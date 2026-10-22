import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { buildInfoJson } from "../../scripts/write-build-info.mjs";
import { ABOUT_COPY, FOOTER_COPY } from "./aboutCopy";
import { formatBst, formatBstDate, shortSha } from "./buildInfo";
import { problemReportText } from "./problemReport";
import { RELEASES, lastReleases, parseReleases, releaseFor } from "./releases";

const h16 = (s: string): string => createHash("sha256").update(s, "utf8").digest("hex").slice(0, 16);

test("London time: BST in summer, GMT in winter, the zone's own short name; invalid input is empty", () => {
  assert.equal(formatBst("2026-10-22T13:15:00Z"), "22 Oct 2026 14:15 BST");
  assert.equal(formatBst("2026-10-22T14:15:00+01:00"), "22 Oct 2026 14:15 BST");
  assert.equal(formatBst("2026-12-01T09:05:00Z"), "1 Dec 2026 09:05 GMT");
  assert.equal(formatBstDate("2026-10-21T17:56:00+01:00"), "21 Oct 2026");
  assert.equal(formatBst("nonsense"), "");
  assert.equal(shortSha("064999a8db2866f64d4bf0fcc6cc85773142c93d"), "064999a");
  assert.equal(shortSha("unknown"), "unknown");
});

// R1 (22 Oct, ABOUT_WHATS_NEW_SIGNED_R1; 0.6.32 and 0.6.27 reworded 22 Oct evening so they state what the release added and nothing about the current on/off state): the five lines, by hash, in order, with L2A's live times. 0.6.30 and 0.6.31 were never deployed and are not listed.
test("What's new: the five signed lines, newest first, by hash, with their live times; no undeployed version", () => {
  assert.deepEqual(RELEASES.map((r) => r.engine), ["0.6.32", "0.6.29", "0.6.28", "0.6.27", "0.6.26"]);
  // the first 8 hex of each of R1's hashes (a full 16-hex hash can carry a long digit run that the invented-fixtures guard reads as an ID number)
  assert.deepEqual(RELEASES.map((r) => h16(r.line).slice(0, 8)), ["808a1b95", "210ff941", "32df00dd", "e020dffd", "9dcd93be"]);
  assert.deepEqual(RELEASES.map((r) => formatBst(r.liveAt)), ["22 Oct 2026 14:15 BST", "22 Oct 2026 09:02 BST", "21 Oct 2026 17:56 BST", "21 Oct 2026 09:01 BST", "20 Oct 2026 18:40 BST"]);
  assert.equal(RELEASES.find((r) => r.engine === "0.6.28")?.showTime, false, "0.6.28 shows the date only (two logs say about 17:56)");
  assert.equal(lastReleases().length, 5);
  assert.equal(lastReleases(2).length, 2);
  assert.equal(releaseFor("0.6.32")?.liveAt, "2026-10-22T14:15:00+01:00");
  assert.equal(releaseFor("0.6.99"), undefined);
  for (const r of RELEASES) assert.doesNotMatch(r.line, /\blive\b|preview|beta|stable|secure|model|judge|GPU/i, r.line);
});

test("parseReleases: bad rows are dropped, never guessed; the list is sorted newest first", () => {
  assert.deepEqual(parseReleases(null), []);
  assert.deepEqual(parseReleases({ releases: [{ engine: "1", liveAt: "bad", line: "x" }, { engine: "", liveAt: "2026-10-01T00:00:00Z", line: "x" }, { engine: "2", liveAt: "2026-10-01T00:00:00Z" }] }), []);
  const r = parseReleases({ releases: [{ engine: "a", liveAt: "2026-10-01T00:00:00Z", line: "x" }, { engine: "b", liveAt: "2026-10-02T00:00:00Z", line: "y" }] });
  assert.deepEqual(r.map((x) => x.engine), ["b", "a"]);
});

