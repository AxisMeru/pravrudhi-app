// What the contract picker on /matters shows (design-partner audit, gap 3). "Loading…" was the answer to every state with no contracts in
// it, so a registry that answered with an empty list, or never answered, looked like a page still loading, with Analyse still clickable.
export type PickerState = "loading" | "error" | "empty" | "ready";

export function pickerState(loaded: boolean, failed: boolean, count: number, demo: boolean): PickerState {
  if (failed) return "error";
  if (count > 0) return "ready";
  // The recorded demo has no registry at all; its page keeps its old behaviour (the example fills the picker).
  if (demo) return "loading";
  return loaded ? "empty" : "loading";
}

export const NO_CONTRACTS_MESSAGE = "The engine's registry returned no contracts, so there is nothing to check against right now.";
