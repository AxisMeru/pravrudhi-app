// Admin → Access (app#520, minimal): the Supabase Edge Function admin-invite, invite and resend by email only (Track B's function; contract v1.1 reduced, no list, no ban). No address is ever logged.

import { accessToken } from "@/lib/auth";
import { ERROR_COPY, ERROR_GENERIC } from "./copy";

/** The contract's email rule, checked before the call (the function enforces it again): one address, trimmed and lowercased, at most 254 characters, exactly one "@", none of the listed characters. Returns the cleaned address or null. */
export function cleanEmail(raw: string): string | null {
  const e = raw.trim().toLowerCase();
  if (e.length === 0 || e.length > 254) return null;
  if (e.split("@").length !== 2) return null;
  if (/[,;\s<>()"'\\\u0000-\u001f\u007f]/.test(e)) return null;
  const [local, domain] = e.split("@");
  if (!local || !domain) return null;
  return e;
}

export type ActionResult = { ok: true } | { ok: false; code: string; message: string };

export function messageFor(code: string): string {
  return ERROR_COPY[code] ?? ERROR_GENERIC;
}

/** The function answers within its own 10 s upstream limit; a request with no answer after this long is stopped so "Working…" cannot hang. */
export const FUNCTION_TIMEOUT_MS = 20_000;

type Body = { action: "invite"; email: string } | { action: "resend"; email: string };

async function callFunction(body: Body): Promise<ActionResult> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = accessToken();
  if (!base || !key || !token) return { ok: false, code: "unauthorized", message: messageFor("unauthorized") };
  try {
    const res = await fetch(`${base}/functions/v1/admin-invite`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, apikey: key, "content-type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(FUNCTION_TIMEOUT_MS),
    });
    const out = (await res.json().catch(() => null)) as { ok?: unknown; code?: unknown } | null;
    if (res.ok && out?.ok === true) return { ok: true };
    const code = typeof out?.code === "string" ? out.code : res.status === 401 ? "unauthorized" : res.status === 403 ? "forbidden" : "";
    return { ok: false, code, message: messageFor(code) };
  } catch (e) {
    // No answer in time: the invitation may or may not have been sent, so the message says so (never "nothing was changed").
    const timedOut = typeof e === "object" && e !== null && ((e as { name?: string }).name === "TimeoutError" || (e as { name?: string }).name === "AbortError");
    const code = timedOut ? "no_answer" : "upstream_unavailable";
    return { ok: false, code, message: messageFor(code) };
  }
}

export function inviteAccount(email: string): Promise<ActionResult> {
  return callFunction({ action: "invite", email });
}
export function resendInvitation(email: string): Promise<ActionResult> {
  return callFunction({ action: "resend", email });
}
