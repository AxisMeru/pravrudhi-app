export function buildSha(env: Record<string, string | undefined>): string;
export function buildFlags(env: Record<string, string | undefined>): { assistant_entry: boolean; delete_confirmed: boolean; intake: boolean; citation_nav: boolean; citation_existence_only: boolean };
export function buildJson(env: Record<string, string | undefined>): string;
export const FLAG_ENV: Record<"assistant_entry" | "delete_confirmed" | "intake" | "citation_nav" | "citation_existence_only", string>;
