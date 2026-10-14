import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";

import { BANNED } from "./wordingAudit";
import { DATA_HANDLING_SUBTITLE, DH_ASSIST_CONSENT, DH_ASSIST_DELETE, DH_ASSIST_INTRO, DH_ASSIST_LAW, DH_ASSIST_LINK_TEXT, DH_ASSIST_SIGNIN, DH_ASSIST_TERMS, ASSISTANT_DELETE_CONFIRMED, ASSISTANT_RETENTION_MAX_HOURS, DH_NOASSIST, DH_WHERE_ASSIST, FIRM_STORAGE_KEYS, dataHandlingSections } from "./dataHandling";
import { promiseHits } from "../../e2e/support/noTrainingPromise";
import { canSeeNotifications } from "./runsAccess";
import { WORKFLOWS, WORKFLOWS_CLOSING } from "./workflowsCopy";

const ROUTE_A = dataHandlingSections(false, false); // the page without the assistant: the shipped default, whatever the build flag is
const text = (id: string) => ROUTE_A.find((s) => s.id === id)!.paragraphs.join(" ");

test("the data-handling text is R1's exact words, and it answers all three questions of its subtitle", () => {
  assert.equal(DATA_HANDLING_SUBTITLE, "What leaves your firm when you use Pravrudhi-Nyaya, where it is processed, and how long it is kept.");
  assert.equal(text("sent"), "When you press Screen these facts, the facts you enter and the offences you select are sent to the Pravrudhi engine. Files you choose are read in your browser; only the text read from them is sent.");
  assert.equal(
    text("kept"),
    "Run records are kept for up to 7 days. They are removed when the next analysis runs, and can disappear earlier if the service restarts. Signed-in and anonymous runs are kept the same way. A run record can include the text of facts the screening marked as supported, so do not enter real names or case details unless your firm's setup allows it. Partner audit records hold no fact text and are kept for up to 90 days. Requests that run asynchronously are held in memory for about an hour.",
  );
  assert.equal(
    text("where"),
    "The screening runs on the Pravrudhi engine, hosted on RunPod (serverless, in an EU data centre). The larger of the two screening models runs in EU data centres; the region of the other is not fixed. This app is hosted on Vercel, whose region is not fixed. Sign-in is handled by Supabase; its location is not stated here. The hosting providers may keep their own logs.",
  );
  assert.equal(text("browser"), "For a signed-in member, your browser keeps your sign-in session, your recent pages in the command palette and your theme choice. The facts you type are not kept in your browser. The public demo also keeps two notification-preference flags.");
  assert.equal(text("frontier"), "Use a frontier model as an additional reader. Not available: this deployment has not switched the frontier reader on.");
  assert.equal(text("citations"), "The citation check does not save the citation or the quote you enter.");
});

test("what must NOT be said is not said: no region for the smaller model, no 'no fact text', no training promise", () => {
  const all = ROUTE_A.map((s) => s.paragraphs.join(" ")).join(" ");
  assert.doesNotMatch(all, /no fact text is kept|smaller[^.]*\bEU\b|\bkept for 7 days\b/i);
  assert.deepEqual(promiseHits(all), [], "the data-handling text makes no training or evaluation promise");
  assert.match(all, /up to 7 days/);
});

test("the sentences new to this page carry no banned word (the citation check's own signed sentence is quoted, not written here)", () => {
  for (const s of ROUTE_A) {
    if (s.id === "citations") continue;
    for (const p of s.paragraphs) assert.doesNotMatch(p, BANNED, p);
  }
});

test("/workflows: one status word each, R1's closing line, no figure or id", () => {
  assert.deepEqual(WORKFLOWS.map((w) => [w.name, w.status]), [["Screening orchestration", "Building"], ["Intake", "Planned"], ["Memo preparation", "Planned"], ["Matter update review", "Planned"], ["Hearing preparation", "Planned"]]);
  assert.equal(WORKFLOWS[0].note, "The step-by-step screening assistant is in development. In development checks on invented matters it completed every screening and produced a decision result each time. The app shows you only the engine's decision result, never an assistant's own wording of it. Not yet offered in the product.");
  assert.equal(WORKFLOWS_CLOSING, "A workflow runs only when you start it, and only on the matter you give it.");
  assert.doesNotMatch(JSON.stringify(WORKFLOWS) + WORKFLOWS_CLOSING, /\d|\bA[0-9]\b/);
});

// "Stored in your browser" claims only three keys. Any other browser-storage key in src must be on this list of non-firm ones or this test fails and the page's sentence needs a new read.
const DEMO_ONLY_KEYS: readonly string[] = [
  "pravrudhi.notifications.asked", "pravrudhi.notifications.optin", // written by NotificationBell, which renders only where canSeeNotifications(access, IS_DEMO) is true: the public demo, never a signed-in member
];
const NON_FIRM_KEYS: readonly string[] = [...DEMO_ONLY_KEYS];
const root = join(__dirname, "..");
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.spec\.ts$/.test(name)) out.push(p);
  }
  return out;
}

