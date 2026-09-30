import { Component, lazy, Suspense, useEffect, useRef, type MouseEvent, type ReactNode } from 'react';
import { ArrowDown, ArrowRight, Images, SlidersHorizontal, FolderOpen } from 'lucide-react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import logo from '../../assets/brand/cullpilot-lockup-horizontal.svg';
import { AuthPanel } from './AuthPanel';
import type { SceneMotion } from './PhotoScene';
import coast from './art/coast.svg';
import './landing.css';

const PhotoScene = lazy(() => import('./PhotoScene'));
gsap.registerPlugin(ScrollTrigger, useGSAP);

function ScenePlaceholder() {
  return <div className="landing-scene-loading" aria-hidden="true"><img src={coast} alt="" /></div>;
}

// A failed 3D download must not take the account form down with it.
class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <ScenePlaceholder /> : this.props.children; }
}

export function AuthLanding() {
  const root = useRef<HTMLElement>(null);
  const authArea = useRef<HTMLElement>(null);
  const motion = useRef<SceneMotion>({ progress: 0 });
  const focusDestination = useRef<number | null>(null);

  useEffect(() => {
    const focusAccount = () => {
      const destination = focusDestination.current;
      focusDestination.current = null;
      if (destination !== null && Math.abs(window.scrollY - destination) < 5 && !authArea.current?.inert) {
        authArea.current?.focus({ preventScroll: true });
      }
    };
    window.addEventListener('scrollend', focusAccount);
    return () => window.removeEventListener('scrollend', focusAccount);
  }, []);

  useGSAP(() => {
    const page = root.current!;
    const panel = authArea.current!;
    const media = gsap.matchMedia();
    media.add({ all: '(min-width: 0px)', desktop: '(min-width: 901px) and (min-height: 701px)', reduce: '(prefers-reduced-motion: reduce)' }, context => {
      const { desktop, reduce } = context.conditions!;
      if (!desktop || reduce) {
        page.dataset.layout = 'stacked';
        panel.inert = false;
        motion.current.progress = reduce ? 0.65 : 0;
        if (!reduce) {
          gsap.to(motion.current, { progress: 0.85, ease: 'none', scrollTrigger: {
            trigger: '.landing-visual', start: 'top 55%', end: 'bottom 20%', scrub: 0.3,
          }, onUpdate: () => motion.current.invalidate?.() });
          gsap.fromTo('.landing-auth-card', { y: 24, opacity: 0.4 }, { y: 0, opacity: 1, duration: 0.5,
            scrollTrigger: { trigger: panel, start: 'top 90%', toggleActions: 'play none none reverse' } });
        }
        motion.current.invalidate?.();
        return;
      }
      page.dataset.layout = 'desktop';
      panel.inert = true;
      const timeline = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: {
        trigger: '.landing-scroll-track', start: 'top top', end: 'bottom bottom', scrub: 0.55,
        invalidateOnRefresh: true,
      }, onUpdate: () => {
        motion.current.invalidate?.();
        const canUsePanel = timeline.progress() > 0.58;
        // Invisible forms must never be reachable through keyboard navigation.
        panel.inert = !canUsePanel;
        if (!canUsePanel && panel.contains(document.activeElement)) {
          page.querySelector<HTMLAnchorElement>('.landing-home')?.focus({ preventScroll: true });
        }
      } });
      timeline.to(motion.current, { progress: 1, duration: 1 }, 0)
        .to('.landing-hero-copy', { autoAlpha: 0, y: -32, duration: 0.25 }, 0.06)
        .to('.landing-visual', { x: () => -page.clientWidth * 0.42, duration: 0.7, ease: 'sine.inOut' }, 0.12)
        .to('.landing-orbit', { scale: 0.82, duration: 0.7 }, 0.12)
        .to('.landing-scene-label', { autoAlpha: 0, duration: 0.2 }, 0.12)
        .fromTo('.landing-story-copy', { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.24 }, 0.32)
        .fromTo(panel, { xPercent: 100 }, { xPercent: 0, duration: 0.66, ease: 'sine.inOut' }, 0.22)
        .fromTo('.landing-auth-card', { autoAlpha: 0, y: 28, scale: 0.97 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.48 }, 0.42)
        .to('.landing-scroll-cue', { autoAlpha: 0, duration: 0.15 }, 0.1)
        .fromTo('.landing-progress-fill', { scaleX: 0 }, { scaleX: 1, duration: 1 }, 0);
      return () => { panel.inert = false; };
    });
    return () => { media.revert(); panel.inert = false; };
  }, { scope: root });

  function goToAccount(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    const page = root.current!;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const track = page.querySelector<HTMLElement>('.landing-scroll-track')!;
    const top = page.dataset.layout === 'desktop'
      ? track.getBoundingClientRect().top + window.scrollY + track.offsetHeight - window.innerHeight
      : authArea.current!.getBoundingClientRect().top + window.scrollY - 20;
    focusDestination.current = top;
    if (Math.abs(window.scrollY - top) < 5 || reduce) {
      window.scrollTo({ top, behavior: 'instant' });
      authArea.current?.focus({ preventScroll: true });
      focusDestination.current = null;
    } else {
      window.scrollTo({ top, behavior: 'smooth' });
    }
  }

  return <main ref={root} className="landing-page">
    <div className="landing-scroll-track">
      <div className="landing-stage">
        <header className="landing-header">
          <a className="landing-home" href="#" aria-label="CullPilot 首页" onClick={event => { event.preventDefault(); window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }); }}>
            <img src={logo} alt="CullPilot" />
          </a>
          <span className="landing-header-description">为每一次拍摄，找到值得留下的画面。</span>
        </header>

        <section className="landing-hero-copy" aria-labelledby="landing-title">
          <div className="landing-product-label"><span />你的智能选片工作台</div>
          <h1 id="landing-title">快门之后，<br />精彩才刚开始。</h1>
          <p>把成百上千次快门，整理成真正想留下的画面。<br className="landing-desktop-break" />CullPilot 陪你浏览、比较、复核，<br className="landing-desktop-break" />让每一次拍摄，都有一个漂亮的收尾。</p>
          <a className="landing-button landing-start" href="#landing-account" onClick={goToAccount}>开始选片<ArrowRight size={18} aria-hidden="true" /></a>
          <span className="landing-hero-footnote">专属工作区 · 人工复核 · 精选导出</span>
        </section>

        <div className="landing-visual">
          <div className="landing-orbit" aria-hidden="true"><span /><span /></div>
          <SceneBoundary><Suspense fallback={<ScenePlaceholder />}><PhotoScene motion={motion} /></Suspense></SceneBoundary>
          <div className="landing-scene-label" aria-hidden="true"><span />每个画面，都是一种可能</div>
        </div>

        <section className="landing-story-copy" aria-label="CullPilot 选片流程">
          <p className="landing-story-kicker">从一叠照片，到一组精选。</p>
          <h2>少一些犹豫，<br />多一些心动。</h2>
          <p>集中浏览，相互比较。<br />CullPilot 帮你整理，最后的决定始终在你。</p>
        </section>

        <div className="landing-scroll-cue" aria-hidden="true"><span className="landing-scroll-icon"><ArrowDown size={16} /></span><span>向下滚动，看看精彩如何归拢</span></div>
        <div className="landing-stage-footer"><span>你的视角，始终是主角。</span><span className="landing-progress" aria-hidden="true"><span className="landing-progress-fill" /></span><span>CullPilot / 选片，从容一点。</span></div>

        <section ref={authArea} id="landing-account" className="landing-account" aria-label="登录或注册 CullPilot" tabIndex={-1}>
          <div className="landing-account-inner"><div className="landing-account-label"><span />你的下一组精选，从这里开始</div><AuthPanel /></div>
        </section>
      </div>
    </div>
    <section className="landing-mobile-story" aria-label="你的选片流程">
      <div><Images size={18} /><span>导入一次拍摄</span><p>照片集中放进专属工作区。</p></div>
      <div><SlidersHorizontal size={18} /><span>比较与复核</span><p>逐张查看，保留或舍弃由你决定。</p></div>
      <div><FolderOpen size={18} /><span>带走你的精选</span><p>把决定留下的画面整理导出。</p></div>
    </section>
    <footer className="landing-end"><img src={logo} alt="CullPilot" /><p>每一次拍摄，都值得好好收尾。</p></footer>
  </main>;
}
