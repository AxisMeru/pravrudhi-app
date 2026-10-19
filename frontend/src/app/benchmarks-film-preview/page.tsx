import { redirect } from "next/navigation";

// The film belongs on /benchmarks only (operator, 19 Oct 2026): there is no preview page. A request for the old review route goes to /benchmarks.
export default function BenchmarksFilmPreviewRedirect() {
  redirect("/benchmarks");
}
