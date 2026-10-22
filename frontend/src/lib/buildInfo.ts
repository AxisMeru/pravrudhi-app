// The app's own version for the About page and the footer (app#519): the commit and the build time baked into THIS build (next.config.ts, from scripts/write-build-info.mjs). Nothing here reads the network.
export const APP_SHA: string = /^[0-9a-f]{40}$/.test(process.env.NEXT_PUBLIC_APP_SHA ?? "") ? (process.env.NEXT_PUBLIC_APP_SHA as string) : "unknown";
export const BUILD_TIME: string = Number.isNaN(Date.parse(process.env.NEXT_PUBLIC_BUILD_TIME ?? "")) ? "" : (process.env.NEXT_PUBLIC_BUILD_TIME as string);

/** The short commit shown in the footer and on /about: the first 7 characters, or "unknown". */
export const shortSha = (sha: string): string => (sha === "unknown" ? "unknown" : sha.slice(0, 7));

/** "22 Oct 2026 14:15 BST" for an ISO instant, in London time (BST in summer, GMT in winter: the zone's own short name). "" for anything that is not a date. */
export function formatBst(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZoneName: "short" }).formatToParts(new Date(t));
  const p = (type: string): string => parts.find((x) => x.type === type)?.value ?? "";
  return `${p("day")} ${p("month")} ${p("year")} ${p("hour")}:${p("minute")} ${p("timeZoneName")}`;
}

/** "21 Oct 2026" (the date alone, London time) for a release whose go-live minute is not exact. */
export function formatBstDate(iso: string): string {
  const full = formatBst(iso);
  return full ? full.split(" ").slice(0, 3).join(" ") : "";
}