test("the About words and the footer pattern: no contact, no model word, no forbidden claim", () => {
  const all = Object.values(ABOUT_COPY).join(" ") + Object.values(FOOTER_COPY).join(" ");
  // R1 (22 Oct): no access wording on /about (no invite-only, approved-only, closed-beta, restricted-access claim; no Admin/Access page, not live)
  assert.doesNotMatch(all, /@|contact|support|preview|beta|stable|secure|model|judge|GPU|always|fully|invit|approved|whitelist|allowlist|team member|early access|pilot|restricted|request access|\badmin\b|\baccess\b/i);
  assert.doesNotMatch(RELEASES.map((r) => r.line).join(" "), /invit|approved|whitelist|allowlist|team member|beta|early access|pilot|restricted|request access|\badmin\b|\baccess\b/i);
  assert.equal(ABOUT_COPY.statusRunning, "Engine: running");
  assert.equal(ABOUT_COPY.statusDown, "Engine: not answering");
  assert.equal(ABOUT_COPY.engineUnavailable, "engine version unavailable right now");
  assert.equal(ABOUT_COPY.copyButton, "Copy details for a problem report");
  assert.equal(ABOUT_COPY.copied, "Copied.");
});

test("the problem report text: the app sha, build time, engine version and status, the page address without query or fragment, the browser and the time; nothing else", () => {
  const t = problemReportText({ sha: "064999a8db2866f64d4bf0fcc6cc85773142c93d", builtAt: "2026-10-22T11:40:00Z", engine: "0.6.32", running: true, url: "https://pravrudhi-app.vercel.app/about?matter=0123456789abcdef&email=a@b.c#frag", userAgent: "TestBrowser/1.0", now: new Date("2026-10-22T12:00:00Z") });
  assert.equal(t, ["Problem report details", "App: 064999a (built 22 Oct 2026 12:40 BST)", "Engine: 0.6.32", "Engine: running", "Page: https://pravrudhi-app.vercel.app/about", "Browser: TestBrowser/1.0", "Time: 2026-10-22T12:00:00.000Z (22 Oct 2026 13:00 BST)"].join("\n"));
  assert.doesNotMatch(t, /matter=|email|@|frag|token|bearer/i);
  const down = problemReportText({ sha: "unknown", builtAt: "", engine: null, running: false, url: "not a url", userAgent: "UA", now: new Date("2026-10-22T12:00:00Z") });
  assert.match(down, /App: unknown\n/);
  assert.match(down, /Engine: engine version unavailable right now/);
  assert.match(down, /Engine: not answering/);
  assert.match(down, /Page: \n|Page: $/m);
});

test("the footer is in the root layout inside main (every page), the menu and layout B list About, and the build info is baked from the prebuild file, not read from the network", () => {
  const root = join(__dirname, "..", "..");
  const layout = readFileSync(join(root, "src", "app", "layout.tsx"), "utf8");
  assert.match(layout, /<EditionGate>\{children\}<\/EditionGate>\s*<SiteFooter \/>/);
  assert.match(readFileSync(join(root, "src", "components", "Sidebar.tsx"), "utf8"), /href: "\/about", label: NAV_LABELS\.about/);
  assert.match(readFileSync(join(root, "src", "components", "MatterBNav.tsx"), "utf8"), /"\/how-it-was-built", "\/about"\]/);
  assert.match(readFileSync(join(root, "package.json"), "utf8"), /"prebuild": "node scripts\/write-build-json\.mjs && node scripts\/write-build-info\.mjs"/);
  const bi = readFileSync(join(root, "src", "lib", "buildInfo.ts"), "utf8");
  assert.doesNotMatch(bi, /fetch\(|XMLHttpRequest/);
});

const SHA = "0123456789abcdef0123456789abcdef01234567";
test("build info: the sha follows build.json's rule (BUILD_SHA, else VERCEL_GIT_COMMIT_SHA, 40 hex or unknown), the time is the one passed, and nothing else is written (no env, no secret)", () => {
  const now = new Date("2026-10-22T13:15:00.000Z");
  assert.deepEqual(JSON.parse(buildInfoJson({ BUILD_SHA: SHA }, now)), { sha: SHA, builtAt: "2026-10-22T13:15:00.000Z" });
  assert.equal(JSON.parse(buildInfoJson({ VERCEL_GIT_COMMIT_SHA: SHA }, now)).sha, SHA);
  assert.equal(JSON.parse(buildInfoJson({ BUILD_SHA: "short" }, now)).sha, "unknown");
  assert.equal(JSON.parse(buildInfoJson({}, now)).sha, "unknown");
  assert.deepEqual(Object.keys(JSON.parse(buildInfoJson({ BUILD_SHA: SHA, SECRET: "x", NEXT_PUBLIC_X: "1" }))).sort(), ["builtAt", "sha"]);
});
