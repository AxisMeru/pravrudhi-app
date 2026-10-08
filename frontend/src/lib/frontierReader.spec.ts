import { strict as assert } from "node:assert";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { FrontierQuote, FrontierCell } from "../components/screening/FrontierQuote";
import { FrontierToggle } from "../components/screening/FrontierToggle";
import {
  FRONTIER_UNAVAILABLE_TEXT, consentLine, frontierCell, frontierToggleState, quoteCheckLabel,
} from "./frontierReader";

const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);

test("the toggle is disabled with a plain reason unless the engine says the reader is available, and a stale 'on' never shows as checked", () => {
  for (const available of [undefined, null, false]) {
    const s = frontierToggleState({ available, value: true });
    assert.deepEqual(s, { disabled: true, checked: false, reason: FRONTIER_UNAVAILABLE_TEXT, consent: null });
  }
  assert.equal(frontierToggleState({ available: false, value: false, reason: "Switched off by your administrator." }).reason, "Switched off by your administrator.");
});

test("available and off by default: usable, unchecked, no consent line until it is switched on", () => {
  assert.deepEqual(frontierToggleState({ available: true, value: false }), { disabled: false, checked: false, reason: null, consent: null });
  const on = frontierToggleState({ available: true, value: true, provider: "ExampleAI" });
  assert.equal(on.consent, "Your facts will be sent to ExampleAI under your organisation's key.");
  assert.equal(consentLine(), "Your facts will be sent to the provider your organisation has configured under your organisation's key.");
});

test("the rendered toggle: label, disabled with the reason, no consent; and when on, the consent line", () => {
  const off = html(createElement(FrontierToggle, { value: true, onChange: () => {}, available: false }));
  assert.match(off, /Use a frontier model as an additional reader/);
  assert.match(off, /disabled/);
  assert.match(off, /Not available: this deployment has not switched the frontier reader on\./);
  assert.doesNotMatch(off, /Your facts will be sent/);
  const on = html(createElement(FrontierToggle, { value: true, onChange: () => {}, available: true, provider: "ExampleAI" }));
  assert.match(on, /Your facts will be sent to ExampleAI under your organisation&#x27;s key\./);
  assert.doesNotMatch(on, /disabled/);
});

test("the quote-check labels: passed, not found, the signed sentence for another known code, an unknown code as sent", () => {
  assert.equal(quoteCheckLabel("ok"), "passed the quote check");
  assert.equal(quoteCheckLabel("quote_not_found"), "quote not found in your facts");
  assert.match(quoteCheckLabel("ambiguous_quote"), /appears more than once/);
  assert.match(quoteCheckLabel("brand_new"), /does not recognise yet \("brand_new"\)/);
  assert.equal(quoteCheckLabel(null), "The quote was not checked.");
});

test("a frontier cell is a claim, its quote and the check, and says it is advisory; with no quote there is no check to show", () => {
  const c = frontierCell({ status: "established", fact_id: "F2", quote: "the sum was due", quote_check: "ok" });
  assert.deepEqual(c, { claim: "The frontier reader says this condition is shown.", quote: "the sum was due", check: { text: "passed the quote check", passed: true } });
  assert.equal(frontierCell({ status: "established" })?.check, null);
  assert.equal(frontierCell(null), null);
  assert.match(frontierCell({ status: "weird" })?.claim ?? "", /does not know \("weird"\)/);
  const markup = html(createElement(FrontierCell, { reading: { status: "established", quote: "the sum was due", quote_check: "quote_not_found" } }));
  assert.match(markup, /quote not found in your facts/);
  assert.match(markup, /data-passed="false"/);
  assert.match(markup, /Advisory only: the frontier reader never changes a status above\./);
});

test("a passed quote is marked passed and a failed one is not", () => {
  assert.match(html(createElement(FrontierQuote, { quote: "q", check: "ok" })), /data-passed="true"/);
  assert.match(html(createElement(FrontierQuote, { quote: "q", check: "empty_quote" })), /data-passed="false"/);
});

test("a cell's check is marked passed only for ok; every other code and a missing code are not passed", () => {
  const passed = (quote_check?: string | null) => frontierCell({ status: "established", quote: "q", quote_check })?.check?.passed;
  assert.equal(passed("ok"), true);
  for (const c of ["quote_not_found", "ambiguous_quote", "empty_quote", "unknown_fact", "brand_new", "", null, undefined]) assert.equal(passed(c), false, String(c));
});

test("a label is looked up as an OWN key: names inherited from Object.prototype are unknown codes, never a function or a sentence", () => {
  for (const code of ["toString", "constructor", "__proto__", "hasOwnProperty", "valueOf"]) {
    assert.match(quoteCheckLabel(code), /does not recognise yet/, code);
  }
});
