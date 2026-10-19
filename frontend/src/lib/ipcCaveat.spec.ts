import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { IPC_TEXT_CAVEAT_1860, IPC_TEXT_CAVEAT_BOTH, ipcCaveatOf } from "./ipcCaveat";

const h = (t: string) => createHash("sha256").update(t).digest("hex").slice(0, 16);

test("both IPC caveats are R1's exact lines", () => {
  assert.equal(h(IPC_TEXT_CAVEAT_BOTH), "274f685a33fa625c");
  assert.equal(h(IPC_TEXT_CAVEAT_1860), "27c3a9e31e5fa784");
});

test("an IPC section shows the true-in-both-states line, or the 1860 line only when the engine sent exactly it; other acts and other engine values show nothing extra", () => {
  assert.equal(ipcCaveatOf({ id: "ipc_405", act: "IPC" }), IPC_TEXT_CAVEAT_BOTH);
  assert.equal(ipcCaveatOf({ id: "x", act: "Indian Penal Code, 1860" }), IPC_TEXT_CAVEAT_BOTH);
  assert.equal(ipcCaveatOf({ id: "ipc_405", act: "IPC", text_caveat: IPC_TEXT_CAVEAT_1860 }), IPC_TEXT_CAVEAT_1860);
  assert.equal(ipcCaveatOf({ id: "ipc_405", act: "IPC", text_caveat: "made up" }), IPC_TEXT_CAVEAT_BOTH);
  assert.equal(ipcCaveatOf({ id: "ipc_405", act: "IPC", text_caveat: null }), IPC_TEXT_CAVEAT_BOTH);
  for (const x of [{ id: "bns_316", act: "BNS" }, { id: "ni_138", act: "NI Act", text_caveat: IPC_TEXT_CAVEAT_1860 }, {}]) assert.equal(ipcCaveatOf(x), null);
});

test("the corpus hit and the ask's source list both render the caveat through ipcCaveatOf", () => {
  const src = readFileSync(join(__dirname, "..", "app", "nyaya", "page.tsx"), "utf8");
  assert.equal((src.match(/ipcCaveatOf\(/g) ?? []).length, 4, "two uses (test + text) in each of the two lists");
});
