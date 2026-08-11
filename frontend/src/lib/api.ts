import type { Tokens } from './types';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api/v1';

const ACCESS_KEY = 'library.accessToken';
const REFRESH_KEY = 'library.refreshToken';

/** Error thrown by the API client with the backend's message + status. */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

export function setTokens(tokens: Tokens): void {
  localStorage.setItem(ACCESS_KEY, tokens.accessToken);
  localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

let onSessionExpired: (() => void) | null = null;

/** Register a callback invoked when an authenticated session can no longer be
 *  refreshed (token revoked / expired). The AuthContext uses this to log out. */
export function setSessionExpiredHandler(fn: (() => void) | null): void {
  onSessionExpired = fn;
}

let refreshPromise: Promise<string | null> | null = null;

/** Exchange the stored refresh token for a fresh pair. Dedupes concurrent calls. */
async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await fetch(`${API_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken })
        });
        if (!res.ok) return null;
        const data = (await res.json()) as { tokens: Tokens };
        setTokens(data.tokens);
        return data.tokens.accessToken;
      } catch {
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

interface RequestOptions extends Omit<RequestInit, 'body' | 'headers'> {
  body?: unknown;
  headers?: Record<string, string>;
}

/**
 * Typed fetch wrapper against the API. Attaches the bearer token, transparently
 * refreshes once on a 401, and throws `ApiError` with the backend message.
 */
export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = getAccessToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers
  };

  const doFetch = (authToken?: string) =>
    fetch(`${API_URL}${path}`, {
      ...options,
      headers: { ...headers, ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) },
      body: options.body === undefined ? undefined : JSON.stringify(options.body)
    });

  let res = await doFetch();

  // Expired access token → try the refresh token once, then replay the request.
  if (res.status === 401 && getRefreshToken()) {
    const fresh = await refreshAccessToken();
    if (fresh) res = await doFetch(fresh);
  }

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as {
        error?: { message?: string; code?: string; details?: unknown };
      };
      message = body.error?.message ?? body.error?.code ?? message;
    } catch {
      // non-JSON error body
    }
    // A 401 that could not be recovered by refresh means the session is dead.
    if (res.status === 401 && getAccessToken()) onSessionExpired?.();
    throw new ApiError(message, res.status);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const apiUrl = API_URL;
