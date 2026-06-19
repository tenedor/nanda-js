import type { ErrorResponse } from './ErrorResponse.js';
import { getLogger } from '../logging.js';

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

// Performs the raw HTTP call and body parsing. Returns status + parsed body without throwing.
async function fetchJsonHelper(url: string, init?: RequestInit): Promise<{ status: number; body: unknown }> {
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

  return { status: res.status, body };
}

// All outbound HTTP calls in this prototype go through here.
export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const method = init?.method?.toUpperCase() ?? 'GET';

  let requestBody: unknown;
  if (typeof init?.body === 'string') {
    try { requestBody = JSON.parse(init.body); } catch { requestBody = init.body; }
  }

  getLogger().info({ direction: 'sent', kind: 'request', url, method, body: requestBody }, 'outbound request');

  const { status, body } = await fetchJsonHelper(url, init);

  getLogger().info({ direction: 'received', kind: 'response', url, method, status, body }, 'outbound response');

  if (status < 200 || status >= 300) {
    throw new HttpClientError(status, body as ErrorResponse, url);
  }

  return body as T;
}
