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

// A new key's secret is shown once. It is kept on screen only as long as it is needed: cleared when it has been
// copied, and after this timeout whether or not it was.
export const SECRET_TTL_MS = 60_000;

export type CopyOutcome = "copied" | "failed";

// A clipboard that is missing (an insecure context) or refuses the write is a visible failure, never a silent one:
// the caller shows the outcome and keeps the secret on screen so it can be copied by hand.
export async function copySecret(
  clipboard: { writeText?: (text: string) => Promise<void> } | undefined | null,
  secret: string,
): Promise<CopyOutcome> {
  if (!clipboard || typeof clipboard.writeText !== "function") return "failed";
  try {
    await clipboard.writeText(secret);
    return "copied";
  } catch {
    return "failed";
  }
}
