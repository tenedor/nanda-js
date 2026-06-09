import type { ErrorResponse } from './ErrorResponse.js';

export class HttpClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: ErrorResponse,
    public readonly url: string,
  ) {
    super(`HTTP ${status} from ${url}: ${body.message}`);
    this.name = 'HttpClientError';
  }
}

// All outbound HTTP calls in this prototype go through here.
export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...init?.headers,
    },
  });

  const text = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    body = { message: text };
  }

  if (!res.ok) {
    throw new HttpClientError(res.status, body as ErrorResponse, url);
  }

  return body as T;
}
