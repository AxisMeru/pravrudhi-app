/**
 * Engine 0.6.19 candidate (#504): an assisted run whose paid session was billed but whose result could not be produced answers HTTP 502 {"error":"assistant_session_billed","detail":...,"assistant":{...}} and
 * must NOT be retried automatically (the app never retries the assisted route on a 5xx: #338). The code, the status, the engine's detail and the assistant block never reach the page.
 */
export const ASSISTANT_SESSION_BILLED_CODE = "assistant_session_billed";

/** R1's sentence (15 Oct, byte-exact): shown on the assisted path only when a billed assisted run produced no result; it does not replace a plain screening result. */
export const ASSISTANT_SESSION_BILLED_LINE = "The assistant run did not finish, so no result was produced. Please wait a little before running it again. You can still screen without the assistant.";
