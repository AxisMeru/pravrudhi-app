// The pinned copy of the engine's assistant retention value (#125; Studio's page check). The engine repo owns it (configs/assistant_tier.yaml, retention_max_hours) and will serve it
// through GET /api/assistant; the app keeps ONE definition here. The Data handling sentence builds its "2" from this constant, and a unit test ties the constant to the vendored
// contract fixture (src/lib/fixtures/assistantContract.json): a change to either fails the test, so the page cannot drift from the engine.
export const ASSISTANT_RETENTION_MAX_HOURS = 2;
