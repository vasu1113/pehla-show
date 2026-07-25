/**
 * The one place the frontend knows where Track A lives.
 *
 * Everything else imports API_BASE from here, so pointing the UI at a deployed
 * backend is an env change and never a code change.
 */
export const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000';

export function apiUrl(path) {
  return `${API_BASE}${path}`;
}
