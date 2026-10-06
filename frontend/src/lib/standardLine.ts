// The "standard applied" line the matter view shows next to the verdict (#32): which standard of proof the analysis was asked for
// (`proved` or `prima_facie_disclosed`), where it came from, and whether the judge was actually told it. It reads the `standard`
// field the engine already returns (partner API, #220); no engine change. When the field is missing (an older engine) the
// line is the engine's own default, stated as such. An unknown value is shown as the engine sent it, never reworded.

export interface AnalyseFactsStandard {
  requested: string;
  applied: string | null;
  source: string;
  proceeding_posture?: string | null;
  in_judge_prompt: boolean;
}

export interface StandardLine {
  /** e.g. "standard: proved (default)". */
  text: string;
  /** Shown beneath the line when the judge was NOT told the standard; null otherwise. */
  notice: string | null;
}

export const STANDARD_MISSING_TEXT = "standard: proved (default)";
export const STANDARD_NOT_IN_PROMPT_NOTICE =
  "The judge was not told this standard, so it did not shape this result; the standard is recorded for the audit only.";

export function standardLine(standard: AnalyseFactsStandard | null | undefined): StandardLine {
  if (!standard || typeof standard.requested !== "string" || !standard.requested.trim()) {
    return { text: STANDARD_MISSING_TEXT, notice: null };
  }
  const requested = standard.requested.trim();
  let origin: string;
  switch (standard.source) {
    case "default":
      origin = "default";
      break;
    case "proceeding_posture":
      origin = standard.proceeding_posture ? `from the proceeding posture: ${standard.proceeding_posture}` : "from the proceeding posture";
      break;
    case "proceeding_type":
      origin = "from the proceeding type";
      break;
    default:
      origin = `source: ${String(standard.source ?? "not stated")}`;
  }
  return {
    text: `standard: ${requested} (${origin})`,
    notice: standard.in_judge_prompt === false ? STANDARD_NOT_IN_PROMPT_NOTICE : null,
  };
}
