import core from "@actions/core";
import send from "./send.js";

/**
 * Invoke the Slack GitHub Action job from this file but export actual logic
 * from another file for testing purposes.
 */
try {
  send(core);
} catch (error) {
  if (error instanceof Error) {
    core.error(error.message);
    core.debug(`${error.name} stack: ${error.stack}`);
  } else {
    core.error(`${error}`);
  }
}
