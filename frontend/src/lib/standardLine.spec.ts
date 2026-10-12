import { strict as assert } from "node:assert";
import test from "node:test";

import { STANDARD_MISSING_TEXT, STANDARD_NOT_IN_PROMPT_NOTICE, standardLine } from "./standardLine";

test("a missing standard says the engine reported none and names the default without claiming it was applied", () => {
  for (const missing of [undefined, null]) assert.deepEqual(standardLine(missing), { text: "standard: not reported by this engine (judged at the default standard of proof)", notice: null });
  assert.equal(STANDARD_MISSING_TEXT, "standard: not reported by this engine (judged at the default standard of proof)");
  assert.deepEqual(standardLine({ requested: "  ", applied: null, source: "default", in_judge_prompt: false }), { text: STANDARD_MISSING_TEXT, notice: null });
});

test("the standard and its source are shown: default, posture (named), type, anything else as sent", () => {
  assert.equal(standardLine({ requested: "proved", applied: "proved", source: "default", in_judge_prompt: true }).text, "standard: proved (default)");
  assert.equal(
    standardLine({ requested: "prima_facie_disclosed", applied: "prima_facie_disclosed", source: "proceeding_posture", proceeding_posture: "quash", in_judge_prompt: true }).text,
    "standard: prima_facie_disclosed (from the proceeding posture: quash)",
  );
  assert.equal(standardLine({ requested: "proved", applied: "proved", source: "proceeding_posture", in_judge_prompt: true }).text, "standard: proved (from the proceeding posture)");
  assert.equal(standardLine({ requested: "prima_facie_disclosed", applied: null, source: "proceeding_type", in_judge_prompt: true }).text, "standard: prima_facie_disclosed (from the proceeding type)");
  assert.equal(standardLine({ requested: "a_new_standard", applied: null, source: "something_new", in_judge_prompt: true }).text, "standard: a_new_standard (source: something_new)");
});

test("when the judge was not told the standard, the line says so; when it was, there is no notice", () => {
  const told = standardLine({ requested: "prima_facie_disclosed", applied: "prima_facie_disclosed", source: "proceeding_posture", proceeding_posture: "quash", in_judge_prompt: true });
  assert.equal(told.notice, null);
  const notTold = standardLine({ requested: "prima_facie_disclosed", applied: null, source: "proceeding_posture", proceeding_posture: "quash", in_judge_prompt: false });
  assert.equal(notTold.notice, STANDARD_NOT_IN_PROMPT_NOTICE);
  assert.match(STANDARD_NOT_IN_PROMPT_NOTICE, /did not shape this result/);
  assert.equal(notTold.text, "standard requested: prima_facie_disclosed (from the proceeding posture: quash)", "the recorded standard is still shown, honestly labelled");
});
