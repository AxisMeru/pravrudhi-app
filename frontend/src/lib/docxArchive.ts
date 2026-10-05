// A structural check of a .docx (a zip) BEFORE mammoth reads it, in two stages:
//  1. `checkDocxArchive` reads the central directory and refuses, without inflating anything, an archive whose
//     DECLARED sizes make it a zip bomb.
//  2. `verifyDocxInflation` then inflates every part in a bounded stream and refuses any part that produces more
//     than it declared, or a total over the cap. Declared sizes are only a claim; this is what makes them true, so
//     a header that lies about a small size cannot make the later real extraction allocate a huge buffer.
import { ExtractError } from "./factsInput";

export const MAX_DOCX_ENTRIES = 200;
export const MAX_DOCX_UNCOMPRESSED_BYTES = 50 * 1024 * 1024;
export const MAX_DOCX_RATIO = 100;

const EOCD = 0x06054b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;
const NOT_A_DOCX = "This file is not a readable .docx. Paste the facts as text instead.";
const UNSUPPORTED = "This .docx uses an archive format that is not supported. Paste the facts as text instead.";

export interface ZipEntry {
  name: string;
  method: number;
  compressed: number;
  uncompressed: number;
  localOffset: number;
}

// The end-of-central-directory record is within the last 22 + 65535 bytes (its comment is up to 64 KiB): scan
// BACKWARDS from the last possible position, whatever the file's size.
function findEocd(view: DataView, length: number): number {
  const last = length - 22;
  const first = Math.max(0, last - 0xffff);
  for (let i = last; i >= first; i--) {
    if (view.getUint32(i, true) === EOCD) return i;
  }
  return -1;
}

export function readEntries(data: ArrayBuffer): ZipEntry[] {
  const view = new DataView(data);
  const bytes = new Uint8Array(data);
  if (data.byteLength < 22) throw new ExtractError(NOT_A_DOCX);
  const eocd = findEocd(view, data.byteLength);
  if (eocd < 0) throw new ExtractError(NOT_A_DOCX);
  const count = view.getUint16(eocd + 10, true);
  const size = view.getUint32(eocd + 12, true);
  let offset = view.getUint32(eocd + 16, true);
  if (count === 0xffff || size === 0xffffffff || offset === 0xffffffff) throw new ExtractError(UNSUPPORTED);
  if (count > MAX_DOCX_ENTRIES) throw new ExtractError(`This .docx has ${count} parts; the limit is ${MAX_DOCX_ENTRIES}.`);
  const decoder = new TextDecoder();
  const entries: ZipEntry[] = [];
  for (let n = 0; n < count; n++) {
    if (offset + 46 > data.byteLength || view.getUint32(offset, true) !== CENTRAL) throw new ExtractError(NOT_A_DOCX);
    const compressed = view.getUint32(offset + 20, true);
    const uncompressed = view.getUint32(offset + 24, true);
    const nameLen = view.getUint16(offset + 28, true);
    const extraLen = view.getUint16(offset + 30, true);
    const commentLen = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    if (compressed === 0xffffffff || uncompressed === 0xffffffff || localOffset === 0xffffffff) {
      throw new ExtractError(UNSUPPORTED);
    }
    entries.push({
      name: decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLen)),
      method: view.getUint16(offset + 10, true),
      compressed,
      uncompressed,
      localOffset,
    });
    offset += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

export function checkDocxArchive(data: ArrayBuffer): void {
  let total = 0;
  for (const e of readEntries(data)) {
    if (e.name.includes("..") || /vbaProject\.bin$/i.test(e.name)) {
      throw new ExtractError("This .docx contains parts that are not accepted. Paste the facts as text instead.");
    }
    if (e.uncompressed > 0 && (e.compressed === 0 || e.uncompressed / e.compressed > MAX_DOCX_RATIO)) {
      throw new ExtractError("This .docx expands far more than a document should. Paste the facts as text instead.");
    }
    total += e.uncompressed;
    if (total > MAX_DOCX_UNCOMPRESSED_BYTES) {
      throw new ExtractError(`This .docx would expand to more than ${MAX_DOCX_UNCOMPRESSED_BYTES / 1024 / 1024} MB.`);
    }
  }
}

const LIES = "This .docx does not match its own size declarations. Paste the facts as text instead.";

// Inflate one part with a hard cap, in a stream, and stop the moment it is exceeded: no buffer larger than a chunk
// plus the cap is ever held.
async function inflatedSize(compressedBytes: Uint8Array, cap: number): Promise<number> {
  const source = new Blob([compressedBytes as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  const reader = source.getReader();
  let produced = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return produced;
      produced += value.byteLength;
      if (produced > cap) return produced;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}

export async function verifyDocxInflation(data: ArrayBuffer): Promise<void> {
  const view = new DataView(data);
  const bytes = new Uint8Array(data);
  let budget = MAX_DOCX_UNCOMPRESSED_BYTES;
  for (const e of readEntries(data)) {
    const h = e.localOffset;
    if (h + 30 > data.byteLength || view.getUint32(h, true) !== LOCAL) throw new ExtractError(NOT_A_DOCX);
    const start = h + 30 + view.getUint16(h + 26, true) + view.getUint16(h + 28, true);
    if (start + e.compressed > data.byteLength) throw new ExtractError(NOT_A_DOCX);
    const part = bytes.subarray(start, start + e.compressed);
    if (e.method === 0) {
      if (e.compressed !== e.uncompressed) throw new ExtractError(LIES);
    } else if (e.method === 8) {
      const produced = await inflatedSize(part, Math.min(e.uncompressed, budget));
      if (produced !== e.uncompressed) throw new ExtractError(LIES);
    } else {
      throw new ExtractError(UNSUPPORTED);
    }
    budget -= e.uncompressed;
    if (budget < 0) throw new ExtractError(`This .docx would expand to more than ${MAX_DOCX_UNCOMPRESSED_BYTES / 1024 / 1024} MB.`);
  }
}
