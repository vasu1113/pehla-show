import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  loadMockRun,
  RUN_SOURCE,
  startRun,
  waitForRun,
} from './runApi';

const RunContext = createContext(null);

function runError(run) {
  return run?.error?.message
    ?? run?.warnings?.at(-1)?.message
    ?? 'The analysis could not be completed.';
}

export function RunProvider({ children }) {
  const activeRequest = useRef(null);
  const [state, setState] = useState({
    run: null,
    runId: null,
    status: 'idle',
    progress: null,
    error: null,
    source: RUN_SOURCE,
  });

  useEffect(() => () => activeRequest.current?.abort(), []);

  const startAnalysis = useCallback(async ({ script, selected, title }) => {
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setState({
      run: null,
      runId: null,
      status: RUN_SOURCE === 'mock' ? 'loading' : 'submitting',
      progress: null,
      error: null,
      source: RUN_SOURCE,
    });

    try {
      if (RUN_SOURCE === 'mock') {
        const run = await loadMockRun(fetch, controller.signal);
        setState({
          run,
          runId: run.run_id,
          status: 'ready',
          progress: null,
          error: null,
          source: RUN_SOURCE,
        });
        return run;
      }

      const started = await startRun({
        script,
        personaIds: selected,
        title,
      });
      setState((current) => ({
        ...current,
        runId: started.run_id,
        status: 'analysing',
      }));

      const run = await waitForRun(started.run_id, {
        signal: controller.signal,
        onUpdate: (update) => {
          setState((current) => ({
            ...current,
            run: update.status === 'analysing' ? current.run : update,
            status: update.status,
            progress: update.progress ?? current.progress,
            error: update.status === 'error' ? runError(update) : null,
          }));
        },
      });

      if (run.status === 'error') throw new Error(runError(run));
      return run;
    } catch (error) {
      if (error?.name === 'AbortError') throw error;
      setState((current) => ({
        ...current,
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      }));
      throw error;
    }
  }, []);

  return (
    <RunContext.Provider value={{ ...state, startAnalysis }}>
      {children}
    </RunContext.Provider>
  );
}

export function useRun() {
  const context = useContext(RunContext);
  if (!context) throw new Error('useRun must be used inside RunProvider');
  return context;
}
