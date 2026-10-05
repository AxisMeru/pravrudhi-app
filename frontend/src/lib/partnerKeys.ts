import type { PartnerKey, PartnerKeyUsage } from "@/lib/api";

export type KeysView =
  | { kind: "not-found" }
  | { kind: "error" }
  | { kind: "empty" }
  | { kind: "rows"; rows: KeyRow[] };

export interface KeyRow {
  keyId: string;
  label: string;
  revoked: boolean;
  total: number;
  failed: number;
  days: { day: string; calls: number; failed: number }[];
}

// The engine answers 401/403/404 to anyone who is not an admin; the page says "not found" to all of them so it
// does not reveal that an admin surface exists.
export function viewFor(status: number | null, keys: PartnerKey[], usage: PartnerKeyUsage[]): KeysView {
  if (status === 401 || status === 403 || status === 404) return { kind: "not-found" };
  if (status !== null) return { kind: "error" };
  if (keys.length === 0) return { kind: "empty" };
  const byKey = new Map(usage.map((u) => [u.key_id, u]));
  return {
    kind: "rows",
    rows: keys.map((k) => {
      const days = byKey.get(k.key_id)?.days ?? [];
      return {
        keyId: k.key_id,
        label: k.label,
        revoked: k.revoked,
        total: days.reduce((n, d) => n + d.calls, 0),
        failed: days.reduce((n, d) => n + d.failed, 0),
        days,
      };
    }),
  };
}
