import type { ApiError, ApiSuccess } from '@ekms/contracts';

/** Browser requests stay same-origin; Next.js forwards /api/v1 to the API. */
export async function apiGet<T>(
  path: `/${string}`,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`/api/v1${path}`, {
    credentials: 'same-origin',
    signal,
  });
  if (!response.ok) {
    const body = (await response.json()) as ApiError;
    throw new Error(body.error.message);
  }
  const body = (await response.json()) as ApiSuccess<T>;
  return body.data;
}
