import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { BrandLoader } from '../shared/BrandLoader';
import './workspace-entry.css';

type Phase = 'idle' | 'covering' | 'loading' | 'leaving';
interface EntryRun { started: number; reduced: boolean; finishing: boolean; resume?: () => void }
interface EntryContextValue {
  enter(commit: () => void): Promise<void>;
  ready(): void;
  cancel(): void;
}
const EntryContext = createContext<EntryContextValue | null>(null);

export function WorkspaceEntryTransitionProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>('idle');
  const run = useRef<EntryRun | null>(null);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const status = useRef<HTMLDivElement>(null);
  const active = phase !== 'idle';

  const later = useCallback((callback: () => void, delay: number) => {
    const timer = setTimeout(() => { timers.current.delete(timer); callback(); }, delay);
    timers.current.add(timer);
  }, []);
  const clear = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current.clear();
    const previous = run.current;
    run.current = null;
    previous?.resume?.();
  }, []);
  const cancel = useCallback(() => { clear(); setPhase('idle'); }, [clear]);
  const ready = useCallback(() => {
    const current = run.current;
    if (!current || current.finishing) return;
    current.finishing = true;
    // Keep fast responses readable; slow requests determine their own duration.
    later(() => {
      if (run.current !== current) return;
      setPhase('leaving');
      later(() => {
        if (run.current !== current) return;
        flushSync(cancel);
        document.querySelector<HTMLElement>('.workspace-main')?.focus({ preventScroll: true });
      }, current.reduced ? 0 : 240);
    }, Math.max(0, (current.reduced ? 0 : 700) - (performance.now() - current.started)));
  }, [cancel, later]);
  const enter = useCallback(async (commit: () => void) => {
    if (run.current) return;
    const current: EntryRun = { started: performance.now(), reduced: matchMedia('(prefers-reduced-motion: reduce)').matches, finishing: false };
    run.current = current;
    setPhase('covering');
    await new Promise<void>(resolve => { current.resume = resolve; later(resolve, current.reduced ? 0 : 180); });
    if (run.current !== current) return;
    current.resume = undefined;
    try {
      // Cover the login page before auth state replaces it with the workspace.
      flushSync(() => { setPhase('loading'); commit(); });
      // Reveal the workspace's loading/error controls if the network is slow.
      later(ready, 5000);
    } catch (error) { cancel(); throw error; }
  }, [cancel, later, ready]);

  useLayoutEffect(() => {
    if (!active) return;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = 'hidden';
    status.current?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [active]);
  useEffect(() => {
    window.addEventListener('cullpilot:session-expired', cancel);
    return () => { window.removeEventListener('cullpilot:session-expired', cancel); clear(); };
  }, [cancel, clear]);

  return <EntryContext.Provider value={{ enter, ready, cancel }}>
    <div className="workspace-entry-content" inert={active} aria-hidden={active || undefined}>{children}</div>
    {active && <div className="workspace-entry-overlay" data-phase={phase}>
      <div className="workspace-entry-status" ref={status} tabIndex={-1} role="status" aria-live="polite" aria-atomic="true">
        <BrandLoader variant="horizontal" size="hero" />
        <h2>正在准备你的工作台</h2>
        <p>让值得留下的瞬间，逐一就位。</p>
      </div>
    </div>}
  </EntryContext.Provider>;
}

export function useWorkspaceEntryTransition() {
  const value = useContext(EntryContext);
  if (!value) throw new Error('WorkspaceEntryTransitionProvider is required');
  return value;
}
