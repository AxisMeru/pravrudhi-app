// The assistant entry flag (#125; R1 14 Oct): ONE switch for everything that describes or offers the assistant: the Screening entry, the consent line's Data handling link,
// and the Data handling section about it. While the assistant is not offered in production none of it exists, because a page that describes a feature that is not there is itself a claim.
// Set at build time (NEXT_PUBLIC_ASSISTANT_ENTRY=1) only on Lead-2's / L2A's go after the live read passed; off by default.
export const ASSISTANT_ENTRY_ENABLED = process.env.NEXT_PUBLIC_ASSISTANT_ENTRY === "1";
