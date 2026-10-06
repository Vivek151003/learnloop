import type { ApiError, AuthResponse } from '@learnloop/shared';

/** An API failure with the server's { code, message, requestId } shape. */
export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiError,
  ) {
    super(body.message);
    this.name = 'ApiRequestError';
  }
  get code() {
    return this.body.code;
  }
  fieldErrors(): Record<string, string> {
    return Object.fromEntries((this.body.details ?? []).map((d) => [d.path, d.message]));
  }
}

// The access token and CSRF token are kept in memory only, never in
// localStorage, so injected script cannot lift them from storage.
let accessToken: string | null = null;
let csrfToken: string | null = null;
let onSessionLost: () => void = () => {};

export function setSession(s: Pick<AuthResponse, 'accessToken' | 'csrfToken'> | null) {
  accessToken = s?.accessToken ?? null;
  csrfToken = s?.csrfToken ?? null;
}

export function onSessionExpired(fn: () => void) {
  onSessionLost = fn;
}

let refreshing: Promise<AuthResponse | null> | null = null;

/** Exchanges the HttpOnly refresh cookie for a new access token. Concurrent callers share one call. */
export function refreshSession(): Promise<AuthResponse | null> {
  refreshing ??= fetch('/api/v1/auth/refresh', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  })
    .then(async (res) => {
      if (!res.ok) return null;
      const data = (await res.json()) as AuthResponse;
      setSession(data);
      return data;
    })
    .catch(() => null)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

async function parseError(res: Response): Promise<ApiRequestError> {
  let body: ApiError;
  try {
    body = (await res.json()) as ApiError;
  } catch {
    body = {
      code: 'HTTP_' + res.status,
      message: 'Something went wrong. Please try again.',
      requestId: '',
    };
  }
  return new ApiRequestError(res.status, body);
}

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

async function send(method: Method, path: string, body?: unknown): Promise<Response> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (csrfToken && method !== 'GET') headers['X-CSRF-Token'] = csrfToken;
  return fetch(`/api/v1${path}`, {
    method,
    headers,
    credentials: 'same-origin',
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
  let res = await send(method, path, body);
  // One silent refresh on an expired access token, then retry once.
  if (res.status === 401 && accessToken) {
    const refreshed = await refreshSession();
    if (refreshed) res = await send(method, path, body);
    else onSessionLost();
  }
  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body: unknown = {}) => request<T>('POST', path, body),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  del: <T = void>(path: string) => request<T>('DELETE', path),
  /** Downloads a file response (for example CSV) with auth headers attached. */
  async download(path: string, filename: string) {
    const res = await send('GET', path);
    if (!res.ok) throw await parseError(res);
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },
};

export function qs(params: Record<string, string | number | undefined | null>): string {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== '',
  );
  return entries.length ? `?${new URLSearchParams(entries.map(([k, v]) => [k, String(v)]))}` : '';
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiRequestError) return err.message;
  return 'Something went wrong. Please check your connection and try again.';
}
