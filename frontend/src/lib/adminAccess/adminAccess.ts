// Admin → Access (app#520): the engine list route and the Supabase Edge Function admin-invite, per Track B's API contract v1 (81a69344a916). Unknown fields are ignored; no address or id is ever logged.

import { apiBase, engineFetch } from "@/lib/api";
import { accessToken } from "@/lib/auth";
import { ERROR_COPY, ERROR_GENERIC } from "./copy";

export type WakePolicy = "any_signed_in" | "allowlist";
export type Role = "admin" | "member";
export type InviteState = "pending" | "accepted";

export interface AccessAccount {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  banned_until: string | null;
  blocked: boolean;
  role: Role;
  invite_state: InviteState;
}

export interface AccessList {
  wakePolicy: WakePolicy;
  limit: number;
  offset: number;
  nextOffset: number | null;
  accounts: AccessAccount[];
}

export const PAGE_SIZE = 50;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Reads the 200 body of GET /api/v1/admin/access. Anything that is not the contract's shape is null (the page shows the load error, never a half-read list). */
export function parseAccessList(body: unknown): AccessList | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;
  if (b.wake_policy !== "any_signed_in" && b.wake_policy !== "allowlist") return null;
  if (!Array.isArray(b.accounts)) return null;
  const accounts: AccessAccount[] = [];
  for (const a of b.accounts) {
    if (typeof a !== "object" || a === null) return null;
    const r = a as Record<string, unknown>;
    if (typeof r.id !== "string" || !UUID.test(r.id) || typeof r.email !== "string" || typeof r.created_at !== "string") return null;
    if (r.role !== "admin" && r.role !== "member") return null;
    if (r.invite_state !== "pending" && r.invite_state !== "accepted") return null;
    if (typeof r.blocked !== "boolean") return null;
    accounts.push({
      id: r.id,
      email: r.email,
      created_at: r.created_at,
      last_sign_in_at: typeof r.last_sign_in_at === "string" ? r.last_sign_in_at : null,
      banned_until: typeof r.banned_until === "string" ? r.banned_until : null,
      blocked: r.blocked,
      role: r.role,
      invite_state: r.invite_state,
    });
  }
  return {
    wakePolicy: b.wake_policy,
    limit: typeof b.limit === "number" ? b.limit : PAGE_SIZE,
    offset: typeof b.offset === "number" ? b.offset : 0,
    nextOffset: typeof b.next_offset === "number" ? b.next_offset : null,
    accounts,
  };
}

/** "feature_off": the route is absent (404) or answers non-JSON (v1.1), the page shows nothing. "forbidden": a non-admin. "unavailable": any other failure. */
export type ListResult = { kind: "ok"; list: AccessList } | { kind: "feature_off" } | { kind: "forbidden" } | { kind: "unavailable" };

export async function fetchAccessList(offset: number, signal?: AbortSignal): Promise<ListResult> {
  try {
    const res = await engineFetch(`${apiBase()}/api/v1/admin/access?limit=${PAGE_SIZE}&offset=${offset}`, { cache: "no-store", signal });
    if (res.status === 404) return { kind: "feature_off" };
    if (res.status === 403) return { kind: "forbidden" };
    if (!res.ok) return { kind: "unavailable" };
    // Contract v1.1: with the feature off a signed-in caller gets 200 text/html (the SPA fallback): any non-JSON answer is "feature off"; the HTML is never parsed.
    if (!(res.headers.get("content-type") ?? "").toLowerCase().includes("json")) return { kind: "feature_off" };
    const list = parseAccessList(await res.json().catch(() => null));
    return list ? { kind: "ok", list } : { kind: "unavailable" };
  } catch {
    return { kind: "unavailable" };
  }
}

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

type Body = { action: "invite"; email: string } | { action: "resend"; user_id: string } | { action: "ban"; user_id: string };

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
export function resendInvitation(userId: string): Promise<ActionResult> {
  return callFunction({ action: "resend", user_id: userId });
}
export function blockAccount(userId: string): Promise<ActionResult> {
  return callFunction({ action: "ban", user_id: userId });
}

/** What the page shows for the invite and resend controls: only an administrator, and only when every signed-in account may start the models (contract section 0). */
export function showInviteControls(isAdmin: boolean, policy: WakePolicy): boolean {
  return isAdmin && policy === "any_signed_in";
}
