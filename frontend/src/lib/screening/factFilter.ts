/** The fact filter (M2a) applies only to the result it was chosen on: the same run id with different facts is another result, and a fact that is no longer there selects nothing. */
export interface FactFilterState { key: string; factId: string }

export const resultKey = (result: { run_id: string; facts: ReadonlyArray<{ id: string; sha256: string }> }): string =>
  `${result.run_id}|${result.facts.map((f) => `${f.id}:${f.sha256}`).join(",")}`;

export function activeFactFilter(state: FactFilterState | null, result: { run_id: string; facts: ReadonlyArray<{ id: string; sha256: string }> }): string | null {
  if (state === null || state.key !== resultKey(result)) return null;
  return result.facts.some((f) => f.id === state.factId) ? state.factId : null;
}
