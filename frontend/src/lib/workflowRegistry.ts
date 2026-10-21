// The workflow registry (Advisor Q6, Lead-2 adopted 20 Oct): ONE entry per engine workflow, keyed by the engine's own wf_* flag id, so /workflows and the nav read the same list.
// WORDS are static and R1's (WORKFLOW_REGISTRY_WORDS_DRAFT_R1_2026-10-20.md sha12 bda372ae9d62; pinned by hash in workflowRegistry.spec.ts). AVAILABILITY is dynamic when the engine reports it:
// GET /api/v1/status `workflows: {wf_key: bool}` (engine #571, ships IN engine 0.6.24; the app reads it at runtime (useEngineWorkflows, #470); an engine without the field, an anonymous visitor on a hosted engine, or a status that cannot be read uses REGISTRY_FALLBACK_ON, the 0.6.23 set pinned to configs/partner_api.yaml).
// The page shows these cards only on a build with NEXT_PUBLIC_WORKFLOWS_V2=1 (lib/workflowsV2Flag.ts).
export type RegistryKey =
  | "wf_a2_span_index"
  | "wf_a3_chronology"
  | "wf_a5_ingredient_agenda"
  | "wf_s1_matter_citation_sweep"
  | "wf_b2_quashing_agenda"
  | "wf_a6_cheque_case_check"
  | "wf_a7_matter_hearing_pack"
  | "wf_b3_s138_checklist"
  | "wf_a4_bail_drafting"
  | "wf_a8_synopsis_list_of_dates"
  | "wf_b1_section_lookup";

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
  /** An optional second short line under the card (R1, #502: the declaration the drafting rows require). */
  note?: string;
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

/**
 * The two drafting workflows (A4 bail drafting, A8 synopsis with a list of dates; #502, Lead-2: what is built must show in production): live on /matter-tools and ON in the engine since 0.6.24, template only (no model).
 * They are listed on /workflows only on a build that has their cards (NEXT_PUBLIC_DRAFTING_CARDS=1), so no card links to an anchor that is not on the page. R1's words for both rows are pinned in workflowRegistry.spec.ts.
 */
const DECLARATION_NOTE = "You first say if a person under 18, a sexual offence or trafficking is involved."; // R1 d01a5f640a2e2d8f (REGISTRY_A4_A8_ROWS_R1 8e64dfe094a2): the second line under EACH drafting row
export const REGISTRY_DRAFTING: readonly RegistryEntry[] = [
  { key: "wf_a4_bail_drafting", route: "/bail-draft", title: "Bail application grounds", line: "A first draft of bail grounds from facts you enter, for a lawyer to rewrite.", anchor: "pv-bail", usesPapers: false, startHere: false, note: DECLARATION_NOTE },
  { key: "wf_a8_synopsis_list_of_dates", route: "/synopsis-dates", title: "Synopsis and list of dates", line: "Lists dates with sources; drafts a synopsis only where it can, for a lawyer to rewrite.", anchor: "pv-synopsis", usesPapers: true, startHere: false, note: DECLARATION_NOTE },
];

/**
 * The section look-up row (B1; Lead-2, 21 Oct: an 11th row). Listed ONLY on a build with NEXT_PUBLIC_SECTION_LOOKUP=1, the flag of the card it opens, and never Available unless the engine's own status map says wf_b1_section_lookup is true (the older-engine fallback is the original eight).
 * R1's words (REGISTRY_B1_ROW_R1_2026-10-21.md sha12 ce7f2fb654ea) are pinned in workflowRegistry.spec.ts. It is not in the machine list the deploy gate reads (REGISTRY_MACHINE): that list is the always-on rows.
 */
export const REGISTRY_LOOKUP: RegistryEntry = { key: "wf_b1_section_lookup", route: "/section-lookup", title: "Old section look-up", line: "Shows the table's section for an old IPC or CrPC number; old CrPC text is not held.", anchor: "pv-sl", usesPapers: false, startHere: false };

