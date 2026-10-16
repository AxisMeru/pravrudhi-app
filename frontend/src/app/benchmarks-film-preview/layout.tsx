import type { Metadata } from "next";

import { pageTitle } from "@/lib/pageTitles";

// An unlisted review route (NyayaSiddhi film, 16 Oct): never indexed, never linked from the site; it goes away or moves into /benchmarks when the film is signed.
export const metadata: Metadata = { title: pageTitle("benchmarksFilmPreview"), robots: { index: false, follow: false } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
