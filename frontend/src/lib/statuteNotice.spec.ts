import { strict as assert } from "node:assert";
import test from "node:test";
import { INDIA_CODE_HOME, STATUTE_NOTICE, hitSourceLink, isIndiaCodeHost, sourceLinkFor, sourceLinkLabel } from "./statuteNotice";

const SOURCES = [
  { work: "Bharatiya Nyaya Sanhita (2023)", site: "indiacode.gov.in", pages: [{ url: "https://indiacode.gov.in/act/abc/sections" }] },
  { work: "Indian Penal Code, 1860", pages: [] },
  { work: "Bharatiya Nagarik Suraksha Sanhita (2023)", pages: [{ url: "http://insecure.example/x" }] },
];

test("the notice is the exact licence wording", () => {
  assert.equal(STATUTE_NOTICE, "Unofficial text; the official version on India Code prevails.");
});

test("an act resolves to the page the corpus recorded for it", () => {
  assert.deepEqual(sourceLinkFor("Bharatiya Nyaya Sanhita", SOURCES), { href: "https://indiacode.gov.in/act/abc/sections", recorded: true });
});

test("an act with no recorded page falls back to the India Code home page, never a guessed link", () => {
  assert.deepEqual(sourceLinkFor("Indian Penal Code", SOURCES), { href: INDIA_CODE_HOME, recorded: false });
  assert.deepEqual(sourceLinkFor("Unknown Act", SOURCES), { href: INDIA_CODE_HOME, recorded: false });
  assert.deepEqual(sourceLinkFor("", SOURCES), { href: INDIA_CODE_HOME, recorded: false });
});

test("an engine that omits or mangles `sources` falls back instead of throwing", () => {
  for (const bad of [undefined, null, "x", 5, {}, [null, 3, "y"]]) {
    assert.deepEqual(sourceLinkFor("Bharatiya Nyaya Sanhita", bad), { href: INDIA_CODE_HOME, recorded: false });
  }
});

test("only India Code hosts are labelled and used as the act's link", () => {
  assert.equal(isIndiaCodeHost("https://indiacode.gov.in/act/x"), true);
  assert.equal(isIndiaCodeHost("https://www.indiacode.nic.in/"), true);
  assert.equal(isIndiaCodeHost("https://evil-indiacode.gov.in.example.com/"), false);
  assert.equal(isIndiaCodeHost("https://example.com/indiacode.gov.in"), false);
  assert.equal(isIndiaCodeHost("http://indiacode.gov.in/"), false);
  assert.equal(isIndiaCodeHost("not a url"), false);
  const other = [{ work: "Indian Penal Code, 1860", pages: [{ url: "https://example.org/ipc" }] }];
  assert.deepEqual(sourceLinkFor("Indian Penal Code", other), { href: INDIA_CODE_HOME, recorded: false });
  const mixed = [{ work: "Indian Penal Code, 1860", pages: [{ url: "https://example.org/ipc" }, { url: "https://indiacode.gov.in/act/ipc" }] }];
  assert.equal(sourceLinkFor("Indian Penal Code", mixed).href, "https://indiacode.gov.in/act/ipc");
});

test("a non-https recorded link is not used", () => {
  assert.equal(sourceLinkFor("Bharatiya Nagarik Suraksha Sanhita", SOURCES).href, INDIA_CODE_HOME);
});

test("a name that only shares a prefix does not match another act", () => {
  assert.equal(sourceLinkFor("Bharatiya Nyaya", SOURCES).recorded, false);
});

test("malformed source records are ignored", () => {
  assert.equal(sourceLinkFor("X", [{ work: 5, pages: "no" }, {}] as Record<string, unknown>[]).recorded, false);
});

