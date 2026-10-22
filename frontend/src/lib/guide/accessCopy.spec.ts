import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { ACCESS_ON, type AccessGuide } from "./accessCopy";

const all = (g: AccessGuide): string => [g.heading, g.intro, g.rowsHeading, ...g.rows.flatMap((r) => [r.label, r.text]), g.modelsHeading, ...g.models].join("\n");

// REDACTIONS (operator, 22 Oct): no email, user id, endpoint id, dollar figure, limit, machine name or the helper that starts the models; nothing about who can create an account.
const BANNED = /@|\$|\bwake\b|\bwaker\b|endpoint|runpod|\bgpu\b|\buser id\b|[0-9a-f]{8}-[0-9a-f]{4}|invit|sign-?ups?|create an account|approved|whitelist|allowlist|team member|beta|early access|pilot|restricted|request access|\bflag\b|dollar|cap\b|limit/i;
test("the section is redacted: nothing a reader should not see", () => {
  assert.doesNotMatch(all(ACCESS_ON), BANNED);
});

test("the ON section (R1): the app starts the models for a signed-in screening and shows each load; a second model that does not finish every ingredient shows the first model's result with a warning; a signed-out visitor is never said to be able to send a screening", () => {
  const on = all(ACCESS_ON);
  assert.match(on, /the app starts them and shows each model loading/);
  assert.match(on, /This can take a few minutes\./);
  assert.match(on, /Nothing is shown as supported until both models have checked it\./);
  assert.match(on, /The second model may not start, or may not complete its check for every ingredient, even when the first model has\. When that happens, the first model's result is shown with a warning, and any ingredient the second model did not check goes to a lawyer and is not shown as supported\./);
  assert.match(on, /Every signed-in person can use all of these, including starting the analysis models\./);
  assert.match(on, /If the first model does not start, the page says so plainly and no result is shown\. You can try again in a few minutes\./);
  assert.match(on, /The models can be switched off again after a period without use\./);
  assert.doesNotMatch(on, /nothing is scored|model rows|each model while/i, "no claim that rests only on mocked tests (R1, Track A coverage)");
  assert.doesNotMatch(on, /You can send a screening|Nothing is scored until|when nobody needs them|ask your administrator|\balways\b|every ingredient is scored|both models score/i);
  assert.doesNotMatch(on, /\b\d+\s*(s|sec|seconds|min|minutes)\b/i, "no number of seconds or minutes ('a few minutes' is the only duration word)");
  assert.deepEqual(ACCESS_ON.rows.map((r) => r.label), ["Without signing in", "Signed in", "Administrator"]);
  assert.equal(ACCESS_ON.rows[0]!.text, "You can read the public pages, watch the three films and use the anonymous demo. To screen your own facts you need to sign in.");
  assert.equal(ACCESS_ON.rows[2]!.text, "An administrator can do everything a signed-in person can.");
});

test("the guide page imports the ON section, and the guide's own step 2 and 'If it seems slow' keep their original sentences (true when cold start is on)", () => {
  const page = readFileSync(join(__dirname, "..", "..", "app", "guide", "page.tsx"), "utf8");
  assert.match(page, /import \{ ACCESS_ON as ACCESS \} from "@\/lib\/guide\/accessCopy";/);
  const copy = readFileSync(join(__dirname, "copy.ts"), "utf8");
  assert.match(copy, /The first screening after a quiet period can take a few minutes to start; a later one can be faster\./);
  assert.match(copy, /Choose Screen these facts\. The first screening after a quiet period can take a few minutes to start \(see If it seems slow\)\./);
});
