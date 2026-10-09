import { createHash } from "node:crypto";

/** The sha256 the engine echoes for a fact: of the stripped text. A mock that echoes a fact must use it, because the page pairs echoed and submitted facts by it. */
export const sha = (text: string): string => createHash("sha256").update(text.trim()).digest("hex");
