// R1's IPC text caveats (IPC_BOTH_STATES_R1_2026-10-17.md c957c443e42f).
// - IPC_TEXT_CAVEAT_BOTH (274f685a33fa625c) is true before and after engine 0.6.22: shown wherever IPC section text appears.
// - IPC_TEXT_CAVEAT_1860 (27c3a9e31e5fa784) is true only once 0.6.22 ships the Ministry of Home Affairs PDF asset: the engine sends it as `text_caveat` (engine PR #539) on corpus hits and on a Nyaya ask's sources for IPC ids, null otherwise; the app shows it ONLY when the engine sent exactly that line, and otherwise shows the "both states" line for an IPC section.
export const IPC_TEXT_CAVEAT_BOTH = "Section text is taken from published statute sources and may not include recent amendments. Check the current text.";
export const IPC_TEXT_CAVEAT_1860 = "Section text is from the 1860 Act; amendments after 1997 are not included. Check the current text.";

const isIpc = (x: { id?: unknown; act?: unknown }): boolean => (typeof x.id === "string" && /^ipc/i.test(x.id)) || (typeof x.act === "string" && /^ipc$|penal code/i.test(x.act.trim()));

/** The caveat to show with a source or corpus hit, or null (not an IPC section). Fail closed: any other engine value is ignored, never shown. */
export function ipcCaveatOf(x: { id?: unknown; act?: unknown; text_caveat?: unknown }): string | null {
  if (!isIpc(x)) return null;
  return x.text_caveat === IPC_TEXT_CAVEAT_1860 ? IPC_TEXT_CAVEAT_1860 : IPC_TEXT_CAVEAT_BOTH;
}
