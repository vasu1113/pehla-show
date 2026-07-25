import { useSyncExternalStore } from 'react';
import { clockStore } from './clockStore';

/**
 * React binding for THE CLOCK. Any component that calls this re-renders on
 * every clock change, reading the live `currentSeconds` and friends.
 *
 * Non-React / canvas readers (e.g. the theatre later) should NOT use this hook;
 * they read `clockStore.getState()` inside their own draw pass and subscribe via
 * `clockStore.subscribe`. Either way they read the shared clock — never a timer
 * of their own.
 */
export function useClock() {
  return useSyncExternalStore(clockStore.subscribe, clockStore.getState);
}

// Re-export the actions so components import everything clock-related from here.
export const clock = clockStore;
