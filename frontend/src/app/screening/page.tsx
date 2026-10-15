"use client";

// The Screening view (O8, #830): paste or upload the facts, pick the offence, see which ingredients the facts support. The checklist is the hero;
// every new string is in lib/screening/copy.ts (R1 reviews that list). The engine's decisions are shown in plain words and never changed here.
import { Loader2, ScanSearch } from "lucide-react";
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";

import { NotSignedInNotice } from "@/components/NotSignedInNotice";
import { CaveatStrip } from "@/components/CaveatStrip";
import { RetentionBefore } from "@/components/RetentionBefore";
import { CitationsPanel } from "@/components/citations/CitationsPanel";
import { CITATIONS_PANEL_ENABLED } from "@/lib/citationNav";
import { PageHeader } from "@/components/PageHeader";
import { runAgainState } from "@/lib/runAgain";
import { ASSISTANT_ENTRY_ENABLED } from "@/lib/assistantFlag";
import { ASSISTANT_PAUSED_TEXT, pausedTreatment } from "@/lib/assistantTier";
import { AssistantRun, AssistantTrace } from "@/components/screening/AssistantRun";
import { useAssistantProvider, useAssistantState, useSignedIn } from "@/components/useAssistantTier";
import { agendaContractId } from "@/lib/screening/model";
import { AutoGrowTextarea } from "@/components/AutoGrowTextarea";
import { IngredientChecklist } from "@/components/screening/IngredientChecklist";
import { StatuteNotice } from "@/components/StatuteNotice";
import { ApiError, analyseFacts, invalidAnswerRecord, nyayaRegistryContracts, nyayaRegistryEntries, type AnalyseFactsResult } from "@/lib/api";
import { GUIDE_LANDING_LINK, GUIDE_PATH } from "@/lib/guide/copy";
import { PRODUCT_LINE } from "@/lib/productCopy";
import { NO_CONTRACTS_MESSAGE, pickerState } from "@/lib/contractsPicker";
import { IS_DEMO } from "@/lib/api";
import { ExampleBanner, ExampleNotFound } from "@/components/ExampleBanner";
import { takeHandoff, takeHandoffCitations } from "@/lib/handoff";
import { HearingPreparation } from "@/components/HearingPreparation";
import { WorkspaceSteps } from "@/components/WorkspaceSteps";
import { HEARING_NOT_OFFERED_TEXT, HEARING_PREP_BUILT, WORKSPACE_ANCHORS, WORKSPACE_LOCKED_TEXT, WORKSPACE_STEP_LABELS } from "@/lib/workspace";
import { EXAMPLES, exampleById, intakeCitationsFor, isUnchangedExample, memoExample, type DemoExample } from "@/lib/demo/example";
import { ABOUT_SCREENING_LABEL, BANNER_STANDING_LINE, EXAMPLE_ENTRY_LABEL } from "@/lib/screening/copy";
import { checkFacts, extractText, fileKind, UNREADABLE_MESSAGE } from "@/lib/factsInput";
import { DOCX_MIME } from "@/lib/docxWriter";
import { buildRunRecord, buildScreeningMemo, buildScreeningMemoDocx } from "@/lib/screening/memo";
import { splitIntoFacts } from "@/lib/screening/facts";
import { OFFENCES, offenceCheckboxName, offenceNoteIds, offenceOf } from "@/lib/screening/offences";
import { EXPORT_GROUP_LABEL, EXPORT_LABELS, MEMO_DOCX_LABEL, ipcDisclosure, NOT_VALIDATED_OFFENCE_NOTE, SCREENING_SUBTITLE, SCREENING_TITLE } from "@/lib/screening/copy";
import { classifyAnalyseError, fetchServiceStatus, formatNextOpen, isClosed, type StatusResult } from "@/lib/serviceStatus";
import { ASSISTED_RUNNING_NOTE, LEAVE_AND_RETURN_TEXT, RUNNING_STATUS_LINE, waitingFor } from "@/lib/runningCopy";
import { CHECKING_SIGN_IN_LABEL, SCREENING_FILE_NOTE, SIGNING_IN_TEXT, TIMEOUT_RETRY_TEXT, WARM_UP_NOTE, validatedById, validationLabel, validationMark } from "@/lib/surfaceCopy";

const SLOW_START_SECONDS = 200;

