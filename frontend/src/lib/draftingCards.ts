// The bail-draft (A4) and synopsis (A8) cards on /preview: OFF by default. NEXT_PUBLIC_DRAFTING_CARDS=1 (exactly "1") shows them, only when the engine serves both routes (the 0.6.24 flip).
// With the flag unset the cards, and the declaration question that sits on them, are absent from the page.
export const DRAFTING_CARDS = process.env.NEXT_PUBLIC_DRAFTING_CARDS === "1";
