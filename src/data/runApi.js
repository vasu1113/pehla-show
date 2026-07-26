import { apiUrl } from './api.js';

export const RUN_SOURCE = import.meta.env?.VITE_RUN_SOURCE ?? 'live';

export class ApiResponseError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiResponseError';
    this.status = status;
  }
}

async function readPayload(response) {
  const payload = await response.json().catch(() => ({}));
  if (response.ok) return payload;

  const detail = payload?.detail;
  const message = typeof detail === 'string'
    ? detail
    : payload?.error?.message ?? `Request failed (${response.status})`;
  throw new ApiResponseError(message, response.status);
}

// Fetch rejects with TypeError when the host is unreachable (for example, a
// local UI opened without FastAPI running on port 8000).
export function isNetworkUnavailable(error) {
  return error instanceof TypeError || error?.name === 'NetworkError';
}

export async function startRun(
  { script, personaIds, title = 'Untitled' },
  fetcher = fetch,
) {
  const response = await fetcher(apiUrl('/analyse'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      raw_text: script,
      title,
      persona_ids: personaIds,
    }),
  });
  return readPayload(response);
}

export async function getRun(runId, fetcher = fetch, signal) {
  const response = await fetcher(apiUrl(`/runs/${runId}`), { signal });
  return readPayload(response);
}

export async function waitForRun(
  runId,
  {
    fetcher = fetch,
    signal,
    onUpdate = () => {},
    pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
    initialDelay = 500,
    maximumDelay = 2000,
  } = {},
) {
  let delay = initialDelay;
  while (!signal?.aborted) {
    const run = await getRun(runId, fetcher, signal);
    onUpdate(run);
    if (run.status !== 'analysing') return run;
    await pause(delay);
    delay = Math.min(maximumDelay, Math.round(delay * 1.4));
  }
  throw new DOMException('Analysis cancelled', 'AbortError');
}

export async function loadMockRun(fetcher = fetch, signal) {
  const response = await fetcher('/data/mockRun.json', { signal });
  return readPayload(response);
}
