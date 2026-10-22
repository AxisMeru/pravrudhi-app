import assert from "node:assert/strict";
import test from "node:test";

import { HOME_COPY, HOME_FILMS, HOME_QUICK, HOME_READ_MORE } from "./copy";
import { modelsStateOf } from "./status";

test("the models line follows the engine's judges field: both parked = off, any warming = starting, one ready and one parked = no line, both ready = ready, absent = no line, anything else unreadable", () => {
  assert.equal(modelsStateOf({ judges: { first: "parked", second: "parked" } }), "off");
  assert.equal(modelsStateOf({ judges: { first: "warming", second: "parked" } }), "starting");
  assert.equal(modelsStateOf({ judges: { first: "ready", second: "warming" } }), "starting");
  assert.equal(modelsStateOf({ judges: { first: "ready", second: "parked" } }), "none");
  assert.equal(modelsStateOf({ judges: { first: "parked", second: "ready" } }), "none");
  assert.equal(modelsStateOf({ judges: { first: "ready", second: "ready" } }), "ready");
  assert.equal(modelsStateOf({ engine_version: "0.6.32" }), "none");
  assert.equal(modelsStateOf(null), "unavailable");
  assert.equal(modelsStateOf({ judges: "x" }), "unavailable");
  assert.equal(modelsStateOf({ judges: { first: "?", second: "?" } }), "unavailable");
});

test("the Home words: no figure beyond the three film lengths, none of the barred words, no model or GPU claim, no start-time promise", () => {
  const all = [...Object.values(HOME_COPY), ...HOME_FILMS.flatMap((f) => [f.title, f.line]), ...HOME_READ_MORE.map((l) => l.label), ...HOME_QUICK.map((l) => l.label)].join("\n");
  assert.doesNotMatch(all, /\blive\b|recorded|AI-powered|accurate|verdict[^.]|ranking|the only|best|free trial|sign up|preview|coming soon|GPU|\d/i);
  assert.match(HOME_COPY.standing, /not a verdict/);
  assert.deepEqual(HOME_FILMS.map((f) => f.length), ["6:40", "6:51", "7:33"]);
  assert.doesNotMatch([HOME_COPY.modelsReady, HOME_COPY.modelsStarting, HOME_COPY.modelsOff, HOME_COPY.modelsUnavailable].join(" "), /minute|second|soon|will start/i);
  assert.equal(HOME_COPY.modelsOff, "The analysis models are switched off at the moment.");
});
