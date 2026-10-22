// Typed fetch client for the Pravrudhi engine's JSON API.
//
// Every function here can fail — there may be no engine running, or an endpoint may not exist yet on an
// older engine build. Callers are expected to handle rejection; nothing here retries or hides a failure.

import { parseAppendix, parseAssistantBlock, parseAssistantInfo, type AssistantBlock, type ScreeningAppendix } from "./assistantRun";
import contractElements from "./fixtures/contractElements.json";
import { runWake, type WakeIO } from "./wake/wakeRun";
import type { WakeView } from "./wake/wake";
import { WAKE_POLL_ERROR } from "./wake/wakeCopy";

function detectBase(): string {
  const configured = process.env.NEXT_PUBLIC_API_BASE?.replace(/\/+$/, "");
  if (configured) return configured;
  // Same-origin when the engine serves the page (loopback or the desktop shell); from a hosted origin with no
  // engine named there is no engine, and the connection banner says so rather than reaching for the visitor's
  // machine (ADR-0051 addendum 2).
  return "";
}

// Resolve at request time so static prerendering cannot freeze the browser's base.
export { detectBase as apiBase };

/** True when the engine is a hosted one named at build time (NEXT_PUBLIC_API_BASE): a different origin from the page, behind the web session. A page served by the engine itself is not. */
export function isHostedEngine(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_API_BASE?.replace(/\/+$/, ""));
}

// Get the current web session's access token for Supabase JWT auth.
async function webSessionToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  try {
    const { accessToken, sessionStale, refreshSession } = await import("./auth");
    if (accessToken() && sessionStale()) await refreshSession();
    return accessToken();
  } catch {
    return null;
  }
}

// A 401 with a session in hand: renew it once and say whether the caller should retry. A 401 with no session,
// or after a failed renewal, means signed out; the stale session is dropped so the account control and the
// sign-in page agree, then the page goes to /signin.
async function recoverFrom401(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    const { accessToken, refreshSession, clearSession } = await import("./auth");
    if (accessToken() && (await refreshSession())) return true;
    clearSession();
  } catch {
    /* no session module: nothing to clear */
  }
  return false;
}

// A hosted engine answering 401 means the session is gone or was never made: go to /signin rather than present
// the refusal as an engine that is not reachable. Only when a build names a Supabase project; never from /signin.
function toSignIn(status: number): void {
  if (status !== 401 || typeof window === "undefined" || !process.env.NEXT_PUBLIC_SUPABASE_URL) return;
  if (window.location.pathname.startsWith("/signin")) return;
  window.location.assign(new URL("/signin", window.location.origin).href);
}

// init.authOptional (2026-09-24): most of the app is signed-in-only, and for those calls a 401 that survives
// a session renewal genuinely means "go sign in" -- the default, unchanged. But the anonymous surface (the
// two demo-anon routes, and the identity probe edition() uses to name itself) is reachable by design with NO
// session at all, so a 401 from THOSE is an ordinary, expected outcome for a real anonymous visitor, not a
// reason to bounce them off the page they came to use. Real incident (2026-09-24): before this flag existed,
// every page's Sidebar called edition() -> GET /api/me on mount, that 401's anonymously, and the blanket
// redirect below fired for EVERY page load with no session -- so /matters (genuinely anonymous-capable)
// never rendered for an anonymous visitor at all, redirected to /signin before its own content could load.
export interface EngineFetchInit extends RequestInit {
  authOptional?: boolean;
  /** The user chose the anonymous demo: attach NO bearer token and do not try to renew a session for this call. */
  anonymous?: boolean;
}

// Every call to the engine goes through here (ADR-0051 addendum 3). The bearer token of the signed-in web
// session is attached when there is one — a local or desktop engine has none and ignores the absence — a stale
// session is renewed first, a 401 is answered by renewing once and retrying, and a 401 that survives that sends
// the page to /signin -- UNLESS the caller marked this call `authOptional` (see above), in which case the 401
// is simply returned like any other response. Page modules that fetched the engine themselves never carried
// the token, so the first signed-in operator saw "could not reach" on every page whose module was not api.ts
// (2026-09-12); a spec now refuses any bare engine fetch outside this function.
export async function engineFetch(input: string, init: EngineFetchInit = {}, retried = false): Promise<Response> {
  const { authOptional, anonymous, ...rest } = init;
  const token = anonymous ? null : await webSessionToken();
  const headers = new Headers(rest.headers);
  if (token && !headers.has("authorization")) headers.set("authorization", `Bearer ${token}`);
  const res = await fetch(input, { ...rest, headers });
  if (res.status === 401) {
    if (!anonymous && !retried && (await recoverFrom401())) return engineFetch(input, init, true);
    if (!authOptional) toSignIn(res.status);
  }
  return res;
}

// Whether this page is a recording rather than a live engine.
//
// Decided at runtime, from where the page is being served, because that is what actually determines it: a browser
// blocks a page on a public origin from reaching an engine on the visitor's machine, so a public page trying
// anyway produces nothing but console errors. A page served by the engine itself is on localhost and is live.
// NEXT_PUBLIC_DEMO forces the recording on for local preview of the public site.
function detectDemo(): boolean {
  // The product has no recording; only a build that says NEXT_PUBLIC_DEMO=1 (none does) is one.
  return process.env.NEXT_PUBLIC_DEMO === "1";
}

export const IS_DEMO = detectDemo();

export interface ApiErrorDetail {
  code?: string;
  reason?: string;
  retryAfter?: number;
  /** The `type` of each item of a FastAPI 422 `detail` list (for example string_too_long): only the type names, never the engine's messages. */
  validationTypes?: string[];
}

export class ApiError extends Error {
  readonly code?: string;
  readonly reason?: string;
  readonly retryAfter?: number;
  readonly validationTypes?: string[];
  constructor(
    public readonly status: number,
    public readonly path: string,
    detail: ApiErrorDetail = {},
  ) {
    super(`${path}: HTTP ${status}`);
    this.name = "ApiError";
    this.code = detail.code;
    this.reason = detail.reason;
    this.retryAfter = detail.retryAfter;
    this.validationTypes = detail.validationTypes;
  }
}

/** Reads the engine's error body ({ error: <code>, reason? }) into an ApiError; exported so a spec can run a recorded body through the same path the app uses. */
export async function apiErrorFrom(res: Response, path: string): Promise<ApiError> {
  let code: string | undefined;
  let reason: string | undefined;
  let validationTypes: string[] | undefined;
  try {
    const body = (await res.clone().json()) as { error?: unknown; reason?: unknown; detail?: unknown };
    if (typeof body.error === "string") code = body.error;
    if (typeof body.reason === "string") reason = body.reason;
    if (Array.isArray(body.detail)) validationTypes = body.detail.flatMap((d) => (typeof d === "object" && d !== null && typeof (d as { type?: unknown }).type === "string" ? [(d as { type: string }).type] : []));
  } catch {
    /* not JSON (a gateway error page): status alone */
  }
  const ra = Number(res.headers.get("retry-after"));
  return new ApiError(res.status, path, { code, reason, retryAfter: Number.isFinite(ra) && ra > 0 ? ra : undefined, validationTypes });
}

// Routes workspace_root.py's root_for() resolves by a named `workspace` (server.py's objectives/providers/
// panel/messaging routes, runs.py's run routes, nyaya.py's routes) — a signed-in non-admin caller who omits it
// gets refused with 400 ("Name a workspace..."), the gap the default-workspace decision (session-3, 2026-09-12)
// closes. Kept as a root list rather than a per-call-site concern, so a route added to one side (a new engine
// endpoint that takes `workspace`) only needs adding here once, on the frontend side, for every caller of
// getJSON/postJSON/putJSON/deleteJSON/streamRun to pick it up.
const WORKSPACE_SCOPED_ROOTS = [
  "/api/objectives",
  "/api/providers",
  "/api/panel/vendors",
  "/api/messaging/telegram",
  "/api/runs",
  "/api/models",
  "/api/nyaya",
];

function isWorkspaceScoped(path: string): boolean {
  return WORKSPACE_SCOPED_ROOTS.some((root) => path === root || path.startsWith(`${root}/`) || path.startsWith(`${root}?`));
}

// Every product account gets exactly one workspace for now (see ensureDefaultWorkspace below); a future picker
// that lets a user choose or create among several — matching desktop's lib/product.js — only has to change
// this constant and the two functions around it, not every call site below.
export const DEFAULT_WORKSPACE = "default";

// Only a real signed-in web session gets a workspace named for it. A local or desktop caller has no session at
// all (identity disabled or optional, CurrentUserDep resolves to None) and root_for()'s refusal is worse for it
// than the one this whole change fixes: `workspace` present with `user is None` is "Sign in to open a
// workspace", not the admin-gets-engine-root path that local/desktop use has always relied on. So naming one
// must depend on there being a session, not merely on the path shape. `typeof window === "undefined"` guards
// the dynamic import the same way webSessionToken() above does, so this stays inert during SSR/static build.
export async function hasWebSession(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    const { currentSession } = await import("./auth");
    return currentSession() !== null;
  } catch {
    return false;
  }
}

