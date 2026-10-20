export function buildSha(env: Record<string, string | undefined>): string;
export function buildFlags(env: Record<string, string | undefined>): { assistant_entry: boolean; delete_confirmed: boolean; intake: boolean; citation_nav: boolean; citation_existence_only: boolean; look_tonal: boolean; layout_matter_b: boolean; workflows_v2: boolean };
export function buildJson(env: Record<string, string | undefined>): string;
export const FLAG_ENV: Record<"assistant_entry" | "delete_confirmed" | "intake" | "citation_nav" | "citation_existence_only" | "look_tonal" | "layout_matter_b" | "workflows_v2", string>;
