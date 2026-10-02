// Facts input for /matters: one fact per line, engine limits enforced with a message (never silent
// truncation), and client-side file reading. Nothing here touches the network.

export const MAX_FACTS = 8;
export const MAX_FACT_CHARS = 4000;
export const MAX_FILE_BYTES = 2 * 1024 * 1024;

export const MAX_PDF_PAGES = 50;
export const PARSE_TIMEOUT_MS = 20_000;

export const UNREADABLE_MESSAGE = "Couldn't read this file. Paste the facts as text instead.";
export const NO_TEXT_MESSAGE =
  "This file has no extractable text (it may be a scan). OCR is not supported; paste the facts as text instead.";

export function splitFacts(text: string): string[] {
  return text
    .split("\n")
    .map((f) => f.trim())
    .filter((f) => f.length > 0);
}

export type FactsCheck = { ok: true; facts: string[] } | { ok: false; message: string };

export function checkFacts(text: string): FactsCheck {
  const facts = splitFacts(text);
  if (facts.length === 0) return { ok: false, message: "Enter at least one fact." };
  if (facts.length > MAX_FACTS) {
    return { ok: false, message: `You have ${facts.length} facts; the limit is ${MAX_FACTS}. Merge or remove some.` };
  }
  const long = facts.findIndex((f) => f.length > MAX_FACT_CHARS);
  if (long >= 0) {
    return {
      ok: false,
      message: `Fact ${long + 1} is ${facts[long].length} characters; the limit is ${MAX_FACT_CHARS}. Shorten or split it.`,
    };
  }
  return { ok: true, facts };
}

export type ExtractResult = { ok: true; text: string } | { ok: false; message: string };

export function fileKind(name: string): "txt" | "pdf" | "docx" | null {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  return ext === "txt" || ext === "pdf" || ext === "docx" ? ext : null;
}

// A parser failure the user should be told about specifically (page limit, timeout). Any other throw becomes the
// generic UNREADABLE_MESSAGE. Either way a failed parse is an error, never an empty text: an empty text would
// silently become "no facts".
export class ExtractError extends Error {}

export type Parser = (data: ArrayBuffer) => Promise<string>;
export interface Parsers {
  pdf?: Parser;
  docx?: Parser;
}

export interface FileLike {
  name: string;
  size: number;
  text(): Promise<string>;
  arrayBuffer(): Promise<ArrayBuffer>;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new ExtractError("Reading this file took too long. Paste the facts as text instead.")), ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
}

export async function extractText(
  file: FileLike,
  parsers: Parsers = {},
  timeoutMs: number = PARSE_TIMEOUT_MS,
): Promise<ExtractResult> {
  const kind = fileKind(file.name);
  if (kind === null) return { ok: false, message: "Only .txt, .pdf and .docx files are accepted." };
  if (file.size > MAX_FILE_BYTES) {
    return { ok: false, message: `File is ${Math.ceil(file.size / 1024)} KB; the limit is ${MAX_FILE_BYTES / 1024} KB.` };
  }
  let raw: string;
  if (kind === "txt") {
    raw = await file.text();
  } else {
    const parse = parsers[kind];
    if (!parse) return { ok: false, message: `.${kind} extraction is not available in this build.` };
    try {
      raw = await withTimeout(file.arrayBuffer().then(parse), timeoutMs);
    } catch (e) {
      return { ok: false, message: e instanceof ExtractError ? e.message : UNREADABLE_MESSAGE };
    }
  }
  const text = raw.trim();
  return text ? { ok: true, text } : { ok: false, message: NO_TEXT_MESSAGE };
}