/** The entries /workflows lists: the eight, plus the two drafting rows on a build that has the drafting cards, plus the look-up row on a build with the look-up card. */
export const registryEntries = (draftingCards: boolean, sectionLookup = false): readonly RegistryEntry[] => [...REGISTRY, ...(draftingCards ? REGISTRY_DRAFTING : []), ...(sectionLookup ? [REGISTRY_LOOKUP] : [])];

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

/** The status answer's `workflows` field as booleans only (a non-boolean entry is dropped, never guessed); null when the field is absent or not an object (an older engine, or no status). */
export function parseStatusWorkflows(x: unknown): Record<string, boolean> | null {
  if (x === null || typeof x !== "object" || Array.isArray(x)) return null;
  const out: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(x as Record<string, unknown>)) if (typeof v === "boolean") out[k] = v;
  return Object.keys(out).length > 0 ? out : null; // an object with no boolean in it is no usable map (never "all off")
}

/** Available where the engine says so; with no `workflows` field in the status, the fallback set. A status that could not be read never hides a card. */
export function registryAvailable(statusWorkflows: Record<string, unknown> | null | undefined): Record<RegistryKey, boolean> {
  const has = statusWorkflows !== null && typeof statusWorkflows === "object";
  return Object.fromEntries([...REGISTRY, ...REGISTRY_DRAFTING, REGISTRY_LOOKUP].map((e) => [e.key, has ? statusWorkflows[e.key] === true : REGISTRY_FALLBACK_ON.includes(e.key)])) as Record<RegistryKey, boolean>;
}

/** The machine-readable list for the deploy gate (Track A DRIFT-1/2): id, status, route, verb. Checked in as workflowRegistry.json and pinned equal by workflowRegistry.spec.ts. */
export const REGISTRY_MACHINE = [...REGISTRY, ...REGISTRY_DRAFTING].map((e) => ({ id: e.key, status: "Available", route: e.route, verb: "POST" })); // ten rows: the eight, then A4 and A8 (on in the engine since 0.6.24)


/** What the app knows about the engine's workflows: still reading, could not read, a readable status with no `workflows` field (an older engine), or the engine's own map. */
export type WorkflowsRead = { kind: "loading" } | { kind: "unreadable" } | { kind: "none" } | { kind: "map"; map: Record<string, boolean> };

/** The two drafting cards' flag ids (A4 bail drafting, A8 synopsis and list of dates): off-registry, shown on the matter-tools page only with NEXT_PUBLIC_DRAFTING_CARDS=1. */
export const DRAFTING_WORKFLOW_KEYS = ["wf_a4_bail_drafting", "wf_a8_synopsis_list_of_dates"] as const;

/**
 * R1's rule (20 Oct, #475): the "Some tools on this page are not switched on in this deployment" line is true, so shown, ONLY when a tool the page shows (a registry tool, or the A4/A8 card when those cards are on) is reported off.
 * A map that exists counts a missing key as off. A status that cannot be read, or has not been read yet, HIDES the line (never claim a tool is off on a guess). A readable status with no map (0.6.23 or older) uses the pinned fallback:
 * the eight registry tools on, A4/A8 off, so the line shows only when the A4/A8 cards are on.
 */
export function toolsOffLineShown(read: WorkflowsRead, draftingCardsOn: boolean): boolean {
  if (read.kind === "loading" || read.kind === "unreadable") return false;
  if (read.kind === "none") return draftingCardsOn;
  const shown: string[] = [...REGISTRY.map((e) => e.key), ...(draftingCardsOn ? DRAFTING_WORKFLOW_KEYS : [])];
  return shown.some((k) => read.map[k] !== true);
}

/** The map the registry cards use: the engine's own when there is one, else null (the fallback set). */
export const readMap = (read: WorkflowsRead): Record<string, boolean> | null => (read.kind === "map" ? read.map : null);
