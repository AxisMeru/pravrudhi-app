import { CODED_ERROR_TEXT } from "./signedStrings";

// The text of a chat stream `error` event. The engine used to send the message in `error`; since the coded-503 change (pravrudhi #319) `error`
// is a stable CODE ("chat_endpoint_unreachable") and the fixed human text moved to `detail`. A code the app has signed wording for shows
// that wording; any other code shows `detail`, then `error` (an older engine, or a code with no detail, is shown as the engine sent it),
// and never nothing.
export function streamErrorText(event: Record<string, unknown>): string {
  const code = typeof event.error === "string" ? event.error.trim() : "";
  if (code === "chat_endpoint_unreachable") return CODED_ERROR_TEXT.chat_endpoint_unreachable;
  const detail = typeof event.detail === "string" ? event.detail.trim() : "";
  if (detail) return detail;
  const error = typeof event.error === "string" ? event.error.trim() : "";
  if (error) return error;
  return "The chat reply failed.";
}
