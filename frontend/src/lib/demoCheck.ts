import type { AnalyseFactsResult } from "./api";

export type DemoPath = "PROOF" | "ABSTAIN" | "REFER_TO_LAWYER";

export interface DemoFixture {
  id: string;
  path: DemoPath;
  wording: "plain" | "formal";
  // Null until recorded from live runs in a service window; the live spec skips (with a reason) while null.
  contractId: string | null;
  expectedOutcome: string | null;
  facts: string[];
}

const HEX64 = /^[0-9a-f]{64}$/;

export function checkDemoResult(result: AnalyseFactsResult, fx: DemoFixture): string[] {
  const problems: string[] = [];
  if (!result.run_id) problems.push("no run_id");
  if (!HEX64.test(result.score_sha256)) problems.push("score_sha256 is not 64 hex");
  if (result.facts.length !== fx.facts.length) problems.push(`expected ${fx.facts.length} facts, got ${result.facts.length}`);
  for (const f of result.facts) if (!HEX64.test(f.sha256)) problems.push(`fact ${f.id} sha256 is not 64 hex`);
  const c = result.contracts.find((x) => x.contract_id === fx.contractId);
  if (!c) return [...problems, `no result for contract ${fx.contractId}`];
  if (c.outcome !== fx.expectedOutcome) problems.push(`outcome ${c.outcome}, recorded expectation ${fx.expectedOutcome}`);
  if (c.outcome === "PROOF" || c.outcome === "DENIAL") {
    if (c.elements.length === 0) problems.push("no element rows");
    const submitted = result.facts.map((f) => f.text);
    for (const e of c.elements) {
      if (e.status !== "established") continue;
      if (!e.quote) problems.push(`established element "${e.element}" has no quote`);
      else if (!submitted.some((t) => t.includes(e.quote as string))) problems.push(`quote for "${e.element}" is not in the submitted facts`);
    }
  }
  return problems;
}
