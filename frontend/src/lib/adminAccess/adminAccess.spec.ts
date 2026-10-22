import assert from "node:assert/strict";
import test from "node:test";

import { ACCESS_COPY, ERROR_COPY, ERROR_GENERIC } from "./copy";
import { cleanEmail, messageFor, parseAccessList, showInviteControls } from "./adminAccess";

const ID = "47454d00-3231-44ae-bfae-f7343d553e9b";
const acct = (over: Record<string, unknown> = {}) => ({ id: ID, email: "a@example.org", created_at: "2026-09-01T09:00:00Z", last_sign_in_at: null, banned_until: null, blocked: false, role: "member", invite_state: "pending", ...over });

test("the list body of the contract parses; unknown fields are ignored; any other shape is null", () => {
  const ok = parseAccessList({ wake_policy: "any_signed_in", allowlist_size: null, limit: 50, offset: 0, returned: 1, next_offset: null, extra: 1, accounts: [acct({ extra: true })] });
  assert.ok(ok);
  assert.equal(ok!.wakePolicy, "any_signed_in");
  assert.equal(ok!.accounts.length, 1);
  assert.equal(ok!.nextOffset, null);
  assert.equal(parseAccessList({ wake_policy: "allowlist", accounts: [] })!.wakePolicy, "allowlist");
  assert.equal(parseAccessList(null), null);
  assert.equal(parseAccessList("<!DOCTYPE html>"), null);
  assert.equal(parseAccessList({ wake_policy: "other", accounts: [] }), null);
  assert.equal(parseAccessList({ wake_policy: "allowlist" }), null);
  assert.equal(parseAccessList({ wake_policy: "allowlist", accounts: [acct({ id: "not-a-uuid" })] }), null);
  assert.equal(parseAccessList({ wake_policy: "allowlist", accounts: [acct({ role: "owner" })] }), null);
  assert.equal(parseAccessList({ wake_policy: "allowlist", accounts: [acct({ blocked: "yes" })] }), null);
});

test("the email rule: trimmed, lowercased, one address, no listed character, at most 254 characters", () => {
  assert.equal(cleanEmail("  Person@Example.ORG "), "person@example.org");
  for (const bad of ["", "   ", "a@b@c", "nobody", "a@", "@b.org", "a,b@c.org", "a;b@c.org", "a b@c.org", "<a>@c.org", "a(b)@c.org", "a\"b@c.org", "a\\b@c.org", "a\u0001@c.org", `${"x".repeat(250)}@c.org`]) {
    assert.equal(cleanEmail(bad), null, JSON.stringify(bad));
  }
});

test("every error code of the contract has one fixed message, an unknown code gets the generic one, and none echoes an input", () => {
  const codes = ["unauthorized", "forbidden", "invalid_email", "rate_limited", "invite_rate_limited", "already_registered", "already_accepted", "account_banned", "protected_account", "no_such_user", "upstream_unavailable", "audit_unavailable", "not_configured", "invite_redirect_not_allowed"];
  for (const c of codes) assert.ok(ERROR_COPY[c], c);
  assert.equal(messageFor("something_new"), ERROR_GENERIC);
  assert.equal(messageFor(""), ERROR_GENERIC);
  for (const m of [...Object.values(ERROR_COPY), ERROR_GENERIC]) assert.doesNotMatch(m, /@|[0-9a-f]{8}-[0-9a-f]{4}/);
});

test("invite and resend show only for an administrator when every signed-in account may start the models (contract section 0)", () => {
  assert.equal(showInviteControls(true, "any_signed_in"), true);
  assert.equal(showInviteControls(true, "allowlist"), false);
  assert.equal(showInviteControls(false, "any_signed_in"), false);
});

test("the wording rules: Blocked, up to 1 hour, never immediately; no model-start switch, no delete, no un-block", () => {
  const all = [...Object.values(ACCESS_COPY), ...Object.values(ERROR_COPY), ERROR_GENERIC].join("\n");
  assert.match(ACCESS_COPY.blockExplain, /up to 1 hour/);
  assert.doesNotMatch(all, /immediately|\bbanned\b|\bdelete|unblock|un-block|reinstate|restore access/i);
  assert.doesNotMatch(all, /allow(ed)? to start|toggle|switch (on|off)|may start the models/i);
  assert.equal(ACCESS_COPY.statusBlocked, "Blocked");
});
