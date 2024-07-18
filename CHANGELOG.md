# v2

TODO:

- [ ] gather secret inputs from environment variables as fallback
- [ ] proxy attribute

- [ ] Breaking notes: the default `payload` is changed from `github.context.payload` to `github.context`

## notes

[action.yml]: https://docs.github.com/en/actions/creating-actions/metadata-syntax-for-github-actions#name

---

Proposal: Changes for `@v2`

👋 Hello fellow GitHub Action actioneers and workflow builders! This issue is meant for us **all** to discuss potential changes for a `v2` of this action. We've had [some pain points](https://github.com/slackapi/slack-github-action/issues/221) on `v1` for a while that make using this action more complicated than it should be and are hoping that a few breaking changes can improve a lot of this.

Your ideas, thoughts, feedback, suggestions, comments, and hopes are all welcomed here and we're hoping to solidify plans for what this next version will have over the next month.

## Proposed changes and the feature set

This current action is focused on sending messages to a channel - either via bot token or incoming webhook - or invoking a workflow in Slack using a webhook trigger. These methods are solid and will continue to be supported, but with changes to how the action is setup.

### Calling API methods

Requests to the [web API methods](https://api.slack.com/methods) **as a top-level parameter** provides a few more options than sending a message to either channel or thread. Message sending will still work, but the method could be swapped for another one:

```yaml
- name: Post a message to this channel
  uses: slackapi/slack-github-action@v2
  with:
    method: chat.postMessage
    payload: |
      "channel": "C0123456789",
      "text": "howdy <@channel>!"
    token: ${{ secrets.SLACK_BOT_TOKEN }}
```

This action uses the [`@slack/web-api`](https://github.com/slackapi/node-slack-sdk/tree/main/packages/web-api) package behind-the-scenes and will support all of the same web API methods!

Method arguments are also moved to be top-level values of the `payload` for ease of use. This is the same `payload` that'll be passed to the `method`, so must still be valid JSON. However, we can do magic in code to wrap this value in braces and could even remove an extra trailing comma before parsing it as JSON.

Note: Additional magic can be included to continue support for a complete JSON `payload` for ease of using outputs from previous jobs as the `payload`.

Related issues: #41, #216, #268, #269

#### File uploads

Calling web API methods with `@slack/web-api` makes uploading files just another API call, but with all of the advantages of `files.uploadV2`:

```yaml
- name: Share a file to that channel
  uses: slackapi/slack-github-action@v2
  with:
    method: files.uploadV2
    payload: |
      "channel_id": "C0123456789",
      "initial_comment": "the results are in!",
      "file": "results.out",
      "filename": "results-${{ github.sha }}.out"
    token: ${{ secrets.SLACK_BOT_TOKEN }}
```

Related issues: #92

### Sending incoming webhooks

A `payload` will continue to be POSTed to an incoming `webhook` if a generated URL is provided:

```yaml
- name: Send a message via incoming webhook
  uses: slackapi/slack-github-action@v2
  with:
    payload: |
      "text": "thanks <@USLACKBOT> :heart:",
      "blocks": [
    	{
          "type": "section",
          "text": {
            "type": "mrkdwn",
            "text": "thanks <@USLACKBOT> :heart:"
          }
        }
      ]
    webhook: ${{ secrets.SLACK_WEBHOOK_URL }}
```

The included `payload` or `payload-file-path` have identical parsing behaviors as the `method`.

Related issues: #39

### Sending to Workflow Builder

The same `webhook` input parameter will POST to Workflow Builder without change, but a `payload-delimiter` input parameter can be added to customize flattening behavior:

```yaml
- name: Send a message via incoming webhook
  uses: slackapi/slack-github-action@v2
  with:
    payload-delimiter: "_"
    payload-file-path: "drinks.json"
    webhook: ${{ secrets.SLACK_WEBHOOK_URL }}
```

No flattening will happen unless the `payload-delimiter` parameter is provided - no defaults. This parameter can be used as input for all methods and webhooks, but is recommended here for support in Workflow Builder.

For reference, this flattening will convert nested JSON of the `payload` or `payload-file-path`:

```json
{
  "drinks": {
    "coffee": 4,
    "water": 12
  }
}
```

```json
{
  "drinks_coffee": 4,
  "drinks_water": 12
}
```

Related issues: #280

## Additional breakages

Beyond the above changes to input shapes, some behaviors will be updated that might require updates to existing workflows:

### Erroring on failed requests

Some workflows might depend on this action to complete with success. Others might not care and would rather continue to the next step regardless of how this action completes.

You can make this choice with an `errors` input parameter set to `true` because the default is `false`:

```yaml
- name: Attempt to inverse a message
  uses: slackapi/slack-github-action@v2
  with:
    errors: true
    method: chat.reverse
    payload: |
      "message": "tacocat"
    token: ${{ secrets.SLACK_USER_TOKEN }}
```

This example job will fail because of the `method`, but an invalid `token` or failed `retries` are other reasons to fail. Invalid inputs, such as a broken `payload` or a missing `method`, will continue to always fail, regardless of the `errors` value.

Related issues: #9, #10, #63

### Retries for failed API calls

Perhaps a failed request - for rate limiting reasons or whatever - is alright and you want to continue the workflow. Or fail the workflow right away. Or configure how retries wait.

A `retries` input parameter with a few enumerated values is proposed for both web API requests and webhook POSTs:

- `0`: No retries, just hope that things go alright.
- `5`: Five retries in five minutes. **Changed to default**.
- `10`: Ten retries in about thirty minutes.
- `RAPID`: A burst of retries to keep things running fast.

These values mirror [options in `@slack/web-api`](https://slack.dev/node-slack-sdk/web-api#automatic-retries) and can be mimicked for `axios` POST requests that need another attempt.

Related issues: #245, #292

### Preference for input parameters

Both the `token` and `webhook` URL are recommended as input parameters using the `with` attribute. Just one of these must be provided and this action will exit with error otherwise, regardless of configured exit behaviors.

Either of these can still be provided as the updated `SLACK_TOKEN` or current `SLACK_WEBHOOK_URL` environment variables.

All of the same applies to a `proxy` input parameter or an `HTTPS_PROXY` environment variable.

Related issues: #219, #221

### Parsing payload file values

The templated variable replacements happening for strings in a `.github/workflows/action.yml` file - such as the `payload` input parameter - is [difficult to match](https://github.com/slackapi/slack-github-action/issues/203#issuecomment-2038256707) from within the action code. This has caused some confusion with `???` replacements for missing variables in a JSON payload file.

With the introduction of `method` it's assumed that payload files will contain the entire payload already, either existing in the repository or generated from another job.

To improve usage with this assumption, **`payload-file-path` will not be parsed by default**. This file will be used as is when provided as the `payload-file-path`. Parsing this file with the included action [`context`](https://github.com/slackapi/slack-github-action/blob/0b62a9eeebeb785d66141eafba2b9575bf96522e/src/slack-send.js#L45-L47) remains an option through setting the value of `payload-file-path-parsed` to `true`.

```yaml
- name: Update the application manifest
  uses: slackapi/slack-github-action@v2
  with:
    method: apps.manifest.update
    payload-file-path: "./manifest-payload.json"
    payload-file-path-parsed: false # Default
    token: ${{ secrets.SLACK_APP_CONFIGURATION_TOKEN }}
```

Note: This file is still expected to be complete, valid JSON as is. No magic will happen here.

Related issues: #203, #226

## Output parameters

This current action returns the following step outputs upon success:

- `time`: The date of completion as `(new Date()).toTimeString()`.
- `thread_ts`: The timestamp of the top threaded message. Requires `method`.
- `ts`: The timestamp of the posted message. Requires a `method`.
- `channel_id`: The channel ID of the posted message. Requires a `method`.

These are solid parameters for chaining multiple messages and no change is made to the parameters that require `method` when the `method` used returns these values. `time` should perhaps be changed to the epoch `new Date().valueOf()` too.

Additional output parameters are added to `method` requests for optional use in following steps:

- `ok`: If the request completed without errors.
- `response`: The stringified JSON response from the API.

---

## But that's just a plan

If you're using this action or have read this far, cooool, your thoughts on these changes or suggestions for others and all else are most encouraged! All that's above is a proposed plan that can be adjusted. This is a heartened request for feedback 💌
