// The wording audit (O8 / #828): which user-visible strings on the house-judge path say more than the code does. The house judges cite a whole fact;
// they do not prove, establish or quote. Only the frontier reader writes words, and only its files may say "quote" (FRONTIER_FILES).
// This scans source text for string literals and JSX text that contain a banned word; comments, imports, class names and test ids are skipped.
// It is a lexical net, not a proof of correctness: a hit is a string to read, and an allow-list entry says why a hit is fine.

export const BANNED = /\b(proof|proofs|proved|proven|prove|proves|established|verbatim|word[- ]for[- ]word|passages?|quotes?|quoted|quoting)\b/i;

/** Files whose job is the frontier reader's own quote. Everything else is the house path. */
export const FRONTIER_FILES: readonly string[] = ["src/lib/frontierReader.ts", "src/components/screening/FrontierQuote.tsx", "src/components/screening/FrontierToggle.tsx"];

export interface AuditHit {
  file: string;
  line: number;
  text: string;
}

const LITERAL = /"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'|`((?:[^`\\]|\\.)*)`/g;

function skippable(line: string): boolean {
  const t = line.trim();
  return t === "" || t.startsWith("//") || t.startsWith("*") || t.startsWith("/*") || /^(import|export \* from|export \{.*\} from)\b/.test(t);
}

/** User-visible candidates on one line: string literals with a space in them (a word, not an identifier) and bare JSX text. */
function candidates(line: string): string[] {
  const out: string[] = [];
  const noAttrs = line.replace(/\b(className|data-testid|data-kind|aria-controls|id|key|href|type|role|name|htmlFor)=("[^"]*"|\{[^}]*\})/g, "");
  for (const m of noAttrs.matchAll(LITERAL)) {
    // identifiers inside a template literal's ${...} are code, not words a reader sees
    const s = (m[1] ?? m[2] ?? m[3] ?? "").replace(/\$\{[^}]*\}/g, " ");
    if (/\s/.test(s.trim()) && /[A-Za-z]{3}/.test(s)) out.push(s);
  }
  // a single-word value of a text-bearing property (label: "established") is shown to the reader too
  for (const m of noAttrs.matchAll(/\b(label|title|text|heading|description|subtitle)\s*:\s*"([^"\s]+)"/g)) out.push(m[2]);
  const jsx = noAttrs.match(/>([^<>{}]*[A-Za-z]{3}[^<>{}]*)</g);
  if (jsx) for (const j of jsx) out.push(j.slice(1, -1));
  return out;
}

export function scanSource(file: string, text: string): AuditHit[] {
  const hits: AuditHit[] = [];
  text.split("\n").forEach((line, i) => {
    if (skippable(line)) return;
    for (const c of candidates(line)) {
      if (BANNED.test(c)) hits.push({ file, line: i + 1, text: c.trim().slice(0, 160) });
    }
  });
  return hits;
}

/** A frontier file may use the words; a house-path file may not, unless the allow-list says why. */
export function violations(hits: readonly AuditHit[], allow: ReadonlySet<string> = new Set()): AuditHit[] {
  return hits.filter((h) => !FRONTIER_FILES.includes(h.file) && !allow.has(`${h.file}:${h.text}`));
}
