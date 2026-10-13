// What counts as a promise about training or evaluation use. The app makes none the code does not enforce (R1/Lead-2, 13 Oct). This file is the one place the
// patterns live; the unit scan (src/lib/noTrainingPromise.spec.ts) and the browser tests import it. The sample phrases are built from pieces so that no file
// in the repo carries a promise as a contiguous string, which is what the scan looks for.
const NEG = String.raw`(?:never|not|won't|will not|do not|does not|don't|doesn't)`;
const GAP = String.raw`[^.\n;]{0,40}`;
export const NO_PROMISE_PATTERNS: readonly RegExp[] = [
  // a negation, then "used", then train / evaluate / improve / fine-tune (covers the for-training, to-train-models and to-improve-models wordings)
  new RegExp(String.raw`\b${NEG}\b${GAP}\b(?:used?|using)\b[^.\n;]{0,30}\b(?:train\w*|evaluat\w*|improv\w*|fine-?tun\w*)`, "i"),
  // a negation, then "train", then on / with / from / using (the we-never-train-on-your-text wording)
  new RegExp(String.raw`\b${NEG}\b[^.\n;]{0,30}\btrain\w*\s+(?:\w+\s+){0,3}(?:on|with|from|using)\b`, "i"),
  // a negation, then "model training"
  new RegExp(String.raw`\b${NEG}\b${GAP}\bmodel training\b`, "i"),
  // the old engine sentence's tail, however the first half is worded
  new RegExp(["\\bused for", "training or evaluation"].join(" "), "i"),
];
export const promiseHits = (text: string): string[] => {
  const flat = text.replace(/\s+/g, " ");
  return NO_PROMISE_PATTERNS.flatMap((rx) => { const m = flat.match(rx); return m ? [m[0]] : []; });
};
/** For toContainText / not.toContainText in the browser tests: one regex over the same patterns. */
export const NO_PROMISE_ANY = new RegExp(NO_PROMISE_PATTERNS.map((r) => `(?:${r.source})`).join("|"), "i");
/** Phrases that MUST be caught. Written with ~ for e, # for o and @ for i so that this file never carries a promise itself. */
const D = (t: string) => t.replace(/~/g, "e").replace(/#/g, "o").replace(/@/g, "i");
export const PROMISE_SAMPLES: readonly string[] = [
  "Submissions are n~ver used for tra@n@ng or evaluat@#n.",
  "Your text is n~ver used to tra@n models.",
  "Your text w@ll n#t be used for model tra@n@ng.",
  "We n~ver tra@n on your submissions.",
  "Your facts are n#t used to @mprove our models.",
  "Facts are n~ver used for evaluat@#n.",
].map(D);
export const INNOCENT_SAMPLES: readonly string[] = [
  "Run records are kept for up to 7 days. They are removed when the next analysis runs, and can disappear earlier.",
  "A run record can include the text of facts the screening marked as supported.",
  "The screening models were trained on public statute text before you used this product.",
  "No judge has been trained on this contract's statute text yet.",
];
