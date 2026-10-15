import assert from "node:assert/strict";
import test from "node:test";

import { activeFactFilter, resultKey } from "./factFilter";

const r = (run_id: string, ids: string[]) => ({ run_id, facts: ids.map((id) => ({ id, sha256: `sha-${id}` })) });

test("the filter applies to the result it was chosen on, and only while that fact is in it", () => {
  const a = r("run-1", ["F1", "F2", "F3"]);
  const state = { key: resultKey(a), factId: "F3" };
  assert.equal(activeFactFilter(state, a), "F3");
  assert.equal(activeFactFilter(null, a), null);
  // another run
  assert.equal(activeFactFilter(state, r("run-2", ["F1", "F2", "F3"])), null);
  // the SAME run id with fewer facts is another result: F3 is gone
  assert.equal(activeFactFilter(state, r("run-1", ["F1", "F2"])), null);
  // the same run id and ids but another fact text (sha) is another result too
  assert.equal(activeFactFilter(state, { run_id: "run-1", facts: [{ id: "F1", sha256: "x" }, { id: "F2", sha256: "y" }, { id: "F3", sha256: "z" }] }), null);
});
