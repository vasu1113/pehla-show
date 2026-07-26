import { useEffect, useState } from 'react';
import bundled from './personas.json';
import { apiUrl } from './api';

/**
 * The persona library the operator picks six from.
 *
 * The API is the authority on which ids exist — a selection made here is posted
 * straight back as `persona_ids`, so picking something the backend has never
 * heard of is a 400 at the worst possible moment.
 *
 * Once the API responds, its Supabase library is the complete authority. The
 * bundled data is strictly an offline fallback and must never appear alongside
 * live personas.
 *
 * When /personas does not answer — no backend, demo laptop offline — the
 * bundled library renders on its own so the front door is never a blank page,
 * and everything is selectable because there is nothing to contradict it.
 * `source` says which happened, and the UI is allowed to say so out loud.
 */

/** The browser filters and searches on these; the contract carries none of
 *  them, so a persona the API knows and the bundle does not still sorts. */
function withBrowseDefaults(persona) {
  return {
    category: persona.persona_type ?? 'context',
    language: '—',
    attention_span: 'medium',
    trope_appetite: 'medium',
    ...persona,
  };
}

export function usePersonaLibrary() {
  const [state, setState] = useState({
    personas: bundled.map((persona) => withBrowseDefaults({ ...persona, seeded: true })),
    source: 'bundled',
  });

  useEffect(() => {
    let live = true;

    fetch(apiUrl('/personas'))
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((payload) => {
        const fromApi = payload?.personas ?? [];
        // An empty library is not an answer worth acting on — keep the bundle.
        if (!live || fromApi.length === 0) return;

        setState({
          personas: fromApi.map((persona) =>
            withBrowseDefaults({ ...persona, seeded: true }),
          ),
          source: 'api',
        });
      })
      .catch(() => {
        /* bundled library stays on screen */
      });

    return () => {
      live = false;
    };
  }, []);

  return state;
}
