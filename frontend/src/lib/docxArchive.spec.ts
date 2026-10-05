import assert from "node:assert/strict";
import test from "node:test";

import { checkDocxArchive, MAX_DOCX_ENTRIES, MAX_DOCX_RATIO } from "./docxArchive";
import { DOCX_WORKER_TIMEOUT_MS, parseDocxInWorker, type DocxWorkerLike } from "./docParsers";
import { ExtractError } from "./factsInput";

// A zip with only a central directory: the check reads declared sizes and never inflates, so no data is needed.
const u16 = (n: number) => [n & 255, (n >> 8) & 255];
const u32 = (n: number) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];

function zip(entries: { name: string; compressed: number; uncompressed: number }[]): ArrayBuffer {
  const central: number[] = [];
  for (const e of entries) {
    const name = [...new TextEncoder().encode(e.name)];
    central.push(
      ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(8), ...u16(0), ...u16(0), ...u32(0),
      ...u32(e.compressed), ...u32(e.uncompressed), ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(0), ...u32(0), ...name,
    );
  }
  const end = [...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(entries.length), ...u16(entries.length), ...u32(central.length), ...u32(0), ...u16(0)];
  return Uint8Array.from([...central, ...end]).buffer as ArrayBuffer;
}

const refused = (data: ArrayBuffer) => assert.throws(() => checkDocxArchive(data), (e: unknown) => e instanceof ExtractError);

test("a normal docx archive passes", () => {
  checkDocxArchive(zip([
    { name: "[Content_Types].xml", compressed: 300, uncompressed: 900 },
    { name: "word/document.xml", compressed: 4000, uncompressed: 40000 },
  ]));
});

test("a zip bomb is refused before anything is inflated", () => {
  refused(zip([{ name: "word/document.xml", compressed: 1000, uncompressed: 1000 * (MAX_DOCX_RATIO + 1) }]));
  refused(zip([{ name: "word/document.xml", compressed: 0, uncompressed: 5000 }]));
  refused(zip([
    { name: "a.xml", compressed: 10_000_000, uncompressed: 30_000_000 },
    { name: "b.xml", compressed: 10_000_000, uncompressed: 30_000_000 },
  ]));
});

test("too many parts, macro parts, path traversal, zip64 and non-zip bytes are refused", () => {
  refused(zip(Array.from({ length: MAX_DOCX_ENTRIES + 1 }, (_, i) => ({ name: `p${i}.xml`, compressed: 10, uncompressed: 20 }))));
  refused(zip([{ name: "word/vbaProject.bin", compressed: 10, uncompressed: 20 }]));
  refused(zip([{ name: "../evil.xml", compressed: 10, uncompressed: 20 }]));
  refused(zip([{ name: "big.xml", compressed: 0xffffffff, uncompressed: 0xffffffff }]));
  refused(new TextEncoder().encode("not a zip at all, just text").buffer as ArrayBuffer);
  refused(new ArrayBuffer(0));
});

class FakeWorker implements DocxWorkerLike {
  onmessage: DocxWorkerLike["onmessage"] = null;
  onerror: DocxWorkerLike["onerror"] = null;
  terminated = 0;
  constructor(private readonly behaviour: (w: FakeWorker) => void) {}
  postMessage(): void {
    this.behaviour(this);
  }
  terminate(): void {
    this.terminated++;
  }
}

const OK_ZIP = () => zip([{ name: "word/document.xml", compressed: 100, uncompressed: 400 }]);

test("the worker's text is returned and the worker is terminated", async () => {
  const w = new FakeWorker((self) => self.onmessage?.({ data: { ok: true, text: "Lata met Kiran." } }));
  assert.equal(await parseDocxInWorker(OK_ZIP(), () => w), "Lata met Kiran.");
  assert.equal(w.terminated, 1);
});

test("a worker that never answers is terminated at the deadline and the page is told it took too long", async () => {
  const w = new FakeWorker(() => undefined);
  await assert.rejects(parseDocxInWorker(OK_ZIP(), () => w, 20), (e: unknown) => e instanceof ExtractError && /took too long/.test(e.message));
  assert.equal(w.terminated, 1);
  assert.ok(DOCX_WORKER_TIMEOUT_MS >= 5_000 && DOCX_WORKER_TIMEOUT_MS <= 60_000);
});

test("a failing worker rejects and is terminated; a bomb never even starts one", async () => {
  const failing = new FakeWorker((self) => self.onmessage?.({ data: { ok: false } }));
  await assert.rejects(parseDocxInWorker(OK_ZIP(), () => failing));
  assert.equal(failing.terminated, 1);
  const crashed = new FakeWorker((self) => self.onerror?.(new Error("boom")));
  await assert.rejects(parseDocxInWorker(OK_ZIP(), () => crashed));
  let created = 0;
  const bomb = zip([{ name: "word/document.xml", compressed: 10, uncompressed: 10_000_000 }]);
  await assert.rejects(async () => parseDocxInWorker(bomb, () => { created++; return failing; }));
  assert.equal(created, 0);
});
