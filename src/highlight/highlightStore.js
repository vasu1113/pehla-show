import { useSyncExternalStore } from 'react';

/**
 * A tiny shared channel so the analytics panel can light up seats in the
 * theatre — hover a cohort, its people glow; hover a drop, the seats that
 * emptied there flash. One external store, read by both distant panels.
 */
let state = { cohort: null, seats: null };
const listeners = new Set();

function emit() {
  for (const l of listeners) l();
}

export const highlightStore = {
  getState: () => state,
  subscribe(l) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  cohort(id) {
    state = { cohort: id, seats: null };
    emit();
  },
  seats(arr) {
    state = { cohort: null, seats: arr };
    emit();
  },
  clear() {
    if (state.cohort === null && state.seats === null) return;
    state = { cohort: null, seats: null };
    emit();
  },
};

export function useHighlight() {
  return useSyncExternalStore(highlightStore.subscribe, highlightStore.getState);
}
