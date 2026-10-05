// A cheap structural check of a .docx (a zip) BEFORE anything inflates it: read the central directory, add up the
// declared sizes and refuse an archive whose expansion would be a zip bomb. Nothing is decompressed here.
import { ExtractError } from "./factsInput";

export const MAX_DOCX_ENTRIES = 200;
export const MAX_DOCX_UNCOMPRESSED_BYTES = 50 * 1024 * 1024;
export const MAX_DOCX_RATIO = 100;

const EOCD = 0x06054b50;
const CENTRAL = 0x02014b50;
const NOT_A_DOCX = "This file is not a readable .docx. Paste the facts as text instead.";

export function checkDocxArchive(data: ArrayBuffer): void {
  const view = new DataView(data);
  const bytes = new Uint8Array(data);
  let eocd = -1;
  for (let i = Math.min(data.byteLength - 22, 22 + 0xffff); i >= Math.max(0, data.byteLength - 22 - 0xffff); i--) {
    if (i >= 0 && view.getUint32(i, true) === EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new ExtractError(NOT_A_DOCX);
  const entries = view.getUint16(eocd + 10, true);
  const size = view.getUint32(eocd + 12, true);
  let offset = view.getUint32(eocd + 16, true);
  if (entries === 0xffff || size === 0xffffffff || offset === 0xffffffff) {
    throw new ExtractError("This .docx uses an archive format that is not supported. Paste the facts as text instead.");
  }
  if (entries > MAX_DOCX_ENTRIES) throw new ExtractError(`This .docx has ${entries} parts; the limit is ${MAX_DOCX_ENTRIES}.`);
  let total = 0;
  const decoder = new TextDecoder();
  for (let n = 0; n < entries; n++) {
    if (offset + 46 > data.byteLength || view.getUint32(offset, true) !== CENTRAL) throw new ExtractError(NOT_A_DOCX);
    const compressed = view.getUint32(offset + 20, true);
    const uncompressed = view.getUint32(offset + 24, true);
    const nameLen = view.getUint16(offset + 28, true);
    const extraLen = view.getUint16(offset + 30, true);
    const commentLen = view.getUint16(offset + 32, true);
    if (compressed === 0xffffffff || uncompressed === 0xffffffff) {
      throw new ExtractError("This .docx uses an archive format that is not supported. Paste the facts as text instead.");
    }
    const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLen));
    if (name.includes("..") || /vbaProject\.bin$/i.test(name)) {
      throw new ExtractError("This .docx contains parts that are not accepted. Paste the facts as text instead.");
    }
    if (uncompressed > 0 && (compressed === 0 || uncompressed / compressed > MAX_DOCX_RATIO)) {
      throw new ExtractError("This .docx expands far more than a document should. Paste the facts as text instead.");
    }
    total += uncompressed;
    if (total > MAX_DOCX_UNCOMPRESSED_BYTES) {
      throw new ExtractError(`This .docx would expand to more than ${MAX_DOCX_UNCOMPRESSED_BYTES / 1024 / 1024} MB.`);
    }
    offset += 46 + nameLen + extraLen + commentLen;
  }
}