test("the firm surface stores in the browser only the three keys the data-handling page names (and uses no cookie, sessionStorage, IndexedDB or service worker)", () => {
  const used = new Set<string>();
  const forbidden: string[] = [];
  for (const f of walk(root)) {
    const src = readFileSync(f, "utf8").replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
    const rel = relative(root, f);
    if (/document\.cookie|sessionStorage|indexedDB|serviceWorker/.test(src)) forbidden.push(rel);
    if (!/localStorage/.test(src)) continue;
    // The keys are the string constants these files hand to localStorage.
    for (const m of src.matchAll(/(?:STORAGE_KEY|RECENTS_KEY|OPTIN_KEY|ASKED_KEY|THEME_KEY)\s*=\s*"([^"]+)"/g)) used.add(m[1]);
    // annotations.ts keys are built from a prefix: Studio's run-page notes, not a firm-surface item.
    if (rel.endsWith("annotations.ts")) continue;
    if (!/(STORAGE_KEY|RECENTS_KEY|OPTIN_KEY|ASKED_KEY|THEME_KEY)/.test(src)) forbidden.push(`${rel}: localStorage with a key this test does not know`);
  }
  assert.deepEqual(forbidden, []);
  for (const k of used) assert.ok(FIRM_STORAGE_KEYS.includes(k) || NON_FIRM_KEYS.includes(k), `storage key "${k}" is on neither list: the data-handling sentence needs a new read`);
  for (const k of FIRM_STORAGE_KEYS) assert.ok(used.has(k), `the page names "${k}" but no source uses it`);
});

