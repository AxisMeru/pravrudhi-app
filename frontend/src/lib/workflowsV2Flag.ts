// The workflows front door (Advisor Q6): the registry cards on /workflows and Workflows at the top of the work nav. OFF by default: with the flag unset /workflows and the nav are as they were.
// NEXT_PUBLIC_WORKFLOWS_V2=1 (exactly "1"); recorded in /build.json as workflows_v2.
export const WORKFLOWS_V2 = process.env.NEXT_PUBLIC_WORKFLOWS_V2 === "1";
