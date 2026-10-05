import assert from "node:assert/strict";
import test from "node:test";

import { randomBytes } from "node:crypto";
import { deflateRawSync } from "node:zlib";

import { checkDocxArchive, MAX_DOCX_ENTRIES, MAX_DOCX_RATIO, verifyDocxInflation } from "./docxArchive";
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


// A real zip (local headers, data, central directory, end record) with true deflate data. `declared` lets a test make a
// header lie about the size; `comment` pads the end record's comment.
interface Part { name: string; data: Uint8Array; method?: 0 | 8 | 12; declared?: number }
function realZip(parts: Part[], comment = 0): ArrayBuffer {
  const chunks: Buffer[] = [];
  const central: number[] = [];
  let length = 0;
  const push = (b: Buffer | number[]) => {
    const buf = Buffer.from(b);
    chunks.push(buf);
    length += buf.length;
  };
  for (const p of parts) {
    const method = p.method ?? 8;
    const body = method === 8 ? deflateRawSync(p.data) : Buffer.from(p.data);
    const name = [...new TextEncoder().encode(p.name)];
    const declared = p.declared ?? p.data.length;
    const offset = length;
    push([...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(method), ...u16(0), ...u16(0), ...u32(0),
      ...u32(body.length), ...u32(declared), ...u16(name.length), ...u16(0), ...name]);
    push(body);
    central.push(...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(method), ...u16(0), ...u16(0), ...u32(0),
      ...u32(body.length), ...u32(declared), ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(0), ...u32(offset), ...name);
  }
  const cdOffset = length;
  push(central);
  push([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(parts.length), ...u16(parts.length), ...u32(central.length),
    ...u32(cdOffset), ...u16(comment), ...new Array(comment).fill(65)]);
  const all = Buffer.concat(chunks);
  return all.buffer.slice(all.byteOffset, all.byteOffset + all.byteLength) as ArrayBuffer;
}

test("a real-sized docx (over 100 KB, 300 KB and 2 MB) is accepted, not refused as unreadable", async () => {
  for (const size of [101 * 1024, 301 * 1024, 2 * 1024 * 1024]) {
    const doc = realZip([
      { name: "[Content_Types].xml", data: new TextEncoder().encode("<Types/>") },
      { name: "word/document.xml", data: new Uint8Array(randomBytes(size)) },
    ]);
    assert.ok(doc.byteLength > 100 * 1024);
    checkDocxArchive(doc);
    await verifyDocxInflation(doc);
  }
});

test("the end record is found whatever the file size and a trailing comment", async () => {
  const doc = realZip([{ name: "word/document.xml", data: new Uint8Array(randomBytes(400 * 1024)) }], 5000);
  checkDocxArchive(doc);
  await verifyDocxInflation(doc);
});

test("a part that inflates to more than it declares is refused by the bounded inflate (the header lied)", async () => {
  const lying = realZip([{ name: "word/document.xml", data: new Uint8Array(5 * 1024 * 1024), declared: 100 }]);
  // The declared sizes look harmless (the check alone is fooled)...
  assert.doesNotThrow(() => checkDocxArchive(lying));
  // ...the bounded inflate is not.
  await assert.rejects(verifyDocxInflation(lying), (e: unknown) => e instanceof ExtractError && /size declarations/.test(e.message));
});

test("a part that inflates to less than declared, an unsupported method and a stored size mismatch are refused", async () => {
  const short = realZip([{ name: "a.xml", data: new Uint8Array(1000), declared: 5000 }]);
  await assert.rejects(verifyDocxInflation(short), (e: unknown) => e instanceof ExtractError);
  const exotic = realZip([{ name: "a.xml", data: new Uint8Array(10), method: 12 }]);
  await assert.rejects(verifyDocxInflation(exotic), (e: unknown) => e instanceof ExtractError);
  const stored = realZip([{ name: "a.xml", data: new Uint8Array(10), method: 0, declared: 20 }]);
  await assert.rejects(verifyDocxInflation(stored), (e: unknown) => e instanceof ExtractError);
});

test("the cumulative declared size over the cap is refused even when each part is honest", () => {
  const parts = Array.from({ length: 6 }, (_, i) => ({ name: `p${i}.xml`, data: new Uint8Array(randomBytes(10 * 1024 * 1024)) }));
  assert.throws(() => checkDocxArchive(realZip(parts)), (e: unknown) => e instanceof ExtractError && /50 MB/.test(e.message));
});
