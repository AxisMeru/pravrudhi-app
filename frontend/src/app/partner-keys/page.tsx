"use client";

import { useCallback, useState } from "react";
import {
  ApiError,
  createPartnerKey,
  partnerKeys,
  partnerUsage,
  revokePartnerKey,
  type CreatedPartnerKey,
} from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { viewFor, type KeysView } from "@/lib/partnerKeys";

export default function PartnerKeysPage() {
  const [org, setOrg] = useState("");
  const [view, setView] = useState<KeysView | null>(null);
  const [label, setLabel] = useState("");
  const [created, setCreated] = useState<CreatedPartnerKey | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (o: string) => {
    try {
      const [keys, usage] = await Promise.all([partnerKeys(o), partnerUsage(o)]);
      setView(viewFor(null, keys, usage));
    } catch (e) {
      setView(viewFor(e instanceof ApiError ? e.status : 0, [], []));
    }
  }, []);

  async function create() {
    setBusy(true);
    try {
      setCreated(await createPartnerKey(org, label.trim()));
      setLabel("");
      await load(org);
    } catch (e) {
      setView(viewFor(e instanceof ApiError ? e.status : 0, [], []));
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    setBusy(true);
    try {
      await revokePartnerKey(org, id);
      await load(org);
    } catch (e) {
      setView(viewFor(e instanceof ApiError ? e.status : 0, [], []));
    } finally {
      setBusy(false);
    }
  }

  if (view?.kind === "not-found") {
    return <div className="p-8 text-sm text-[var(--color-text-dim)]">Not found.</div>;
  }

  return (
    <div>
      <PageHeader title="Partner keys" subtitle="Keys and per-day usage for one organisation." />
      <div className="space-y-6 px-8 py-6">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setCreated(null);
            void load(org.trim());
          }}
        >
          <input
            value={org}
            onChange={(e) => setOrg(e.target.value)}
            placeholder="organisation id"
            aria-label="organisation id"
            className="rounded border border-[var(--color-border)] bg-transparent px-3 py-1.5 text-sm"
          />
          <button type="submit" disabled={!org.trim()} className="rounded border border-[var(--color-border)] px-3 py-1.5 text-sm">
            Load
          </button>
        </form>

        {view?.kind === "error" && <p role="alert" className="text-sm text-red-500">Could not load keys. Try again.</p>}

        {created && (
          <div role="status" className="rounded border border-[var(--color-border)] p-3 text-sm">
            <p>New key secret, shown once. Copy it now.</p>
            <code className="mt-1 block break-all">{created.secret}</code>
          </div>
        )}

        {view && view.kind !== "error" && (
          <>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void create();
              }}
            >
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="key label"
                aria-label="key label"
                className="rounded border border-[var(--color-border)] bg-transparent px-3 py-1.5 text-sm"
              />
              <button type="submit" disabled={busy || !label.trim()} className="rounded border border-[var(--color-border)] px-3 py-1.5 text-sm">
                Create key
              </button>
            </form>

            {view.kind === "empty" && <p className="text-sm text-[var(--color-text-dim)]">No keys yet.</p>}
            {view.kind === "rows" && (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-[var(--color-text-dim)]">
                    <th>Key</th><th>Status</th><th>Calls (30d)</th><th>Failed</th><th>By day</th><th />
                  </tr>
                </thead>
                <tbody>
                  {view.rows.map((r) => (
                    <tr key={r.keyId} className="border-t border-[var(--color-border)] align-top">
                      <td>{r.label} <span className="text-[var(--color-text-dim)]">{r.keyId}</span></td>
                      <td>{r.revoked ? "Revoked" : "Active"}</td>
                      <td>{r.total}</td>
                      <td>{r.failed}</td>
                      <td>{r.days.map((d) => `${d.day}: ${d.calls}${d.failed ? ` (${d.failed} failed)` : ""}`).join("; ") || "no calls"}</td>
                      <td>
                        {!r.revoked && (
                          <button disabled={busy} onClick={() => void revoke(r.keyId)} className="text-red-500">Revoke</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </div>
  );
}
