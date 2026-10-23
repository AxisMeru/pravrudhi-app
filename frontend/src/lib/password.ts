// app d65: set, change and recover a password (Supabase Auth). The password is never logged, never stored (not in the saved session, not in storage) and never put in a URL; it travels only in the body of one PUT.
import { accessToken } from "./auth";
import { PASSWORD_COPY } from "./passwordCopy";

export const MIN_PASSWORD_LENGTH = 8;

export type PasswordProblem = "too_short" | "mismatch";
export type SetPasswordFailure = "session" | "same" | "weak" | "reauth" | "unavailable";
export type SetPasswordResult = { ok: true } | { ok: false; reason: SetPasswordFailure };

/** The first thing wrong with a new password and its confirmation, or null. Checked in the page before anything is sent. */
export function checkNewPassword(password: string, confirm: string): PasswordProblem | null {
  if (password.length < MIN_PASSWORD_LENGTH) return "too_short";
  if (password !== confirm) return "mismatch";
  return null;
}

function supabase(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? { url, key } : null;
}

/**
 * PUT /auth/v1/user {password} with the signed-in session's token. Supabase's own refusals are mapped to our reasons; its wording is never shown.
 * `reauth` is Supabase asking for a fresh sign-in before it changes a password on an older session.
 */
export async function setPassword(password: string): Promise<SetPasswordResult> {
  const cfg = supabase();
  const token = accessToken();
  if (!cfg || !token) return { ok: false, reason: "session" };
  try {
    const res = await fetch(`${cfg.url}/auth/v1/user`, {
      method: "PUT",
      headers: { "content-type": "application/json", apikey: cfg.key, authorization: `Bearer ${token}` },
      body: JSON.stringify({ password }),
      cache: "no-store",
    });
    if (res.ok) return { ok: true };
    if (res.status === 401 || res.status === 403) return { ok: false, reason: "session" };
    const body = (await res.json().catch(() => null)) as { error_code?: unknown; msg?: unknown; message?: unknown } | null;
    const code = typeof body?.error_code === "string" ? body.error_code : "";
    const words = `${typeof body?.msg === "string" ? body.msg : ""} ${typeof body?.message === "string" ? body.message : ""}`.toLowerCase();
    if (code === "reauthentication_needed" || words.includes("reauthentication")) return { ok: false, reason: "reauth" };
    if (code === "same_password") return { ok: false, reason: "same" };
    if (code === "weak_password") return { ok: false, reason: "weak" };
    return { ok: false, reason: "unavailable" };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

/**
 * POST /auth/v1/recover {email} with redirect_to <origin>/signin. Like the sign-in link (app#523) the answer does not depend on whether the address has an account: any refusal for an unknown
 * address is the same `ok` as a sent link. Only a rate limit, a server error or a dropped connection is a failure, and that is our one generic line.
 */
export async function requestPasswordReset(email: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const cfg = supabase();
  if (!cfg) return { ok: false, error: "Supabase not configured" };
  const redirect = typeof window !== "undefined" ? `${window.location.origin}/signin` : "";
  try {
    const res = await fetch(`${cfg.url}/auth/v1/recover${redirect ? `?redirect_to=${encodeURIComponent(redirect)}` : ""}`, {
      method: "POST",
      headers: { "content-type": "application/json", apikey: cfg.key },
      body: JSON.stringify({ email }),
    });
    if (res.ok) return { ok: true };
    if (res.status === 429 || res.status >= 500) return { ok: false, error: PASSWORD_COPY.forgotFailed };
    return { ok: true };
  } catch {
    return { ok: false, error: PASSWORD_COPY.forgotFailed };
  }
}
