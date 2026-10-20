// "Your matters" on /matter-tools (Lead-2, 20 Oct: the real fix for 'you cannot get back to your papers after a reload'). OFF by default: NEXT_PUBLIC_YOUR_MATTERS=1 (exactly "1"), and only once the engine release that carries
// POST /matter-spans/my-matters (engine #597/#599, flag wf_a2_list_matters) is live AND R2 has signed the code. The list shows ids nowhere: rows are numbered in the engine's order for this view only.
// Words: R1's YOUR_MATTERS_WORDS_V2_R1_2026-10-20.md (v2, sha12 82c7d921e0b2), by hash in yourMatters.spec.ts. No scope line: 'Your matters' is true whether the browser's session lists only the signed-in person's own matters (tenant user:<id>; the app calls as the signed-in user, never with an organisation key) or an organisation's. ym_scope_IF_ORG_KEY (3d153f5123b5d4c6) is NOT shown.
export const YOUR_MATTERS = process.env.NEXT_PUBLIC_YOUR_MATTERS === "1";

export const YOUR_MATTERS_TEXT = {
  heading: "Your matters", // 1f5c412c19048e5d
  open: "Open", // ed077f3d8125d60d
  delete: "Delete", // e2d0a54968ead24e
  confirmYes: "Yes, delete", // 7b05a8e35af97cc6
  confirmCancel: "Cancel", // 19766ed6ccb2f4a3
  deleted: "The matter was deleted.", // 7d20b9389e62301b
  empty: "You have no matters yet.", // 396b162d70db5492
  truncated: "Showing 50 matters. There are more, and they are not listed here.", // 3d1687352bc99fd5
} as const;

export const matterLabel = (n: number): string => `Matter ${n}`; // 954edc623f83d36d
export const papersCount = (n: number): string => (n === 1 ? "1 paper" : `${n} papers`); // aa8d34127537ac13, b29985bdb7fe97ed ({n} papers)
/** The delete question names the matter number AND its paper count (the numbers renumber after a delete): R1's three forms (531d384b4779f8c1, 142ca35eac49f0a1, f0fb0cbf9e577442). */
export const confirmLine = (n: number, papers: number): string =>
  papers === 0 ? `Delete Matter ${n}? It is removed from this service's store. This cannot be undone.`
  : papers === 1 ? `Delete Matter ${n} and its 1 paper? It is removed from this service's store. This cannot be undone.`
  : `Delete Matter ${n} and its ${papers} papers? They are removed from this service's store. This cannot be undone.`;

/** With the list on, the matter note no longer says the matters cannot be listed (ym_note 559d274110ed22e2) and /data-handling carries one line about the list in place of the two interim lines (dh_list_line 238de48b950dafa5). */
export const YM_NOTE = "The papers you add here are kept as text in our store, in the EU (Romania), until you delete the paper or the matter. Your matters are listed above, and you can open or delete them there. Deleting removes them from this service's store. Images are not read."; // 559d274110ed22e2
export const DH_LIST_LINE = "You can list your matters on Matter tools, open one, and delete a paper or the whole matter."; // 238de48b950dafa5
