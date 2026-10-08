// REFER-first (design-partner posture): contracts the engine refers to a lawyer are listed before every other result, so a referral is
// never below the fold of a long answer. Stable: contracts keep the engine's order within each group. The memo keeps the engine's order.
export function referFirst<T extends { outcome: string }>(contracts: readonly T[]): T[] {
  return [...contracts.filter((c) => c.outcome === "REFER_TO_LAWYER"), ...contracts.filter((c) => c.outcome !== "REFER_TO_LAWYER")];
}
