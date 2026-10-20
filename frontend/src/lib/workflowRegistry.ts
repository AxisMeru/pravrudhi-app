// The workflow registry (Advisor Q6, Lead-2 adopted 20 Oct): ONE entry per engine workflow, keyed by the engine's own wf_* flag id, so /workflows and the nav read the same list.
// WORDS are static and R1's (WORKFLOW_REGISTRY_WORDS_DRAFT_R1_2026-10-20.md sha12 bda372ae9d62; pinned by hash in workflowRegistry.spec.ts). AVAILABILITY is dynamic when the engine reports it:
// GET /api/v1/status `workflows: {wf_key: bool}` (engine #571, ships IN engine 0.6.24; registryAvailable() takes it, and the app's runtime read of it is pravrudhi-app#470, so today every card uses REGISTRY_FALLBACK_ON, the 0.6.23 set pinned to configs/partner_api.yaml, which is also what an older engine gets).
// The page shows these cards only on a build with NEXT_PUBLIC_WORKFLOWS_V2=1 (lib/workflowsV2Flag.ts).
export type RegistryKey =
  | "wf_a2_span_index"
  | "wf_a3_chronology"
  | "wf_a5_ingredient_agenda"
  | "wf_s1_matter_citation_sweep"
  | "wf_b2_quashing_agenda"
  | "wf_a6_cheque_case_check"
  | "wf_a7_matter_hearing_pack"
  | "wf_b3_s138_checklist";

export interface RegistryEntry {
  key: RegistryKey;
  title: string;
  /** One line, 90 characters or fewer (R1). The full cleared line stays on the tool's own card. */
  line: string;
  /** The card of the matter-tools page this entry opens (its element id). */
  anchor: string;
  /** The engine route (under /api/v1) the card calls: what the deploy gate probes for a 404. */
  route: string;
  usesPapers: boolean;
  startHere: boolean;
}

// Display order (Advisor): Add papers first and marked "Start here", then the papers-based tools, then the cheque checklist and the cheque case check.
export const REGISTRY: readonly RegistryEntry[] = [
  { key: "wf_a2_span_index", route: "/matter-spans/query", title: "Papers for a matter", line: "Add the papers of a matter and find a passage in them.", anchor: "pv-matter", usesPapers: true, startHere: true },
  { key: "wf_a3_chronology", route: "/chronology", title: "Chronology", line: "Lists the dates it reads in your papers, each with its sentence. May be incomplete.", anchor: "pv-a3", usesPapers: true, startHere: false },
  { key: "wf_a5_ingredient_agenda", route: "/review-agenda", title: "Review agenda", line: "Lists the ingredients of the cheque-dishonour offence and the papers to look in.", anchor: "pv-a5", usesPapers: true, startHere: false },
  { key: "wf_a7_matter_hearing_pack", route: "/matter-hearing-pack", title: "Hearing pack", line: "Gathers the dates, papers still to add and citations to look up for a hearing.", anchor: "pv-hp", usesPapers: true, startHere: false },
  { key: "wf_b2_quashing_agenda", route: "/quashing-agenda", title: "Quashing agenda", line: "Lists the Supreme Court's quashing categories; does not say whether any applies.", anchor: "pv-s3", usesPapers: true, startHere: false },
  { key: "wf_s1_matter_citation_sweep", route: "/matter-citation-sweep", title: "Citation sweep", line: "Checks that each citation in your papers exists in our index, nothing more.", anchor: "pv-s1", usesPapers: true, startHere: false },
  { key: "wf_b3_s138_checklist", route: "/s138-checklist", title: "Section 138 checklist", line: "Counts section 138 periods from dates you confirm: a checklist, not a decision.", anchor: "pv-b3", usesPapers: false, startHere: false },
  { key: "wf_a6_cheque_case_check", route: "/cheque-case-check", title: "Cheque case check", line: "Shows the review agenda and candidate dates per step; you confirm each date.", anchor: "pv-cc", usesPapers: true, startHere: false },
];

export const REGISTRY_WORDS = {
  tagUsesPapers: "Uses your papers",
  chipAvailable: "Available",
  chipComing: "Coming",
  startHere: "Start here",
} as const;

/** Where a card opens: the matter-tools page at the tool's card. */
export const REGISTRY_BASE_PATH = "/matter-tools";
export const registryHref = (e: RegistryEntry): string => `${REGISTRY_BASE_PATH}#${e.anchor}`;

/** The engine flags that are ON in the 0.6.23 release (configs/partner_api.yaml: a2, a3, a5, s1, b2, a6, a7, b3 on; a4, a8 off). Used only while the engine's status carries no `workflows` field. */
export const REGISTRY_FALLBACK_ON: readonly RegistryKey[] = REGISTRY.map((e) => e.key);

/** Available where the engine says so; with no `workflows` field in the status, the fallback set. A status that could not be read never hides a card. */
export function registryAvailable(statusWorkflows: Record<string, unknown> | null | undefined): Record<RegistryKey, boolean> {
  const has = statusWorkflows !== null && typeof statusWorkflows === "object";
  return Object.fromEntries(REGISTRY.map((e) => [e.key, has ? statusWorkflows[e.key] === true : REGISTRY_FALLBACK_ON.includes(e.key)])) as Record<RegistryKey, boolean>;
}

/** The machine-readable list for the deploy gate (Track A DRIFT-1/2): id, status, route, verb. Checked in as workflowRegistry.json and pinned equal by workflowRegistry.spec.ts. */
export const REGISTRY_MACHINE = REGISTRY.map((e) => ({ id: e.key, status: REGISTRY_FALLBACK_ON.includes(e.key) ? "Available" : "Building", route: e.route, verb: "POST" }));

/** R1's "Some tools on this page are not switched on" line is true only when at least one registry tool is unavailable; with all eight on it is not shown. */
export const someRegistryToolOff = (statusWorkflows: Record<string, unknown> | null | undefined): boolean => Object.values(registryAvailable(statusWorkflows)).some((v) => !v);
