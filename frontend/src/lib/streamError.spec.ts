import assert from "node:assert/strict";
import test from "node:test";

import { streamErrorText } from "./streamError";

test("streamErrorText: the new shape (error is a code, detail is the text) shows the detail, not the code", () => {
  assert.equal(
    streamErrorText({ type: "error", error: "chat_endpoint_unreachable", detail: "the chat model endpoint is unreachable; retry later" }),
    "the chat model endpoint is unreachable; retry later",
  );
});

test("streamErrorText: the old shape (error is the text, no detail) still shows the text", () => {
  assert.equal(streamErrorText({ type: "error", error: "chat endpoint unreachable" }), "chat endpoint unreachable");
});

test("streamErrorText: a code with a missing, empty or non-string detail falls back to the error field", () => {
  assert.equal(streamErrorText({ type: "error", error: "chat_endpoint_unreachable" }), "chat_endpoint_unreachable");
  assert.equal(streamErrorText({ type: "error", error: "chat_endpoint_unreachable", detail: "  " }), "chat_endpoint_unreachable");
  assert.equal(streamErrorText({ type: "error", error: "chat_endpoint_unreachable", detail: 5 }), "chat_endpoint_unreachable");
});

test("streamErrorText: an event with neither still says something", () => {
  assert.equal(streamErrorText({ type: "error" }), "The chat reply failed.");
  assert.equal(streamErrorText({ type: "error", error: 7, detail: null }), "The chat reply failed.");
});
