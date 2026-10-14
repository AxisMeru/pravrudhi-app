// The running view of a screening (P7; R1's strings, 14 Oct). The page may say only what it knows while the request is open: that it is waiting, for how long, and what the user can do.
// It does NOT know the steps until the result returns, so no step name is shown during the wait. WARM_UP_NOTE and TIMEOUT_RETRY_TEXT (surfaceCopy.ts) are used as signed.

export const RUNNING_STATUS_LINE = "Screening in progress. This page is waiting for the result.";

/** The elapsed line, one dynamic pattern: "Waiting for 00:07". No promise of a time. */
export function waitingFor(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `Waiting for ${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** Added only for a run with the assistant. */
export const ASSISTED_RUNNING_NOTE = "The assistant is working through the steps; they are shown on this page when it finishes.";

/**
 * Leave-and-return, version B (R1): the screening page keeps its state in the page itself, so leaving it (even by a link inside the app, in the same tab) drops the run and its result;
 * returning shows an empty form. Version A ("You can go to another page and come back; your screening keeps running...") would be false and is never written here.
 * e2e/running-states.spec.ts proves the premise: after a client-side navigation away and back, the running or finished screening is not shown.
 */
export const LEAVE_AND_RETURN_TEXT = "Keep this page open until the screening finishes. If you leave it, you will not see the result.";
