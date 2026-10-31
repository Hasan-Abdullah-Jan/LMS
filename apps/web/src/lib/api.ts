/**
 * HTTP client for the Express API.
 * - The access token lives only in memory; the refresh token is an httpOnly cookie.
 * - A 401 triggers one silent refresh (single-flight) and a retry.
 * - Errors are normalised into ApiError using the API's { error: { code, message, details } } envelope.
 */

export const API_URL = (import.meta.env.VITE_API_URL ?? '/api').replace(/\/$/, '');

export interface ApiErrorDetail {
  path?: string;
  message: string;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details: ApiErrorDetail[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }

  fieldError(path: string): string | undefined {
    return this.details.find((d) => d.path === path)?.message;
  }
}

export interface Page<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number };
}

export interface SessionPayload<U> {
  accessToken: string;
  expiresAt: number;
  user: U;
}

type Listener = (token: string | null) => void;

let accessToken: string | null = null;
const listeners = new Set<Listener>();
let refreshInFlight: Promise<boolean> | null = null;
let refreshHandler: (() => Promise<boolean>) | null = null;
let unauthorizedHandler: ((error: ApiError) => void) | null = null;

export const tokenStore = {
  get: () => accessToken,
  set(token: string | null) {
    accessToken = token;
    listeners.forEach((listener) => listener(token));
  },
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

/** Wired by the AuthProvider. */
export function configureAuthHandlers(handlers: {
  refresh: () => Promise<boolean>;
  onUnauthorized: (error: ApiError) => void;
}) {
  refreshHandler = handlers.refresh;
  unauthorizedHandler = handlers.onUnauthorized;
}

async function refreshOnce(): Promise<boolean> {
  if (!refreshHandler) return false;
  refreshInFlight ??= refreshHandler().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | null | undefined>;
  signal?: AbortSignal;
  /** Use a specific bearer token (e.g. a password-recovery token) instead of the session. */
  token?: string;
  /** Skip the refresh-and-retry dance (used by auth endpoints themselves). */
  skipRefresh?: boolean;
}

export function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = `${API_URL}${path}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

async function toApiError(response: Response): Promise<ApiError> {
  let payload: { error?: { code?: string; message?: string; details?: ApiErrorDetail[] } } | null =
    null;
  try {
    payload = await response.json();
  } catch {
    /* non-JSON body */
  }
  const fallback =
    response.status === 429
      ? 'Too many requests. Please wait a moment and try again.'
      : response.status >= 500
        ? 'The server had a problem. Please try again.'
        : 'Request failed.';
  return new ApiError(
    response.status,
    payload?.error?.code ?? 'UNKNOWN',
    payload?.error?.message ?? fallback,
    payload?.error?.details ?? [],
  );
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, signal, token, skipRefresh } = options;
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;

  const send = () => {
    const headers: Record<string, string> = { Accept: 'application/json' };
    const bearer = token ?? accessToken;
    if (bearer) headers.Authorization = `Bearer ${bearer}`;
    if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json';
    return fetch(buildUrl(path, query), {
      method,
      headers,
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
      credentials: 'include',
      signal,
    });
  };

  let response: Response;
  try {
    response = await send();
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      'Cannot reach the server. Check your connection and try again.',
    );
  }

  if (response.status === 401 && !token && !skipRefresh && accessToken) {
    if (await refreshOnce()) response = await send();
  }

  if (!response.ok) {
    const error = await toApiError(response);
    if (error.status === 401 && !token && !skipRefresh) unauthorizedHandler?.(error);
    throw error;
  }
  if (response.status === 204) return undefined as T;
  const contentType = response.headers.get('content-type') ?? '';
  return (
    contentType.includes('application/json') ? response.json() : response.text()
  ) as Promise<T>;
}

/** Unwrap { data } envelopes. */
export async function getData<T>(path: string, options?: RequestOptions): Promise<T> {
  return (await request<{ data: T }>(path, options)).data;
}

export const api = {
  get: <T>(path: string, query?: RequestOptions['query'], signal?: AbortSignal) =>
    getData<T>(path, { query, signal }),
  page: <T>(path: string, query?: RequestOptions['query'], signal?: AbortSignal) =>
    request<Page<T>>(path, { query, signal }),
  post: <T>(path: string, body?: unknown) => getData<T>(path, { method: 'POST', body }),
  put: <T>(path: string, body?: unknown) => getData<T>(path, { method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown) => getData<T>(path, { method: 'PATCH', body }),
  delete: (path: string) => request<void>(path, { method: 'DELETE' }),
};

/**
 * Multipart upload with progress (XMLHttpRequest exposes upload progress; fetch does not).
 */
export function upload<T>(
  path: string,
  form: FormData,
  options: {
    method?: 'POST' | 'PUT';
    onProgress?: (percent: number) => void;
    query?: RequestOptions['query'];
  } = {},
): Promise<T> {
  const attempt = () =>
    new Promise<{ status: number; body: string }>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open(options.method ?? 'POST', buildUrl(path, options.query));
      xhr.withCredentials = true;
      xhr.setRequestHeader('Accept', 'application/json');
      if (accessToken) xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable)
          options.onProgress?.(Math.round((event.loaded / event.total) * 100));
      };
      xhr.onload = () => resolve({ status: xhr.status, body: xhr.responseText });
      xhr.onerror = () =>
        reject(
          new ApiError(0, 'NETWORK_ERROR', 'Upload failed. Check your connection and try again.'),
        );
      xhr.send(form);
    });

  return (async () => {
    let result = await attempt();
    if (result.status === 401 && (await refreshOnce())) result = await attempt();
    let parsed: {
      data?: T;
      error?: { code?: string; message?: string; details?: ApiErrorDetail[] };
    } = {};
    try {
      parsed = result.body ? JSON.parse(result.body) : {};
    } catch {
      /* ignore */
    }
    if (result.status < 200 || result.status >= 300) {
      throw new ApiError(
        result.status,
        parsed.error?.code ?? 'UNKNOWN',
        parsed.error?.message ??
          (result.status === 413 ? 'The file is too large.' : 'Upload failed.'),
        parsed.error?.details ?? [],
      );
    }
    return parsed.data as T;
  })();
}

/** Ask the API for a 60-second signed URL, then open it. */
export async function openSignedUrl(path: string): Promise<void> {
  const { url } = await getData<{ url: string; fileName: string }>(path);
  const link = document.createElement('a');
  link.href = url;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/** Download an authenticated file response (e.g. gradebook CSV). */
export async function downloadFile(path: string, fallbackName: string): Promise<void> {
  const run = () =>
    fetch(buildUrl(path), {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      credentials: 'include',
    });
  let response = await run();
  if (response.status === 401 && (await refreshOnce())) response = await run();
  if (!response.ok) throw await toApiError(response);
  const blob = await response.blob();
  const name =
    /filename="([^"]+)"/.exec(response.headers.get('content-disposition') ?? '')?.[1] ??
    fallbackName;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function errorMessage(error: unknown, fallback = 'Something went wrong.'): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
