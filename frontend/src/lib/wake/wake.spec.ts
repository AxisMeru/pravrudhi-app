import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { parseWake, wakeView, WAKE_UNREADABLE_VIEW, type Wake } from "./wake";
import * as C from "./wakeCopy";

const h = (s: string) => createHash("sha256").update(s, "utf8").digest("hex").slice(0, 16);

test("R1's cold-start words are pinned by hash", () => {
  const pins: Record<string, string> = {
    WAKE_GLOSS: "91152916bbe39545", WAKE_PROGRESS_ALL: "6830eb86aa822ed5", WAKE_PROGRESS_FIRST_READY: "d9e9fac24bd90f36", WAKE_PROGRESS_SECOND_READY: "44a9c6cc2eebd005",
    WAKE_DONE_BOTH: "6e9c35e86b932820", WAKE_WARN_SECOND_FAILED: "91c0b850609e0c16", WAKE_WARN_FIRST_FAILED: "e5802acdfade5b7d", WAKE_FAIL_BOTH: "d53d5a8d10bfef84",
    WAKE_FAIL_TIMEOUT_TAIL: "f0f88970b7f2f2b3", WAKE_POLL_ERROR: "48532b162248a874", WAKE_REFUSAL_KEEP: "19206a8cb431cbb4",
  };
  for (const [k, v] of Object.entries(pins)) assert.equal(h((C as unknown as Record<string, string>)[k]), v, k);
  assert.equal(h(C.WAKE_LABEL.first), "b28de417ac0120c5");
  assert.equal(h(C.WAKE_LABEL.second), "578028587e4ee76c");
  assert.equal(h(C.WAKE_STATUS.waiting), "f5e5f81fd2567874");
  assert.equal(h(C.WAKE_STATUS.starting), "aeed4d26bb5f0c31");
  assert.equal(h(C.WAKE_STATUS.ready), "5fa7aac5375c5815");
  assert.equal(h(C.WAKE_STATUS.failed), "360719dab666cdfb");
});

test("parseWake: absent or unreadable is null; unknown states and bad rows are dropped", () => {
  assert.equal(parseWake(undefined), null);
  assert.equal(parseWake("waking"), null);
  assert.equal(parseWake({ state: "running", models: [] }), null);
  const w = parseWake({ state: "waking", reason: "nonsense", models: [{ role: "first", state: "starting", progress: Number.NaN }, { role: "third", state: "ready" }, { role: "second", state: "bogus" }, { role: "first", state: "ready" }, null] });
  assert.deepEqual(w, { state: "waking", reason: null, deadlineS: null, pollAfterS: null, models: [{ role: "first", state: "starting", progress: null }] });
  assert.equal(parseWake({ state: "waking", models: [{ role: "first", state: "ready", progress: 7 }] })?.models[0].progress, null);
});

const wk = (state: Wake["state"], first: string, second: string, reason: Wake["reason"] = null): Wake =>
  parseWake({ state, reason, models: [{ role: "first", state: first, progress: null }, { role: "second", state: second, progress: null }] }) as Wake;

test("reducer: waiting lines by which model is ready; missing row reads as waiting", () => {
  assert.equal(wakeView(wk("waking", "starting", "waiting")).line, C.WAKE_PROGRESS_ALL);
  assert.equal(wakeView(wk("waking", "ready", "starting")).line, C.WAKE_PROGRESS_FIRST_READY);
  assert.equal(wakeView(wk("waking", "starting", "ready")).line, C.WAKE_PROGRESS_SECOND_READY);
  const v = wakeView({ state: "waking", reason: null, models: [], deadlineS: null, pollAfterS: null });
  assert.deepEqual(v.rows.map((r) => r.status), ["Waiting to start", "Waiting to start"]);
  assert.equal(v.phase, "waiting");
});

test("reducer: ready scores; partial warns above the result; failures stop with nothing scored", () => {
  assert.deepEqual([wakeView(wk("ready", "ready", "ready")).phase, wakeView(wk("ready", "ready", "ready")).line], ["scoring", C.WAKE_DONE_BOTH]);
  const p = wakeView(wk("partial", "ready", "failed", "second_judge_unavailable"));
  assert.equal(p.phase, "partial");
  assert.equal(p.warning, C.WAKE_WARN_SECOND_FAILED);
  assert.equal(wakeView(wk("failed", "failed", "starting", "first_judge_unavailable")).warning, C.WAKE_WARN_FIRST_FAILED);
  assert.equal(wakeView(wk("failed", "failed", "failed", "first_judge_unavailable")).warning, C.WAKE_FAIL_BOTH);
  const t = wakeView(wk("timeout", "starting", "starting", "start_timeout"));
  assert.equal(t.phase, "stopped");
  assert.equal(t.warning, "The analysis models did not start. Nothing was scored and no result is shown. This is not a finding about your matter. The models did not start within the time we allow. You can try again in a few minutes.");
  assert.equal(WAKE_UNREADABLE_VIEW.warning, C.WAKE_POLL_ERROR);
});

test("no view ever prints a percentage, a duration or a forbidden word", () => {
  const all = [wk("waking", "starting", "waiting"), wk("waking", "ready", "starting"), wk("ready", "ready", "ready"), wk("partial", "ready", "failed"), wk("failed", "failed", "failed"), wk("timeout", "starting", "starting", "start_timeout")];
  for (const w of all) {
    const v = wakeView(w);
    const text = [v.line, v.warning ?? "", ...v.rows.map((r) => r.status)].join(" ");
    assert.doesNotMatch(text, /\d|%|partial result|provisional|preliminary|best effort|Running|Analysing/i);
  }
});
