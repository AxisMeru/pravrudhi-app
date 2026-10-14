// The assistant run (pravrudhi-app#125; engine contract assistant_v1_2, Track C 14 Oct; strings R1 14 Oct). One extra request, opted into per run with a consent tick, that
// drives the screening stages and answers the same decide result plus an `assistant` block. The app shows the decide result and a fixed-word step trace, and nothing the
// assistant wrote: `summary` and `cost` are on the wire and are never read for display. A block that does not match the contract makes the whole answer unreadable.

import { DH_ASSIST_SIGNIN } from "./dataHandling";
import { ASSISTANT_PAUSED_TEXT, type AssistantState } from "./assistantTier";

export const ASSISTANT_RUN_LABEL = "Run with the screening assistant";
/** The link beside the consent line (R1 14 Oct): names what it leads to; used only for this entry. -> /data-handling#dh-assistant */
export const ASSISTANT_DATA_LINK_TEXT = "How the assistant handles your facts";
export const STEP_TRACE_HEADING = "Steps of this screening"; // states only that these steps ran; attributes the decision to no one (R1 14 Oct)

/** Shown beside the consent tick EVERY time, per request; the tick is unticked on each load and after each run. `provider` comes from the engine; with none it names no vendor of its own. */
export function assistantConsentLine(provider?: string | null): string {
  const name = typeof provider === "string" && provider.trim() ? provider.trim() : "an AI provider";
  return `Running with the assistant sends your facts to ${name} through our account. Screening without the assistant does not.`;
}

export const ASSISTANT_TIMEOUT_TEXT = "The assistant did not finish in time; this is the screening result without it.";
export const ASSISTANT_BUDGET_TEXT = "The assistant's budget for this session is used; screening works as normal.";
export const ASSISTANT_COULD_NOT_USE_TEXT = "The assistant could not be used for this run; this is the screening result without it.";

export const STEP_NAMES = ["ingest", "select_contracts", "describe_contract", "judge_element", "quote_check", "assemble", "lean_check", "decide"] as const;
export type StepName = (typeof STEP_NAMES)[number];
export const STEP_LABELS: Readonly<Record<StepName, string>> = {
  ingest: "Read the facts",
  select_contracts: "Chose the offences",
  describe_contract: "Read the offence's ingredients",
  judge_element: "Read each ingredient",
  quote_check: "Checked the quotes",
  assemble: "Assembled the table",
  lean_check: "Ran the structure check",
  decide: "Decided",
};

export const OUTCOMES = ["finished", "timed_out", "budget", "refused"] as const;
export type AssistantOutcome = (typeof OUTCOMES)[number];
export const REASONS = ["not_configured", "paused", "consent_required", "timeout", "per_session_budget", "daily_ceiling", "error", "safety", "sign_in_required", "rate_limited"] as const;
export type AssistantReason = (typeof REASONS)[number];
export const CHECKS = ["valid", "invalid", "agrees", "differs"] as const;
export type StepCheck = (typeof CHECKS)[number];

export interface AssistantStep {
  name: StepName;
  check?: StepCheck;
}

/**
 * The engine's memo appendix (appendix_version 1, pravrudhi #416/#421), a TOP-LEVEL key of a finished assisted answer: { appendix_version, steps: [{ name, calls, check? }], per_contract, refused_calls }.
 * The app keeps the version and the steps (name, check and calls); the memo prints only the signed step labels and signed check wording (R1, #169), never counts. Anything that does not match is no appendix.
 */
export interface ScreeningAppendix {
  appendix_version: 1;
  steps: { name: StepName; check?: StepCheck; calls?: number }[];
}

/** The mock harness's check of an appendix a mock gives (the engine's pinned OpenAPI predates it): the shape recorded from the production engine 0.6.8, nothing the engine does not send. */
export function appendixViolations(v: unknown): string[] {
  if (v === undefined) return [];
  const out: string[] = [];
  if (!isObj(v)) return ["appendix: expected an object"];
  const allowed = new Set(["appendix_version", "steps", "per_contract", "refused_calls"]);
  for (const k of Object.keys(v)) if (!allowed.has(k)) out.push(`appendix.${k}: not in the recorded shape`);
  if (v.appendix_version !== 1) out.push("appendix.appendix_version: expected 1");
  if (!Array.isArray(v.steps)) out.push("appendix.steps: expected a list");
  else v.steps.forEach((s, i) => {
    if (!isObj(s)) return void out.push(`appendix.steps[${i}]: not an object`);
    for (const k of Object.keys(s)) if (!["name", "calls", "check"].includes(k)) out.push(`appendix.steps[${i}].${k}: not in the recorded shape`);
    if (!has(STEP_NAMES, s.name)) out.push(`appendix.steps[${i}].name: not a step name`);
    if (!Number.isInteger(s.calls)) out.push(`appendix.steps[${i}].calls: expected a whole number`);
    if (s.check !== undefined && !has(CHECKS, s.check)) out.push(`appendix.steps[${i}].check: not a check`);
  });
  if (v.per_contract !== undefined && !Array.isArray(v.per_contract)) out.push("appendix.per_contract: expected a list");
  if (v.refused_calls !== undefined && !Number.isInteger(v.refused_calls)) out.push("appendix.refused_calls: expected a whole number");
  return out;
}

