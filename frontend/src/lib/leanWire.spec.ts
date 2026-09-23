import { strict as assert } from "node:assert";
import test from "node:test";

import { decodeLeanWireForDisplay } from "./leanWire";

// nyaya_lean_registry.py's own _esc() (src/pravrudhi/application/nyaya_lean_registry.py) escapes four
// reserved characters for the wire, in this order: % first, then ( ) , -- so a decoder must reverse
// that order (undo , ) ( last-escaped-first, % last) or it corrupts a literal "%25" that was never a
// percent sign to begin with.

test("leanWire: decodes a percent-encoded comma", () => {
  assert.equal(decodeLeanWireForDisplay("an offence%2C or an act"), "an offence, or an act");
});

test("leanWire: decodes parentheses", () => {
  assert.equal(decodeLeanWireForDisplay("E%28the conduct%2C AC%29"), "E(the conduct, AC)");
});

test("leanWire: decodes a real omitted_claims wire string end to end", () => {
  const raw =
    "G_SATISFIES(E(the conduct in the facts,AC),E(the thing abetted is itself an offence%2C or is " +
    "an act which would be an offence if committed by a person capable by law of committing an " +
    "offence with the same intention or knowledge as the abettor's own,EL))";
  const decoded = decodeLeanWireForDisplay(raw);
  assert.ok(!decoded.includes("%2C"), "no raw percent-encoding should remain");
  assert.match(decoded, /an offence, or is an act/);
});

test("leanWire: a literal percent sign survives (encoded as %25, decoded last)", () => {
  // If a source string ever legitimately contained a literal "%", _esc() encodes it as "%25" FIRST,
  // before escaping any ( ) , -- so decoding "%25" back to "%" must happen LAST, or an unrelated
  // "%2C"/"%28"/"%29" produced by some other decode step could be misread as a literal percent.
  assert.equal(decodeLeanWireForDisplay("50%25 of cases"), "50% of cases");
});

test("leanWire: text with no escapes at all is returned unchanged", () => {
  assert.equal(decodeLeanWireForDisplay("entrusted with property"), "entrusted with property");
});

test("leanWire: empty string is returned unchanged", () => {
  assert.equal(decodeLeanWireForDisplay(""), "");
});
