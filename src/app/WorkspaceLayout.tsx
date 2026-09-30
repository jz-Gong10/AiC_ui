import { Children, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type FormEvent, type PointerEvent, type ReactNode } from 'react';
import { GripHorizontal, GripVertical } from 'lucide-react';
import { platform } from '../platform/platform';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
function useSize(key: string, fallback: number, min: number, max: number) {
  const [value, setValue] = useState(() => {
    const saved = platform.readPreference(key);
    const number = saved === null ? NaN : Number(saved);
    return Number.isFinite(number) ? clamp(number, min, max) : fallback;
  });
  useEffect(() => { platform.writePreference(key, String(value)); }, [key, value]);
  return [value, setValue] as const;
}

// Pointer capture keeps dragging active outside the small handle and releases
// automatically on pointerup/cancel without document-level event listeners.
function useResizeDrag(start: (event: PointerEvent<HTMLButtonElement>) => (event: PointerEvent<HTMLButtonElement>) => void) {
  const drag = useRef<{ pointerId: number; move: (event: PointerEvent<HTMLButtonElement>) => void } | null>(null);
  const [dragging, setDragging] = useState(false);
  function finish(event: PointerEvent<HTMLButtonElement>) {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
    setDragging(false);
  }
  return {
    'data-dragging': dragging,
    onPointerDown(event: PointerEvent<HTMLButtonElement>) {
      if (!event.isPrimary || event.button !== 0) return;
      event.preventDefault();
      event.currentTarget.focus();
      event.currentTarget.setPointerCapture(event.pointerId);
      drag.current = { pointerId: event.pointerId, move: start(event) };
      setDragging(true);
    },
    onPointerMove(event: PointerEvent<HTMLButtonElement>) {
      if (drag.current?.pointerId === event.pointerId) drag.current.move(event);
    },
    onPointerUp: finish,
    onPointerCancel: finish,
    onLostPointerCapture: finish,
  };
}

export function Workbench({ children }: { children: ReactNode }) {
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1000);
  const [share, setShare] = useSize('cullpilot.chat-share.v1', 34, 20, 60);
  const [height, setHeight] = useSize('cullpilot.chat-panel-height.v1', 380, 280, 800);
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 650px)').matches);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 650px)');
    const changed = () => setMobile(media.matches);
    media.addEventListener('change', changed);
    return () => media.removeEventListener('change', changed);
  }, []);
  useLayoutEffect(() => {
    const element = container.current!;
    const measure = () => setWidth(element.clientWidth);
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    return () => observer.disconnect();
  }, []);
  function bounds() {
    return { min: 240 / width * 100, max: Math.min(60, (width - 320 - 8) / width * 100) };
  }
  function resize(value: number) {
    if (mobile) setHeight(clamp(value, 280, 800));
    else { const { min, max } = bounds(); setShare(clamp(value, min, max)); }
  }
  const drag = useResizeDrag(event => {
    const rect = container.current!.getBoundingClientRect();
    const initial = container.current!.firstElementChild!.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    return next => resize(mobile ? initial.height + next.clientY - startY : (initial.width + next.clientX - startX) / rect.width * 100);
  });
  const panels = Children.toArray(children);
  const displayedShare = mobile ? share : clamp(share, bounds().min, bounds().max);
  return <div ref={container} className="workbench resizable-workbench" style={{ '--chat-share': `${displayedShare}%`, '--chat-panel-height': `${height}px` } as CSSProperties}>
    {panels[0]}
    <button type="button" className="workspace-divider" role="separator" aria-label="调整对话区与素材区比例" aria-orientation={mobile ? 'horizontal' : 'vertical'} aria-valuemin={mobile ? 280 : Math.round(bounds().min)} aria-valuemax={mobile ? 800 : Math.round(bounds().max)} aria-valuenow={Math.round(mobile ? height : displayedShare)} aria-valuetext={mobile ? `对话区高度 ${Math.round(height)} 像素` : `对话区宽度 ${Math.round(displayedShare)}%`} title={mobile ? '上下拖动调整对话区高度' : '左右拖动调整对话区与素材区比例'} {...drag} onKeyDown={event => {
      const decrease = mobile ? 'ArrowUp' : 'ArrowLeft';
      const increase = mobile ? 'ArrowDown' : 'ArrowRight';
      if (event.key === decrease || event.key === increase) {
        event.preventDefault();
        resize((mobile ? height : displayedShare) + (event.key === increase ? 1 : -1) * (mobile ? 20 : 2));
      } else if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        resize(mobile ? (event.key === 'Home' ? 280 : 800) : bounds()[event.key === 'Home' ? 'min' : 'max']);
      }
    }}>{mobile ? <GripHorizontal size={16} /> : <GripVertical size={16} />}</button>
    {panels[1]}
  </div>;
}

export function ResizableComposer({ children, onSubmit }: { children: ReactNode; onSubmit: (event: FormEvent) => void }) {
  const form = useRef<HTMLFormElement>(null);
  const [height, setHeight] = useSize('cullpilot.composer-height.v1', 70, 42, 320);
  const [limit, setLimit] = useState(320);
  useLayoutEffect(() => {
    const panel = form.current?.closest('.chat-panel');
    if (!panel) return;
    const measure = () => {
      const heading = panel.querySelector('.panel-heading')?.getBoundingClientRect().height || 0;
      const hint = panel.querySelector('.chat-hint')?.getBoundingClientRect().height || 0;
      setLimit(clamp(panel.clientHeight - heading - hint - 150, 42, 320));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(panel);
    const hint = panel.querySelector('.chat-hint');
    if (hint) observer.observe(hint);
    measure();
    return () => observer.disconnect();
  }, []);
  const displayedHeight = Math.min(height, limit);
  const drag = useResizeDrag(event => {
    const startY = event.clientY;
    const initial = form.current!.querySelector('textarea')!.getBoundingClientRect().height;
    return next => setHeight(clamp(initial + startY - next.clientY, 42, limit));
  });
  return <form ref={form} className="composer resizable-composer" onSubmit={onSubmit} style={{ '--composer-height': `${displayedHeight}px` } as CSSProperties}>
    <button type="button" className="composer-resize" role="separator" aria-label="调整输入框高度" aria-orientation="horizontal" aria-valuemin={42} aria-valuemax={Math.round(limit)} aria-valuenow={Math.round(displayedHeight)} title="向上拖动增高，向下拖动减小高度" {...drag} onKeyDown={event => {
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        event.preventDefault();
        setHeight(clamp(displayedHeight + (event.key === 'ArrowUp' ? 20 : -20), 42, limit));
      } else if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        setHeight(event.key === 'Home' ? 42 : limit);
      }
    }}><GripHorizontal size={16} /></button>
    {children}
  </form>;
}