/** Tolerant: an absent or malformed appendix is `undefined` (never an error); a step with a name or check this build does not know is left out. */
export function parseAppendix(v: unknown): ScreeningAppendix | undefined {
  if (!isObj(v) || v.appendix_version !== 1 || !Array.isArray(v.steps)) return undefined;
  const steps: ScreeningAppendix["steps"] = [];
  for (const s of v.steps) {
    if (!isObj(s) || !has(STEP_NAMES, s.name)) continue;
    const step: ScreeningAppendix["steps"][number] = { name: s.name as StepName };
    if (has(CHECKS, s.check)) step.check = s.check as StepCheck;
    if (Number.isInteger(s.calls) && (s.calls as number) >= 0) step.calls = s.calls as number;
    steps.push(step);
  }
  return steps.length > 0 ? { appendix_version: 1, steps } : undefined;
}

/** What the app keeps of the engine's `assistant` block. `summary` and `cost` are deliberately dropped. */
export interface AssistantBlock {
  used: boolean;
  outcome: AssistantOutcome;
  reason: AssistantReason | null;
  steps: AssistantStep[];
}

const has = <T extends readonly string[]>(list: T, v: unknown): v is T[number] => typeof v === "string" && (list as readonly string[]).includes(v);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** The contract's own mapping: finished has no reason; timed_out is timeout; budget is per_session_budget only; refused is any other reason. */
const OUTCOME_REASONS: Readonly<Record<AssistantOutcome, readonly (AssistantReason | null)[]>> = {
  finished: [null],
  timed_out: ["timeout"],
  budget: ["per_session_budget"],
  refused: ["not_configured", "paused", "consent_required", "daily_ceiling", "error", "safety", "sign_in_required", "rate_limited"],
};

/** The list of ways `v` is not the contract's assistant block (empty = a valid block). Used by the app's guard and by the e2e mock check. */
export function assistantViolations(v: unknown): string[] {
  const out: string[] = [];
  if (!isObj(v)) return ["assistant: not an object"];
  const allowed = new Set(["used", "outcome", "reason", "steps", "cost", "summary", "session_id"]);
  for (const k of Object.keys(v)) if (!allowed.has(k)) out.push(`assistant.${k}: not in the contract`);
  if (typeof v.used !== "boolean") out.push("assistant.used: expected boolean");
  if (!has(OUTCOMES, v.outcome)) out.push("assistant.outcome: not one of the contract's outcomes");
  const reason = v.reason === undefined ? null : v.reason;
  if (reason !== null && !has(REASONS, reason)) out.push("assistant.reason: not one of the contract's reasons");
  else if (has(OUTCOMES, v.outcome) && !OUTCOME_REASONS[v.outcome].includes(reason as AssistantReason | null)) out.push("assistant.reason: does not fit the outcome");
  if (!Array.isArray(v.steps)) out.push("assistant.steps: expected a list");
  else
    v.steps.forEach((s, i) => {
      if (!isObj(s)) return void out.push(`assistant.steps[${i}]: not an object`);
      for (const k of Object.keys(s)) if (k !== "name" && k !== "check") out.push(`assistant.steps[${i}].${k}: not in the contract`);
      if (!has(STEP_NAMES, s.name)) out.push(`assistant.steps[${i}].name: not one of the contract's stages`);
      if (s.check !== undefined && !has(CHECKS, s.check)) out.push(`assistant.steps[${i}].check: not one of the contract's checks`);
    });
  if (v.cost !== undefined && v.cost !== null) {
    const c = v.cost;
    if (!isObj(c) || !Number.isInteger(c.used_cents) || !Number.isInteger(c.budget_cents)) out.push("assistant.cost: expected integer cents");
  }
  if (v.summary !== undefined && v.summary !== null && typeof v.summary !== "string") out.push("assistant.summary: expected text or null");
  if (v.session_id !== undefined && v.session_id !== null && typeof v.session_id !== "string") out.push("assistant.session_id: expected text or null");
  return out;
}

/** Parse the engine's block into what the app keeps; throws (as an unreadable answer) on anything that does not match the contract. */
export function parseAssistantBlock(v: unknown, unreadable: () => never): AssistantBlock {
  if (assistantViolations(v).length > 0) return unreadable();
  const b = v as Record<string, unknown>;
  const steps = (b.steps as Record<string, unknown>[]).map((s) => ({ name: s.name as StepName, ...(s.check !== undefined ? { check: s.check as StepCheck } : {}) }));
  return { used: b.used as boolean, outcome: b.outcome as AssistantOutcome, reason: (b.reason ?? null) as AssistantReason | null, steps };
}

