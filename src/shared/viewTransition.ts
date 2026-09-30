import { flushSync } from 'react-dom';

export type TransitionSurface = 'gallery' | 'workspace';
const activeAnimations = new Set<Animation>();

// Animate the live DOM instead of native view-transition snapshots. The native
// top layer intercepts pointer input even outside the animated gallery surface.
export function transitionView(surface: TransitionSurface, update: () => void) {
  for (const animation of activeAnimations) animation.cancel();
  activeAnimations.clear();
  flushSync(update);
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const selector = surface === 'gallery' ? '.gallery-stage' : '.workbench, .top-title h1';
  for (const element of document.querySelectorAll<HTMLElement>(selector)) {
    if (!element.animate || !element.getClientRects().length) continue;
    try {
      const animation = element.animate([{ opacity: 0.8 }, { opacity: 1 }], {
        duration: surface === 'gallery' ? 180 : 220,
        easing: 'ease-out',
      });
      activeAnimations.add(animation);
      animation.onfinish = animation.oncancel = () => { activeAnimations.delete(animation); };
    } catch {
      // The state is already committed; animation support never gates input.
    }
  }
}
