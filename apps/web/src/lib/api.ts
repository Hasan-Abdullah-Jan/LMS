const baseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';
let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  if (accessToken && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${accessToken}`);
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers, credentials: 'include' });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(response.status, payload.error?.code ?? 'ERROR', payload.error?.message ?? 'Request failed');
  return payload as T;
}

export async function downloadFile(path: string): Promise<void> {
  const headers = new Headers();
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  const response = await fetch(`${baseUrl}${path}`, { headers, credentials: 'include' });
  if (!response.ok) throw new ApiError(response.status, 'DOWNLOAD_FAILED', 'Could not download this file');
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = response.headers.get('content-disposition')?.match(/filename="?([^";]+)"?/i)?.[1] ?? 'download';
  anchor.click();
  URL.revokeObjectURL(url);
}

