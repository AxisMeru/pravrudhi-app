// Band: the product's one fully-realised artifact experience today (ADR-0049 names prabhasa-nyaya the
// reference artifact, rendered through the product's own surface until it can create artifact repositories
// generically). A question of Indian law, answered from a real corpus, checked citation by citation.

import Link from "next/link";
import { Scale } from "lucide-react";
import type { NyayaAsk } from "@/lib/api";

export function NyayaBand({ asks }: { asks: NyayaAsk[] | null }) {
  const answered = asks?.length ?? 0;
  return (
    <Link
      href="/nyaya"
      className="block rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5 transition-colors hover:bg-[var(--color-surface-raised)]"
    >
      <div className="flex items-center gap-2">
        <Scale size={16} className="text-[var(--color-text-dim)]" />
        <h2 className="text-sm font-medium text-[var(--color-text)]">Nyaya</h2>
      </div>
      <p className="mt-2 text-sm leading-6 text-[var(--color-text-dim)]">
        {answered > 0
          ? `${answered} question${answered === 1 ? "" : "s"} of Indian law asked and answered, every citation checked against a real corpus.`
          : "Ask a question of Indian law, answered from a real corpus of statutes, with every citation checked."}
      </p>
    </Link>
  );
}