// The single place the workspace slug is threaded onto a request, so every one of the ~15 call sites below
// stays a bare path. Appending it to a path the engine does not resolve by workspace is harmless (FastAPI
// ignores an unrecognised query parameter); the guard in workspace-scoped.spec.ts is what keeps the two sides
// honest as routes are added.
export async function withWorkspace(path: string): Promise<string> {
  if (!isWorkspaceScoped(path) || !(await hasWebSession())) return path;
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}workspace=${encodeURIComponent(DEFAULT_WORKSPACE)}`;
}

async function getJSON<T>(path: string, opts: { authOptional?: boolean; signal?: AbortSignal } = {}): Promise<T> {
  const res = await engineFetch(`${detectBase()}${await withWorkspace(path)}`, { cache: "no-store", authOptional: opts.authOptional, signal: opts.signal });
  if (!res.ok) throw new ApiError(res.status, path);
  return (await res.json()) as T;
}

// The engine refuses state-changing requests without its local token, so that no page a user happens to be
// visiting can start work on their GPU. The token is readable only by a same-origin caller, which this app is
// when the engine serves it. It is fetched once and kept in memory; it is never stored anywhere a script on
// another page could reach.
let cachedToken: string | null = null;
// The probe is answered "no token" (401, 403, 404) by every engine that is not a local desktop one. That answer does not change during a visit, so it is remembered: the next write does not
// ask again (and a visitor's console shows one failed probe, not one per write). A network failure, a 429 or a 5xx is NOT remembered (the engine may simply have been unreachable or busy a moment ago).
let noLocalToken = false;

/** Forget what the token probe answered (a test, or a change of engine): the next write asks again. */
export function forgetLocalToken(): void {
  cachedToken = null;
  noLocalToken = false;
}

export async function localToken(): Promise<string | null> {
  if (cachedToken !== null) return cachedToken;
  if (noLocalToken) return null;
  try {
    // authOptional (2026-09-24): this is a same-origin local-write-guard probe, not the user's session --
    // a hosted engine either doesn't serve this route at all or 401s it for every caller, signed in or not,
    // and that was never a valid signal that the REAL session is invalid. Before this flag, a 401 here
    // (silently and correctly treated as "no local token" two lines below) ALSO fired the global /signin
    // redirect as an unrelated side effect -- on every postJSON/putJSON/deleteJSON call and analyseFacts(),
    // for every visitor. Real incident: this is what actually bounced an anonymous /matters visit to
    // /signin mid-request, discovered live-debugging why the edition()/notifications() fixes alone weren't
    // enough.
    const res = await engineFetch(`${detectBase()}/api/app-token`, { cache: "no-store", authOptional: true });
    if (!res.ok) {
      // Only the answers that mean "this engine has no local write guard" are remembered; a 429 or a 5xx may pass (a desktop engine that served the token a moment ago), so it is asked again, like a network failure.
      if (res.status === 401 || res.status === 403 || res.status === 404) noLocalToken = true;
      return null;
    }
    cachedToken = ((await res.json()) as { token: string }).token;
    return cachedToken;
  } catch {
    return null;
  }
}

async function postJSON<T>(path: string, body: unknown): Promise<T> {
  const localTok = await localToken();
  const res = await engineFetch(`${detectBase()}${await withWorkspace(path)}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(localTok ? { "x-pravrudhi-token": localTok } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new ApiError(res.status, path);
  return (await res.json()) as T;
}

