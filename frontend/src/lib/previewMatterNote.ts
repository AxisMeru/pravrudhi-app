// The matter note and the 'matter gone' line of the preview page, R1's file PREVIEW_MATTER_NOTE_R1_v2_2026-10-17.md (sha12 20e75ba6467e), pinned in previewMatterNote.spec.ts. Promises NO storage: the production store is container-local and is recreated by swaps (L2A, A2_PROD_STORE_FACTS_2026-10-17). The earlier 'stay stored until you delete them' was withdrawn.
export const MATTER_NOTE = {
  matter_note: "The service may remove papers when it restarts or is updated, so keep your own copies. Reloading this page loses the matter number shown here, and this page cannot list your matters.",
  matter_gone: "This matter is no longer held. Start a matter and add the papers again.",
} as const;
