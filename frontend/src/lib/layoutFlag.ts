// Layout B "matter-b" (Studio spec v3 bb1b62b1c51a, pravrudhi-app#144): a grouped sidebar with a static screening header and a result-first Screening page. OFF by default: with the build flag unset no data-layout
// attribute is written, none of the new markup renders and not one rule in globals.css applies, so the live pages are unchanged (rollback = unset the flag and rebuild).
// The flag is NEXT_PUBLIC_LAYOUT_MATTER_B=1 (exactly "1", like the other build flags). It is recorded in /build.json as the seventh key layout_matter_b (scripts/write-build-json.mjs); kill switch = unset the env var and redeploy.
export const LAYOUT_MATTER_B = process.env.NEXT_PUBLIC_LAYOUT_MATTER_B === "1";
export const LAYOUT_ATTRIBUTE: "matter-b" | undefined = LAYOUT_MATTER_B ? "matter-b" : undefined;