async function putJSON<T>(path: string, body: unknown): Promise<T> {
  const localTok = await localToken();
  const res = await engineFetch(`${detectBase()}${await withWorkspace(path)}`, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      ...(localTok ? { "x-pravrudhi-token": localTok } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new ApiError(res.status, path);
  return (await res.json()) as T;
}

async function deleteJSON<T>(path: string): Promise<T> {
  const localTok = await localToken();
  const res = await engineFetch(`${detectBase()}${await withWorkspace(path)}`, {
    method: "DELETE",
    headers: {
      ...(localTok ? { "x-pravrudhi-token": localTok } : {}),
    },
  });
  if (!res.ok) throw new ApiError(res.status, path);
  return (await res.json()) as T;
}

// Provisions this account's one workspace, once per session. ensure_workspace (application/workspaces.py) is
// itself idempotent — a second call only confirms the workspace still exists — so this collapses concurrent and
// repeat calls into the one real request rather than relying on the caller to remember not to call it twice.
// A failure here is never swallowed: it rejects, and the next call retries: the same underlying failure would
// also surface on the very next workspace-scoped page fetch as the ordinary "could not reach" state every page
// already renders on ApiError, so no separate error surface is needed.
let workspaceBootstrap: Promise<void> | null = null;

// A route the engine CLOSES to this account (403, or 401 with no session) is not a failure to retry: the account is a
// member of the law-firm product, which has no workspace to provision (Lead-2's #548 decision: /api/workspaces is
// operator-only). It resolves, once, and is not tried again this session, so navigating never repeats it and nothing
// throws. Any other failure still rejects and is retried on the next call, as before.
function isClosedToThisAccount(e: unknown): boolean {
  const status = (e as { status?: unknown } | null)?.status;
  return status === 403 || status === 401;
}

export function resetWorkspaceBootstrapForTests(): void {
  workspaceBootstrap = null;
}

export function ensureDefaultWorkspace(): Promise<void> {
  if (!workspaceBootstrap) {
    workspaceBootstrap = postJSON<{ slug: string; path: string }>("/api/workspaces", { slug: DEFAULT_WORKSPACE })
      .then(() => undefined)
      .catch((e) => {
        if (isClosedToThisAccount(e)) return undefined; // remembered: the promise stays resolved
        workspaceBootstrap = null;
        throw e;
      });
  }
  return workspaceBootstrap;
}

export interface HealthResponse {
  /** The assistant tier (#122): read through lib/assistantTier.ts, which fails closed when this is absent or malformed. */
  assistant_tier?: { state?: string; reason?: string | null };
  ok: boolean;
  version: string;
  kernel: string;
  ledger: boolean;
}

export interface BadgeCounts {
  grey: number;
  amber: number;
  green: number;
  red: number;
}

export interface NightSummary {
  spent_gpu_h: number | null;
  outcomes: unknown;
  incumbent: string | null;
}

export type StatusResponse =
  | { initialised: false }
  | {
      initialised: true;
      chain_ok: boolean;
      events: number;
      ledger_head: string | null;
      state_hash: string;
      candidates: number;
      badges: BadgeCounts;
      promoted: Record<string, string[]>;
      pruned: number;
      nights: Record<string, NightSummary>;
      inbox_pending: string[];
      locks: unknown;
    };

export interface Candidate {
  id: string;
  badge: "grey" | "amber" | "green" | "red";
  surface: string | null;
  bucket: Record<string, string> | null;
  proposed_seq: number;
  edit_family: string | null;
  xs: number[];
  n_obs: number;
  cost_gpu_h: number;
  last_boundary: string | null;
  promoted: boolean;
  pruned: string | null;
  audit_high: boolean;
  skipped: boolean;
  rebased: number;
  incumbent_hash: string | null;
}

export interface HostInfo {
  name: string;
  transport: string;
  address: string;
  user: string;
  workdir: string;
  orca_host_id: string;
}

export interface HostCapabilities {
  os: string;
  arch: string;
  cpu_count: number;
  ram_gb: number;
  gpu_name: string;
  gpu_vram_gb: number;
  accelerator: "cuda" | "metal" | "none" | string;
  accel_mem_gb: number;
  docker: boolean;
  python: string;
  agents: string[];
  local_models: string[];
  reachable: boolean;
  error: string;
  can_train: boolean;
  can_serve_open_models: boolean;
  usable_model_gb: number;
}

export interface HostRow {
  host: HostInfo;
  capabilities: HostCapabilities;
}

export interface HostsResponse {
  hosts: HostRow[];
}

export interface AgentStatus {
  name: string;
  available: boolean;
  reason: string;
}

export interface ExternalRow {
  seq: number;
  night: number;
  kind: string;
  severity: string;
  tier: string;
  track: string;
  condition: string;
  model: string;
  tool: string;
  tool_version?: string | null;
  dataset?: string;
  metrics: Record<string, Record<string, number>>;
  n_samples?: Record<string, number | null>;
  sha256: string;
  [extra: string]: unknown;
}

export interface RunRequest {
  target: "model" | "harness";
  model: string;
  bench: string;
  budget_gpu_h: number;
  proposer: string;
  policy: string;
}

export interface RunHandle {
  id: string;
  [extra: string]: unknown;
}

export async function health(): Promise<HealthResponse> {
  if (IS_DEMO) {
    const d = await (await import("./demo")).demo();
    return { ok: true, version: d.engine.version, kernel: d.engine.version, ledger: true };
  }
  // authOptional (2026-09-24): ConnectionBanner polls this every 5s on every page, for every visitor --
  // "is the engine reachable at all" is a connectivity probe, not something that should ever redirect an
  // anonymous visitor to /signin, same principle as edition()'s /api/me and notifications()'s poll.
  // #312 (Track-B storm attack): a /api/health that never answers must not hold a connection for ever (six fill the browser's pool and queue every other same-origin fetch): the request itself is aborted after HEALTH_TIMEOUT_MS.
  return getJSON<HealthResponse>("/api/health", { authOptional: true, signal: timeoutSignal(HEALTH_TIMEOUT_MS) });
}

export const HEALTH_TIMEOUT_MS = 8_000;

/** True for the error a request's own timeout (or any abort) produces: the read gave no answer, which is not a refusal. */
export const isAbortError = (e: unknown): boolean => typeof e === "object" && e !== null && ((e as { name?: string }).name === "TimeoutError" || (e as { name?: string }).name === "AbortError");

/** An AbortSignal that aborts after `ms` (AbortSignal.timeout where the browser has it, else a controller and a timer). */
export function timeoutSignal(ms: number): AbortSignal {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") return AbortSignal.timeout(ms);
  const c = new AbortController();
  setTimeout(() => c.abort(), ms);
  return c.signal;
}

export async function status(): Promise<StatusResponse> {
  if (IS_DEMO) return (await (await import("./demo")).demo()).status;
  return getJSON<StatusResponse>("/api/status");
}

export async function candidates(): Promise<Candidate[]> {
  if (IS_DEMO) return [];
  return getJSON<Candidate[]>("/api/candidates");
}

export async function nights(): Promise<NightSummary[]> {
  if (IS_DEMO) return (await (await import("./demo")).demo()).nights;
  return getJSON<NightSummary[]>("/api/nights");
}

export async function hosts(): Promise<HostsResponse> {
  if (IS_DEMO) return (await import("./demo")).demoHosts();
  return getJSON<HostsResponse>("/api/hosts");
}

export async function agents(): Promise<AgentStatus[]> {
  if (IS_DEMO) return (await import("./demo")).demoAgents();
  return getJSON<AgentStatus[]>("/api/agents");
}

// ---------------------------------------------------------------------------
// Bring-your-own provider keys. The engine stores a key (see `application.credentials`) but never returns
// it — a provider row says only whether a key is configured, never what it is.

export interface ProviderInfo {
  id: string;
  title: string;
  configured: boolean;
}

// The engine stores a key regardless of whether the probe below validated it (server.py's set_provider_key:
// "store.put runs unconditionally") -- `validated` says whether the provider's own models endpoint accepted
// it, `reason` is that probe's own explanation either way ("ok" on success, never empty). There is no `ok`
// field: a stale, never-matching client type here previously made every successful save render as a failure
// (`reason: "ok"` shown as the error message) because it checked a field the server never sent.
export interface ProviderKeySaveResult {
  provider: string;
  configured: true;
  validated: boolean;
  reason: string;
}

// Removal has no rejection path of its own -- store.delete is called unconditionally and a non-2xx response
// (the provider id itself is unknown, or the request fails outright) already throws via postJSON/deleteJSON's
// own ApiError, so a resolved result here is always success.
export interface ProviderKeyRemovedResult {
  provider: string;
  configured: false;
}

export async function providers(): Promise<ProviderInfo[]> {
  if (IS_DEMO) return [];
  return getJSON<ProviderInfo[]>("/api/providers");
}

export async function putProviderKey(id: string, key: string): Promise<ProviderKeySaveResult> {
  if (IS_DEMO) throw new ApiError(501, `/api/providers/${id}/key`);
  return postJSON<ProviderKeySaveResult>(`/api/providers/${encodeURIComponent(id)}/key`, { key });
}

export async function deleteProviderKey(id: string): Promise<ProviderKeyRemovedResult> {
  if (IS_DEMO) throw new ApiError(501, `/api/providers/${id}/key`);
  return deleteJSON<ProviderKeyRemovedResult>(`/api/providers/${encodeURIComponent(id)}/key`);
}

// A workspace's own Telegram bot. The engine's credential belongs to the operator and a workspace cannot reach
// it (application/messaging.py::resolve_telegram), so bringing your own is the only way notifications reach a
// phone. `configured` is all the server will say about the token — it is never readable back.
export interface MessagingStatus {
  configured: boolean;
  enabled: boolean;
  chat_id: string;
  /** True on the operator's own engine, whose bot comes from its service environment rather than settings. */
  from_environment?: boolean;
}

export async function messagingStatus(): Promise<MessagingStatus> {
  // The recording has no engine behind it, so asking one for messaging settings reaches a local address that
  // is not there and logs a CORS error on the settings page. The write paths were guarded and this read was
  // not; the deployed suite caught it in Firefox and WebKit, on the published site, where a console error is
  // exactly what a visitor's browser would show.
  if (IS_DEMO) return { configured: false, enabled: false, chat_id: "", from_environment: false };
  return getJSON<MessagingStatus>("/api/messaging/telegram");
}

// Fields left out are left alone, so the on/off switch does not require re-posting the token.
export async function putMessaging(body: {
  token?: string;
  chat_id?: string;
  enabled?: boolean;
}): Promise<MessagingStatus> {
  if (IS_DEMO) throw new ApiError(501, "/api/messaging/telegram");
  return putJSON<MessagingStatus>("/api/messaging/telegram", body);
}

export async function clearMessaging(): Promise<MessagingStatus> {
  if (IS_DEMO) throw new ApiError(501, "/api/messaging/telegram");
  return deleteJSON<MessagingStatus>("/api/messaging/telegram");
}

// Whether this checkout is behind the newest tagged release (see `application.updates`), and the exact
// command that would catch it up. Its own endpoint: the check reaches GitHub, and /api/status is polled.
export interface UpdateStatus {
  current: { version: string; kernel_version: string; git_describe?: string };
  latest: { tag: string; url: string } | null;
  update_available: boolean;
  /** Whether the check reached GitHub. False means unknown, not up to date. */
  checked?: boolean;
  how: string;
}

export async function updateStatus(): Promise<UpdateStatus> {
  if (IS_DEMO) {
    const d = await (await import("./demo")).demo();
    return {
      current: { version: d.engine.version, kernel_version: d.engine.version },
      latest: null,
      update_available: false,
      how: "",
    };
  }
  return getJSON<UpdateStatus>("/api/update");
}

// The operator's saved update policy, and applying or rolling back an update. Distinct from `updateStatus`
// above: that check only reaches GitHub to compare versions, these actually touch the checkout.

export interface UpdateConfig {
  channel: "dev" | "release";
  auto_apply: boolean;
  check_interval_min: number;
  keep_previous: number;
}

export interface ApplyResult {
  applied: boolean;
  version: string | null;
  reason: string;
  rolled_back: boolean;
}

export async function updateConfig(): Promise<UpdateConfig> {
  if (IS_DEMO) throw new ApiError(501, "/api/update/config");
  return getJSON<UpdateConfig>("/api/update/config");
}

export async function putUpdateConfig(config: UpdateConfig): Promise<UpdateConfig> {
  if (IS_DEMO) throw new ApiError(501, "/api/update/config");
  return putJSON<UpdateConfig>("/api/update/config", config);
}

export async function applyUpdate(channel?: "dev" | "release"): Promise<ApplyResult> {
  if (IS_DEMO) throw new ApiError(501, "/api/update/apply");
  return postJSON<ApplyResult>("/api/update/apply", { channel: channel ?? null });
}

export async function rollbackUpdate(): Promise<ApplyResult> {
  if (IS_DEMO) throw new ApiError(501, "/api/update/rollback");
  return postJSON<ApplyResult>("/api/update/rollback", {});
}

export async function external(): Promise<ExternalRow[]> {
  if (IS_DEMO) return (await (await import("./demo")).demo()).external;
  return getJSON<ExternalRow[]>("/api/external");
}

export async function startRun(req: RunRequest): Promise<RunHandle> {
  if (IS_DEMO) throw new ApiError(501, "/api/runs");
  return postJSON<RunHandle>("/api/runs", req);
}

export async function stopRun(runId: string): Promise<RunHandle> {
  return postJSON<RunHandle>(`/api/runs/${encodeURIComponent(runId)}/stop`, {});
}

// Everything a page needs to show a run as it happens, or what the loop produced. Added centrally so that pages
// built in parallel never contend for this file.

export interface RunEvent {
  // "proposed_one" and "pruned" appear in a recorded run, which is replayed from the engine's own record
  // rather than from the live log, so it carries per-candidate detail the live stream summarises.
  type: "paired" | "promoted" | "proposed" | "proposed_one" | "pruned" | "round" | "closed" | "log" | "end";
  t?: number;
  candidate?: string;
  seed?: number;
  incumbent?: number;
  candidate_score?: number;
  delta?: number;
  decision?: string;
  n?: number;
  raw?: number;
  accepted?: number;
  round?: number;
  selected?: number;
  remaining_gpu_h?: number;
  night?: number;
  status?: string;
  exit_code?: number;
  text?: string;
  strategy?: string | null;
  family?: string | null;
}

export interface RunDetail extends RunHandle {
  recent: RunEvent[];
}

export interface PromotedModel {
  id: string;
  track: "model" | "harness";
  night: number;
  recipe: Record<string, unknown>;
  artefact: string | null;
  external_before: Record<string, Record<string, number>> | null;
  external_after: Record<string, Record<string, number>> | null;
}

export async function runs(): Promise<RunHandle[]> {
  if (IS_DEMO) return (await (await import("./demo")).demo()).runs;
  return getJSON<RunHandle[]>("/api/runs");
}

export async function run(runId: string): Promise<RunDetail> {
  return getJSON<RunDetail>(`/api/runs/${encodeURIComponent(runId)}`);
}

export async function models(): Promise<PromotedModel[]> {
  if (IS_DEMO) return (await (await import("./demo")).demo()).models;
  return getJSON<PromotedModel[]>("/api/models");
}

/**
 * Subscribe to a run's live events. Returns a function that closes the stream.
 * The engine sends server-sent events; a closed or failed stream is reported through onError rather than thrown,
 * because a page showing a long run must survive a dropped connection.
 */
export function streamRun(
  runId: string,
  onEvent: (event: RunEvent) => void,
  onError?: (error: Event) => void,
): () => void {
  // withWorkspace is async (it checks for a real session before naming one), so the source cannot open
  // synchronously; a caller that closes before it opens must still be honoured, hence `closed`.
  let source: EventSource | null = null;
  let closed = false;
  void withWorkspace(`/api/runs/${encodeURIComponent(runId)}/events`).then((path) => {
    if (closed) return;
    source = new EventSource(`${detectBase()}${path}`);
    source.onmessage = (message) => {
      try {
        onEvent(JSON.parse(message.data) as RunEvent);
      } catch {
        /* a malformed frame is skipped rather than killing the stream */
      }
    };
    source.onerror = (error) => {
      onError?.(error);
      source?.close();
    };
  });
  return () => {
    closed = true;
    source?.close();
  };
}

// ---------------------------------------------------------------------------
// Objectives: what the user is trying to achieve, and whether it is happening.

export interface Measurement {
  value: number;
  stderr: number;
  n: number;
  model: string;
  night: number;
  seq: number;
  sha256: string;
}

export type ProgressState = "unmeasured" | "baseline_only" | "measured";

export interface BenchmarkProgress {
  benchmark: string;
  state: ProgressState;
  reason: string;
  baseline: Measurement | null;
  latest: Measurement | null;
  delta: number | null;
  delta_lo: number | null;
  delta_hi: number | null;
  target_delta: number | null;
  met: boolean | null;
  significant: boolean;
}

export interface BenchmarkSpec {
  id: string;
  tool: string;
  metric: string;
  direction: string;
}

export interface Objective {
  id: string;
  intent: string;
  track: string;
  domain: string;
  benchmarks: BenchmarkSpec[];
  recipes: string[];
  target_delta: number | null;
  created: string;
  notes: string;
  progress: BenchmarkProgress[];
}

export interface Recipe {
  id: string;
  capability: string;
  title: string;
  skill: string;
  summary: string;
  source: string;
  available: boolean;
}

export interface ObjectiveDetail extends Objective {
  recipe_detail: { available: Recipe[]; absent: Recipe[]; unknown: string[] };
}

export interface ObjectivesResponse {
  objectives: Objective[];
  problems: { file: string; reason: string }[];
}

export async function objectives(): Promise<ObjectivesResponse> {
  if (IS_DEMO) return (await (await import("./demo")).demo()).objectives ?? { objectives: [], problems: [] };
  return getJSON<ObjectivesResponse>("/api/objectives");
}

export async function objective(id: string): Promise<ObjectiveDetail> {
  if (IS_DEMO) {
    const d = await (await import("./demo")).demo();
    const found = (d.objectives?.objectives ?? []).find((o) => o.id === id);
    if (!found) throw new ApiError(404, `/api/objectives/${id}`);
    return { ...found, recipe_detail: { available: [], absent: [], unknown: found.recipes } };
  }
  return getJSON<ObjectiveDetail>(`/api/objectives/${encodeURIComponent(id)}`);
}

export async function recipeLibrary(): Promise<Recipe[]> {
  if (IS_DEMO) return (await (await import("./demo")).demo()).recipes ?? [];
  return (await getJSON<{ recipes: Recipe[] }>("/api/recipes")).recipes;
}

export interface ObjectiveInput {
  id: string;
  intent: string;
  track: string;
  domain: string;
  benchmarks: { id: string; tool: string; metric: string; direction: string }[];
  recipes: string[];
  target_delta: number | null;
  notes: string;
}

export async function postObjective(body: ObjectiveInput): Promise<Objective> {
  if (IS_DEMO) throw new ApiError(501, "/api/objectives");
  return postJSON<Objective>("/api/objectives", body);
}

// The compiled plan: an intent turned into ordered work. A proposal, never evidence.

export interface PlanStep {
  id: string;
  capability: string;
  recipe_ids: string[];
  available_recipe_ids: string[];
  availability: "available" | "uninstalled" | "no_recipe";
  consumes: string[];
  produces: string[];
  check: { criterion: string; benchmarks: BenchmarkSpec[]; target_delta: number | null };
  quantities: { name: string; value: number | null }[];
  reason: string;
}

export interface Plan {
  objective: string;
  steps: PlanStep[];
  external_inputs?: string[];
  unknown_recipes?: string[];
  assumptions?: string[];
  review_notes?: string[];
}

export async function objectivePlan(id: string): Promise<Plan> {
  if (IS_DEMO) {
    const d = await (await import("./demo")).demo();
    const found = (d.plans ?? {})[id];
    if (!found) throw new ApiError(404, `/api/objectives/${id}/plan`);
    return found;
  }
  return getJSON<Plan>(`/api/objectives/${encodeURIComponent(id)}/plan`);
}

// The plan compiled to Loom source: what the engine would actually run, not just the step outline above.

export interface LoomStep {
  id: string;
  text: string;
}

export interface LoomResponse {
  objective: string;
  source: string;
  steps: LoomStep[];
}

export async function objectiveLoom(id: string): Promise<LoomResponse> {
  if (IS_DEMO) {
    const d = await (await import("./demo")).demo();
    return (d.loom ?? {})[id] ?? { objective: id, source: "", steps: [] };
  }
  return getJSON<LoomResponse>(`/api/objectives/${encodeURIComponent(id)}/loom`);
}

// Subagent routing: which step would go to which agent/model at what tier, and inside what worktree path,
// plus whatever runs have actually been dispatched so far.

export interface SubagentPreviewRow {
  step: string;
  tier: string;
  agent: string;
  allowed_path: string;
}

export interface SubagentRunRow {
  step: string;
  route: string;
  accepted: boolean;
  wall: number;
}

export interface SubagentsResponse {
  preview: SubagentPreviewRow[];
  runs: SubagentRunRow[];
}

export async function objectiveSubagents(id: string): Promise<SubagentsResponse> {
  if (IS_DEMO) {
    const d = await (await import("./demo")).demo();
    return (d.subagents ?? {})[id] ?? { preview: [], runs: [] };
  }
  return getJSON<SubagentsResponse>(`/api/objectives/${encodeURIComponent(id)}/subagents`);
}

export async function dispatchSubagents(id: string): Promise<SubagentsResponse> {
  if (IS_DEMO) throw new ApiError(501, `/api/objectives/${id}/subagents/dispatch`);
  return postJSON<SubagentsResponse>(`/api/objectives/${encodeURIComponent(id)}/subagents/dispatch`, {});
}

// ---------------------------------------------------------------------------
// Chat: the assistant may state a number only if a tool call in this turn returned it. Anything the model's
// draft states that no tool backed is stripped before this response is built, and listed in `refusals` instead.

export interface ChatCitation {
  seq: number;
  what: string;
}

export interface ChatToolCall {
  tool: string;
  args: Record<string, unknown>;
  result_summary: string;
}

export interface ChatResponse {
  thread_id: string;
  reply: string;
  citations: ChatCitation[];
  tool_calls: ChatToolCall[];
  refusals: string[];
}

export async function chat(message: string, threadId: string | null): Promise<ChatResponse> {
  if (IS_DEMO) throw new ApiError(501, "/api/chat");
  return postJSON<ChatResponse>("/api/chat", { message, thread_id: threadId });
}

/**
 * Stream a chat response as server-sent events.
 * Yields events as they arrive from the server: tool calls, tokens, citations, and finally a done event.
 */
export async function* chatStream(
  message: string,
  threadId: string | null,
): AsyncGenerator<Record<string, unknown>, void, unknown> {
  if (IS_DEMO) throw new ApiError(501, "/api/chat/stream");

  const localTok = await localToken();
  const res = await engineFetch(`${detectBase()}/api/chat/stream`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(localTok ? { "x-pravrudhi-token": localTok } : {}),
    },
    body: JSON.stringify({ message, thread_id: threadId }),
  });

  if (!res.ok) throw new ApiError(res.status, "/api/chat/stream");

  const reader = res.body?.getReader();
  if (!reader) throw new Error("Response has no readable body");

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n\n");

      // Keep the last incomplete line in the buffer
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;
        if (!line.startsWith("data: ")) continue;

        try {
          const jsonStr = line.slice("data: ".length).trim();
          const event = JSON.parse(jsonStr) as Record<string, unknown>;
          yield event;
        } catch {
          // Malformed JSON in SSE frame; skip it
        }
      }
    }

    // Process any remaining data
    if (buffer.trim()) {
      if (buffer.startsWith("data: ")) {
        try {
          const jsonStr = buffer.slice("data: ".length).trim();
          const event = JSON.parse(jsonStr) as Record<string, unknown>;
          yield event;
        } catch {
          // Ignore
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export interface ChatThreadSummary {
  id: string;
  updated: string;
  turns: number;
}

export async function chatThreads(): Promise<ChatThreadSummary[]> {
  if (IS_DEMO) return [];
  return (await getJSON<{ threads: ChatThreadSummary[] }>("/api/chat/threads")).threads;
}

// Present on a stored turn once the engine started recording it alongside the reply; absent on turns written
// before that, so a stored turn must render correctly with or without it.
export interface ChatTurnMeta {
  citations: ChatCitation[];
  refusals: string[];
  tool_calls: ChatToolCall[];
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
  created: string;
  meta?: ChatTurnMeta;
}

export async function chatThread(id: string): Promise<ChatTurn[]> {
  if (IS_DEMO) throw new ApiError(501, `/api/chat/threads/${id}`);
  return (await getJSON<{ id: string; turns: ChatTurn[] }>(`/api/chat/threads/${encodeURIComponent(id)}`)).turns;
}

// prabhasa-nyaya: a question of Indian law, answered from sources by the vendors the user picks, every
// citation checked against the corpus. A verdict is a check of the answer against the sources it was shown,
// never a statement about the law, and nothing here is ledger evidence (provenance `agama`).
export interface NyayaVendor {
  id: string;
  model: string;
  interface: string;
  available: boolean;
  why: string | null;
  note: string;
}

export interface NyayaCitation {
  id: string;
  status: "licensed" | "unshown" | "invented";
}

export interface NyayaAudit {
  checker: string;
  verdict: string;
  span?: string | null;
  class?: string | null;
  why?: string | null;
  /** checker="lean" only (Track A P1b, ADR-0003): the claims the checked contract does not license. */
  unlicensed_claims?: string[] | null;
  /** checker="lean" only: how many `notFormalisable` entries the checked contract itself declares. */
  not_formalisable_count?: number | null;
}

export interface NyayaAnswer {
  vendor: string;
  model: string;
  text: string;
  wall_s: number;
  citations: NyayaCitation[];
  verdict: "licensed" | "unlicensed" | "invented_citation" | "abstained" | "error";
  confidence: string;
  error?: string | null;
  audit?: NyayaAudit | null;
}

export interface NyayaSource {
  id: string;
  act: string;
  section: string;
  title: string;
  /** Engine 0.6.22 (#539): R1's IPC text caveat for an IPC id, null for any other act; absent on an older engine. Shown only when it is exactly R1's line (lib/ipcCaveat.ts). */
  text_caveat?: string | null;
}

export interface NyayaAsk {
  id: string;
  asked_at: string;
  question: string;
  sources: NyayaSource[];
  answers: NyayaAnswer[];
  provenance: string;
  note: string;
}

export interface NyayaCorpusHit extends NyayaSource {
  score: number;
  text: string;
  /** The page the corpus recorded for this act on India Code, or null; absent on an engine that predates it (pravrudhi #313). */
  source_url?: string | null;
  /** Always the India Code home page on an engine that sends it; a fallback, never a deep link. */
  source_fallback_url?: string;
}

export async function nyayaVendors(): Promise<NyayaVendor[]> {
  if (IS_DEMO) return [];
  return (await getJSON<{ vendors: NyayaVendor[] }>("/api/nyaya/vendors")).vendors;
}

export async function nyayaCorpus(q: string): Promise<{ documents: number; sources: Record<string, unknown>[]; hits: NyayaCorpusHit[] }> {
  return getJSON(`/api/nyaya/corpus?q=${encodeURIComponent(q)}`);
}

export async function nyayaAsk(
  question: string, vendors: string[], checker: string | null, contractId?: string | null,
): Promise<NyayaAsk> {
  if (IS_DEMO) throw new ApiError(501, "/api/nyaya/ask");
  return postJSON<NyayaAsk>("/api/nyaya/ask", { question, vendors, checker, contract_id: contractId ?? null });
}

export async function nyayaAudit(
  sources: string, answer: string, checker: string, contractId?: string | null,
): Promise<NyayaAudit & { raw?: string }> {
  if (IS_DEMO) throw new ApiError(501, "/api/nyaya/audit");
  return postJSON("/api/nyaya/audit", { sources, answer, checker, contract_id: contractId ?? null });
}

export async function nyayaAsks(): Promise<NyayaAsk[]> {
  if (IS_DEMO) return [];
  return (await getJSON<{ asks: NyayaAsk[] }>("/api/nyaya/asks")).asks;
}

// The fourteen BNS/IPC registry contracts (Track A T5b, `nyaya_lean_registry.py`), a DIFFERENT family
// from the citation-shaped Lean checker above (`NyayaAudit`'s `contract_id`): these score an explicit
// per-element Met/Not-Met judgment the caller supplies, never free text this surface derives itself --
// see `nyaya_lean_registry.check_registry`'s own docstring for why. Manual (person-supplied
// assertions) today; the element-first harness is meant to supply the same shape once it exists --
// nothing here claims that yet.

export interface NyayaRegistryCheckResult {
  checker: string;
  contract_id: string;
  verdict: string;
  denied_claims: string[];
  unlicensed_claims: string[];
  omitted_claims: string[];
  elements: Record<string, boolean>;
  evidence: Record<string, string>;
  provenance: string;
}

export async function nyayaRegistryEntries(): Promise<{ id: string; validated: boolean; sources?: string[] | null }[]> {
  if (IS_DEMO) return [];
  const r = await getJSON<{ entries?: { id: string; validated: boolean; sources?: string[] | null }[] }>("/api/nyaya/registry/contracts", {
    authOptional: true,
  });
  return Array.isArray(r.entries) ? r.entries : [];
}

export async function nyayaRegistryContracts(): Promise<string[]> {
  if (IS_DEMO) return [];
  // Part of the demo-anon surface (PRAVRUDHI_DEMO_ANON_PATHS) -- a 401 here from a genuinely anonymous
  // visitor must not redirect to /signin; it's reported to the caller like any other failure.
  return (await getJSON<{ contracts: string[] }>("/api/nyaya/registry/contracts", { authOptional: true })).contracts;
}

export async function nyayaRegistryElements(contractId: string): Promise<string[]> {
  if (IS_DEMO) return [];
  return (
    await getJSON<{ contract_id: string; elements: string[] }>(
      `/api/nyaya/registry/${encodeURIComponent(contractId)}/elements`,
    )
  ).elements;
}

export async function nyayaRegistryCheck(
  contractId: string,
  assertions: Record<string, boolean>,
  evidence?: Record<string, string>,
): Promise<NyayaRegistryCheckResult> {
  if (IS_DEMO) throw new ApiError(501, "/api/nyaya/registry/check");
  return postJSON("/api/nyaya/registry/check", {
    contract_id: contractId,
    assertions,
    evidence: evidence && Object.keys(evidence).length > 0 ? evidence : null,
  });
}

// L4 partner API (docs/decisions/LEG-PLAN-2026-09-23.md, pravrudhi api/partner.py): the agentic loop over
// the same registry contracts, facts in. A DIFFERENT surface from nyayaRegistryCheck above -- the agent
// judges each element itself (a house judge, quote-checked against the fact it names) rather than taking
// a person's Met/Not-Met assertions directly.

export interface AnalyseFactsElement {
  element: string;
  is_denial: boolean;
  // Five values since AxisMeru/pravrudhi#37 (the fifth decided by the operator 2026-09-26): "established" |
  // "not_confirmed" | "not_established" | "not_evaluated_second_unavailable" |
  // "not_evaluated_gate1_unavailable". Left as `string` because the engine is a separate release train and
  // may send a value this build predates -- lib/elementStatus.ts turns it into a presentation and fails closed
  // on anything it does not recognise, rather than reading an unknown status as a negative finding.
  status: string;
  // Which judge's tau the element failed, on a non-established element (#37, second comment). Optional: an
  // engine release before #45 omits the field entirely, and the engine sends null where no leg binds (e.g. a
  // single-judge run).
  //
  // "both" was dropped with operator approval (AxisMeru/pravrudhi#57): the engine cannot reach a state where
  // both legs bind, so the value was unreachable. Nothing in this repository reads the field -- this
  // declaration is its only occurrence -- so narrowing the union is inert here.
  binding_leg?: "primary" | "second" | null;
  claimed: boolean;
  p_established: number | null;
  // The second judge's p (config C); null when no second judge ran. Additive and optional on older engines.
  p_established_second?: number | null;
  // The per-element screening signal (4B p, supported if >= its threshold); optional, absent until the engine sends it.
  screening_signal?: { p: number; supported: boolean } | null;
  fact_id: string | null;
  quote: string | null;
  start: number | null;
  end: number | null;
  quote_check: string | null;
  attempts: number;
  occurrences: number;
  offsets_source: string | null;
  // Who supplied the quote (e.g. "model") -- shown per element so the element table can name the exact
  // fact behind each claim, not just the final verdict (LEG-PLAN P3/L4 requirement).
  quote_source: string | null;
  // The engine's own sentence for how the element cites its support (additive; absent on an older engine).
  citation_note?: string | null;
  error: string | null;
}

export interface AnalyseFactsContract {
  contract_id: string;
  outcome: string; // "PROOF" | "DENIAL" | "ABSTAIN" | "REFER_TO_LAWYER"
  reason: string;
  elements: AnalyseFactsElement[];
  assertions: Record<string, boolean> | null;
  lean: { verdict: string; denied_claims: string[]; unlicensed_claims: string[]; omitted_claims: string[] } | null;
  lean_outcome: string | null;
  // Which pinned checker binary scored which exact input (engine: partner `lean_attestation`); null when no Lean call ran,
  // absent from an older engine. Attests WHAT was scored and by WHICH binary, not that the facts are true.
  lean_attestation?: { binary_sha256: string; wire_sha256: string; verdict: string } | null;
  uncertain: string[];
  statute_text_mismatch: boolean | null;
  // The provision text, for reference (engine: pravrudhi#308; absent from an older engine). `rule_text` is the provision
  // text from the contract's own source; `judge_rule_text` is present only when the judge was shown a different or
  // shorter version (statute_text_mismatch, or its text was cut); `rule_text_source` names where `rule_text` came from.
  rule_text?: string | null;
  judge_rule_text?: string | null;
  rule_text_source?: string | null;
  // The provisions this contract is about (the engine derives them from the contract's own sources; no text here).
  citations?: AnalyseFactsCitation[] | null;
}

export interface AnalyseFactsCitation {
  act: string;
  section: string | null;
  corpus_id: string | null;
  in_corpus: boolean;
  title: string | null;
}

export interface AnalyseFactsStandardOut {
  requested: string;
  applied: string | null;
  source: string;
  proceeding_posture?: string | null;
  in_judge_prompt: boolean;
}

/** What the engine sends: the facts echo carries each fact's id and sha256 only, never its text (pravrudhi nyaya_agent.py AgentRun.facts). */
export interface AnalyseFactsWire extends Omit<AnalyseFactsResult, "facts"> {
  facts: { id: string; sha256: string }[];
}

/**
 * The display rule for the screening result (AxisMeru/pravrudhi-app#113, Lead-2, 13 Oct): the result is rendered ONLY from the decide tool result, never from free text an
 * agent wrote around it. This is the one boundary, and it picks DEEP: the answer is rebuilt field by field from the lists below at every level (top level, each contract,
 * each element, each fact, the standard, citations, Lean and attestation objects). Any other field, at any depth, is dropped here and cannot reach a page, the memo or the
 * run record. The lists are the engine schema's own field names (src/lib/decideResult.spec.ts fails if the pinned schema gains one that is not decided on). The app states
 * retention itself and reads neither the engine's retention notice nor its set-version fields, so those are not listed.
 */
export const DECIDE_TOP_KEYS = ["run_id", "judge", "score_sha256", "facts", "contracts", "provenance", "standard"] as const;
export const DECIDE_CONTRACT_KEYS = ["assertions", "citations", "contract_id", "elements", "judge_rule_text", "lean", "lean_attestation", "lean_outcome", "outcome", "reason", "rule_text", "rule_text_source", "statute_text_mismatch", "uncertain"] as const;
export const DECIDE_ELEMENT_KEYS = ["attempts", "binding_leg", "citation_note", "claimed", "defeater_second_disagreement", "element", "end", "error", "fact_id", "fact_id_disagreement", "is_denial", "occurrences", "offsets_source", "p_established", "p_established_second", "quote", "quote_check", "quote_source", "screening_signal", "second_fact_id", "second_logit_distance", "second_refer_band_fired", "second_skip_reason", "second_unavailable", "start", "status", "tau_second"] as const;
export const DECIDE_FACT_KEYS = ["id", "text", "sha256"] as const;
export const DECIDE_STANDARD_KEYS = ["applied", "in_judge_prompt", "proceeding_posture", "requested", "source"] as const;
export const DECIDE_CITATION_KEYS = ["act", "corpus_id", "in_corpus", "section", "title"] as const;
export const DECIDE_LEAN_KEYS = ["verdict", "denied_claims", "unlicensed_claims", "omitted_claims"] as const;
export const DECIDE_ATTESTATION_KEYS = ["binary_sha256", "wire_sha256", "verdict"] as const;
export const DECIDE_SIGNAL_KEYS = ["p", "supported"] as const;

/** Thrown when the engine's answer has a listed field of the wrong type, or an assertions key that is not one of the contract's own element or denial names: the whole answer is unreadable and nothing from it is shown. */
export class InvalidEngineAnswerError extends Error {
  readonly runId: string | null;
  constructor(runId: string | null) {
    super("invalid engine answer");
    this.name = "InvalidEngineAnswerError";
    this.runId = runId;
  }
}
/** #1038: a start the engine began but could not finish (or that could not be followed). Carries R1's line; nothing was scored. */
export class WakeStoppedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WakeStoppedError";
  }
}
/** The run-record download for an unreadable answer: a machine marker and the run id, nothing else. */
export const invalidAnswerRecord = (runId: string | null): string => JSON.stringify({ invalid_engine_answer: true, run_id: runId }, null, 2);

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isScalar = (v: unknown): boolean => v === null || typeof v === "string" || typeof v === "number" || typeof v === "boolean";
type Shape = { keys: readonly string[]; lists?: Record<string, "objects" | "strings">; objects?: Record<string, Shape | "booleans">; };
const FACT: Shape = { keys: DECIDE_FACT_KEYS };
const CITATION: Shape = { keys: DECIDE_CITATION_KEYS };
const SIGNAL: Shape = { keys: DECIDE_SIGNAL_KEYS };
const ELEMENT: Shape = { keys: DECIDE_ELEMENT_KEYS, objects: { screening_signal: SIGNAL } };
const LEAN: Shape = { keys: DECIDE_LEAN_KEYS, lists: { denied_claims: "strings", unlicensed_claims: "strings", omitted_claims: "strings" } };
const ATTESTATION: Shape = { keys: DECIDE_ATTESTATION_KEYS };
const STANDARD: Shape = { keys: DECIDE_STANDARD_KEYS };

/**
 * Check one object against its shape and return a copy holding only the listed fields. Any listed field of the wrong type throws: a scalar field must be a string, number, boolean
 * or null; a list field must be a list (null allowed where the schema allows it) of objects or strings as named; an object field must be an object or null.
 */
function shaped(v: unknown, shape: Shape, runId: () => string | null, lists: Record<string, Shape | "strings"> = {}, nullable: readonly string[] = []): Record<string, unknown> {
  const bad = (): never => { throw new InvalidEngineAnswerError(runId()); };
  if (!isObj(v)) return bad();
  const out: Record<string, unknown> = {};
  for (const k of shape.keys) {
    const x = v[k];
    if (x === undefined) continue;
    if (shape.objects && k in shape.objects) {
      if (x === null) out[k] = null;
      else if (shape.objects[k] === "booleans") out[k] = x;
      else out[k] = shaped(x, shape.objects[k] as Shape, runId);
    } else if (k in lists) {
      if (x === null && nullable.includes(k)) { out[k] = null; continue; }
      if (!Array.isArray(x)) return bad();
      const kind = lists[k];
      out[k] = x.map((item) => (kind === "strings" ? (typeof item === "string" ? item : bad()) : shaped(item, kind, runId)));
    } else if (shape.lists && k in shape.lists) {
      if (x === null || !Array.isArray(x) || !x.every((i) => typeof i === "string")) return bad();
      out[k] = x;
    } else {
      if (!isScalar(x)) return bad();
      out[k] = x;
    }
  }
  return out;
}

export function decideResultOnly(wire: AnalyseFactsWire): AnalyseFactsWire {
  const runId = (): string | null => (isObj(wire) && typeof (wire as unknown as Record<string, unknown>).run_id === "string" ? ((wire as unknown as Record<string, unknown>).run_id as string) : null);
  const bad = (): never => { throw new InvalidEngineAnswerError(runId()); };
  const top = shaped(wire, { keys: DECIDE_TOP_KEYS.filter((k) => k !== "facts" && k !== "contracts" && k !== "standard") }, runId);
  const w = wire as unknown as Record<string, unknown>;
  if (w.facts !== undefined) top.facts = (Array.isArray(w.facts) ? w.facts : bad()).map((f) => shaped(f, FACT, runId));
  if (w.standard !== undefined) top.standard = w.standard === null ? null : shaped(w.standard, STANDARD, runId);
  if (w.contracts !== undefined) {
    top.contracts = (Array.isArray(w.contracts) ? w.contracts : bad()).map((c) => {
      const out = shaped(c, { keys: DECIDE_CONTRACT_KEYS.filter((k) => !["assertions", "citations", "elements", "lean", "lean_attestation", "uncertain"].includes(k)) }, runId);
      const cc = c as Record<string, unknown>;
      if (cc.elements !== undefined) out.elements = (Array.isArray(cc.elements) ? cc.elements : bad()).map((e) => shaped(e, ELEMENT, runId));
      if (cc.citations !== undefined) out.citations = cc.citations === null ? null : (Array.isArray(cc.citations) ? cc.citations : bad()).map((x) => shaped(x, CITATION, runId));
      if (cc.lean !== undefined) out.lean = cc.lean === null ? null : shaped(cc.lean, LEAN, runId);
      if (cc.lean_attestation !== undefined) out.lean_attestation = cc.lean_attestation === null ? null : shaped(cc.lean_attestation, ATTESTATION, runId);
      if (cc.uncertain !== undefined) out.uncertain = (Array.isArray(cc.uncertain) ? cc.uncertain : bad()).map((x) => (typeof x === "string" ? x : bad()));
      if (cc.assertions !== undefined) {
        if (cc.assertions === null) out.assertions = null;
        else {
          if (!isObj(cc.assertions)) return bad();
          // The engine keys the assertions by the contract's own element and denial names (nyaya_agent.assemble_assertions).
          const id = typeof out.contract_id === "string" ? out.contract_id : "";
          const known = (contractElements.contracts as Record<string, { elements: string[]; denials: string[] }>)[id] ?? null;
          const own = Array.isArray(out.elements) ? (out.elements as Array<Record<string, unknown>>).map((e) => e.element) : [];
          const names = new Set<unknown>([...(known ? [...known.elements, ...known.denials] : []), ...own]);
          const a: Record<string, boolean> = {};
          for (const [key, val] of Object.entries(cc.assertions)) {
            if (typeof val !== "boolean" || !names.has(key)) return bad();
            a[key] = val;
          }
          out.assertions = a;
        }
      }
      return out;
    });
  }
  return top as unknown as AnalyseFactsWire;
}

/** What the app works with: the wire answer with each echoed fact's text filled in from the facts this app SUBMITTED. */
export interface AnalyseFactsResult {
  /** #1038 (R2): set only on a run that came through a wake, when the engine's raw answer says the second judge did not run (at the top or on a contract). The page then shows the partial-load warning whatever the wake block said. */
  second_judge_did_not_run?: true;
  /** Present only on an assisted run (#125): the app's kept part of the engine's assistant block. */
  assistant?: AssistantBlock;
  /** Present only on a finished assisted run whose answer carried a readable appendix (#169): the memo prints its steps. */
  appendix?: ScreeningAppendix;
  run_id: string;
  judge: string;
  score_sha256: string;
  facts: { id: string; text: string; sha256: string }[];
  contracts: AnalyseFactsContract[];
  provenance: string;
  // The standard of proof asked for and whether the judge was told it (engine #220); absent from an older engine.
  standard?: AnalyseFactsStandardOut | null;
}

// 320s: a generous margin above RunPod LB's own ~300s execution ceiling and the ~2.5 minute worst-case cold
// start (operator decision 2026-09-24, no warm workers while we build: ~24s engine start + ~200s judge cold
// start). A shorter client-side timeout would cut a real, still-in-progress cold start off before the
// backend could ever have answered -- this exists so that never happens, not to bound wall-clock time.
export const ANALYSE_FACTS_TIMEOUT_MS = 320_000;

async function analyseFactsAttempt(path: string, body: string, signal?: AbortSignal, anonymous = false, extraHeaders: Record<string, string> = {}): Promise<Response> {
  const localTok = await localToken();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException("timed out", "TimeoutError")), ANALYSE_FACTS_TIMEOUT_MS);
  const onAbort = () => controller.abort(signal?.reason ?? new DOMException("cancelled", "AbortError"));
  if (signal?.aborted) onAbort();
  else signal?.addEventListener("abort", onAbort, { once: true });
  try {
    return await engineFetch(`${detectBase()}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(localTok ? { "x-pravrudhi-token": localTok } : {}), ...extraHeaders },
      body,
      signal: controller.signal,
      anonymous,
      // Part of the demo-anon surface -- a 401 from a genuinely anonymous caller is an ordinary ApiError
      // below, never a redirect to /signin.
      authOptional: true,
    });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

// The engine's coded 503s (pravrudhi #319) for a busy or briefly unavailable agent. Before the codes existed these were uncoded 503s, which
// were retried once; they keep that behaviour. Every other coded refusal (judges_offline, judge_unavailable, outside_service_window, ...) is final.
// internal_error (engine 0.6.18, #499): before the code existed an unhandled exception was a bare 500, which was retried once; the coded 500 keeps that behaviour.
const RETRY_ONCE_CODES = new Set(["agent_at_capacity", "agent_unavailable", "internal_error"]);

async function sha256Hex(text: string): Promise<string> {
  const d = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * The engine echoes each fact as {id, sha256} (the sha256 of the stripped text) and no text, so the text shown beside a citation is the text this app
 * submitted, paired to the echoed fact BY sha256 (never by position). An echoed fact that matches no submitted fact, and every fact when the counts
 * differ, gets an empty text: the callers then show no cited-fact text at all rather than a wrong one.
 */
export async function withFactText(rawWire: AnalyseFactsWire, submitted: string[]): Promise<AnalyseFactsResult> {
  const wire = decideResultOnly(rawWire);
  const echoed = Array.isArray(wire.facts) ? wire.facts : [];
  if (echoed.length !== submitted.length) return { ...wire, facts: echoed.map((f) => ({ ...f, text: "" })) };
  // crypto.subtle exists only in a secure context (https or localhost). Without it the engine's own contract is used: it keeps the caller's order as F1..Fn
  // and refuses an empty fact, so with equal counts the positional pairing is exact.
  if (!globalThis.crypto?.subtle) return { ...wire, facts: echoed.map((f, i) => ({ ...f, text: submitted[i].trim() })) };
  const bySha = new Map<string, string[]>();
  for (const t of submitted) {
    const stripped = t.trim();
    const h = await sha256Hex(stripped);
    bySha.set(h, [...(bySha.get(h) ?? []), stripped]);
  }
  return { ...wire, facts: echoed.map((f) => ({ ...f, text: bySha.get(f.sha256)?.shift() ?? "" })) };
}

/** Thrown instead of sending the facts when the engine says this browser is not signed in (12 Oct: a call after a 401 on /api/me was served as an anonymous demo call). */
export class NotSignedInError extends Error {
  constructor() {
    super("not signed in");
    this.name = "NotSignedInError";
  }
}

/** Bounded: three looks at /api/me, 1.5 s apart (the first renews the web session). Mutable only so a test can set the pause to 0. */
/** Thrown instead of sending the facts when /api/me gave no answer we can rely on (an error status, a timeout, a dropped connection). There is no anonymous fallback. */
export class SignInUnverifiedError extends Error {
  constructor() {
    super("sign-in could not be checked");
    this.name = "SignInUnverifiedError";
  }
}

export const signInPolicy = { attempts: 3, pauseMs: 1500 };

type SessionState = "signed_in" | "signed_out" | "no_endpoint" | "unverified";

/**
 * What GET /api/me says. 200 is signed in; 401 is signed out; 404 or 405 means this engine has no identity endpoint at all (a local engine), which is not a
 * reason to block. Anything else (403, 5xx, a dropped connection, a timeout) is UNVERIFIED: the check did not give an answer, so it is never treated as signed in.
 */
async function sessionState(signal?: AbortSignal): Promise<SessionState> {
  // A visitor with no web session on a HOSTED engine is signed out by definition: the identity probe would only come back 401 and log a red error on every page (#137). The probe is still asked
  // wherever it can answer something: a signed-in visitor, and an engine that serves the page itself (local, desktop).
  if (isHostedEngine() && !(await hasWebSession())) return "signed_out";
  try {
    const res = await engineFetch(`${detectBase()}/api/me`, { cache: "no-store", authOptional: true, signal });
    if (res.status === 401) return "signed_out";
    if (res.status === 404 || res.status === 405) return "no_endpoint";
    return res.ok ? "signed_in" : "unverified";
  } catch {
    return "unverified";
  }
}

/**
 * Resolves only when the engine says signed in or has no identity endpoint. On a 401, or on an answer that could not be verified, it looks again a bounded number
 * of times (the first retry after a 401 renews the web session inside engineFetch), calling `onSigningIn` once, and then throws NotSignedInError (401) or
 * SignInUnverifiedError (no answer). Facts are never sent before this resolves, and an unverified check never falls back to the anonymous demo.
 *
 * KNOWN LIMIT (R2, 12 Oct; reworded 15 Oct, #103): this checks the session BEFORE the request. An expired bearer is not the gap: the engine already answers it 401 and the first retry renews the
 * session. The real residue is a session CLEARED between the 200 here and the POST (another tab signs out, or a refresh fails): the POST then carries no identity header at all and the engine can
 * still serve it anonymously (the production call D of 12 Oct). The check cannot close that window.
 */
export async function requireSession(opts: { onSigningIn?: () => void; signal?: AbortSignal; attempts?: number; pauseMs?: number } = {}): Promise<void> {
  const attempts = opts.attempts ?? signInPolicy.attempts;
  let last: SessionState = "unverified";
  for (let i = 0; i < attempts; i++) {
    last = await sessionState(opts.signal);
    if (last === "signed_in" || last === "no_endpoint") return;
    if (i === 0 && last === "signed_out") opts.onSigningIn?.();
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, opts.pauseMs ?? signInPolicy.pauseMs));
    if (opts.signal?.aborted) throw new DOMException("cancelled", "AbortError");
  }
  throw last === "signed_out" ? new NotSignedInError() : new SignInUnverifiedError();
}

/**
 * GET /api/me for the assistant entry (Lead-2, #125; R1 14 Oct): true on 200; false only on a clear 401 or a 404/405 (an engine with no identity endpoint); null on any error, timeout or dropped
 * connection, so a signed-in user whose identity call failed is never shown a sign-in line that is not their situation (nothing is shown, nothing enabled).
 */
export async function isSignedIn(signal?: AbortSignal): Promise<boolean | null> {
  const s = await sessionState(signal);
  return s === "signed_in" ? true : s === "signed_out" || s === "no_endpoint" ? false : null;
}

export interface AnalyseFactsOptions {
  /** Run with the screening assistant (#125): the assist route, with consent sent as true. The caller sets this only after the user ticked the consent box for THIS run. */
  assisted?: boolean;
  /** The user chose the anonymous demo explicitly: skip the sign-in check. Never set by the app on its own. */
  allowAnonymous?: boolean;
  /** Called once when the session is being retried ("Signing you in…"). */
  onSigningIn?: () => void;
  /** Called once when the sign-in check is over and the request is about to be sent (immediately for the anonymous demo, which skips the check): from here on a request is really in flight. */
  onRequestStart?: () => void;
  /**
   * #151 (Lead-2, R1 14 Oct): called once when the plain request timed out and is being sent ONCE more. Only a fetch timeout qualifies (never a 4xx/5xx answer, never the user cancelling), only on the
   * plain analyse-facts route (the assisted route is consent-bearing and paid: no retry until Track C says it is safe), and only when the caller shows the line. The second timeout is the ordinary error.
   */
  onTimeoutRetry?: () => void;
  /**
   * #1038 cold start with progress. Given only by the screening page, and only on the plain route. When the engine refuses with judges_offline, the app asks it to start the models (a wake job); a refusal
   * that wake is not allowed, or ANY other answer to that ask, leaves today's refusal exactly as it was. While a start is in progress this is called with what to show.
   */
  onWake?: (view: WakeView) => void;
}

/**
 * #1038 (engine 0.6.31): the start of a wake and its status, both for the signed-in user and with no facts (a start sends none; the status is keyed by the user, no id). The page then sends the screening ITSELF.
 * Any answer to the start but 200/202 (including 503 {"error":"judges_offline","wake":"not_allowed"}) is "not allowed": today's refusal stands.
 * A wake this page began and may still have open (it stopped following after its own limit, a cancel, or unreadable polls) is FOLLOWED on the next try, never started a second time (daily cap, cooldown): the wake belongs to
 * the user, not to a request, so the screening that follows is always the current facts. Cleared when the engine reports a terminal state, the poll answers 401/403, or the lease ends.
 */
let openWake: { userId: string; at: number } | null = null;
const OPEN_WAKE_LEASE_MS = 10 * 60 * 1000;

function wakeIO(signal: AbortSignal | undefined, onView: (v: WakeView) => void, userId: string | null, onTerminal: () => void): WakeIO {
  const base = `${detectBase()}/api/v1/analyse-facts/wake`;
  const call = async (url: string, init: RequestInit) => {
    const localTok = await localToken();
    return engineFetch(url, { ...init, headers: { "content-type": "application/json", ...(localTok ? { "x-pravrudhi-token": localTok } : {}) }, signal, authOptional: true });
  };
  const resume = openWake !== null && openWake.userId === (userId ?? "session") && Date.now() - openWake.at < OPEN_WAKE_LEASE_MS;
  if (!resume) openWake = null;
  return {
    signal,
    onView,
    resume,
    sleep: (ms, sig) => new Promise<void>((resolve, reject) => {
      const t = setTimeout(resolve, ms);
      sig?.addEventListener("abort", () => { clearTimeout(t); reject(new DOMException("cancelled", "AbortError")); }, { once: true });
    }),
    start: async () => {
      try {
        const r = await call(base, { method: "POST", body: "{}" });
        if (r.status !== 200 && r.status !== 202) return { kind: "not_allowed" };
        openWake = { userId: userId ?? "session", at: Date.now() };
        return { kind: "started", body: await r.json() };
      } catch (e) {
        if ((e as { name?: string } | null)?.name === "AbortError") throw e;
        return { kind: "not_allowed" };
      }
    },
    poll: async () => {
      const r = await call(`${base}/status`, { method: "GET" });
      if (!r.ok) {
        if (r.status === 401 || r.status === 403) { openWake = null; onTerminal(); }
        throw new ApiError(r.status, "/api/v1/analyse-facts/wake/status");
      }
      return r.json();
    },
  };
}

export async function analyseFacts(
  facts: string[],
  contractIds: string[],
  narrative?: string,
  signal?: AbortSignal,
  opts: AnalyseFactsOptions = {},
): Promise<AnalyseFactsResult> {
  const path = opts.assisted ? "/api/v1/analyse-facts/assist" : "/api/v1/analyse-facts";
  if (IS_DEMO) throw new ApiError(501, path);
  if (!opts.allowAnonymous) await requireSession({ onSigningIn: opts.onSigningIn, signal });
  opts.onRequestStart?.();
  const body = JSON.stringify({ facts, contract_ids: contractIds, narrative: narrative ?? "", ...(opts.assisted ? { consent: true } : {}) });
  // A network failure or timeout is NOT retried: the caller gets a definite message quickly (#14). Only an
  // uncoded 5xx is retried once (plain route only, #338); a coded refusal (outside_service_window, judge_unavailable) and any 4xx are final.
  let res: Response;
  let wakeMode: "ready" | "partial" | null = null;
  try {
    res = await analyseFactsAttempt(path, body, signal, opts.allowAnonymous === true);
  } catch (e) {
    const timedOut = e instanceof DOMException && e.name === "TimeoutError";
    if (!timedOut || opts.assisted || !opts.onTimeoutRetry || signal?.aborted) throw e;
    opts.onTimeoutRetry();
    res = await analyseFactsAttempt(path, body, signal, opts.allowAnonymous === true);
  }
  if (!res.ok) {
    let err = await apiErrorFrom(res, path);
    // #338: the assisted route (paid, consent per run) is never retried on a 5xx, coded or not: an unhandled exception can come after paid work, and a retry would start a second paid session on one consent tick.
    if (!opts.assisted && res.status >= 500 && (!err.code || RETRY_ONCE_CODES.has(err.code))) {
      res = await analyseFactsAttempt(path, body, signal, opts.allowAnonymous === true);
      if (!res.ok) err = await apiErrorFrom(res, path);
    }
    // A rate-limited (or otherwise refused) assisted run still gives the user the screening result: the plain request is sent instead and the block says refused, with no reason shown (R1, #125).
    if (!res.ok && opts.assisted && (res.status === 429 || res.status === 403)) {
      const plain = await analyseFacts(facts, contractIds, narrative, signal, { ...opts, assisted: false });
      return { ...plain, assistant: { used: false, outcome: "refused", reason: "error", steps: [] } };
    }
    if (!res.ok && !opts.assisted && !opts.allowAnonymous && opts.onWake && res.status === 503 && err.code === "judges_offline") {
      const { currentSession } = await import("./auth");
      const o = await runWake(wakeIO(signal, opts.onWake, currentSession()?.id ?? null, () => {}));
      if (o.kind === "stopped") {
        if (o.terminal) openWake = null;
        throw new WakeStoppedError(o.view.warning ?? "");
      }
      if (o.kind === "ready" || o.kind === "partial") {
        openWake = null;
        // the engine no longer runs the screening for the user: the page sends it itself, with the one-time ticket when only the first model is up (the ticket stays in memory and is never shown)
        if (o.kind === "partial" && !o.ticket) throw new WakeStoppedError(WAKE_POLL_ERROR);
        wakeMode = o.kind;
        res = await analyseFactsAttempt(path, body, signal, false, o.kind === "partial" && o.ticket ? { "x-wake-ticket": o.ticket } : {});
        if (!res.ok) throw await apiErrorFrom(res, path);
      }
    }
    if (!res.ok) throw err;
  }
  const wire = (await res.json()) as AnalyseFactsWire;
  const result = await withFactText(wire, facts);
  const raw = wire as unknown as Record<string, unknown>;
  // #360: an object answer that lacks `facts` or `contracts` (a proxy or version mismatch) is off the contract like null or a non-list: the page must not read a list that is not there
  if (!Array.isArray(raw.contracts) || !Array.isArray(raw.facts)) throw new InvalidEngineAnswerError(typeof raw.run_id === "string" ? raw.run_id : null);
  const secondSkipped = wakeMode !== null && (wakeMode === "partial" || raw.second_judge_ran === false || raw.contracts.some((c) => typeof c === "object" && c !== null && (c as Record<string, unknown>).second_judge_ran === false));
  if (!opts.assisted) return secondSkipped ? { ...result, second_judge_did_not_run: true } : result;
  const unreadable = (): never => { throw new InvalidEngineAnswerError(typeof raw.run_id === "string" ? raw.run_id : null); };
  const appendix = parseAppendix(raw.appendix);
  return { ...result, assistant: parseAssistantBlock(raw.assistant, unreadable), ...(appendix ? { appendix } : {}) };
}

/** POST /api/v1/intake (pravrudhi#414): pasted text only, signed-in users only; the plain deterministic route (no model). Returns the engine's answer unparsed: lib/intake.ts reads it. */
export async function postIntake(text: string, signal?: AbortSignal): Promise<unknown> {
  const path = "/api/v1/intake";
  if (IS_DEMO) throw new ApiError(501, path);
  await requireSession({ signal });
  const res = await engineFetch(`${detectBase()}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text }),
    signal,
  });
  if (!res.ok) throw await apiErrorFrom(res, path);
  return res.json();
}

