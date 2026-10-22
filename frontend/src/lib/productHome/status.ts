// The models line of the signed-in Home (app#539): read from the SAME engine status call the Screening page makes (GET /api/v1/status, the `judges` field), once on load, no timer.
import { apiBase, engineFetch } from "@/lib/api";

export type ModelsState = "ready" | "starting" | "off" | "unavailable" | "none";

/** `judges` = {first, second}, each "parked" | "warming" | "ready" (engine 0.6.32+). Absent = the feature is off in this engine: no line. */
export function modelsStateOf(body: unknown): ModelsState {
  if (typeof body !== "object" || body === null) return "unavailable";
  const j = (body as Record<string, unknown>).judges;
  if (j === undefined) return "none";
  if (typeof j !== "object" || j === null) return "unavailable";
  const f = (j as Record<string, unknown>).first, s = (j as Record<string, unknown>).second;
  if (f === "ready" && s === "ready") return "ready";
  if (f === "warming" || s === "warming" || (f === "ready" && s !== "ready") || (s === "ready" && f !== "ready")) return "starting";
  if (f === "parked" && s === "parked") return "off";
  return "unavailable";
}

export async function readModelsState(signal?: AbortSignal): Promise<ModelsState> {
  try {
    const res = await engineFetch(`${apiBase()}/api/v1/status`, { cache: "no-store", signal, authOptional: true });
    if (!res.ok) return "unavailable";
    return modelsStateOf(await res.json().catch(() => null));
  } catch {
    return "unavailable";
  }
}
