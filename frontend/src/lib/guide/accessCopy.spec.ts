import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { ACCESS_ON, START_LIMITS, type AccessGuide } from "./accessCopy";

const all = (g: AccessGuide): string => [g.heading, g.intro, g.rowsHeading, ...g.rows.flatMap((r) => [r.label, r.text]), g.modelsHeading, ...g.models].join("\n");

// REDACTIONS (operator, 22 Oct; limits ALLOWED from 23 Oct, see START_LIMITS: no email, user id, endpoint id, dollar figure, machine name or the helper that starts the models; nothing about who can create an account.
const BANNED = /@|\$|\bwake\b|\bwaker\b|endpoint|runpod|\bgpu\b|\buser id\b|[0-9a-f]{8}-[0-9a-f]{4}|sign-?ups?|create an account|approved|whitelist|allowlist|team member|beta|early access|pilot|restricted|request access|\bflag\b|dollar|cap\b|limit/i;
test("the section is redacted: nothing a reader should not see", () => {
  assert.doesNotMatch(all(ACCESS_ON), BANNED);
});

test("the ON section (R1): the app starts the models for a signed-in screening and shows each load; a second model that does not finish every ingredient shows the first model's result with a warning; a signed-out visitor is never said to be able to send a screening", () => {
  const on = all(ACCESS_ON);
  assert.match(on, /If you send a screening while they are off and your account may start them, the app starts them and shows each model loading/);
  assert.match(on, /Otherwise the page says they are switched off and nothing is scored\./);
  assert.match(on, /This can take several minutes\./);
  assert.match(on, /Nothing is shown as supported until both models have checked it\./);
  assert.match(on, /The second model may not start, or may not complete its check for every ingredient, even when the first model has\. When that happens, the first model's result is shown with a warning, and any ingredient the second model did not check goes to a lawyer and is not shown as supported\./);
  assert.match(on, /Whether you can start the analysis models depends on your account\./);
  assert.doesNotMatch(on, /Every signed-in person|every signed-in account/i, "state-free until any-signed-in is live (R1)");
  assert.match(on, /If the first model does not start, the page says so plainly and no result is shown\. You can try again later\./);
  assert.match(on, /The models can be switched off again after a period without use\./);
  assert.doesNotMatch(on, /model rows|each model while/i, "no claim that rests only on mocked tests (R1, Track A coverage)");
  assert.doesNotMatch(on, /You can send a screening|Nothing is scored until|when nobody needs them|ask your administrator|\balways\b|every ingredient is scored|both models score/i);
  assert.doesNotMatch(on, /\b\d+\s*(s|sec|seconds|min|minutes)\b/i, "no number of seconds or minutes ('several minutes' is the only duration word; the one number in the limits list is not part of this section)");
  assert.deepEqual(ACCESS_ON.rows.map((r) => r.label), ["Without signing in", "Signed in", "Administrator"]);
  assert.equal(ACCESS_ON.rows[0]!.text, "You can read the public pages, watch the three films and use the anonymous demo. To screen your own facts you need to sign in.");
  assert.equal(ACCESS_ON.rows[2]!.text, "An administrator can do everything a signed-in person can, and can invite a person by email.");
});

test("the guide page imports the ON section, and the guide's own step 2 and 'If it seems slow' are R1's d61 words (true in every state: switched off, admin-only, any signed-in)", () => {
  const page = readFileSync(join(__dirname, "..", "..", "app", "guide", "page.tsx"), "utf8");
  assert.match(page, /import \{ ACCESS_ON as ACCESS, START_LIMITS \} from "@\/lib\/guide\/accessCopy";/);
  const copy = readFileSync(join(__dirname, "copy.ts"), "utf8");
  assert.match(copy, /If the analysis models are switched off, the page either starts them and shows progress, or says plainly that they are switched off and nothing was scored\./);
  assert.match(copy, /If the analysis models have to start first, a screening can take several minutes to begin; a later one can be faster\./);
  assert.doesNotMatch(copy, /tries once more|quiet period/);
});

// app d66 (Lead-2, 23 Oct; R1's exact lines): the guide states the limits on starting the models. Only the 6 is a number (the shipped engine setting, "currently"); no dollar figure, no id, no hours, no endpoint or machine name, no invitation limit.
test("START_LIMITS: R1's six lines exactly, one number only, nothing a reader should not see", () => {
  assert.equal(START_LIMITS.heading, "Starting the models: limits");
  assert.deepEqual([...START_LIMITS.items], [
    "Each account can start the analysis models only a limited number of times in any 24 hours (currently 6).",
    "Each model also has a daily limit on starts across all accounts.",
    "Starts stop for the rest of the day once a daily limit on their cost is reached.",
    "Each person can have one start under way at a time.",
    "After a failed start there is a short wait before another is allowed.",
    "After a period without use the models switch off again by themselves, so the first screening after that can wait several minutes.",
  ]);
  const text = [START_LIMITS.heading, ...START_LIMITS.items].join("\n");
  assert.doesNotMatch(text, /@|\$|€|£|dollar|\bUSD\b|\bwake\b|\bwaker\b|endpoint|runpod|\bgpu\b|[0-9a-f]{8}-[0-9a-f]{4}|\b\d{1,2}:\d{2}\b|invit|hours? (of|a day)/i);
  assert.deepEqual([...text.matchAll(/\d+/g)].map((m) => m[0]), ["24", "6"], "24 hours is the window; 6 is the only count");
});
