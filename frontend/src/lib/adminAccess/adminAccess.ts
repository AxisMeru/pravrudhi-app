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
    });
    const out = (await res.json().catch(() => null)) as { ok?: unknown; code?: unknown } | null;
    if (res.ok && out?.ok === true) return { ok: true };
    const code = typeof out?.code === "string" ? out.code : res.status === 401 ? "unauthorized" : res.status === 403 ? "forbidden" : "";
    return { ok: false, code, message: messageFor(code) };
  } catch {
    return { ok: false, code: "upstream_unavailable", message: messageFor("upstream_unavailable") };
  }
}

export function inviteAccount(email: string): Promise<ActionResult> {
  return callFunction({ action: "invite", email });
}
export function resendInvitation(email: string): Promise<ActionResult> {
  return callFunction({ action: "resend", email });
}
