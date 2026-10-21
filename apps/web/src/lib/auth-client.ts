import type { ApiError, ApiSuccess } from '@ekms/contracts';
export type { AccountUser, SessionSummary } from '@ekms/contracts';

export class ApiFailure extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function authRequest<T>(
  path: string,
  options: RequestInit = {},
  accessToken?: string,
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body) headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, {
      ...options,
      headers,
      credentials: 'same-origin',
    });
  } catch {
    throw new ApiFailure(0, 'NETWORK_ERROR', 'Network unavailable. Try again.');
  }
  const body = (await response.json().catch(() => null)) as
    ApiSuccess<T> | ApiError | null;
  if (!response.ok) {
    const error = body && 'error' in body ? body.error : null;
    throw new ApiFailure(
      response.status,
      error?.code ?? 'REQUEST_FAILED',
      error?.message ?? 'Request failed. Try again.',
    );
  }
  if (!body || !('data' in body))
    throw new ApiFailure(0, 'INVALID_RESPONSE', 'Unexpected server response.');
  return body.data;
}

let refreshFlight: Promise<string> | null = null;

export function refreshSingleFlight(): Promise<string> {
  if (refreshFlight) return refreshFlight;
  const run = () =>
    authRequest<{ accessToken: string }>('/auth/refresh', {
      method: 'POST',
    }).then((data) => data.accessToken);
  // Web Locks serialize cookie rotation across tabs in supporting browsers.
  const flight: Promise<string> =
    typeof navigator !== 'undefined' && navigator.locks
      ? new Promise<string>((resolve, reject) => {
          void navigator.locks
            .request('ekms-refresh', run)
            .then(resolve, reject);
        })
      : run();
  refreshFlight = flight.finally(() => {
    refreshFlight = null;
  });
  return refreshFlight;
}
