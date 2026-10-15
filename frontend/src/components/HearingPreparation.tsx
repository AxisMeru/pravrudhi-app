import type { AnalyseFactsResult } from "@/lib/api";
import { ALTERNATE_LIMB_NOTE } from "@/lib/screening/copy";
import { buildHearingPrep, HEARING_PREP_STRINGS as S, type IntakeCitationInput } from "@/lib/screening/hearingPrep";
import { WORKSPACE_ANCHORS } from "@/lib/workspace";

/** Step 4 of the Matter workspace (the standing line is NOT repeated here: R1's rule is one standing line per result, above the first block; the module's standingLine is left unused by design): the hearing checklist, rendered from the module's output (lib/screening/hearingPrep.ts) with its own words and nothing added. */
export function HearingPreparation({ result, intakeCitations }: { result: AnalyseFactsResult; intakeCitations: readonly IntakeCitationInput[] }) {
  const prep = buildHearingPrep(result, intakeCitations);
  return (
    <section className="flex flex-col gap-4" id={WORKSPACE_ANCHORS.hearing} aria-labelledby="hearing-prep-heading" data-testid="hearing-prep" data-status={prep.status}>
      <h2 id="hearing-prep-heading" className="text-base font-semibold text-[var(--color-text)]">{S.heading}</h2>
      {prep.status === "nothingScreened" ? (
        <p className="text-sm text-[var(--color-text)]" data-testid="hearing-nothing-screened">{S.nothingScreened}</p>
      ) : (
        prep.blocks.map((b) => (
          <div key={b.index} className="flex flex-col gap-2 rounded-md border border-[var(--color-border)] p-3" data-testid="hearing-block" data-state={b.state}>
            <h3 className="text-sm font-medium text-[var(--color-text)]">{b.title}</h3>
            {b.alternateWay && <p className="text-xs text-[var(--color-text-dim)]" data-testid="hearing-alternate-way">{ALTERNATE_LIMB_NOTE}</p>}
            {b.state === "unsettled" && <p className="text-sm text-[var(--color-text)]" data-testid="hearing-unsettled">{S.unsettledBlock}</p>}
            {b.state === "settled" && <p className="text-sm text-[var(--color-text)]" data-testid="hearing-none-open">{S.noneOpen}</p>}
            {b.state === "open" && (
              <>
                <h4 className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-dim)]">{S.openHeading}</h4>
                <ul className="flex flex-col gap-2">
                  {b.open.map((o, i) => (
                    <li key={i} className="text-sm text-[var(--color-text)]" data-testid="hearing-open-ingredient">
                      <div>{o.ingredient}</div>
                      <div className="mt-0.5 text-xs text-[var(--color-text-dim)]"><span className="font-medium">{S.checkLabel}:</span> {o.whatToCheck}</div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        ))
      )}
      {prep.status === "settled" && <p className="text-sm text-[var(--color-text)]" data-testid="hearing-all-supported">{S.allSupportedNote}</p>}
      <div className="flex flex-col gap-1" data-testid="hearing-citations">
        <h3 className="text-sm font-medium text-[var(--color-text)]">{S.citationsHeading}</h3>
        {prep.citations.length === 0 ? (
          <p className="text-sm text-[var(--color-text-dim)]">{S.noCitations}</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {prep.citations.map((c, i) => (
              <li key={i} className="text-sm text-[var(--color-text)]" data-testid="hearing-citation" data-source={c.source}>
                {c.text} <span className="text-xs text-[var(--color-text-dim)]">({c.source === "screening" ? S.citationFromScreening : S.citationFromIntake})</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
