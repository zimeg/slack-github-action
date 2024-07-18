import fs from "node:fs";
import path from "node:path";
import core from "@actions/core";
import { assert } from "chai";
import sinon from "sinon";
import send from "./send.js";

describe("send", () => {
  const fakeCore = sinon.stub(core);
  const fakeFs = sinon.stub(fs);

  beforeEach(() => {
    sinon.reset();

    /**
     * Set default values found in the action.yml file
     */
    fakeCore.getInput.withArgs("errors").returns("false");
    fakeCore.getInput.withArgs("retries").returns("5");
  });

  describe("token", () => {
    it("requires a token is provided in inputs", async () => {
      try {
        await send(fakeCore);
        assert.fail("Failed to throw for missing input");
      } catch {
        assert.include(
          fakeCore.setFailed.lastCall.firstArg,
          "Missing input! Either a token or webhook is required to take action.",
        );
      }
    });

    it("requires a method is provided in inputs", async () => {
      fakeCore.getInput.withArgs("token").returns("xoxb-example-001");
      try {
        await send(fakeCore);
        assert.fail("Failed to throw for missing input");
      } catch {
        assert.include(
          fakeCore.setFailed.lastCall.firstArg,
          "Missing input! A method must be decided to use the token provided.",
        );
      }
    });

    it("errors if both a webhook and token are provided", async () => {
      fakeCore.getInput.withArgs("token").returns("xoxb-example-001");
      fakeCore.getInput.withArgs("webhook").returns("https://slack.com");
      try {
        await send(fakeCore);
        assert.fail("Failed to throw for invalid input");
      } catch {
        assert.include(
          fakeCore.setFailed.lastCall.firstArg,
          "Invalid input! Either the token or webhook is required - not both.",
        );
      }
    });

    it("treats the provided token as a secret", async () => {
      fakeCore.getInput.withArgs("token").returns("xoxb-example-001");
      try {
        await send(fakeCore);
      } catch {
        assert.isTrue(fakeCore.setSecret.withArgs("xoxb-example-001").called);
      }
    });

    it("calls the method with the provided token and content", async () => {
      fakeCore.getInput.withArgs("token").returns("xoxb-example-001");
      fakeCore.getInput.withArgs("method").returns("chat.postMessage");
      fakeCore.getInput.withArgs("payload").returns(`"message": "hello"`);

      await send(fakeCore);

      // assert.include(fakeCore.setFailed.lastCall.firstArg, "test");
    });
  });

  describe("webhook", () => {
    it("requires a webhook is provided in inputs", async () => {
      try {
        await send(fakeCore);
        assert.fail("Failed to throw for missing input");
      } catch {
        assert.include(
          fakeCore.setFailed.lastCall.firstArg,
          "Missing input! Either a token or webhook is required to take action.",
        );
      }
    });

    it("treats the provided webhook as a secret", async () => {
      fakeCore.getInput.withArgs("webhook").returns("https://slack.com");
      try {
        await send(fakeCore);
      } catch {
        assert.isTrue(fakeCore.setSecret.withArgs("https://slack.com").called);
      }
    });
  });

  describe("content", () => {
    //
    // TODO: can the webhook part be beforeEach?

    it("errors if both a payload and file path are provided", async () => {
      fakeCore.getInput.withArgs("webhook").returns("https://slack.com");
      fakeCore.getInput.withArgs("payload").returns(`"message"="hello"`);
      fakeCore.getInput.withArgs("payload-file-path").returns("example.json");
      try {
        await send(fakeCore);
        assert.fail("Failed to throw for invalid input");
      } catch {
        assert.include(
          fakeCore.setFailed.lastCall.firstArg,
          "Invalid input! Just the payload or payload file path is required.",
        );
      }
    });

    it("wraps incomplete payload in braces for valid JSON", async () => {
      fakeCore.getInput.withArgs("webhook").returns("https://slack.com");
      fakeCore.getInput.withArgs("payload").returns(`
        "message": "greetings",
        "channel": "C0123456789",
      `);
      await send(fakeCore);
      //
      // TODO
      //
    });

    it("fails if the provided input payload is invalid JSON", async () => {
      fakeCore.getInput.withArgs("webhook").returns("https://slack.com");
      fakeCore.getInput.withArgs("payload").returns("{");
      try {
        await send(fakeCore);
        assert.fail("Failed to throw for invalid JSON");
      } catch {
        console.log(fakeCore.setFailed.lastCall.firstArg.toString());
        console.log(fakeCore.setFailed.lastCall.firstArg.toString());
        console.log(fakeCore.setFailed.lastCall.firstArg.toString());
        assert.include(
          fakeCore.setFailed.lastCall.firstArg.toString(),
          "Invalid input! Failed to parse the JSON content of the payload",
        );
      }
    });

    it("continues without adjusting valid input payload JSON", async () => {
      fakeCore.getInput.withArgs("webhook").returns("https://slack.com");
      fakeCore.getInput.withArgs("payload").returns(`{
        "message": "greetings",
        "channel": "C0123456789"
      }`);
      await send(fakeCore);
      //
      // TODO
      //
    });

    it("parses JSON from a known file without replacements", async () => {
      fakeCore.getInput.withArgs("webhook").returns("https://slack.com");
      fakeCore.getInput.withArgs("payload-file-path").returns("package.json");
      await send(fakeCore);
      //
      // TODO
      //
    });

    it("fails to parse a file that does not exist", async () => {
      fakeCore.getInput.withArgs("webhook").returns("https://slack.com");
      fakeCore.getInput.withArgs("payload-file-path").returns("unknown.json");
      try {
        await send(fakeCore);
        assert.fail("Failed to throw for nonexistent files");
      } catch {
        assert.include(
          fakeCore.setFailed.lastCall.firstArg.toString(),
          "ENOENT",
        );
      }
    });

    it("replaces templated variables in the payload file", async () => {
      fakeCore.getInput.withArgs("webhook").returns("https://slack.com");
      fakeCore.getInput.withArgs("payload-file-path").returns("example.json");
      fakeCore.getInput.withArgs("payload-file-parsed").returns("true");
      fakeFs.readFileSync
        .withArgs(path.resolve("example.json"), "utf-8")
        .returns("asdf");

      // TODO
      console.log(fakeCore.debug.getCalls());
      console.log(fakeCore.debug.getCalls());
      assert.isTrue(
        fakeFs.readFileSync.calledWith(path.resolve("example.json"), "utf-8"),
      );
    });

    it("flattens nested payloads if a delimiter is provided", async () => {
      fakeCore.getInput.withArgs("webhook").returns("https://slack.com");
      fakeCore.getInput.withArgs("payload").returns("package.json");
      fakeCore.getInput.withArgs("payload-delimiter").returns("_");

      // TODO
    });
  });

  describe("errors", () => {
    // TODO: check that true is default (see all of the above tests with setFailed)
    // TODO: check that "false" works
    // TODO: check that "true" still is true
    // TODO: docs: note that the output ok=false will happen for continued failed requests
    //    ^ also test this. it is a workaround for the default=true logic
    it("..", async () => {
      fakeCore.getInput.withArgs("payload").returns(`"message": "hello"`);
      // await send(fakeCore);
      // assert.include(fakeCore.setFailed.lastCall.firstArg, "test");
    });
  });

  describe("retries", () => {
    it("warns if an invalid retries option is provided", async () => {
      fakeCore.getInput.withArgs("webhook").returns("https://slack.com");
      fakeCore.getInput.withArgs("retries").returns("FOREVER");
      await send(fakeCore);
      assert.isTrue(
        fakeCore.warning.calledWith(
          "Invalid input! An unknown 'retries' value was used: FOREVER",
        ),
      );
    });
  });
});
