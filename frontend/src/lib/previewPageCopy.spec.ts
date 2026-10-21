import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { PREVIEW_PAGE } from "./previewPageCopy";

const h = (t: string) => createHash("sha256").update(t).digest("hex").slice(0, 16);
const PINS: Record<string, string> = {
  title: "03c5481ef61b7703",
  toolsOffLine: "4baa8fa91ce90387",
  signedOutLine: "da7525cf1ae1bc45",
  signedOutLink: "bfd402b2f6f38125",
  signedOutSample: "511c43e85a780657",
  sessionUnverified: "bc8e6c589eb7bc03", // R1 21 Oct, TOOL_OFF_LINES_R1 27fd5ce28704
  signed401: "157d2ec7a61a23c3",
  matterHeading: "1ec1a29ecd3f03f9",
  startMatter: "a9d2db888c2e1b15",
  matterStarted: "f7a1f01ebb0740cd",
  paperNameLabel: "09cd1e1c75f8c1cc",
  paperTextLabel: "9543ec1aaf9b83e8",
  addPaper: "1bb4cd13584409c2",
  papersHeading: "e0d14e9c04d7c332",
  removePaper: "c3812fc4acb861d5",
  removeAll: "4a3bef5f8d793ce1",
  removeAllQuestion: "dbbb42544bbeb438",
  removeAllYes: "fac76e76b4216f9c",
  removeAllCancel: "19766ed6ccb2f4a3",
  s3Name: "9ad16331df1763d0",
  s3Line: "bab4f630218f39e6",
  s3Run: "05021ae8be1bfaa0",
  working: "a92f0449a9f7235b",
};

test("every preview page label is exactly R1's, by hash", () => {
  assert.deepEqual(Object.keys(PREVIEW_PAGE).sort(), Object.keys(PINS).sort());
  for (const [k, hash] of Object.entries(PINS)) assert.equal(h((PREVIEW_PAGE as Record<string, string>)[k]), hash, k);
});
