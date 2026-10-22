import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { MAGIC_LINK_ERROR, sendMagicLink } from "./auth";
import { SIGNIN_COPY } from "./signinCopy";

const h16 = (s: string): string => createHash("sha256").update(s, "utf8").digest("hex").slice(0, 16);

// R1 (22 Oct, SIGNIN_SIGNUPS_OFF_R1): the four lines by hash.
test("the /signin lines are R1's, by hash", () => {
  assert.equal(h16(SIGNIN_COPY.noNewAccounts), "72fb2305a8ada807");
  assert.equal(h16(SIGNIN_COPY.getAccess), "b5cdd717fb40a941");
  assert.equal(h16(SIGNIN_COPY.linkSent), "03d2a0dc38199104");
  assert.equal(h16(SIGNIN_COPY.linkEmptyEmail), "211990c508c815fd");
  assert.doesNotMatch(Object.values(SIGNIN_COPY).join(" "), /invit|approved|beta|@|\d/i);
});

test("the sign-in page has ONE mode: no sign-up state, no Create an account / Create account / Creating account / sign-up message can render", () => {
  const src = readFileSync(join(__dirname, "..", "app", "signin", "page.tsx"), "utf8");
  assert.doesNotMatch(src, /isSignUp|supabaseSignUp|Create an account|Create account|Creating account|Sign up failed|confirmation link|Don't have an account|Already have an account|new-password/);
  assert.match(src, /\{SIGNIN_COPY\.noNewAccounts\} \{SIGNIN_COPY\.getAccess\}/);
  assert.match(src, /setConfirmationMessage\(SIGNIN_COPY\.linkSent\)/);
  assert.doesNotMatch(src, /on its way to \$\{email\}/, "the old line that named the address is gone");
});

function stubFetch(status: number | "throw", body: unknown = {}): { calls: Array<{ url: string; body: string }> } {
  const calls: Array<{ url: string; body: string }> = [];
  (globalThis as { fetch: unknown }).fetch = async (url: string, init: { body: string }) => {
    calls.push({ url, body: init.body });
    if (status === "throw") throw new Error("raw network text");
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  };
  return { calls };
}

test("sendMagicLink: existing accounts only (create_user false); a refusal for an unknown address is the same ok as a sent link; only a rate limit, a server error or a network failure is an error, in OUR words", async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:3000";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-key";
  const sent = stubFetch(200);
  assert.deepEqual(await sendMagicLink("a@example.invalid"), { ok: true });
  assert.equal(JSON.parse(sent.calls[0].body).create_user, false);
  stubFetch(422, { error_description: "Signups not allowed for otp" });
  assert.deepEqual(await sendMagicLink("unknown@example.invalid"), { ok: true });
  stubFetch(400, { msg: "raw provider words" });
  assert.deepEqual(await sendMagicLink("x@example.invalid"), { ok: true });
  for (const st of [429, 500, 503] as const) {
    stubFetch(st, { msg: "raw provider words" });
    assert.deepEqual(await sendMagicLink("x@example.invalid"), { ok: false, error: MAGIC_LINK_ERROR });
  }
  stubFetch("throw");
  assert.deepEqual(await sendMagicLink("x@example.invalid"), { ok: false, error: MAGIC_LINK_ERROR });
});