/**
 * The one plain line after a run, from the outcome and reason alone (never a reason code). finished: none. timed_out: the timeout line. budget: the session budget line.
 * refused: the paused line for the daily ceiling or a paused tier; the not-configured tier states show their own, so there is no line for `not_configured` here beyond the
 * could-not-use line; every other refusal is the could-not-use line.
 */
export function assistantOutcomeLine(b: AssistantBlock): string | null {
  switch (b.outcome) {
    case "finished":
      return null;
    case "timed_out":
      return ASSISTANT_TIMEOUT_TEXT;
    case "budget":
      return ASSISTANT_BUDGET_TEXT;
    case "refused":
      // the daily ceiling or a paused tier: the one paused line; sign-in required (an expired session): the sign-in line, shown once; every other refusal, including a rate limit, the could-not-use line with no reason
      if (b.reason === "daily_ceiling" || b.reason === "paused") return ASSISTANT_PAUSED_TEXT;
      return b.reason === "sign_in_required" ? DH_ASSIST_SIGNIN : ASSISTANT_COULD_NOT_USE_TEXT;
  }
}

/** The short forms for a trace row (the row label already says what was checked; the frontier reader keeps its own quote phrases). */
export const CHECK_PASSED_TEXT = "passed";
export const CHECK_NOT_PASSED_TEXT = "did not pass";
export const QUOTE_NOT_FOUND_ROW_TEXT = "a quote was not found in your facts";

/** A step's check in plain words, or null (shown as nothing). Lean is only "passed" / "did not pass"; a check on a stage that does not carry it is ignored. */
export function stepCheckText(s: AssistantStep): string | null {
  if (s.name === "quote_check") return s.check === "valid" ? CHECK_PASSED_TEXT : s.check === "invalid" ? QUOTE_NOT_FOUND_ROW_TEXT : null;
  if (s.name === "lean_check") return s.check === "agrees" ? CHECK_PASSED_TEXT : s.check === "differs" ? CHECK_NOT_PASSED_TEXT : null;
  return null;
}

export type EntryState = "hidden" | "greyed" | "usable" | "signin";

/**
 * What the Screening entry looks like for a tier state (R2's two hazards, 14 Oct): usable ONLY on an explicit "available" (never on "not greyed": before the first read the state is
 * "not_configured", which shows nothing); paused or unreachable are greyed; not configured is hidden; the whole entry is hidden while the assistant flag is off.
 */
export function entryState(tier: AssistantState, flagOn: boolean, signedIn: boolean | null = true): EntryState {
  if (!flagOn) return "hidden";
  if (tier === "available") return signedIn === true ? "usable" : signedIn === false ? "signin" : "hidden"; // not yet known: nothing shown, nothing enabled
  return tier === "paused" || tier === "unreachable" ? "greyed" : "hidden";
}

/** What the app keeps of GET /api/assistant (engine response model AssistantStatusResponse, pravrudhi#391): only the provider name, for the consent line. The limits and the two pending-delete ages (signed-in only) are on the wire and are never read for display. */
export interface AssistantInfo {
  provider: string;
}

/** The contract's `info` shape (response_model_exclude_unset: optional fields are absent, not null). Violations are listed for the e2e mock check; the app itself only needs `parseAssistantInfo`. */
export function assistantInfoViolations(v: unknown): string[] {
  if (!isObj(v)) return ["assistant info: not an object"];
  const out: string[] = [];
  const allowed = new Set(["provider", "call_timeout_s", "session_budget_usd", "consent_required", "assistant_tier", "oldest_pending_delete_age_s", "sweep_last_ok_age_s"]);
  for (const k of Object.keys(v)) if (!allowed.has(k)) out.push(`assistant info.${k}: not in the engine response model`);
  if (typeof v.provider !== "string") out.push("assistant info.provider: expected text");
  for (const k of ["call_timeout_s", "session_budget_usd"]) if (v[k] !== undefined && v[k] !== null && typeof v[k] !== "number") out.push(`assistant info.${k}: expected a number`);
  for (const k of ["oldest_pending_delete_age_s", "sweep_last_ok_age_s"]) if (v[k] !== undefined && v[k] !== null && !Number.isInteger(v[k])) out.push(`assistant info.${k}: expected whole seconds`);
  if (v.consent_required !== undefined && typeof v.consent_required !== "boolean") out.push("assistant info.consent_required: expected true or false");
  const t = v.assistant_tier;
  if (!isObj(t) || (t.state !== "available" && t.state !== "unavailable")) out.push("assistant info.assistant_tier: missing or not a tier");
  return out;
}

/** The provider name from a GET /api/assistant answer, or null when the answer is not the contract's (no vendor is named then). Everything else, ages included, is dropped. */
export function parseAssistantInfo(v: unknown): AssistantInfo | null {
  if (!isObj(v) || typeof v.provider !== "string" || !v.provider.trim()) return null;
  return { provider: v.provider.trim() };
}
