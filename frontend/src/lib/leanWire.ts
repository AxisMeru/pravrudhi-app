// Reverses the four-character percent-escaping nyaya_lean_registry.py's _esc() applies
// (src/pravrudhi/application/nyaya_lean_registry.py) to build the REG wire's claim strings --
// DISPLAY ONLY. This must never be applied to anything sent back to the checker: the escaped form is
// the wire's own real shape, and scoring always happens server-side on the assertions object, never
// on these claim strings round-tripped back through the browser.
//
// _esc() encodes in this order: "%" -> "%25" first, then "(" -> "%28", ")" -> "%29", "," -> "%2C".
// Decoding must reverse that order -- undo ( ) , first, "%25" -> "%" LAST -- or a literal "%25" that
// was never a percent sign (produced by some other %XX already being decoded) could be misread.
export function decodeLeanWireForDisplay(s: string): string {
  return s.replaceAll("%2C", ",").replaceAll("%28", "(").replaceAll("%29", ")").replaceAll("%25", "%");
}
