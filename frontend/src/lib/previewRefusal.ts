import { str } from "./previewApi";
import { PREVIEW_PAGE } from "./previewPageCopy";
import { PREVIEW } from "./previewWorkflows";

/**
 * Why a Matter-tools call gave no result, in R1's lines (SIGNED_OUT_MATTER_TOOLS_R1_2026-10-19.md, sha12 601912a25adb): a 401 reads "Sign in to add papers." and any engine sentence about "Stored papers"
 * is never shown (it presupposes storage; no retention wording is cleared), the app's own "Adding papers is not available here." takes its place. Other statuses keep the earlier rule: 404/409 are R1's lines,
 * a busy or failed call shows the engine's own sentence when it sent one.
 */
export function previewRefusal(status: number, body: Record<string, unknown> | null): string {
  const detail = str(body?.detail);
  if (status === 401) return PREVIEW_PAGE.signed401;
  if (detail && /stored papers/i.test(detail)) return PREVIEW.wf_store_off;
  if (status === 404) return PREVIEW.wf_unavailable;
  if (status === 409 && body?.error === "no_papers") return PREVIEW.wf_no_papers;
  if (status === 429 || status === 503) return detail ?? PREVIEW.wf_busy;
  return detail ?? PREVIEW.wf_error;
}
