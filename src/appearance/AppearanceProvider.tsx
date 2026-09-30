import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { platform } from '../platform/platform';
import { transitionView } from '../shared/viewTransition';

export const colors: Array<[string, number]> = [
  ['领航蓝', 221], ['晴空蓝', 209], ['冰川蓝', 194], ['青瓷', 176], ['薄荷', 151],
  ['翡翠', 154], ['鼠尾草', 109], ['春芽', 89], ['鸢尾', 249], ['薰衣草', 269],
  ['兰花', 307], ['蔷薇', 337], ['珊瑚', 7], ['桃杏', 18], ['日落橙', 25],
  ['琥珀', 39], ['麦金', 48], ['柠檬', 64], ['橄榄', 79], ['苔绿', 140],
  ['沙岩', 33], ['陶土', 17], ['雾灰蓝', 204], ['银灰', 224], ['暖石', 28],
];
export const styles = [
  ['flat', '平面标准'], ['outline', '线框轻量'], ['rounded', '圆润胶囊'],
  ['compact', '紧凑工具'], ['soft', '柔和填充'], ['elevated', '悬浮卡片'],
  ['glass', '轻玻璃'], ['inset', '内嵌柔塑'], ['bold', '粗线硬朗'],
  ['editorial', '编辑排版'], ['technical', '技术面板'], ['material', '分层纸片'],
  ['retro', '复古终端'], ['minimal', '极简留白'], ['contrast', '清晰高对比'],
] as const;
export type Layout = 'overview' | 'focus' | 'compare';
export type ThemeMode = 'light' | 'dark' | 'system';
interface Appearance { mode: ThemeMode; color: number; style: string; layout: Layout }
interface AppearanceContextValue extends Omit<Appearance, 'mode'> {
  mode: 'light' | 'dark';
  modePreference: ThemeMode;
  setMode(value: Appearance['mode']): void;
  setColor(value: number): void;
  setStyle(value: string): void;
  setLayout(value: Layout): void;
}
const KEY = 'cullpilot.appearance.v1';
const defaults: Appearance = { mode: 'light', color: 0, style: 'flat', layout: 'overview' };
function initial(): Appearance {
  try {
    const value = JSON.parse(platform.readPreference(KEY) || 'null') as Partial<Appearance> | null;
    if (!value) return defaults;
    return {
      mode: value.mode === 'dark' || value.mode === 'system' ? value.mode : 'light',
      color: Number.isInteger(value.color) && value.color! >= 0 && value.color! < colors.length ? value.color! : 0,
      style: styles.some(item => item[0] === value.style) ? value.style! : 'flat',
      layout: value.layout === 'focus' || value.layout === 'compare' ? value.layout : 'overview',
    };
  } catch { return defaults; }
}
const Context = createContext<AppearanceContextValue | null>(null);
export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Appearance>(initial);
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  const mode = state.mode === 'system' ? (systemDark ? 'dark' : 'light') : state.mode;
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);
  useEffect(() => {
    platform.writePreference(KEY, JSON.stringify(state));
    const root = document.documentElement;
    root.dataset.mode = mode;
    root.dataset.modePreference = state.mode;
    root.dataset.style = state.style;
    root.dataset.layout = state.layout;
    const hue = colors[state.color][1];
    root.style.setProperty('--accent', `hsl(${hue} ${state.color >= 20 ? 28 : 55}% ${mode === 'dark' ? 75 : 36}%)`);
    root.style.setProperty('--accent-soft', `hsl(${hue} 65% ${mode === 'dark' ? 21 : 94}%)`);
  }, [state, mode]);
  return <Context.Provider value={{ ...state, mode, modePreference: state.mode,
    setMode: mode => setState(current => ({ ...current, mode })),
    setColor: color => setState(current => ({ ...current, color })),
    setStyle: style => setState(current => ({ ...current, style })),
    setLayout: layout => transitionView('gallery', () => setState(current => ({ ...current, layout }))),
  }}>{children}</Context.Provider>;
}
export function useAppearance() { const context = useContext(Context); if (!context) throw new Error('AppearanceProvider is required'); return context; }