test("the published demo snapshot carries no statute text in a SOURCES block", async () => {
  const { readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const raw = readFileSync(join(__dirname, "..", "..", "public", "demo.json"), "utf8");
  const marker = "[statute text removed; see India Code]";
  let blocks = 0;
  const collect = (o: unknown): void => {
    if (typeof o === "string") {
      const at = o.indexOf("SOURCES (");
      if (at < 0) return;
      blocks += 1;
      const end = o.indexOf("\n\nQUESTION:", at);
      const body = end < 0 ? o.slice(at) : o.slice(at, end);
      if (end < 0) return; // a truncated copy (the 300-character criteria text) stops before the block ends
      for (const entry of body.split(/\n(?=\[[A-Za-z]+\/[^\]]+\] )/).slice(1)) {
        assert.ok(entry.endsWith(marker), `a statute text survives in: ${entry.slice(0, 60)}`);
      }
    } else if (Array.isArray(o)) o.forEach(collect);
    else if (o && typeof o === "object") Object.values(o).forEach(collect);
  };
  collect(JSON.parse(raw));
  assert.ok(blocks > 0, "the snapshot is expected to still hold the recorded prompts");
  assert.doesNotMatch(raw, /Emasculation|shall not discriminate against any citizen/);
});

test("hitSourceLink: the engine's per-hit source_url wins, null is the home page, an absent field falls back to the sources", () => {
  const url = "https://www.indiacode.gov.in/show-data?actid=AC_CEN_5_23&sectionId=1";
  assert.deepEqual(hitSourceLink({ act: "Bharatiya Nyaya Sanhita", source_url: url }, []), { href: url, recorded: true });
  // an engine that says "none recorded" gets the home page even if a source record could be matched here
  assert.deepEqual(hitSourceLink({ act: "Bharatiya Nyaya Sanhita", source_url: null, source_fallback_url: INDIA_CODE_HOME }, SOURCES), { href: INDIA_CODE_HOME, recorded: false });
  // an engine that predates the field (no source_url key): the old lookup from `sources`
  assert.deepEqual(hitSourceLink({ act: "Bharatiya Nyaya Sanhita" }, SOURCES), sourceLinkFor("Bharatiya Nyaya Sanhita", SOURCES));
  assert.deepEqual(hitSourceLink({ act: "Indian Penal Code" }, SOURCES), { href: INDIA_CODE_HOME, recorded: false });
});

test("hitSourceLink: a source_url that is not a plain https India Code link is never used, whatever the engine sent", () => {
  for (const bad of [
    "http://www.indiacode.gov.in/x",
    "https://evil.example/x",
    "https://evil.example\\@indiacode.gov.in/x",
    "https://user@indiacode.gov.in/x",
    "https://indiacode.gov.in:8443/x",
    "https://indiacode.gov.in/x y",
    "https://indiacode.gov.in/x)",
    " https://indiacode.gov.in/x",
    "javascript:alert(1)",
    "https://indiacode.gov.in/x\u0000",
    "https://indiacode.gov.in/x\u200b",
    "https://indiacode.gov.in/\u00e9",
    "https://indiacode.gov.in.evil.example/x",
    "https://indiacode.gov.in/x?next=https://evil.example/y",
    "https://indiacode.gov.in/x/https://evil.example",
    "",
    "not a url",
  ]) {
    assert.deepEqual(hitSourceLink({ act: "Bharatiya Nyaya Sanhita", source_url: bad }, SOURCES), { href: INDIA_CODE_HOME, recorded: false }, bad);
  }
  for (const odd of [5, {}, ["https://indiacode.gov.in/x"]]) {
    assert.equal(hitSourceLink({ act: "Indian Penal Code", source_url: odd }, SOURCES).recorded, false);
  }
});

test("sourceLinkLabel: a recorded India Code page is 'Source on India Code'; the home-page fallback is not called a source", () => {
  assert.equal(sourceLinkLabel("https://www.indiacode.gov.in/show-data?actid=AC_CEN_5_23"), "Source on India Code");
  assert.equal(sourceLinkLabel(INDIA_CODE_HOME), "India Code (home page)");
  assert.equal(sourceLinkLabel("https://example.org/x"), "Source");
  // an act with no recorded page (the IPC, the Constitution) ends up with the home-page label end to end
  assert.equal(sourceLinkLabel(hitSourceLink({ act: "Indian Penal Code", source_url: null }, SOURCES).href), "India Code (home page)");
  assert.equal(sourceLinkLabel(hitSourceLink({ act: "Bharatiya Nyaya Sanhita", source_url: "https://www.indiacode.gov.in/x" }, SOURCES).href), "Source on India Code");
});
