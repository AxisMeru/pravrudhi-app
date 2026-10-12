// One fact per paragraph or line (blank lines separate); inside a fact, runs of whitespace collapse to one space, so a fact is edited as one line.
export function splitIntoFacts(text: string): string[] {
  return text.split(/\r?\n+/).map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
}
