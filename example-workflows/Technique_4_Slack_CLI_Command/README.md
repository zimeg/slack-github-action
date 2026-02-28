# Technique 4: Slack CLI Command

A [service token](/authentication/tokens/#service) is used to install and run [Slack CLI](/tools/slack-cli/) commands directly from a GitHub Actions workflow with this technique.

## Setup

For details on how to setup this technique in GitHub Actions, read the [setup](/tools/slack-github-action/sending-techniques/running-slack-cli-commands/) section of the docs.

## Example workflows

1. [**Deploy an app**](#deploy-an-app): Deploy to Slack on push to the main branch.
2. [**Validate the app manifest**](#validate-the-app-manifest): Check the app manifest on pull requests.
3. [**Manage a collaborator**](#manage-a-collaborator): Add or remove an app collaborator using CLI and API techniques together.

### Deploy an app

Deploy a Slack app when changes are pushed to the main branch. This example uses a service token to authenticate the deploy command.

**Related files**:

- [`deploy.yml`](./deploy.yml): GitHub Actions workflow.

### Validate the app manifest

Run manifest validation on pull requests to catch configuration issues early. This example checks the app manifest file in the repository.

**Related files**:

- [`manifest.yml`](./manifest.yml): GitHub Actions workflow.

### Manage a collaborator

Add or remove an app collaborator using a manually triggered workflow. This example combines the Slack API technique (`users.lookupByEmail`, `chat.postMessage`) with the CLI technique (`collaborators add/remove`) to look up a user by email, update collaborators, and post a confirmation message.

**Related files**:

- [`collaborators.yml`](./collaborators.yml): GitHub Actions workflow.
