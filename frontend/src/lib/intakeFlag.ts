// The Intake page is built but offered only when the engine's intake route is live and signed (R1, R2, Track C): off by default; set NEXT_PUBLIC_INTAKE=1 at build time on the go.
export const INTAKE_ENABLED = process.env.NEXT_PUBLIC_INTAKE === "1";