function download(name: string, body: string | Uint8Array, type: string): void {
  const url = URL.createObjectURL(new Blob([body as BlobPart], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ScreeningPage() {
  const [paste, setPaste] = useState("");
  // What Intake handed over: its chosen facts together with the citations it found. The citations are listed in Hearing preparation only while the screened facts are still those facts.
  const [intakeHand, setIntakeHand] = useState<{ facts: string[]; citations: Array<{ text: string }> } | null>(null);
  // An example link's facts are the first state (read from the URL on the client), so no empty box shows and then fills. The list itself is drawn only
  // after hydration (the static page cannot know the URL): until then a same-height placeholder stands where the boxes will be.
  // The first render is the static page's (one empty box): reading the URL here made the client's first render differ from the HTML and React threw hydration error #418 on ?example= links (#241). The example's facts are put in by the layout effect below, before the browser paints, so there is still no empty box on screen.
  const [facts, setFacts] = useState<string[]>([""]);
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [contracts, setContracts] = useState<string[]>([]);
  const [contractsLoaded, setContractsLoaded] = useState(false);
  const [contractsError, setContractsError] = useState<string | null>(null);
  const [contractsTry, setContractsTry] = useState(0);
  const [validated, setValidated] = useState<Map<string, boolean> | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const assistant = useAssistantState();
  const signedIn = useSignedIn();
  const assistantProvider = useAssistantProvider(assistant, signedIn);
  const [assistantConsent, setAssistantConsent] = useState(false); // per run: unticked on load and after every run, never kept
  const [example, setExample] = useState<DemoExample | null>(null);
  const [exampleMissing, setExampleMissing] = useState(false);
  const [result, setResult] = useState<AnalyseFactsResult | null>(null);
  const [request, setRequest] = useState<{ facts: string[]; contractIds: string[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false); // the sign-in re-check before anything is sent (R1, P2): not yet a request in flight
  const inflight = loading && !checking;
  const [runAssisted, setRunAssisted] = useState(false); // the run in flight is an assistant run (P7: one more line)
  const [elapsed, setElapsed] = useState(0);
  const [assistedTimeout, setAssistedTimeout] = useState<number | null>(null); // seconds the assisted run waited, set only when it ended on the app's own timeout (Run again)
  const [error, setError] = useState<string | null>(null);
  const [limitNotice, setLimitNotice] = useState<string | null>(null);
  const [invalidRunId, setInvalidRunId] = useState<string | null | undefined>(undefined); // set (to the run id or null) only when the engine's answer was unreadable
  const [notSignedIn, setNotSignedIn] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [svc, setSvc] = useState<StatusResult | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Leaving the page cancels the run in flight (#176): the request and its ticker no longer run on until the engine answers or the 320 s timeout.
  useEffect(() => () => abortRef.current?.abort(), []);
  const closed = svc?.kind === "ok" && isClosed(svc.status);
  const offline = svc?.kind === "offline";
  const resultRef = useRef<HTMLDivElement>(null);
  const warming = svc?.kind === "ok" && svc.status.judge.state === "warming";
  // The intro fold is closed by default (R1, 14 Oct) because the standing line ("This is a screening aid, not legal advice. A lawyer decides.") stays visible outside it, and so does the caveat strip (validated list, what the models read, the warming line), directly under the standing line (R1 and R2, 14 Oct).
  const picker = pickerState(contractsLoaded, contractsError !== null, contracts.length, IS_DEMO);

  useEffect(() => {
    let off = false;
    const poll = () => fetchServiceStatus().then((r) => !off && setSvc(r));
    poll();
    const id = window.setInterval(poll, 30_000);
    return () => {
      off = true;
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    let off = false;
    nyayaRegistryEntries().then((e) => !off && setValidated(validatedById(e))).catch(() => !off && setValidated(null));
    return () => {
      off = true;
    };
  }, []);

  // Choosing an example link (client-side navigation: the page does not remount, so the URL read below does not run again) loads it directly.
  function applyExample(found: DemoExample) {
    setExampleMissing(false);
    setFacts([...found.facts]);
    setExample(found);
    const ids = found.contracts.flatMap((id) => offenceOf(id)?.contracts ?? [id]);
    setPicked(new Set(ids.filter((id) => contracts.includes(id))));
  }
  // Facts chosen on the Intake page arrive through a one-time in-memory hand-off (lib/handoff.ts): taken once, never stored.
  useEffect(() => {
    const handed = takeHandoff();
    const found = takeHandoffCitations();
    if (handed && handed.length > 0) void Promise.resolve().then(() => { setFacts(handed); setIntakeHand({ facts: handed, citations: found }); });
  }, []);

  // /screening?example=<id> loads a demo example: the allegations of one public court order as numbered facts (read in the browser, as the page is a
  // static export). An id this app does not have shows the "not available" notice with a link to the first example.
  useLayoutEffect(() => {
    const asked = new URLSearchParams(window.location.search).get("example");
    const found = exampleById(asked);
    // State is set synchronously here on purpose: a layout effect's updates are flushed before the browser paints, a deferred (microtask) update is not, and one frame could then show an empty Fact F1 box (#241, R2).
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the URL is only readable in the browser; the update must land before the first paint
    if (asked !== null && found === null) setExampleMissing(true);
    if (found === null) return;
    setFacts([...found.facts]);
    setExample(found);
  }, []);

  useEffect(() => {
    let off = false;
    nyayaRegistryContracts()
      .then((cs) => {
        if (off) return;
        setContractsError(null);
        setContracts(cs);
        setContractsLoaded(true);
        const found = exampleById(new URLSearchParams(window.location.search).get("example"));
        if (found !== null) {
          // the offence is the unit of choice: every contract of an offence the example invokes
          const ids = found.contracts.flatMap((id) => offenceOf(id)?.contracts ?? [id]);
          setPicked(new Set(ids.filter((id) => cs.includes(id))));
        }
      })
      .catch((e: unknown) => {
        if (off) return;
        // A visitor the registry will not answer (401/403 signed out on an auth-required engine, 404 on a host that has no such route) who came by an example link still gets that
        // example's offences, offered and selected: the contract ids are the example's own and the engine validates them on submit (#194). Any other failure is the usual error.
        const found = exampleById(new URLSearchParams(window.location.search).get("example"));
        if (found !== null && e instanceof ApiError && [401, 403, 404].includes(e.status)) {
          const ids = found.contracts.flatMap((id) => offenceOf(id)?.contracts ?? [id]);
          setContractsError(null);
          setContracts(ids);
          setContractsLoaded(true);
          setPicked(new Set(ids));
          return;
        }
        setContractsError(e instanceof ApiError ? `Could not reach the engine's registry API (${e.status}).` : "Could not load contracts.");
      });
    return () => {
      off = true;
    };
  }, [contractsTry]);

  const offered = OFFENCES.map((o) => ({ o, ids: o.contracts.filter((c) => contracts.includes(c)) })).filter((x) => x.ids.length > 0);

  // P2: a new result is brought into view at once, so the user does not scroll past the facts they just typed.
  useEffect(() => {
    if (result) resultRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  }, [result]);

  async function submit(anonymous: boolean = false, assisted: boolean = false) {
    const cleaned = facts.map((f) => f.replace(/\s*\n\s*/g, " ").trim()).filter(Boolean);
    const check = checkFacts(cleaned.join("\n"));
    setLimitNotice(null);
    if (!check.ok) {
      if (check.neutral) { setError(null); return setLimitNotice(check.message); }
      return setError(check.message);
    }
    const ids = Array.from(picked);
    if (ids.length === 0) return setError("Pick at least one offence to screen for.");
    setLoading(true);
    setChecking(true);
    setRunAssisted(assisted);
    setError(null);
    setInvalidRunId(undefined);
    setNotSignedIn(null);
    setSigningIn(false);
    setRetrying(false);
    setResult(null);
    setAssistedTimeout(null);
    setElapsed(0);
    const startedAt = Date.now();
    const ticker = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const r = await analyseFacts(check.facts, ids, undefined, ac.signal, { allowAnonymous: anonymous, assisted, onSigningIn: () => setSigningIn(true), onRequestStart: () => { setChecking(false); setElapsed(0); }, onTimeoutRetry: () => setRetrying(true) });
      setRequest({ facts: check.facts, contractIds: ids });
      setResult(r);
    } catch (e) {
      const c = classifyAnalyseError(e);
      if (assisted && c.kind === "timeout") setAssistedTimeout(Math.round((Date.now() - startedAt) / 1000));
      if (c.kind === "not_signed_in") setNotSignedIn(c.message);
      else setError(c.message);
      if (c.kind === "invalid_answer") setInvalidRunId(c.runId ?? null);
      if (c.kind === "outside_window") fetchServiceStatus().then(setSvc);
    } finally {
      if (assisted) setAssistantConsent(false);
      window.clearInterval(ticker);
      abortRef.current = null;
      setSigningIn(false);
      setRetrying(false);
      setChecking(false);
      setLoading(false);
    }
  }

  const version = svc?.kind === "ok" ? svc.status.engine_version : null;
  const opts = () => ({ engineVersion: version, generatedAt: new Date().toISOString(), example: memoExample(request?.facts ?? [], example) });

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader title={SCREENING_TITLE} subtitle={SCREENING_SUBTITLE} />
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-4 sm:p-8">
        <WorkspaceSteps hasFacts={facts.some((f) => f.trim() !== "")} hasResult={result !== null && request !== null} />
        {!result && <p className="text-sm text-[var(--color-text)]" data-testid="standing-line">{BANNER_STANDING_LINE}</p>}
        <CaveatStrip warming={warming} />
        <details className="rounded-md border border-[var(--color-border)] p-3 print:hidden" data-testid="about-screening">
          <summary className="cursor-pointer text-sm font-medium text-[var(--color-text)] max-md:py-3">{ABOUT_SCREENING_LABEL}</summary>
          <div className="mt-3 flex flex-col gap-3">
            <p className="text-sm text-[var(--color-text)]" data-testid="product-line">{PRODUCT_LINE}</p>
            <p className="text-sm" data-testid="guide-link">
              <Link href={GUIDE_PATH} className="text-[var(--color-accent)] underline">{GUIDE_LANDING_LINK}</Link>
            </p>
          </div>
        </details>
        {exampleMissing && <ExampleNotFound page="/screening" />}
        {example && isUnchangedExample(facts, example) && <ExampleBanner example={example} />}
        {!example && (
          <div className="flex flex-col gap-1 print:hidden" data-testid="example-entry">
            <p className="text-sm font-medium text-[var(--color-text)]">{EXAMPLE_ENTRY_LABEL}</p>
            <ul className="flex flex-col gap-1 text-sm">
              {EXAMPLES.map((e) => (
                <li key={e.id}>
                  <Link href={`/screening?example=${e.id}`} onClick={(ev) => {
                      // only a plain primary click loads the example here; a modified or middle click opens the link elsewhere (the same test next/link uses) and must not touch this tab's facts
                      if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
                      applyExample(e);
                    }} className="inline-flex min-h-6 items-center text-[var(--color-accent)] underline" data-testid={`example-link-${e.id}`}>{e.citation}</Link>
                </li>
              ))}
            </ul>
          </div>
        )}
        <section className="flex flex-col gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 print:hidden" aria-label="Facts" id="step-facts">
          <RetentionBefore />
          <label className="text-sm font-medium text-[var(--color-text)]" htmlFor="screening-paste">Paste the FIR, complaint or narrative</label>
          <AutoGrowTextarea
            id="screening-paste"
            maxRows={14}
            className="min-h-[100px] rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-2 text-sm text-[var(--color-text)]"
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
          />
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="file"
              accept=".txt,.pdf,.docx"
              aria-label="Load facts from a file"
              data-testid="facts-file"
              className="text-sm max-md:min-h-11"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                let parsers = {};
                if (fileKind(file.name) !== "txt") {
                  try {
                    parsers = (await import("@/lib/docParsers")).browserParsers;
                  } catch {
                    return setError(UNREADABLE_MESSAGE);
                  }
                }
                const r = await extractText(file, parsers);
                if (r.ok) {
                  setPaste(r.text);
                  setError(null);
                } else setError(r.message);
              }}
            />
            <button
              type="button"
              className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm"
              data-testid="split-facts"
              onClick={() => {
                const parts = splitIntoFacts(paste);
                if (parts.length > 0) setFacts(parts);
              }}
            >
              Split into numbered facts
            </button>
          </div>
          <p className="text-xs text-[var(--color-text-dim)]">{SCREENING_FILE_NOTE}</p>
          {!hydrated && <div className="h-11 rounded-md border border-[var(--color-border)]" data-testid="fact-list-pending" aria-hidden="true" />}
          <ol className="flex flex-col gap-2" aria-label="Numbered facts" data-testid="fact-list" hidden={!hydrated}>
            {hydrated && facts.map((f, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-2 w-8 shrink-0 font-mono text-xs text-[var(--color-text-dim)]">F{i + 1}</span>
                <AutoGrowTextarea
                  aria-label={`Fact F${i + 1}`}
                  className="min-h-[44px] flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-2 text-sm text-[var(--color-text)]"
                  value={f}
                  onChange={(e) => setFacts((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))}
                />
                <button
                  type="button"
                  className="mt-1 inline-flex min-h-6 min-w-6 items-center justify-center px-1 text-xs text-[var(--color-text-dim)] underline max-md:min-h-11 max-md:min-w-11"
                  aria-label={`Remove fact F${i + 1}`}
                  onClick={() => setFacts((prev) => (prev.length > 1 ? prev.filter((_, j) => j !== i) : [""]))}
                >
                  Remove
                </button>
              </li>
            ))}
          </ol>
          <button type="button" className="inline-flex w-fit items-center text-sm text-[var(--color-text-dim)] underline max-md:min-h-11 max-md:min-w-11" onClick={() => setFacts((p) => [...p, ""])}>
            Add a fact
          </button>

          <fieldset className="mt-2 flex flex-col gap-2" id="step-screen">
            <legend className="text-sm font-medium text-[var(--color-text)]">What to screen for</legend>
            {picker === "error" ? (
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm text-[var(--color-danger)]" role="alert" data-testid="contracts-error">{contractsError}</p>
                <button type="button" className="text-sm text-[var(--color-text-dim)] underline" data-testid="contracts-retry" onClick={() => { setContractsError(null); setContractsTry((n) => n + 1); }}>
                  Try again
                </button>
              </div>
            ) : picker === "empty" ? (
              <p className="text-sm text-[var(--color-warn)]" role="status" data-testid="contracts-empty">{NO_CONTRACTS_MESSAGE}</p>
            ) : picker === "loading" ? (
              <p className="text-sm text-[var(--color-text-dim)]" role="status">Loading…</p>
            ) : (
              <ul className="flex flex-col gap-2" data-testid="offence-list">
                {offered.map(({ o, ids }) => {
                  const on = ids.every((i) => picked.has(i));
                  return (
                    <li key={o.id}>
                      <label className={`flex cursor-pointer items-start gap-2 rounded-md border p-2 text-sm max-md:min-h-11 ${on ? "border-[var(--color-accent)]" : "border-[var(--color-border)]"}`}>
                        <input
                          type="checkbox"
                          className="mt-1 h-6 w-6 shrink-0"
                          aria-label={offenceCheckboxName(o)}
                          aria-describedby={offenceNoteIds(o).join(" ") || undefined}
                          checked={on}
                          onChange={() => setPicked((prev) => {
                            const next = new Set(prev);
                            for (const i of ids) {
                              if (on) next.delete(i);
                              else next.add(i);
                            }
                            return next;
                          })}
                        />
                        <span>
                          <span className="text-[var(--color-text)]">{o.title}</span>
                          {o.sections && <span className="ml-2 text-xs text-[var(--color-text-dim)]">{o.sections}</span>}
                          {o.notValidated && (
                            <span className="mt-0.5 block text-xs text-[var(--color-text-dim)]" id={`offence-${o.id}-not-validated`} data-testid="not-validated-note">{NOT_VALIDATED_OFFENCE_NOTE}</span>
                          )}
                          {o.ipcChecked && (
                            <span className="mt-0.5 block text-xs text-[var(--color-text-dim)]" id={`offence-${o.id}-ipc`} data-testid="ipc-disclosure">{ipcDisclosure(o.ipcChecked)}</span>
                          )}
                          {ids.some((i) => validationLabel(validationMark(validated, i))) && (
                            <span className="ml-2 text-xs text-[var(--color-warn)]">({validationLabel(validationMark(validated, ids[0]))})</span>
                          )}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </fieldset>

          {pausedTreatment(assistant, ASSISTANT_ENTRY_ENABLED).line && (
            <p className="text-xs text-[var(--color-text-dim)]" data-testid="assistant-paused">
              {ASSISTANT_PAUSED_TEXT}
            </p>
          )}

          {ASSISTANT_ENTRY_ENABLED && <AssistantRun
            state={assistant}
            signedIn={signedIn}
            consent={assistantConsent}
            onConsent={setAssistantConsent}
            provider={assistantProvider}
            busy={loading || closed || offline}
            onRun={() => submit(false, true)}
            runAgain={runAgainState({ assisted: assistedTimeout !== null, timedOut: assistedTimeout !== null, secondsSinceFirstSubmit: assistedTimeout ?? 0 })}
          />}

          <button
            type="button"
            onClick={() => submit()}
            disabled={loading || closed || offline}
            className="inline-flex w-fit items-center gap-2 rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-[var(--color-on-accent)] disabled:opacity-50"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <ScanSearch size={14} />}
            {checking ? CHECKING_SIGN_IN_LABEL : loading ? "Screening…" : "Screen these facts"}
          </button>
          {closed && svc?.kind === "ok" && svc.status.service_window && (
            <p className="text-sm text-[var(--color-warn)]" role="status" data-testid="screening-offline">
              The hosted demo is offline outside its service hours ({formatNextOpen(svc.status.service_window)}). Nothing is sent while it is closed.
            </p>
          )}
          {offline && (
            <p className="text-sm text-[var(--color-warn)]" role="status" data-testid="screening-engine-offline">
              The engine is not answering right now. Nothing is sent until it is back.
            </p>
          )}
          {checking && signingIn && <p className="text-sm text-[var(--color-text-dim)]" aria-live="polite" data-testid="signing-in">{SIGNING_IN_TEXT}</p>}
          {inflight && (
            <>
              <button type="button" onClick={() => abortRef.current?.abort()} data-testid="screening-cancel" className="w-fit text-sm text-[var(--color-text-dim)] underline">
                Cancel
              </button>
              {signingIn && <p className="text-sm text-[var(--color-text-dim)]" aria-live="polite" data-testid="signing-in">{SIGNING_IN_TEXT}</p>}
              {retrying && <p className="text-sm text-[var(--color-text-dim)]" aria-live="polite" data-testid="timeout-retry">{TIMEOUT_RETRY_TEXT}</p>}
              <p className="text-sm text-[var(--color-text)]" aria-live="polite" data-testid="running-status">{RUNNING_STATUS_LINE}</p>
              <p className="font-mono text-sm text-[var(--color-text-dim)]" data-testid="running-elapsed">{waitingFor(elapsed)}</p>
              {runAssisted && <p className="text-sm text-[var(--color-text-dim)]" data-testid="running-assisted">{ASSISTED_RUNNING_NOTE}</p>}
              {!signingIn && <p className="text-sm text-[var(--color-text-dim)]" aria-live="polite">{WARM_UP_NOTE}</p>}
              <p className="text-sm text-[var(--color-text-dim)]" data-testid="running-leave">{LEAVE_AND_RETURN_TEXT}</p>
            </>
          )}
          {inflight && elapsed >= SLOW_START_SECONDS && (
            <p className="text-sm text-[var(--color-warn)]" role="status">
              This is taking longer than a normal start. The analysis models may be switched off at the moment. You can cancel and try again later; no result is returned until they answer.
            </p>
          )}
          {notSignedIn && <NotSignedInNotice message={notSignedIn} onAnonymous={() => submit(true)} exampleFacts={isUnchangedExample(facts, example)} />}
          {limitNotice && <p className="text-sm text-[var(--color-text)]" role="status" data-testid="facts-limit-notice">{limitNotice}</p>}
          {error && <p className="text-sm text-[var(--color-danger)]" role="alert" data-testid="screening-error">{error}</p>}
          {invalidRunId !== undefined && (
            <div className="print:hidden">
              <button type="button" className="rounded-md border border-[var(--color-border)] px-2 py-1 text-xs" data-testid="invalid-run-record" onClick={() => download(`run-record-${invalidRunId ?? "unknown"}.json`, invalidAnswerRecord(invalidRunId), "application/json")}>
                {EXPORT_LABELS.runRecord}
              </button>
            </div>
          )}
        </section>

        {/* #232: the Memo and Hearing preparation anchors exist before a result too, so a /workflows link to them lands on a line that says why they are empty (the same words as the step bar). */}
        {!result && (
          <div className="flex flex-col gap-2 text-sm text-[var(--color-text-dim)] print:hidden" data-testid="locked-steps">
            <p id={WORKSPACE_ANCHORS.memo} className="scroll-mt-4" data-testid="locked-memo"><span className="font-medium text-[var(--color-text)]">{WORKSPACE_STEP_LABELS.memo}.</span> {WORKSPACE_LOCKED_TEXT}</p>
            <p id={WORKSPACE_ANCHORS.hearing} className="scroll-mt-4" data-testid="locked-hearing"><span className="font-medium text-[var(--color-text)]">{WORKSPACE_STEP_LABELS.hearing}.</span> {HEARING_PREP_BUILT ? WORKSPACE_LOCKED_TEXT : HEARING_NOT_OFFERED_TEXT}</p>
          </div>
        )}

        {result && request && (
          <div ref={resultRef} className="flex scroll-mt-4 flex-col gap-6" data-testid="screening-result">
            {/* Print only (#234; no new words: the step's own "Facts" label, then the facts as submitted, numbered as the memo numbers them). The form is hidden on paper, so without this the printout carries only the facts a row happens to cite. */}
            <section className="hidden print:block" aria-hidden data-testid="print-facts">
              <h2 className="text-base font-semibold">Facts</h2>
              <ol className="mt-2 flex flex-col gap-1 text-sm">
                {request.facts.map((f, i) => (
                  <li key={i}><span className="font-mono">F{i + 1}</span> {f}</li>
                ))}
              </ol>
            </section>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 print:hidden" data-testid="memo-actions" id="step-memo">
              <div role="group" aria-labelledby="memo-group-label" className="flex flex-wrap items-center gap-2" data-testid="memo-group">
                <span id="memo-group-label" className="text-sm font-medium text-[var(--color-text)]">{EXPORT_GROUP_LABEL}</span>
                <button type="button" className="rounded-md border border-[var(--color-border)] px-2 py-1 text-xs" onClick={() => download(`screening-memo-${result.run_id}.md`, buildScreeningMemo(result, opts()), "text/markdown")}>
                  {EXPORT_LABELS.memo}
                </button>
                <button type="button" className="rounded-md border border-[var(--color-border)] px-2 py-1 text-xs" data-testid="memo-docx" onClick={() => download(`screening-memo-${result.run_id}.docx`, buildScreeningMemoDocx(result, opts()), DOCX_MIME)}>
                  {MEMO_DOCX_LABEL}
                </button>
              </div>
              {/* R1 (15 Oct): "Print / save as PDF" opens the browser's print window and downloads nothing, so it sits BESIDE the "Download the memo" group, not under it. */}
              <button type="button" className="rounded-md border border-[var(--color-border)] px-2 py-1 text-xs" data-testid="memo-print" onClick={() => window.print()}>
                {EXPORT_LABELS.print}
              </button>
              <button type="button" className="rounded-md border border-[var(--color-border)] px-2 py-1 text-xs" onClick={() => download(`run-record-${result.run_id}.json`, buildRunRecord(request, result, opts()), "application/json")}>
                {EXPORT_LABELS.runRecord}
              </button>
            </div>
            {result.assistant && <AssistantTrace block={result.assistant} hideLine={assistant === "paused" && result.assistant.outcome === "refused" && (result.assistant.reason === "daily_ceiling" || result.assistant.reason === "paused")} />}
            {/* R1 (15 Oct): the standing line appears once per result, above the first block, not in every block's banner (before a result it stands at the top of the page). */}
            <p className="text-sm text-[var(--color-text)]" data-testid="standing-line">{BANNER_STANDING_LINE}</p>
            {result.contracts.map((c, i) => (
              <IngredientChecklist key={c.contract_id} contract={c} facts={result.facts} live={i === 0} agenda={c.contract_id === agendaContractId(result.contracts, result.facts)} />
            ))}
            {HEARING_PREP_BUILT && <HearingPreparation result={result} intakeCitations={intakeCitationsFor(request?.facts ?? [], intakeHand)} />}
            {CITATIONS_PANEL_ENABLED && <CitationsPanel />}
            <StatuteNotice />
            {/* P3: the machine identifiers come last, not first. The same text as before, only lower. */}
            <div className="text-xs text-[var(--color-text-dim)]" data-testid="run-ids">run {result.run_id} · score sha <span className="break-all font-mono">{result.score_sha256}</span></div>
          </div>
        )}
      </div>
    </div>
  );
}
