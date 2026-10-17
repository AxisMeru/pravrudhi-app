import { useSyncExternalStore } from "react";

// True below the md breakpoint (767 px and narrower). The server and the first client render say false, so the markup matches; a phone re-renders once. Used where the DOM order itself must change on a phone (not CSS order), so keyboard and screen-reader order equal the visual order.
const QUERY = "(max-width: 767px)";
const subscribe = (cb: () => void) => {
  const m = window.matchMedia(QUERY);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};
export function useNarrow(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => false);
}
