import assert from "node:assert/strict";
import test from "node:test";

import rowsFile from "../data/nyayasiddhi/rows.json";
import linksFile from "../data/nyayasiddhi/row_links.json";
import { parseRowLinks } from "./nyayasiddhiRowLinks";
import { parseRows } from "./nyayasiddhiRows";

const C = "660c7ff8e5bc079662036d4fe31233dc2267c0ae";
const good = { manifest_url: `https://huggingface.co/datasets/AxisMeru/nyayasiddhi/blob/${C}/results/append/x/m.json`, predictions_url: `https://huggingface.co/datasets/AxisMeru/nyayasiddhi/blob/${C}/results/append/x/p.jsonl`, manifest_sha256: "a".repeat(64), prediction_file_sha256: "b".repeat(64) };

test("the published link file parses: eight rows, each at the one pinned commit, all ids belong to rows of rows.json", () => {
  const links = parseRowLinks(linksFile);
  assert.equal(Object.keys(links).length, 8);
  const ids = new Set(parseRows(rowsFile).map((r) => r.rowId));
  for (const [id, l] of Object.entries(links)) {
    assert.ok(ids.has(id), id);
    assert.ok(l.manifestUrl.includes(C) && l.predictionsUrl.includes(C), id);
  }
});

test("a row's links are dropped, never half shown, when any check fails", () => {
  assert.deepEqual(Object.keys(parseRowLinks({ ok: good })), ["ok"]);
  const bad: Record<string, unknown> = {
    offsite: { ...good, manifest_url: "https://example.com/x" },
    other_repo: { ...good, predictions_url: `https://huggingface.co/datasets/Other/nyayasiddhi/blob/${C}/p.jsonl` },
    branch_not_commit: { ...good, manifest_url: "https://huggingface.co/datasets/AxisMeru/nyayasiddhi/blob/main/m.json" },
    traversal: { ...good, manifest_url: `https://huggingface.co/datasets/AxisMeru/nyayasiddhi/blob/${C}/../m.json` },
    short_sha: { ...good, manifest_sha256: "abc" },
    upper_sha: { ...good, prediction_file_sha256: "B".repeat(64) },
    missing: { manifest_url: good.manifest_url },
    not_object: "x",
  };
  assert.deepEqual(parseRowLinks(bad), {});
  assert.deepEqual(parseRowLinks(null), {});
  assert.deepEqual(parseRowLinks([good]), {});
});
