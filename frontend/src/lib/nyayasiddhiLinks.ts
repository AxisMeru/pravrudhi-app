// R1's words for the "Links" block under the NyayaSiddhi film on /benchmarks (r1-seat2/BENCHMARKS_LINKS_BLOCK_R1_2026-10-21.md bbe0e492331d). Targets are the public 'main' pages of the Hugging Face dataset,
// each fetched anonymously by the Researcher on 21 Oct (HTTP 200). Plain labels, no description, no counts. Pinned by hash in nyayasiddhiLinks.spec.ts.
const B = "https://huggingface.co/datasets/AxisMeru/nyayasiddhi";

export const NS_LINKS_HEADING = "Links";
export const NS_LINKS_NOTE = "These links open pages on Hugging Face, outside this app.";
export const NS_LINKS: ReadonlyArray<{ key: string; label: string; href: string }> = [
  { key: "dataset", label: "NyayaSiddhi dataset on Hugging Face", href: B },
  { key: "files", label: "All files", href: `${B}/tree/main` },
  { key: "scorer", label: "Scorer: scorer/s6_scorer.py", href: `${B}/blob/main/scorer/s6_scorer.py` },
  { key: "readme", label: "Participant README", href: `${B}/blob/main/submission680/PARTICIPANT_README.md` },
  { key: "path", label: "Submission path", href: `${B}/blob/main/submission680/SUBMISSION_PATH_680.md` },
  { key: "results", label: "Results folder", href: `${B}/tree/main/results` },
];
