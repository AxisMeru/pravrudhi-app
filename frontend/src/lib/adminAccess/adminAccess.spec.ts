import assert from "node:assert/strict";
import test from "node:test";

import { ACCESS_COPY, ERROR_COPY, ERROR_GENERIC } from "./copy";
import { cleanEmail, messageFor } from "./adminAccess";

test("the email rule: trimmed, lowercased, one address, no listed character, at most 254 characters", () => {
  assert.equal(cleanEmail("  Person@Example.COM "), "person@example.com");
  for (const bad of ["", "   ", "a@b@c", "nobody", "a@", "@example.com", "a,b@example.com", "a;b@example.com", "a b@example.com", "<a>@example.com", "a(b)@example.com", "a\"b@example.com", "a\\b@example.com", "a\u0001@example.com", `${"x".repeat(250)}@example.com`]) {
    assert.equal(cleanEmail(bad), null, JSON.stringify(bad));
  }
});

test("every error code of the contract has one fixed message, an unknown code gets the generic one, and none echoes an input", () => {
  const codes = ["unauthorized", "forbidden", "invalid_email", "rate_limited", "invite_rate_limited", "already_registered", "upstream_unavailable", "audit_unavailable", "not_configured", "invite_redirect_not_allowed"];
  for (const c of codes) assert.ok(ERROR_COPY[c], c);
  assert.equal(messageFor("something_new"), ERROR_GENERIC);
  assert.equal(messageFor(""), ERROR_GENERIC);
  for (const m of [...Object.values(ERROR_COPY), ERROR_GENERIC]) assert.doesNotMatch(m, /@|[0-9a-f]{8}-[0-9a-f]{4}/);
});

test("the minimal page says nothing about a list, blocking, deleting or a model-start switch, and promises nothing about the models", () => {
  const page = Object.values(ACCESS_COPY).join("\n");
  const all = [page, ...Object.values(ERROR_COPY), ERROR_GENERIC].join("\n");
  assert.doesNotMatch(page, /immediately|\bbanned\b|\bblock|\bdelete|unblock|un-?block|toggle|\bmember\b|policy|list of/i);
  assert.doesNotMatch(all, /models?\b/i);
});