/** GET /api/assistant (engine response model AssistantStatusResponse, pravrudhi#391): read only for the provider name in the consent line. Any failure or an answer off the contract is null and the line names no vendor; the limits and the signed-in-only ages are never displayed. */
export async function assistantProvider(): Promise<string | null> {
  try {
    return parseAssistantInfo(await getJSON<unknown>("/api/assistant", { authOptional: true }))?.provider ?? null;
  } catch {
    return null;
  }
}

// Partner key administration (pravrudhi #147). Authorised by the engine, not here: it admits only the signed-in
// admin allowlist and refuses everyone else, so nothing in this app holds a provisioning secret.
export interface PartnerKey {
  key_id: string;
  org_id: string;
  label: string;
  created: string;
  revoked: boolean;
  revoked_at: string | null;
  rate_limit_per_minute: number;
}
export interface CreatedPartnerKey extends PartnerKey {
  secret: string;
}
export interface PartnerUsageDay {
  day: string;
  calls: number;
  failed: number;
}
export interface PartnerKeyUsage {
  key_id: string;
  label: string;
  revoked: boolean;
  days: PartnerUsageDay[];
}

const orgPath = (org: string) => `/api/v1/orgs/${encodeURIComponent(org)}`;

export async function partnerKeys(org: string): Promise<PartnerKey[]> {
  if (IS_DEMO) throw new ApiError(501, `${orgPath(org)}/keys`);
  return (await getJSON<{ keys: PartnerKey[] }>(`${orgPath(org)}/keys`)).keys;
}

