// The text of a chat stream `error` event. The engine used to send the message in `error`; since the coded-503 change (pravrudhi #319) `error`
// is a stable CODE ("chat_endpoint_unreachable") and the fixed human text moved to `detail`. Read `detail` for the text, fall back to `error`
// (an older engine, or a code with no detail, is shown as the engine sent it), and never show nothing.
export function streamErrorText(event: Record<string, unknown>): string {
  const detail = typeof event.detail === "string" ? event.detail.trim() : "";
  if (detail) return detail;
  const error = typeof event.error === "string" ? event.error.trim() : "";
  if (error) return error;
  return "The chat reply failed.";
}
