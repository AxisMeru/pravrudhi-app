import assert from "node:assert/strict";
import test from "node:test";

import { streamErrorText } from "./streamError";

test("streamErrorText: the new shape (error is a code, detail is the text): a signed code shows its signed wording, another code shows the detail", () => {
  assert.equal(
    streamErrorText({ type: "error", error: "chat_endpoint_unreachable", detail: "the chat model endpoint is unreachable; retry later" }),
    "The chat service could not be reached, so the reply could not be completed. Try again later.",
  );
  assert.equal(streamErrorText({ type: "error", error: "some_future_code", detail: "a fixed message" }), "a fixed message");
});

test("streamErrorText: the old shape (error is the text, no detail) still shows the text", () => {
  assert.equal(streamErrorText({ type: "error", error: "chat endpoint unreachable" }), "chat endpoint unreachable");
});

test("streamErrorText: a code with a missing, empty or non-string detail falls back to the error field", () => {
  assert.equal(streamErrorText({ type: "error", error: "some_future_code" }), "some_future_code");
  assert.equal(streamErrorText({ type: "error", error: "some_future_code", detail: "  " }), "some_future_code");
  assert.equal(streamErrorText({ type: "error", error: "some_future_code", detail: 5 }), "some_future_code");
});

test("streamErrorText: an event with neither still says something", () => {
  assert.equal(streamErrorText({ type: "error" }), "The chat reply failed.");
  assert.equal(streamErrorText({ type: "error", error: 7, detail: null }), "The chat reply failed.");
});
