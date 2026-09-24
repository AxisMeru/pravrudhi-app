// Typed fetch client for the engine's notification feed: the record of what happened while nobody was watching
// a page -- a run ending, a job's verdict, a criterion being met. A new file rather than additions to api.ts, so
// pages built in parallel never contend for that one.

import { ApiError, IS_DEMO, apiBase, engineFetch, localToken } from "./api";

export interface NotificationItem {
  id: string;
  at: string;
  kind: string;
  title: string;
  detail: string;
  ref: string;
  read: boolean;
}

export interface NotificationsSnapshot {
  notifications: NotificationItem[];
  unread: number;
}

async function getJSON<T>(path: string, opts: { authOptional?: boolean } = {}): Promise<T> {
  const res = await engineFetch(`${apiBase()}${path}`, { cache: "no-store", authOptional: opts.authOptional });
  if (!res.ok) throw new ApiError(res.status, path);
  return (await res.json()) as T;
}

async function postJSON<T>(path: string, body: unknown): Promise<T> {
  const token = await localToken();
  const res = await engineFetch(`${apiBase()}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { "x-pravrudhi-token": token } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new ApiError(res.status, path);
  return (await res.json()) as T;
}

export async function notifications(n = 30): Promise<NotificationsSnapshot> {
  if (IS_DEMO) return { notifications: [], unread: 0 };
  // authOptional (2026-09-24): NotificationBell polls this on every page, for every visitor, same as
  // edition()'s /api/me -- an anonymous 401 here means "no notifications to show", never a reason to
  // redirect an anonymous visitor to /signin mid-visit (the same real incident class edition() had: a
  // background shell-level poll bounced a long-running anonymous /matters session to /signin mid-request).
  return getJSON<NotificationsSnapshot>(`/api/notifications?n=${n}`, { authOptional: true });
}

// An empty `ids` list marks every unread notification read.
export async function markRead(ids: string[] = []): Promise<NotificationsSnapshot> {
  if (IS_DEMO) throw new ApiError(501, "/api/notifications/read");
  return postJSON<NotificationsSnapshot>("/api/notifications/read", { ids });
}
