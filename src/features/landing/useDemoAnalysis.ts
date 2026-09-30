import { useEffect, useMemo, useRef, useState, type MutableRefObject, type RefObject } from 'react';
import type { SceneMotion } from './PhotoScene';

type Phase = 'idle' | 'waiting' | 'running' | 'done';
interface AnalysisView { index: number | null; phase: Phase; completed: number[] }

// This demo uses authored examples only. No images or scores are sent to an API.
export function useDemoAnalysis(motion: MutableRefObject<SceneMotion>, host: RefObject<HTMLDivElement | null>) {
  const [view, setView] = useState<AnalysisView>({ index: null, phase: 'idle', completed: [] });
  const state = useRef({ index: null as number | null, phase: 'idle' as Phase, progress: 0, completed: new Set<number>(), visible: true });
  const api = useMemo(() => {
    let frame = 0;
    let previousTime = 0;
    const publish = () => setView({ index: state.current.index, phase: state.current.phase, completed: [...state.current.completed] });
    const draw = () => {
      host.current?.parentElement?.style.setProperty('--analysis-progress', String(state.current.progress));
      motion.current.invalidate?.();
    };
    const cancelFrame = () => { cancelAnimationFrame(frame); frame = 0; previousTime = 0; };
    const finish = () => {
      const current = state.current;
      if (current.index === null) return;
      current.completed.add(current.index);
      current.progress = 1;
      current.phase = 'done';
      cancelFrame(); draw(); publish();
    };
    const tick = (time: number) => {
      frame = 0;
      const current = state.current;
      if (current.phase !== 'running' || !current.visible || document.hidden) return;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { finish(); return; }
      if (previousTime) current.progress = Math.min(1, current.progress + Math.min(120, time - previousTime) / 950);
      previousTime = time;
      draw();
      if (current.progress === 1) finish();
      else frame = requestAnimationFrame(tick);
    };
    return {
      state,
      request(index: number) {
        const current = state.current;
        // Re-clicking the same print should not interrupt its own analysis.
        if (current.index === index && current.phase !== 'idle') return;
        cancelFrame();
        current.index = index;
        current.phase = current.completed.has(index) ? 'done' : 'waiting';
        current.progress = current.phase === 'done' ? 1 : 0;
        draw(); publish();
      },
      begin(index: number) {
        const current = state.current;
        if (current.index !== index || current.phase !== 'waiting') return;
        current.phase = 'running';
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { finish(); return; }
        publish();
        if (current.visible && !document.hidden) frame = requestAnimationFrame(tick);
      },
      setVisible(visible: boolean) {
        state.current.visible = visible;
        if (!visible || document.hidden) {
          cancelFrame();
          if (state.current.phase === 'running') {
            state.current.phase = 'waiting';
            state.current.progress = 0;
            draw(); publish();
          }
        }
        else if (!frame && state.current.phase === 'running') frame = requestAnimationFrame(tick);
      },
      reset() {
        cancelFrame();
        Object.assign(state.current, { index: null, phase: 'idle', progress: 0, completed: new Set<number>() });
        draw(); publish();
      },
      dispose: cancelFrame,
    };
  }, [host, motion]);
  useEffect(() => {
    const onVisibility = () => api.setVisible(state.current.visible);
    document.addEventListener('visibilitychange', onVisibility);
    return () => { api.dispose(); document.removeEventListener('visibilitychange', onVisibility); };
  }, [api]);
  return { view, api };
}
