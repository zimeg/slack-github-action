# Example workflow: manage collaborators

This workflow adds or removes an app collaborator using a manually triggered workflow.

This example combines the Slack API technique (`users.lookupByEmail`, `chat.postMessage`) with the CLI technique (`collaborators add/remove`) to look up a user by email, update collaborators, and post a confirmation message.

## Files

### GitHub Actions workflow

```js reference
https://github.com/slackapi/slack-github-action/blob/main/example-workflows/Technique_4_Slack_CLI_Command/collaborators.yml
```
