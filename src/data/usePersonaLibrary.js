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
 * But the backend has six personas seeded and the library is meant to hold
 * fifty, so letting the API replace the list outright turns "pick six from
 * fifty" into "pick the only six there are". Instead the two are unioned: an
 * API persona is `seeded` and selectable, a bundled-only one renders greyed
 * with its own reason. The shelf shows what the product is; the selection
 * stays truthful about what will actually run. As Track C seeds the rest, the
 * greyed entries light up on their own with no code change here.
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

        const seeded = new Map(fromApi.map((persona) => [persona.id, persona]));
        const union = bundled.map((persona) =>
          withBrowseDefaults({
            ...persona,
            ...seeded.get(persona.id),
            seeded: seeded.has(persona.id),
          }),
        );
        // Anything the API knows that the shelf does not — Track C seeding
        // past the bundled fifty — belongs on screen too.
        const known = new Set(bundled.map((persona) => persona.id));
        for (const persona of fromApi) {
          if (!known.has(persona.id)) union.push(withBrowseDefaults({ ...persona, seeded: true }));
        }

        setState({ personas: union, source: 'api' });
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