export async function createPartnerKey(org: string, label: string): Promise<CreatedPartnerKey> {
  if (IS_DEMO) throw new ApiError(501, `${orgPath(org)}/keys`);
  return postJSON<CreatedPartnerKey>(`${orgPath(org)}/keys`, { label });
}

export async function revokePartnerKey(org: string, keyId: string): Promise<PartnerKey> {
  if (IS_DEMO) throw new ApiError(501, `${orgPath(org)}/keys/${keyId}/revoke`);
  return postJSON<PartnerKey>(`${orgPath(org)}/keys/${encodeURIComponent(keyId)}/revoke`, {});
}

export async function partnerUsage(org: string, days = 30): Promise<PartnerKeyUsage[]> {
  if (IS_DEMO) throw new ApiError(501, `${orgPath(org)}/usage/summary`);
  return (await getJSON<{ keys: PartnerKeyUsage[] }>(`${orgPath(org)}/usage/summary?days=${days}`)).keys;
}

/** The citation check (#539): one citation and the quote to look for; the engine answers a status and a fixed note (pravrudhi #181). */
export const VERIFY_CITATION_TIMEOUT_MS = 20_000;

export async function verifyCitation(
  citation: string,
  quote: string | null,
  signal?: AbortSignal,
): Promise<{ result: string; note: string; status?: string; label?: string; preview?: boolean; verified?: boolean; coverage?: unknown; name_compared?: boolean }> {
  const path = "/api/v1/verify-citations";
  if (IS_DEMO) throw new ApiError(501, path);
  // #259: an anonymous visitor of a HOSTED engine has no session to present, so the check is not sent at all: no app-token request, no verify request, the citation text never leaves the browser.
  // The 401 is the engine's own answer for this case, raised here so the page shows the same signed-out sentence as before.
  if (isHostedEngine() && !(await hasWebSession())) throw new ApiError(401, path);
  const localTok = await localToken();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException("timed out", "TimeoutError")), VERIFY_CITATION_TIMEOUT_MS);
  const onAbort = () => controller.abort(signal?.reason ?? new DOMException("cancelled", "AbortError"));
  if (signal?.aborted) onAbort();
  else signal?.addEventListener("abort", onAbort, { once: true });
  try {
    const res = await engineFetch(`${detectBase()}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(localTok ? { "x-pravrudhi-token": localTok } : {}) },
      // no quote = existence-only: the field is left out, never sent empty (an empty quote verifies nothing)
      body: JSON.stringify(quote === null ? { citation } : { citation, quote }),
      signal: controller.signal,
      authOptional: true,
    });
    if (!res.ok) throw await apiErrorFrom(res, path);
    return (await res.json()) as { result: string; note: string; status?: string; label?: string; preview?: boolean; verified?: boolean; coverage?: unknown; name_compared?: boolean };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}
