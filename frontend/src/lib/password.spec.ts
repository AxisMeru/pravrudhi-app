import { strict as assert } from "node:assert";
import test from "node:test";

import { clearSession, completeMagicLink, setSession } from "./auth";
import { FAILURE_TEXT, PASSWORD_COPY, PROBLEM_TEXT } from "./passwordCopy";
import { MIN_PASSWORD_LENGTH, checkNewPassword, requestPasswordReset, setPassword } from "./password";

// app d65 (Lead-2: "the user should be able to set and change the password"). Tests first: the pure checks, the two Supabase calls and the invite/recovery arrival.
const SECRET = "correct horse battery staple 1";
const calls: Array<{ url: string; method: string; headers: Record<string, string>; body: string }> = [];
let answer: { status: number; json?: unknown } = { status: 200, json: {} };

function setup(hash = "") {
  calls.length = 0;
  answer = { status: 200, json: {} };
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.invalid";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  const store: Record<string, string> = {};
  global.localStorage = { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = v; }, removeItem: (k) => { delete store[k]; }, clear: () => undefined, length: 0, key: () => null } as Storage;
  (global as unknown as { window: unknown }).window = { location: { hash, origin: "https://app.example.invalid", pathname: "/signin" }, history: { replaceState: () => undefined } };
  global.fetch = (async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), method: init?.method ?? "GET", headers: (init?.headers ?? {}) as Record<string, string>, body: String(init?.body ?? "") });
    return new Response(JSON.stringify(answer.json ?? {}), { status: answer.status, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  clearSession();
}

test("the minimum is 8 characters and the checks name the first problem only", () => {
  assert.equal(MIN_PASSWORD_LENGTH, 8);
  assert.equal(checkNewPassword("short", "short"), "too_short");
  assert.equal(checkNewPassword("", ""), "too_short");
  assert.equal(checkNewPassword("longenough1", "longenough2"), "mismatch");
  assert.equal(checkNewPassword("longenough1", "longenough1"), null);
  assert.equal(checkNewPassword("a".repeat(8), "a".repeat(8)), null);
  assert.equal(checkNewPassword("a".repeat(7), "a".repeat(7)), "too_short");
});

test("setPassword PUTs {password} to /auth/v1/user with the session token and the publishable key, and the password is in no URL", async () => {
  setup();
  setSession("tok-1", { id: "00000000-0000-4000-8000-000000000001", email: "someone@example.invalid" });
  const r = await setPassword(SECRET);
  assert.deepEqual(r, { ok: true });
  assert.equal(calls.length, 1);
  const c = calls[0]!;
  assert.equal(c.method, "PUT");
  assert.equal(c.url, "https://example.supabase.invalid/auth/v1/user");
  assert.ok(!c.url.includes(SECRET));
  assert.equal(JSON.parse(c.body).password, SECRET);
  assert.equal(c.headers.authorization, "Bearer tok-1");
  assert.equal(c.headers.apikey, "anon-key");
});

test("setPassword never stores the password: not in the saved session, not in storage", async () => {
  setup();
  setSession("tok-1", { id: "00000000-0000-4000-8000-000000000001", email: "someone@example.invalid" });
  await setPassword(SECRET);
  const all = JSON.stringify(Object.values((global.localStorage as unknown as { getItem: (k: string) => string | null }).getItem("pravrudhi-auth-session") ?? ""));
  assert.ok(!all.includes(SECRET));
});

test("setPassword without a session sends nothing and says the session is gone", async () => {
  setup();
  assert.deepEqual(await setPassword(SECRET), { ok: false, reason: "session" });
  assert.equal(calls.length, 0);
});

test("setPassword maps Supabase's refusals to our own reasons, never its words", async () => {
  setup();
  setSession("tok-1", { id: "00000000-0000-4000-8000-000000000001", email: "someone@example.invalid" });
  const cases: Array<[number, unknown, string]> = [
    [401, { msg: "invalid JWT" }, "session"],
    [403, { msg: "forbidden" }, "session"],
    [422, { error_code: "same_password", msg: "New password should be different from the old password." }, "same"],
    [422, { error_code: "weak_password", msg: "Password should contain letters" }, "weak"],
    [400, { error_code: "reauthentication_needed", msg: "Password update requires reauthentication" }, "reauth"],
    [422, { error_code: "reauthentication_needed", msg: "Password update requires reauthentication" }, "reauth"],
    [429, { msg: "rate" }, "unavailable"],
    [500, {}, "unavailable"],
  ];
  for (const [status, json, reason] of cases) {
    answer = { status, json };
    assert.deepEqual(await setPassword(SECRET), { ok: false, reason }, `${status} ${JSON.stringify(json)}`);
  }
});

test("setPassword: a dropped connection is 'unavailable', and the password is not in the error", async () => {
  setup();
  setSession("tok-1", { id: "00000000-0000-4000-8000-000000000001", email: "someone@example.invalid" });
  global.fetch = (async () => { throw new Error(`boom ${SECRET}`); }) as typeof fetch;
  const r = await setPassword(SECRET);
  assert.deepEqual(r, { ok: false, reason: "unavailable" });
  assert.ok(!JSON.stringify(r).includes(SECRET));
});

test("requestPasswordReset POSTs the email to /auth/v1/recover with redirect_to <origin>/signin", async () => {
  setup();
  const r = await requestPasswordReset("someone@example.invalid");
  assert.deepEqual(r, { ok: true });
  const c = calls[0]!;
  assert.equal(c.method, "POST");
  assert.equal(c.url, "https://example.supabase.invalid/auth/v1/recover?redirect_to=" + encodeURIComponent("https://app.example.invalid/signin"));
  assert.deepEqual(JSON.parse(c.body), { email: "someone@example.invalid" });
  assert.equal(c.headers.apikey, "anon-key");
});

test("requestPasswordReset gives the SAME answer for an unknown address (any 4xx, a rate limit included: it only happens for a real address), so the page cannot enumerate accounts", async () => {
  setup();
  for (const status of [200, 400, 404, 422, 429]) {
    answer = { status, json: { msg: "User not found" } };
    assert.deepEqual(await requestPasswordReset("nobody@example.invalid"), { ok: true }, String(status));
  }
});

test("requestPasswordReset: every HTTP answer, a rate limit and a server error included, is the same ok; only a dropped connection is the one generic failure", async () => {
  setup();
  for (const status of [200, 400, 404, 422, 429, 500, 503]) {
    answer = { status, json: {} };
    assert.deepEqual(await requestPasswordReset("someone@example.invalid"), { ok: true }, String(status));
  }
  global.fetch = (async () => { throw new Error("down"); }) as typeof fetch;
  assert.deepEqual(await requestPasswordReset("someone@example.invalid"), { ok: false, error: "Could not send the link. Try again later." });
});

test("a fragment error is never shown in the provider's words: an expired or used link gets our line, and the fragment is removed at once", async () => {
  setup("#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired");
  const replaced: string[] = [];
  (global as unknown as { window: { history: { replaceState: (a: unknown, b: string, c: string) => void } } }).window.history.replaceState = (_a, _b, c) => { replaced.push(c); };
  const r = await completeMagicLink();
  assert.deepEqual(r, { ok: false, error: PASSWORD_COPY.expired });
  assert.deepEqual(replaced, ["/signin"]);
  assert.equal(calls.length, 0);
});

test("an invite or recovery arrival is told apart by the fragment's type; a magic link and a bare token are not", async () => {
  for (const [type, kind] of [["invite", "invite"], ["recovery", "recovery"], ["magiclink", "magiclink"], [undefined, "magiclink"]] as const) {
    setup(`#access_token=tok-x&refresh_token=ref-x&expires_in=3600${type ? `&type=${type}` : ""}`);
    answer = { status: 200, json: { id: "00000000-0000-4000-8000-000000000001", email: "someone@example.invalid" } };
    const r = await completeMagicLink();
    assert.ok(r && r.ok, String(type));
    assert.equal((r as { kind?: string }).kind, kind, String(type));
  }
});

test("R1's lines, exactly, and by hash; the only number is 8; nothing about sign-ups", () => {
  assert.equal(PASSWORD_COPY.setHeading, "Set your password");
  assert.equal(PASSWORD_COPY.setIntro, "Choose a password for your account. You will use it with your email to sign in.");
  assert.equal(PASSWORD_COPY.hint, "At least 8 characters.");
  assert.equal(PASSWORD_COPY.mismatch, "The two passwords do not match.");
  assert.equal(PASSWORD_COPY.tooShort, "Use at least 8 characters.");
  assert.equal(PASSWORD_COPY.expired, "This link has expired. On the sign-in page choose \"Forgot password?\" for a new one, or ask your administrator.");
  assert.equal(PASSWORD_COPY.reauth, "To change your password, sign out, sign in again, then try again.");
  assert.equal(PASSWORD_COPY.forgotSent, "If this address has an account, a link to set a new password is on its way.");
  assert.equal(PASSWORD_COPY.forgotFailed, "Could not send the link. Try again later.");
  assert.equal(PASSWORD_COPY.changed, "Your password has been changed.");
  assert.equal(PROBLEM_TEXT.too_short, PASSWORD_COPY.tooShort);
  assert.equal(FAILURE_TEXT.session, PASSWORD_COPY.expired);
  const all = Object.values(PASSWORD_COPY).join("\n");
  assert.deepEqual(all.match(/\d+/g), ["8", "8"]);
  assert.doesNotMatch(all, /sign.?up|register|new account|security|preview/i);
});
