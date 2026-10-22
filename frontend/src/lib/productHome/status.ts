// The models line of the signed-in Home (app#539): read from the SAME engine status call the Screening page makes (GET /api/v1/status, the `judges` field), once on load, no timer.
import { apiBase, engineFetch } from "@/lib/api";

export type ModelsState = "ready" | "starting" | "off" | "unavailable" | "none";

/** `judges` = {first, second}, each "parked" | "warming" | "ready" (engine 0.6.32+). Absent = the feature is off in this engine: no line; one ready and one parked: no line. */
export function modelsStateOf(body: unknown): ModelsState {
  if (typeof body !== "object" || body === null) return "unavailable";
  const j = (body as Record<string, unknown>).judges;
  if (j === undefined) return "none";
  if (typeof j !== "object" || j === null) return "unavailable";
  const f = (j as Record<string, unknown>).first, s = (j as Record<string, unknown>).second;
  if (f === "ready" && s === "ready") return "ready";
  if (f === "warming" || s === "warming") return "starting";
  if (f === "parked" && s === "parked") return "off";
  // one ready and the other parked (a partial start, or one lease ended first): no line rather than a wrong one (R2 advise)
  if ((f === "ready" && s === "parked") || (s === "ready" && f === "parked")) return "none";
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