/** Every local file reachable from `entries` by a value import (`import type` is erased at build time, so it is not followed). */
function importClosure(entries: string[]): string[] {
  const src = root;
  const seen = new Set<string>();
  const resolve = (from: string, spec: string): string | null => {
    const base = spec.startsWith("@/") ? join(src, spec.slice(2)) : spec.startsWith(".") ? join(from, "..", spec) : null;
    if (!base) return null;
    for (const c of [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts")]) if (existsSync(c) && statSync(c).isFile()) return c;
    return null;
  };
  const visit = (file: string) => {
    if (seen.has(file)) return;
    seen.add(file);
    const code = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    for (const m of code.matchAll(/(?:^|\n)\s*(?:import|export)(\s+type)?[^;'"]*?from\s+["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)|(?:^|\n)\s*import\s+["']([^"']+)["']/g)) {
      if (m[1]) continue;
      const next = resolve(file, m[2] ?? m[3] ?? m[4]);
      if (next) visit(next);
    }
  };
  for (const e of entries) visit(join(src, e));
  return [...seen].map((f) => relative(src, f)).sort();
}

test("the memo, the run record and the file-reading path make no network call in any file they import (the page says they are built in the browser)", () => {
  const files = importClosure(["lib/screening/memo.ts", "lib/memo.ts", "lib/factsInput.ts", "lib/screening/facts.ts", "lib/docParsers.ts", "lib/docxArchive.ts", "lib/docx.worker.ts"]);
  for (const must of ["lib/screening/memo.ts", "lib/memo.ts", "lib/factsInput.ts", "lib/screening/facts.ts", "lib/docParsers.ts", "lib/docxArchive.ts", "lib/docx.worker.ts"]) assert.ok(files.includes(must), `${must} is in the closure`);
  assert.ok(!files.includes("lib/api.ts") && !files.some((f) => /(^|\/)(api|engineFetch|supabase)[^/]*\.tsx?$/.test(f)), `no network module is imported by value: ${files.join(", ")}`);
  for (const f of files) {
    const code = readFileSync(join(root, f), "utf8").replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
    assert.doesNotMatch(code, /\bfetch\(|XMLHttpRequest|sendBeacon|FormData|engineFetch|WebSocket|EventSource/, f);
    assert.doesNotMatch(code, /cMapUrl|standardFontDataUrl/, `${f}: pdf.js loads no remote font or cMap data`);
  }
  // the pdf.js worker is an asset served from this origin, built from the package by the bundler
  assert.match(readFileSync(join(root, "lib/docParsers.ts"), "utf8"), /workerSrc = new URL\("pdfjs-dist\/build\/pdf\.worker\.min\.mjs", import\.meta\.url\)/);
});

test("the two notification flags are demo-only: the page says so, and no member path writes them (R1, 13 Oct)", () => {
  assert.deepEqual([...DEMO_ONLY_KEYS], ["pravrudhi.notifications.asked", "pravrudhi.notifications.optin"]);
  assert.ok(text("browser").endsWith("The public demo also keeps two notification-preference flags."));
  for (const k of DEMO_ONLY_KEYS) assert.ok(!FIRM_STORAGE_KEYS.includes(k), `${k} is not one of the member keys`);
  const bell = readFileSync(join(root, "components", "notifications", "NotificationBell.tsx"), "utf8");
  for (const k of DEMO_ONLY_KEYS) assert.ok(bell.includes(`"${k}"`), `NotificationBell writes ${k}`);
  assert.equal(canSeeNotifications("member", false), false);
  assert.equal(canSeeNotifications(undefined, false), false);
  assert.equal(canSeeNotifications(undefined, true), true);
  assert.ok(readFileSync(join(root, "components", "Sidebar.tsx"), "utf8").includes("canSeeNotifications(whoami.access, IS_DEMO) && <NotificationBell />"));
});

// #125 (R1 14 Oct): the assistant section, its "where" sentence and its delete sentence are each behind a flag.
const ids = (secs: readonly { id: string }[]) => secs.map((s) => s.id);
const para = (secs: readonly { id: string; paragraphs: string[] }[], id: string) => secs.find((s) => s.id === id)?.paragraphs ?? [];

test("assistant flag OFF (the shipped default here): no assistant section and no 'where' sentence about it: the page is route A only", () => {
  assert.ok(!ids(ROUTE_A).includes("assistant"));
  assert.ok(!para(dataHandlingSections(false, true), "where").includes(DH_WHERE_ASSIST));
  assert.ok(!JSON.stringify(dataHandlingSections(false, true)).includes("Anthropic"));
});

test("assistant flag ON: R1's section in order with the exact words; the delete sentence only when separately confirmed; the 'where' sentence is added", () => {
  const on = dataHandlingSections(true, false);
  assert.deepEqual(ids(on).slice(0, 2), ["sent", "assistant"]);
  assert.equal(on.find((s) => s.id === "assistant")!.heading, "Screening with the assistant (optional)");
  assert.deepEqual(para(on, "assistant"), [DH_NOASSIST, DH_ASSIST_INTRO, DH_ASSIST_TERMS, DH_ASSIST_LAW, DH_ASSIST_CONSENT, DH_ASSIST_SIGNIN]);
  assert.deepEqual(para(dataHandlingSections(true, true), "assistant"), [DH_NOASSIST, DH_ASSIST_INTRO, DH_ASSIST_TERMS, DH_ASSIST_DELETE, DH_ASSIST_LAW, DH_ASSIST_CONSENT, DH_ASSIST_SIGNIN]);
  assert.equal(para(on, "where").at(-1), DH_WHERE_ASSIST);
  assert.equal(DH_ASSIST_INTRO, "With the assistant, and only when you tick the consent box for that run, your facts are also sent to Anthropic through our account, under Anthropic's commercial terms.");
  assert.ok(DH_ASSIST_INTRO.includes(DH_ASSIST_LINK_TEXT));
  assert.equal(DH_ASSIST_DELETE, "When your screening finishes, we delete the assistant's session record from Anthropic's service. If that fails, we retry, and it is deleted within 2 hours at the latest.");
  assert.equal(DH_ASSIST_SIGNIN, "The assistant is offered only to signed-in users. Without signing in, you get the screening result without it.");
  assert.equal(DH_ASSIST_LAW, "Anthropic may keep content longer where the law requires it or to enforce its usage policy.");
  assert.equal(DH_ASSIST_CONSENT, "The consent box is off for every run until you tick it.");
});

test("the assistant section names no retention period and says nothing about the pause mechanism; only the terms sentence is exempt from the promise scan", () => {
  const all = para(dataHandlingSections(true, true), "assistant").concat(DH_WHERE_ASSIST).join(" ");
  assert.doesNotMatch(all.replace(DH_ASSIST_DELETE, ""), /\d|not stored|pause|Covered Models|never used|private|secure|rate limit|workspace|partner/i);
  assert.deepEqual(promiseHits(all), []);
  assert.notDeepEqual(promiseHits(DH_ASSIST_TERMS.replace("it may not", "it will not")), [], "a changed version of the exempt sentence is scanned");
  for (const p of para(dataHandlingSections(true, true), "assistant")) if (p !== DH_ASSIST_TERMS) assert.doesNotMatch(p, BANNED, p);
});

test("the '2 hours' on the page is the one constant; before the delete sentence can ship, the engine's contract value must equal it", () => {
  assert.equal(ASSISTANT_RETENTION_MAX_HOURS, 2);
  assert.ok(DH_ASSIST_DELETE.includes(`within ${ASSISTANT_RETENTION_MAX_HOURS} hours at the latest`));
  assert.ok(!DH_ASSIST_DELETE.includes("not stored") && !/\bprivate\b|\bsecure\b/.test(DH_ASSIST_DELETE));
  if (ASSISTANT_DELETE_CONFIRMED) {
    // Turning the flag on needs the vendored contract (src/lib/fixtures/assistantContract.json, from the engine's schema) to carry retention_max_hours equal to the constant.
    const f = join(__dirname, "fixtures", "assistantContract.json");
    assert.ok(existsSync(f), "the delete sentence is on: vendor the engine contract with retention_max_hours");
    assert.equal(JSON.parse(readFileSync(f, "utf8")).retention_max_hours, ASSISTANT_RETENTION_MAX_HOURS);
  }
});
