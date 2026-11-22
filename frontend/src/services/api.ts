import type { Token } from '../types';

let token: Token | null = null;
let onRefresh: ((value: Token) => void) | null = null;
let onExpired: (() => void) | null = null;

export const configureApi = (auth: Token | null, refresh?: (value: Token) => void, expired?: () => void): void => {
  token = auth;
  onRefresh = refresh ?? null;
  onExpired = expired ?? null;
};

export class ApiError extends Error {
  constructor(message: string, public status?: number) { super(message); this.name = 'ApiError'; }
}

export async function api<T>(path: string, options: { method?: string; body?: unknown } = {}, retry = true): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(`/api/v1${path}`, {
      method: options.method ?? 'GET',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token.access}` } : {}) },
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    });
    if (response.status === 401 && retry && token?.refresh) {
      const refreshed = await fetch('/api/v1/auth/token/refresh/', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh: token.refresh }),
      });
      if (refreshed.ok) {
        const next = { ...token, access: (await refreshed.json() as { access: string }).access };
        configureApi(next, onRefresh ?? undefined, onExpired ?? undefined);
        onRefresh?.(next);
        return api<T>(path, options, false);
      }
      onExpired?.();
      throw new ApiError('Sesión vencida', 401);
    }
    const data: unknown = await response.json().catch(() => null);
    if (!response.ok) throw new ApiError(response.status === 403 ? 'Sin permiso para esto' : data ? JSON.stringify(data) : `Error ${response.status}`, response.status);
    return data as T;
  } finally { window.clearTimeout(timeout); }
}

export const isNetworkError = (error: unknown): boolean =>
  error instanceof TypeError || (error instanceof DOMException && error.name === 'AbortError');
