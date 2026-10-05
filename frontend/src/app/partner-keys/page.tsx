"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ApiError,
  createPartnerKey,
  partnerKeys,
  partnerUsage,
  revokePartnerKey,
  type CreatedPartnerKey,
} from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { copySecret, SECRET_TTL_MS, viewFor, type CopyOutcome, type KeysView } from "@/lib/partnerKeys";

export default function PartnerKeysPage() {
  const [org, setOrg] = useState("");
  const [view, setView] = useState<KeysView | null>(null);
  const [label, setLabel] = useState("");
  const [created, setCreated] = useState<CreatedPartnerKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [copy, setCopy] = useState<CopyOutcome | null>(null);

  // The secret is shown once and is not kept: it is cleared after a timeout, and as soon as it has been copied.
  useEffect(() => {
    if (!created) return;
    const timer = setTimeout(() => setCreated(null), SECRET_TTL_MS);
    return () => clearTimeout(timer);
  }, [created]);

  async function copyCreated() {
    if (!created) return;
    const outcome = await copySecret(navigator.clipboard, created.secret);
    if (outcome === "copied") setCreated(null);
    setCopy(outcome);
  }

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
      setCopy(null);
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
            <p>New key secret, shown once. Copy it now; it disappears once copied or after a minute.</p>
            <code className="mt-1 block break-all">{created.secret}</code>
            <button
              type="button"
              className="mt-2 rounded border border-[var(--color-border)] px-2 py-1 text-xs"
              onClick={() => void copyCreated()}
            >
              Copy secret
            </button>
            {copy === "failed" && (
              <p role="alert" className="mt-2 text-xs text-red-500">
                Could not copy to the clipboard. Select the secret above and copy it by hand before it disappears.
              </p>
            )}
          </div>
        )}
        {!created && copy === "copied" && (
          <p role="status" className="text-xs text-[var(--color-text-dim)]">Secret copied and cleared from this page.</p>
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
              <table className="w-full text-left text-sm" aria-label="Partner keys and usage">
                <thead>
                  <tr className="text-[var(--color-text-dim)]">
                    <th scope="col">Key</th><th scope="col">Status</th><th scope="col">Calls (30d)</th><th scope="col">Failed</th><th scope="col">By day</th><th scope="col"><span className="sr-only">Actions</span></th>
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
                          <button
                            disabled={busy}
                            aria-label={`Revoke key ${r.label || r.keyId}`}
                            onClick={() => {
                              if (window.confirm(`Revoke key ${r.label || r.keyId}? Calls using it will stop working.`)) void revoke(r.keyId);
                            }}
                            className="text-red-500"
                          >
                            Revoke
                          </button>
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
