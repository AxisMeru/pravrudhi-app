// The pinned public links of a result row (app#693): the manifest and the predictions file of a published row, at one Hugging Face dataset commit, with their sha256.
// Built from src/data/nyayasiddhi/row_links.json (Track A, from the published rows; HF commit 660c7ff8e5bc). A row whose links do not pass every check shows no link line (fail closed).

export interface RowLinks {
  manifestUrl: string;
  predictionsUrl: string;
  manifestSha256: string;
  predictionsSha256: string;
}

const HF = /^https:\/\/huggingface\.co\/datasets\/AxisMeru\/nyayasiddhi\/blob\/[0-9a-f]{40}\/[A-Za-z0-9._\-\/+]+$/;
const SHA = /^[0-9a-f]{64}$/;

export function parseRowLinks(file: unknown): Record<string, RowLinks> {
  const out: Record<string, RowLinks> = {};
  if (typeof file !== "object" || file === null || Array.isArray(file)) return out;
  for (const [rowId, x] of Object.entries(file as Record<string, unknown>)) {
    if (typeof x !== "object" || x === null) continue;
    const r = x as Record<string, unknown>;
    const { manifest_url: mu, predictions_url: pu, manifest_sha256: ms, prediction_file_sha256: ps } = r;
    if (typeof mu !== "string" || typeof pu !== "string" || typeof ms !== "string" || typeof ps !== "string") continue;
    if (!HF.test(mu) || !HF.test(pu) || mu.includes("..") || pu.includes("..") || !SHA.test(ms) || !SHA.test(ps)) continue;
    out[rowId] = { manifestUrl: mu, predictionsUrl: pu, manifestSha256: ms, predictionsSha256: ps };
  }
  return out;
}
