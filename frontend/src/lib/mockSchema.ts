// Validates a recorded or mock engine response against the engine's OpenAPI response schema (pinned in fixtures/engineOpenapiV1.json), so a mock
// carrying a field production never sends, or missing one it always sends, FAILS the test instead of hiding a page defect (the facts[].text miss of
// the first production Screening run). Object schemas that list `properties` are CLOSED here: an unlisted key is a violation, whether or not the
// engine's schema says additionalProperties. Where the schema leaves an object free-form (additionalProperties true / a string map), the allow-list
// below names the keys production actually sends, taken from the engine source.

import openapi from "./fixtures/engineOpenapiV1.json";

type Schema = {
  $ref?: string; type?: string; properties?: Record<string, Schema>; required?: string[]; items?: Schema; anyOf?: Schema[]; enum?: unknown[];
  additionalProperties?: boolean | Schema;
};
const SCHEMAS = (openapi as unknown as { components: { schemas: Record<string, Schema> }; paths: Record<string, Record<string, { responses: Record<string, { content?: Record<string, { schema: Schema }> }> }>> });

/** Free-form objects whose production keys are known from the engine source (nyaya_agent.py AgentRun.facts: {"id", "sha256"} and NO text). */
const FREE_FORM_ALLOW: Record<string, string[]> = { "AnalyseFactsResponse.facts[]": ["id", "sha256"] };

function resolve(s: Schema): Schema {
  if (!s.$ref) return s;
  return SCHEMAS.components.schemas[s.$ref.replace("#/components/schemas/", "")];
}

function kind(v: unknown): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v === "number" ? (Number.isInteger(v) ? "integer" : "number") : typeof v;
}

function check(v: unknown, schema: Schema, path: string, out: string[]): void {
  const s = resolve(schema);
  if (s.anyOf) {
    const trials = s.anyOf.map((alt) => { const o: string[] = []; check(v, alt, path, o); return o; });
    if (!trials.some((o) => o.length === 0)) out.push(...(trials.find((o) => o.length > 0) ?? []));
    return;
  }
  const k = kind(v);
  if (s.type === "number" ? k !== "number" && k !== "integer" : s.type && s.type !== k) { out.push(`${path}: expected ${s.type}, got ${k}`); return; }
  if (s.enum && !s.enum.includes(v)) out.push(`${path}: ${JSON.stringify(v)} is not one of ${JSON.stringify(s.enum)}`);
  if (s.type === "array") (v as unknown[]).forEach((x, i) => check(x, s.items ?? {}, `${path}[${i}]`, out));
  if (s.type === "object" || s.properties) {
    const o = v as Record<string, unknown>;
    for (const r of s.required ?? []) if (!(r in o)) out.push(`${path}: missing required "${r}"`);
    const props = s.properties ?? {};
    const generic = path.replace(/\[\d+\]/g, "[]");
    const allow = FREE_FORM_ALLOW[generic];
    for (const [key, val] of Object.entries(o)) {
      if (props[key]) check(val, props[key], `${path}.${key}`, out);
      else if (allow) { if (!allow.includes(key)) out.push(`${path}.${key}: production never sends this key (allowed: ${allow.join(", ")})`); }
      else if (Object.keys(props).length > 0) out.push(`${path}.${key}: not in the engine schema`);
    }
  }
}

export type MockedEndpoint = "analyse-facts" | "verify-citations";

/** Violations of `body` against the 200-response schema of the endpoint; empty is a pass. */
export function mockViolations(endpoint: MockedEndpoint, body: unknown): string[] {
  const op = SCHEMAS.paths[`/api/v1/${endpoint}`].post;
  const schema = op.responses["200"].content?.["application/json"].schema as Schema;
  const out: string[] = [];
  check(body, schema, endpoint === "analyse-facts" ? "AnalyseFactsResponse" : "VerifyCitationResponse", out);
  return out;
}

/** Throws (failing the test) when a mock does not match production's schema; returns the body for page.route fulfil. */
export function validMock<T>(endpoint: MockedEndpoint, body: T): T {
  const v = mockViolations(endpoint, body);
  if (v.length) throw new Error(`mock ${endpoint} response does not match the engine schema:\n${v.join("\n")}`);
  return body;
}
