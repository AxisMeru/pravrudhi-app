// Typed fetch client for the Pravrudhi engine's JSON API.
//
// Every function here can fail — there may be no engine running, or an endpoint may not exist yet on an
// older engine build. Callers are expected to handle rejection; nothing here retries or hides a failure.


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
}

// Every call to the engine goes through here (ADR-0051 addendum 3). The bearer token of the signed-in web
// session is attached when there is one — a local or desktop engine has none and ignores the absence — a stale
// session is renewed first, a 401 is answered by renewing once and retrying, and a 401 that survives that sends
// the page to /signin -- UNLESS the caller marked this call `authOptional` (see above), in which case the 401
// is simply returned like any other response. Page modules that fetched the engine themselves never carried
// the token, so the first signed-in operator saw "could not reach" on every page whose module was not api.ts
// (2026-09-12); a spec now refuses any bare engine fetch outside this function.
export async function engineFetch(input: string, init: EngineFetchInit = {}, retried = false): Promise<Response> {
  const { authOptional, ...rest } = init;
  const token = await webSessionToken();
  const headers = new Headers(rest.headers);
  if (token && !headers.has("authorization")) headers.set("authorization", `Bearer ${token}`);
  const res = await fetch(input, { ...rest, headers });
  if (res.status === 401) {
    if (!retried && (await recoverFrom401())) return engineFetch(input, init, true);
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

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly path: string,
  ) {
    super(`${path}: HTTP ${status}`);
    this.name = "ApiError";
  }
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
async function hasWebSession(): Promise<boolean> {
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

async function getJSON<T>(path: string, opts: { authOptional?: boolean } = {}): Promise<T> {
  const res = await engineFetch(`${detectBase()}${await withWorkspace(path)}`, { cache: "no-store", authOptional: opts.authOptional });
  if (!res.ok) throw new ApiError(res.status, path);
  return (await res.json()) as T;
}

// The engine refuses state-changing requests without its local token, so that no page a user happens to be
// visiting can start work on their GPU. The token is readable only by a same-origin caller, which this app is
// when the engine serves it. It is fetched once and kept in memory; it is never stored anywhere a script on
// another page could reach.
let cachedToken: string | null = null;

export async function localToken(): Promise<string | null> {
  if (cachedToken !== null) return cachedToken;
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
    if (!res.ok) return null;
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

export function ensureDefaultWorkspace(): Promise<void> {
  if (!workspaceBootstrap) {
    workspaceBootstrap = postJSON<{ slug: string; path: string }>("/api/workspaces", { slug: DEFAULT_WORKSPACE })
      .then(() => undefined)
      .catch((e) => {
        workspaceBootstrap = null;
        throw e;
      });
  }
  return workspaceBootstrap;
}

export interface HealthResponse {
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
  return getJSON<HealthResponse>("/api/health", { authOptional: true });
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
  status: string; // "established" | "not_established"
  claimed: boolean;
  p_established: number | null;
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
  uncertain: string[];
  statute_text_mismatch: boolean | null;
}

export interface AnalyseFactsResult {
  run_id: string;
  judge: string;
  score_sha256: string;
  facts: { id: string; text: string; sha256: string }[];
  contracts: AnalyseFactsContract[];
  provenance: string;
}

// 320s: a generous margin above RunPod LB's own ~300s execution ceiling and the ~2.5 minute worst-case cold
// start (operator decision 2026-09-24, no warm workers while we build: ~24s engine start + ~200s judge cold
// start). A shorter client-side timeout would cut a real, still-in-progress cold start off before the
// backend could ever have answered -- this exists so that never happens, not to bound wall-clock time.
export const ANALYSE_FACTS_TIMEOUT_MS = 320_000;

async function analyseFactsAttempt(path: string, body: string): Promise<Response> {
  const localTok = await localToken();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ANALYSE_FACTS_TIMEOUT_MS);
  try {
    return await engineFetch(`${detectBase()}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(localTok ? { "x-pravrudhi-token": localTok } : {}) },
      body,
      signal: controller.signal,
      // Part of the demo-anon surface -- a 401 from a genuinely anonymous caller is an ordinary ApiError
      // below, never a redirect to /signin.
      authOptional: true,
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function analyseFacts(
  facts: string[],
  contractIds: string[],
  narrative?: string,
): Promise<AnalyseFactsResult> {
  const path = "/api/v1/analyse-facts";
  if (IS_DEMO) throw new ApiError(501, path);
  const body = JSON.stringify({ facts, contract_ids: contractIds, narrative: narrative ?? "" });
  // This route takes no workspace param (partner.py's session-free design) -- called directly, not through
  // postJSON/withWorkspace, so it can carry its own generous timeout without affecting every other call site.
  let res: Response;
  try {
    res = await analyseFactsAttempt(path, body);
  } catch {
    // A network error or our own timeout abort during the cold-start window -- retried once, since that's
    // exactly the case a warm-up failure looks like from here.
    res = await analyseFactsAttempt(path, body);
  }
  if (!res.ok) {
    // A 5xx while the judge is still warming up is retried once too; a real client error (4xx) never is --
    // retrying a bad request just wastes another cold-start-length wait for the same wrong answer.
    if (res.status >= 500) res = await analyseFactsAttempt(path, body);
    if (!res.ok) throw new ApiError(res.status, path);
  }
  return (await res.json()) as AnalyseFactsResult;
}
