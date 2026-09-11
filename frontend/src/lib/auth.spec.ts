import { strict as assert } from "node:assert";
import test from "node:test";

import {
  signIn,
  signUp,
  signOut,
  currentSession,
  accessToken,
  setSession,
  clearSession,
} from "./auth";

// Mock localStorage
const mockStorage: Record<string, string> = {};

function setupMocks() {
  mockStorage["pravrudhi-auth-session"] = "";
  global.localStorage = {
    getItem: (key) => mockStorage[key] ?? null,
    setItem: (key, value) => {
      mockStorage[key] = value;
    },
    removeItem: (key) => {
      delete mockStorage[key];
    },
    clear: () => {
      for (const key in mockStorage) delete mockStorage[key];
    },
    length: Object.keys(mockStorage).length,
    key: (index) => Object.keys(mockStorage)[index] ?? null,
  } as Storage;

  (global.fetch as unknown) = async (url: string, options?: RequestInit) => {
    const urlStr = url.toString();

    // Mock successful sign-in
    if (urlStr.includes("/auth/v1/token") && options?.method === "POST") {
      const body = options.body ? JSON.parse(String(options.body)) : {};
      if (body.email === "test@example.com" && body.password === "correct-password") {
        return new Response(
          JSON.stringify({
            access_token: "test-access-token-123",
            user: {
              id: "user-123",
              email: "test@example.com",
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      // Wrong password
      return new Response(JSON.stringify({ error_description: "Invalid login credentials" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }

    // Mock sign-up
    if (urlStr.includes("/auth/v1/signup") && options?.method === "POST") {
      const body = options.body ? JSON.parse(String(options.body)) : {};
      if (body.email === "newuser@example.com" && body.password === "valid-password-123") {
        // Confirmation required - no access token
        return new Response(JSON.stringify({ user: { id: "user-new", email: "newuser@example.com" } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (body.email === "existing@example.com" && body.password === "any-password") {
        // Email already exists
        return new Response(
          JSON.stringify({ error_description: "User already registered" }),
          {
            status: 422,
            headers: { "content-type": "application/json" },
          },
        );
      }
      if (body.email === "weak@example.com" && body.password === "123") {
        // Weak password
        return new Response(
          JSON.stringify({ error_description: "Password should be at least 6 characters" }),
          {
            status: 422,
            headers: { "content-type": "application/json" },
          },
        );
      }
      if (body.email === "session@example.com" && body.password === "with-session-123") {
        // Return with access token (no confirmation required in this mock)
        return new Response(
          JSON.stringify({
            access_token: "new-session-token-456",
            user: {
              id: "user-session",
              email: "session@example.com",
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ error_description: "Sign up failed" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    // Mock get current user
    if (urlStr.includes("/auth/v1/user") && options?.method === "GET") {
      const auth = (options.headers ?? {}) as Record<string, string>;
      if (auth.authorization === "Bearer test-access-token-123") {
        return new Response(
          JSON.stringify({
            id: "user-123",
            email: "test@example.com",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }

    // Mock sign-out
    if (urlStr.includes("/auth/v1/logout") && options?.method === "POST") {
      return new Response(JSON.stringify({}), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  };
}

test("auth: sign in with valid credentials stores session", async () => {
  setupMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:3000";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-key";

  const result = await signIn("test@example.com", "correct-password");
  assert.ok(result.ok);
  assert.equal(result.data?.email, "test@example.com");

  const token = accessToken();
  assert.equal(token, "test-access-token-123");
});

test("auth: sign in with wrong password fails", async () => {
  setupMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:3000";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-key";

  const result = await signIn("test@example.com", "wrong-password");
  assert.ok(!result.ok);
  assert.ok(result.error);
});

test("auth: sign in without SUPABASE_URL configured fails gracefully", async () => {
  setupMocks();
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const result = await signIn("test@example.com", "password");
  assert.ok(!result.ok);
  assert.equal(result.error, "Supabase not configured");
});

test("auth: access token is null when no session", async () => {
  setupMocks();
  clearSession();
  const token = accessToken();
  assert.equal(token, null);
});

test("auth: current session returns stored user", async () => {
  setupMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:3000";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-key";

  await signIn("test@example.com", "correct-password");
  const session = currentSession();
  assert.ok(session);
  assert.equal(session.email, "test@example.com");
});

test("auth: sign out clears session and token", async () => {
  setupMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:3000";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-key";

  await signIn("test@example.com", "correct-password");
  assert.equal(accessToken(), "test-access-token-123");

  await signOut();
  assert.equal(accessToken(), null);
  assert.equal(currentSession(), null);
});

test("auth: set and clear session manually", async () => {
  setupMocks();
  const user = { id: "user-456", email: "manual@example.com" };
  setSession("manual-token-456", user);

  assert.equal(accessToken(), "manual-token-456");
  const session = currentSession();
  assert.ok(session);
  assert.equal(session.email, "manual@example.com");

  clearSession();
  assert.equal(accessToken(), null);
  assert.equal(currentSession(), null);
});

test("auth: sign up with needs confirmation returns needsConfirmation true", async () => {
  setupMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:3000";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-key";

  const result = await signUp("newuser@example.com", "valid-password-123");
  assert.ok(!result.ok);
  assert.ok("needsConfirmation" in result);
  assert.equal((result as { needsConfirmation?: boolean }).needsConfirmation, true);
});

test("auth: sign up with email already exists returns error", async () => {
  setupMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:3000";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-key";

  const result = await signUp("existing@example.com", "any-password");
  assert.ok(!result.ok);
  assert.ok("error" in result);
  assert.ok((result as { error?: string }).error?.includes("User already registered"));
});

test("auth: sign up with weak password returns error", async () => {
  setupMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:3000";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-key";

  const result = await signUp("weak@example.com", "123");
  assert.ok(!result.ok);
  assert.ok("error" in result);
  assert.ok((result as { error?: string }).error?.includes("at least 6 characters"));
});

test("auth: sign up returning session stores it", async () => {
  setupMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:3000";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-key";

  const result = await signUp("session@example.com", "with-session-123");
  assert.ok(result.ok);
  assert.equal((result as { data?: { email: string } }).data?.email, "session@example.com");

  const token = accessToken();
  assert.equal(token, "new-session-token-456");
});

test("auth: sign up without SUPABASE_URL configured fails gracefully", async () => {
  setupMocks();
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const result = await signUp("test@example.com", "password");
  assert.ok(!result.ok);
  assert.equal((result as { error?: string }).error, "Supabase not configured");
});
