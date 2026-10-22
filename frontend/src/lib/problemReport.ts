import { ABOUT_COPY } from "./aboutCopy";
import { formatBst, shortSha } from "./buildInfo";

/**
 * The text of "Copy details for a problem report" (app#519; R1: only the app sha, the build time, the engine version, the engine status line, the page URL and the browser's time). The page URL is the address WITHOUT any query or
 * fragment (those can carry data); no facts, no matter id, no user id or email, no token is ever added here.
 */
export function problemReportText(i: { sha: string; builtAt: string; engine: string | null; running: boolean | null; url: string; userAgent: string; now: Date }): string {
  let page = "";
  try {
    const u = new URL(i.url);
    page = `${u.origin}${u.pathname}`;
  } catch {
    page = "";
  }
  const built = i.builtAt ? formatBst(i.builtAt) : "";
  return [
    "Problem report details",
    `App: ${shortSha(i.sha)}${built ? ` (built ${built})` : ""}`,
    `Engine: ${i.engine ?? ABOUT_COPY.engineUnavailable}`,
    i.running === null ? "" : i.running ? ABOUT_COPY.statusRunning : ABOUT_COPY.statusDown,
    `Page: ${page}`,
    `Browser: ${i.userAgent}`,
    `Time: ${i.now.toISOString()} (${formatBst(i.now.toISOString())})`,
  ].filter((l) => l !== "").join("\n");
}
