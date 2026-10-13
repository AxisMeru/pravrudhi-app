// The rule for a promise about how submissions are used for training or evaluation. The app states only what the code enforces (R1/Lead-2, 13 Oct; widened by R2).
// The unit scan (src/lib/noTrainingPromise.spec.ts) and the browser tests import this one module. Sample phrases are encoded below, so this file holds none in readable form.
//
// Per sentence, three kinds of word have to meet: a negating or excluding word, a word for teaching or scoring a model, and a word for using or including the
// user's material (or the teaching verb followed by on/with/from/using the user's data). A plain statement about how the models were built has no use word and passes.
// JSON string boundaries and brackets also end a sentence.
const NEG = String.raw`(?:\bnever\b|\bnot\b|\bno\b|\bcannot\b|\bwithout\b|\w+n't\b|\bexclud\w*|\bexclusion\b)`;
const TOPIC = String.raw`(?:\btrain\w*|\bfine-?tun\w*|\bevaluat\w*|\bmodel (?:improvement|development)\b|\b(?:improv|develop)\w*\s+(?:\w+\s+){0,2}models?\b|\bteach\w*\s+(?:\w+\s+){0,2}models?\b)`;
const USE = String.raw`(?:\bus(?:e|ed|es|ing)\b|\butili[sz]\w*|\breus\w*|\bincluded?\b|\bincluding\b|\bpart of\b|\bexclud\w*|\bexclusion\b|\bretain\w*|\bkept\b)`;
const YOURS = String.raw`(?:\byour\b|\bour\b|\buser\w*|\bcustomer\w*|\bsubmi\w*|\bfacts?\b|\bdata\b|\binputs?\b|\bmatters?\b|\bnarratives?\b)`;
const has = (s: string, rx: string) => new RegExp(rx, "i").test(s);
const sentences = (text: string): string[] => text.replace(/\s+/g, " ").split(/(?<=[.;!?])\s+|["{}\[\]]/);
const flag = (s: string): boolean =>
  has(s, NEG) && ((has(s, TOPIC) && has(s, USE)) || new RegExp(String.raw`\btrain\w*\s+(?:\w+\s+){0,2}(?:on|with|from|using)\b[^.;]{0,30}${YOURS}`, "i").test(s) || new RegExp(String.raw`\bfine-?tun\w*\s+(?:\w+\s+){0,2}(?:on|with|from|using)\b[^.;]{0,30}${YOURS}`, "i").test(s) || has(s, String.raw`\bmodel training\b`));
export const promiseHits = (text: string): string[] => sentences(text).filter(flag).map((s) => s.slice(0, 120));
/** For toContainText / not.toContainText in the browser tests: a body text has no promise. Use `expect(promiseHits(await body.innerText())).toEqual([])`. */
export const hasPromise = (text: string): boolean => promiseHits(text).length > 0;
/** Kept so existing calls stay valid: a regex that matches the old engine sentence's tail; the full rule is promiseHits. */
export const NO_PROMISE_ANY = new RegExp(["\\bused for", "training or evaluation"].join(" "), "i");

/** Phrases that MUST be caught. Written with ~ for e, # for o and @ for i, so this file never carries a promise itself. */
const D = (t: string) => t.replace(/~/g, "e").replace(/#/g, "o").replace(/@/g, "i");
export const PROMISE_SAMPLES: readonly string[] = [
  "Submissions are n~ver used for tra@n@ng or evaluat@#n.",
  "Your text is n~ver used to tra@n models.",
  "Your text w@ll n#t be used for model tra@n@ng.",
  "We n~ver tra@n on your submissions.",
  "Your facts are n#t used to @mprove our models.",
  "Facts are n~ver used for evaluat@#n.",
  // R2's 13 Oct list of wordings
  "Your text @sn't used to tra@n models.",
  "Your submissions aren't used for tra@n@ng.",
  "Your text can't be used to @mprove our models.",
  "Your text cann#t be used for tra@n@ng.",
  "N# data @s used for tra@n@ng.",
  "Your text @s excluded from tra@n@ng.",
  "Your text @s excluded from model @mprovement.",
  "Your facts are n#t @ncluded @n tra@n@ng data.",
  "Your facts are n~ver part of any tra@n@ng set.",
  "We don't f@ne-tune on your facts.",
  "Your text @s used for n# tra@n@ng purpose.",
  "Your text @s n#t ut@l@sed for model development.",
  "Your text @s n~ver reused to teach the model.",
].map(D);
export const INNOCENT_SAMPLES: readonly string[] = [
  "Run records are kept for up to 7 days. They are removed when the next analysis runs, and can disappear earlier.",
  "A run record can include the text of facts the screening marked as supported.",
  "The screening models were trained on public statute text before you used this product.",
  "No judge has been trained on this contract's statute text yet.",
  "More under Data handling.",
  "Do not enter real names or case details unless your firm's setup allows it.",
];
