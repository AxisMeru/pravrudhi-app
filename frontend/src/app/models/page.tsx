"use client";

// ADR-0003: a BYOK product user has no self-improvement loop, no candidates and no nights, so this page used
// to answer a question they never asked ("what has the loop promoted") and its empty state pointed at /start
// to "produce one" -- a concept this edition does not have.
//
// This is deliberately narrower than "which of your providers is working right now": /api/panel/vendors'
// `reachable` field, for every BYOK provider, only checks whether a key is present (panel.py's
// `reachable_in`) -- the same fact `/api/providers`'s own `configured` field already states, under a
// different name. Shipping a "Reachable" column backed by it would be a second label for `configured`
// dressed up as a live health check, which is not honest. A real "is my key working right now" signal needs
// an on-demand, read-only probe the engine does not have yet -- filed as ADR-0004, not faked here.
//
// So this page shows only what /api/providers actually knows: configured or not, per provider, with the real
// place to act on it.

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { providers, type ProviderInfo } from "@/lib/api";

export default function ModelsPage() {
  const [rows, setRows] = useState<ProviderInfo[] | null>(null);
  const [unsupported, setUnsupported] = useState(false);

  useEffect(() => {
    let cancelled = false;
    providers()
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch(() => {
        if (!cancelled) setUnsupported(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <PageHeader title="Models" subtitle="The providers you've configured, and where to add another." />
      <div className="space-y-6 p-8">
        {unsupported && (
          <p className="text-sm text-[var(--color-text-dim)]">This engine build does not report providers yet.</p>
        )}
        {!unsupported && rows === null && <p className="text-sm text-[var(--color-text-dim)]">Loading…</p>}
        {/* Every declared provider is always listed, configured or not - a user should see what this install
            supports before deciding to add a key, not be shown nothing until they've already added one. */}
        {!unsupported && rows !== null && rows.every((p) => !p.configured) && (
          <p className="max-w-2xl text-sm leading-6 text-[var(--color-text-dim)]">
            No providers configured yet. Add your own API key to start using a model.{" "}
            <Link href="/settings" className="text-[var(--color-accent)] hover:underline">
              Add a provider key
            </Link>
            .
          </p>
        )}
        {!unsupported && rows !== null && rows.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-[var(--color-border)]">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--color-surface)] text-xs uppercase tracking-wide text-[var(--color-text-dim)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Provider</th>
                  <th className="px-4 py-3 font-medium">Key</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className="border-t border-[var(--color-border)] align-top">
                    <td className="px-4 py-3 font-medium text-[var(--color-text)]">{p.title}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 ${
                          p.configured ? "text-[var(--color-accent)]" : "text-[var(--color-text-dim)]"
                        }`}
                      >
                        {p.configured ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                        {p.configured ? "configured" : "not configured"}
                      </span>
                      {!p.configured && (
                        <Link href="/settings" className="ml-2 text-xs text-[var(--color-accent)] hover:underline">
                          add key
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
