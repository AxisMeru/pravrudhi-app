import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { ACCESS_OFF, ACCESS_REFUSAL, type AccessGuide } from "./accessCopy";
import { SERVICE_ERROR_TEXT } from "../signedStrings";

const all = (g: AccessGuide): string => [g.heading, g.intro, g.rowsHeading, ...g.rows.flatMap((r) => [r.label, r.text]), g.modelsHeading, ...g.models].join("\n");

test("the refusal line in the guide is the app's own refusal line, word for word", () => {
  assert.equal(ACCESS_REFUSAL, "The analysis models are switched off at the moment. Nothing was scored. Try again later.");
  assert.equal(ACCESS_REFUSAL, SERVICE_ERROR_TEXT.judges_offline);
});

// REDACTIONS (operator, 22 Oct): no email, user id, endpoint id, dollar figure, limit, machine name or the helper that starts the models; nothing about who can create an account; no claim cold start works while it is only being tested.
const BANNED = /@|\$|\bwake\b|\bwaker\b|endpoint|runpod|\bgpu\b|\buser id\b|[0-9a-f]{8}-[0-9a-f]{4}|invit|sign-?ups?|create an account|approved|whitelist|allowlist|team member|beta|early access|pilot|restricted|request access|\bflag\b|dollar|cap\b|limit/i;
test("the section is redacted: nothing a reader should not see", () => {
  assert.doesNotMatch(all(ACCESS_OFF), BANNED);
});

test("while cold start is OFF the section says it is being tested, refuses only for a signed-in account, and promises nothing about who can start the models (R1, R2 22 Oct)", () => {
  const off = all(ACCESS_OFF);
  assert.match(off, /is being tested/);
  assert.match(off, /it does not start anything/);
  assert.match(off, /a screening from a signed-in account is refused at once/);
  assert.doesNotMatch(off, /the app starts them|shows each model loading|first model's result/i);
  assert.doesNotMatch(off, /Every signed-in person|ask your administrator|allowed to start|not been allowed/i);
  assert.doesNotMatch(off, /You can send a screening/, "a signed-out visitor cannot send a screening (R2 BLOCK)");
  assert.doesNotMatch(off, /administrator screens|everything, including/i);
  const page = readFileSync(join(__dirname, "..", "..", "app", "guide", "page.tsx"), "utf8");
  assert.match(page, /import \{ ACCESS_OFF as ACCESS \} from "@\/lib\/guide\/accessCopy";/);
  assert.doesNotMatch(page, /ACCESS_ON/);
});

test("the structure: three rows, in this order", () => {
  assert.deepEqual(ACCESS_OFF.rows.map((r) => r.label), ["Without signing in", "Signed in", "Administrator"]);
  assert.equal(ACCESS_OFF.rows[0]!.text, "You can read the public pages, watch the three films and use the anonymous demo. To screen your own facts you need to sign in.");
  assert.equal(ACCESS_OFF.rows[2]!.text, "An administrator can do everything a signed-in person can.");
});
