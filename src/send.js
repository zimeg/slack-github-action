import fs from "node:fs";
import path from "node:path";
import core from "@actions/core";
import github from "@actions/github";
import flatten from "flat";
import markup from "markup-js";

/**
 * Options of retries for failed requests.
 * @readonly
 * @enum {string} The option for retries.
 */
const Retries = {
  /** No retries, just hope that things go alright.
   * @readonly
   */
  ZERO: "0",
  /**
   * Five retries in five minutes.
   * @readonly
   */
  FIVE: "5",
  /**
   * Ten retries in about thirty minutes.
   * @readonly
   */
  TEN: "10",
  /**
   * A burst of retries to keep things running fast.
   * @readonly
   */
  RAPID: "RAPID",
};

/**
 * @typedef Inputs - Values provided to this job.
 * @property {boolean} errors - If the job should exit after errors or succeed.
 * @property {string?} method - The Slack API method to call.
 * @property {string?} payload - Request contents from the provided input.
 * @property {string?} payloadDelimiter - Seperators of nested attributes.
 * @property {string?} payloadFilePath - Location of a JSON request payload.
 * @property {boolean} payloadFileParsed - If templated values should substitue.
 * @property {string?} proxy - An optional proxied connection for requests.
 * @property {Retries} retries - The retries method to use for failed requests.
 * @property {string?} token - The authentication value used with the Slack API.
 * @property {string?} webhook - A location for posting request payloads.
 */

/**
 * Gather values from the job inputs.
 * @param {core} core - GitHub Actions core utilities.
 * @returns Inputs - values provided to the job.
 */
function getInputs(core) {
  /** @type Inputs */
  const inputs = {
    errors: core.getBooleanInput("errors"),
    method: core.getInput("method"),
    payload: core.getInput("payload"),
    payloadDelimiter: core.getInput("payload-delimiter"),
    payloadFilePath: core.getInput("payload-file-path"),
    payloadFileParsed: core.getBooleanInput("payload-file-parsed") || false,
    proxy: core.getInput("proxy") || process.env.HTTPS_PROXY || null,
    retries: core.getInput("retries") || Retries.FIVE,
    token: core.getInput("token") || process.env.SLACK_TOKEN || "",
    webhook: core.getInput("webhook") || process.env.SLACK_WEBHOOK_URL || "",
  };
  switch (true) {
    case !!inputs.token && !!inputs.webhook:
      core.debug("Setting the provided token and webhook as secret variables.");
      core.setSecret(inputs.token);
      core.setSecret(inputs.webhook);
      throw new SlackError(
        core,
        "Invalid input! Either the token or webhook is required - not both.",
      );
    case !!inputs.token:
      core.debug("Setting the provided token as a secret variable.");
      core.setSecret(inputs.token);
      if (inputs.method) {
        break;
      }
      throw new SlackError(
        core,
        "Missing input! A method must be decided to use the token provided.",
      );
    case !!inputs.webhook:
      core.debug("Setting the provided webhook as a secret variable.");
      core.setSecret(inputs.webhook);
      break;
    default:
      throw new SlackError(
        core,
        "Missing input! Either a token or webhook is required to take action.",
      );
  }
  switch (true) {
    case !!inputs.payload && !!inputs.payloadFilePath:
      throw new SlackError(
        core,
        "Invalid input! Just the payload or payload file path is required.",
      );
    case !!inputs.payload:
      break;
    case !!inputs.payloadFilePath:
      break;
    default:
      break;
  }
  switch (inputs.retries) {
    case Retries.ZERO:
    case Retries.FIVE:
    case Retries.TEN:
    case Retries.RAPID:
      break;
    default:
      core.warning(
        `Invalid input! An unknown 'retries' value was used: ${inputs.retries}`,
      );
  }
  core.debug(`Gathered action inputs: ${JSON.stringify(inputs)}`);
  return inputs;
}

/**
 * @typedef Content - The provided and parsed payload object.
 * @type Record<string, any>
 */

/**
 * Format request content from payload values for use in the request.
 * @param {core} core - GitHub Actions core utilities.
 * @param {Inputs} inputs - values provided to the job.
 * @throws if the input payload or payload file path is invalid JSON.
 * @returns Content - the parsed JSON payload to use in requests.
 */
function getContent(core, inputs) {
  switch (true) {
    case !!inputs.payload:
      try {
        const trimmed = inputs.payload.trim();
        if (!inputs.payload.startsWith("{") && !inputs.payload.endsWith("}")) {
          core.debug("Wrapping input payload in braces to create valid JSON");
          return JSON.parse(`{${trimmed.replace(/,$/, "")}}`);
        }
        return JSON.parse(trimmed);
      } catch (error) {
        if (error instanceof Error) {
          core.debug(error.message);
        }
        throw new SlackError(
          core,
          "Invalid input! Failed to parse the JSON content of the payload",
        );
      }
    case !!inputs.payloadFilePath:
      try {
        core.debug("test");
        const content = fs.readFileSync(
          path.resolve(inputs.payloadFilePath),
          "utf-8",
        );
        if (!inputs.payloadFileParsed) {
          return JSON.parse(content);
        }
        const template = content.replace(/${{/g, "{{");
        const context = {
          env: process.env,
          github: github.context,
        };
        return JSON.parse(markup.up(template, context));
      } catch (error) {
        throw new SlackError(core, error);
      }
    default:
      return github.context;
  }
}

/**
 * Format request content from payload values for use in the request.
 * @param {core} core - GitHub Actions core utilities.
 * @param {Inputs} inputs - values provided to the job.
 * @throws if the input payload or payload file path is invalid JSON.
 * @returns Content - the parsed JSON payload to use in requests.
 */
function createContent(core, inputs) {
  try {
    const content = getContent(core, inputs);
    if (inputs.payloadDelimiter) {
      return flatten(content, { delimiter: inputs.payloadDelimiter });
    }
    core.debug(`Parsed request content: ${JSON.stringify(content)}`);
    return content;
  } catch (error) {
    throw new SlackError(core, error);
  }
}

/**
 * Orchestrate the action job happenings from inputs to logic to outputs.
 * @param {core} core - GitHub Actions core utilities.
 * @throws if an error happens but might not cause the job to fail.
 */
export default async function send(core) {
  const inputs = getInputs(core);
  const content = createContent(core, inputs);
  try {
    switch (true) {
      case !!inputs.token:
        console.log(content);
        break;
      case !!inputs.webhook:
        break;
    }
  } catch (error) {
    throw new SlackError(core, error, inputs.errors);
  }
}

/**
 * SlackError is a custom error wrapper for known errors.
 */
class SlackError extends Error {
  /** @param {core} core - GitHub Actions core utilities.
   * @param {any} error - The error message to throw.
   * @param {boolean} fails - if the exit should be forced.
   */
  constructor(core, error, fails = true) {
    if (error instanceof Error) {
      super(error.message);
    } else {
      super(error);
    }
    this.name = "SlackError";
    if (fails) {
      core.setFailed(error);
    }
  }
}
