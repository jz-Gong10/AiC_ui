import { flushSync } from 'react-dom';

export type TransitionSurface = 'gallery' | 'workspace';
let activeTransition: ViewTransition | null = null;
let revision = 0;

// Keep the native transition scoped to the surface that actually changes.
// Reduced-motion and unsupported browsers still receive the state update.
export function transitionView(surface: TransitionSurface, update: () => void) {
  const root = document.documentElement;
  const currentRevision = ++revision;
  activeTransition?.skipTransition();
  activeTransition = null;
  if (!document.startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    delete root.dataset.transition;
    update();
    return;
  }

  root.dataset.transition = surface;
  try {
    const transition = document.startViewTransition(() => {
      if (currentRevision === revision) flushSync(update);
    });
    activeTransition = transition;
    void transition.ready.catch(() => {});
    void transition.finished.catch(() => {}).finally(() => {
      if (currentRevision === revision) {
        activeTransition = null;
        delete root.dataset.transition;
      }
    });
  } catch {
    if (currentRevision === revision) {
      delete root.dataset.transition;
      update();
    }
  }
}
