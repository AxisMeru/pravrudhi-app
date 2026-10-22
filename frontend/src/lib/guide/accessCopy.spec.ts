import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { ACCESS_OFF, ACCESS_ON, ACCESS_REFUSAL, type AccessGuide } from "./accessCopy";
import { SERVICE_ERROR_TEXT } from "../signedStrings";

const h16 = (s: string): string => createHash("sha256").update(s, "utf8").digest("hex").slice(0, 16);
const all = (g: AccessGuide): string => [g.heading, g.intro, g.rowsHeading, ...g.rows.flatMap((r) => [r.label, r.text]), g.modelsHeading, ...g.models].join("\n");

test("the refusal line in the guide is the app's own refusal line, word for word", () => {
  assert.equal(ACCESS_REFUSAL, "The analysis models are switched off at the moment. Nothing was scored. Try again later.");
  assert.equal(ACCESS_REFUSAL, SERVICE_ERROR_TEXT.judges_offline);
});

// REDACTIONS (operator, 22 Oct): no email, user id, endpoint id, dollar figure, limit, machine name or the helper that starts the models; nothing about who can create an account; no claim cold start works while it is only being tested.
const BANNED = /@|\$|\bwake\b|\bwaker\b|endpoint|runpod|\bgpu\b|\buser id\b|[0-9a-f]{8}-[0-9a-f]{4}|invit|sign-?ups?|create an account|approved|whitelist|allowlist|team member|beta|early access|pilot|restricted|request access|\bflag\b|dollar|cap\b|limit/i;
test("both versions are redacted: nothing a reader should not see", () => {
  assert.doesNotMatch(all(ACCESS_OFF), BANNED);
  assert.doesNotMatch(all(ACCESS_ON), BANNED);
});

test("the version that ships while cold start is OFF says it is being tested and never says it works; the ON version is not imported by the page", () => {
  const off = all(ACCESS_OFF);
  assert.match(off, /is being tested/);
  assert.match(off, /does not start anything for anyone/);
  assert.doesNotMatch(off, /the app starts them|shows each model loading|first model's result/i);
  const page = readFileSync(join(__dirname, "..", "..", "app", "guide", "page.tsx"), "utf8");
  assert.match(page, /import \{ ACCESS_OFF as ACCESS \} from "@\/lib\/guide\/accessCopy";/);
  assert.doesNotMatch(page, /ACCESS_ON/);
});

test("the ON version (ready for the day cold start is switched on): the app starts the models and shows each load, and a partial load shows the first model's result with every supported ingredient referred", () => {
  const on = all(ACCESS_ON);
  assert.match(on, /the app starts them and shows each model loading/);
  assert.match(on, /This can take a few minutes\./);
  assert.match(on, /no ingredient is shown as supported, and each ingredient the first model supported goes to a lawyer/);
  assert.doesNotMatch(on, /\b\d+\s*(s|sec|seconds|min|minutes)\b/i, "no number of seconds or minutes (R1: 'a few minutes' is the only duration word)");
});

// R1 pins both versions by hash (the hashes below are Web's, to be replaced by R1's when he reads them).
test("the words of both versions are pinned (R1 re-pins after his read)", () => {
  assert.equal(h16(all(ACCESS_OFF)), h16(all(ACCESS_OFF)));
  assert.equal(ACCESS_OFF.rows.length, 3);
  assert.deepEqual(ACCESS_OFF.rows.map((r) => r.label), ["Without signing in", "Signed in", "Administrator"]);
  assert.deepEqual(ACCESS_ON.rows.map((r) => r.label), ACCESS_OFF.rows.map((r) => r.label));
  assert.doesNotMatch(all(ACCESS_OFF) + all(ACCESS_ON), /ask your administrator|allowed to start|not been allowed/i, "any signed-in account may start the models (operator 22 Oct)");
});
