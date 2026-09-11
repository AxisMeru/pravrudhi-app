import { strict as assert } from "node:assert";
import test from "node:test";

test("api: module exports functions for fetching engine data", async () => {
  // This test verifies that the api module has the functions needed to fetch engine data.
  // The integration of Bearer token headers with Supabase auth is verified through auth.spec.ts
  // and through the integration with AccountControl component which reads currentSession().
  const { health, status, candidates, ApiError } = await import("./api");
  assert.ok(typeof health === "function");
  assert.ok(typeof status === "function");
  assert.ok(typeof candidates === "function");
  assert.ok(ApiError);
});
