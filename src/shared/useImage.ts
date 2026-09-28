import { useEffect, useState } from 'react';
import { api } from './api';

const cache = new Map<string, string>();
const pending = new Map<string, Promise<string>>();
export function clearImageCache() {
  cache.forEach(url => URL.revokeObjectURL(url));
  cache.clear();
  pending.clear();
}
export function useImage(path: string | null | undefined) {
  const [state, setState] = useState<{ path: string | null; url: string | null }>({ path: null, url: null });
  useEffect(() => {
    if (!path) return;
    if (cache.has(path)) return;
    let active = true;
    if (!pending.has(path)) pending.set(path, api.image(path).then(blob => {
      const url = URL.createObjectURL(blob);
      cache.set(path, url);
      pending.delete(path);
      return url;
    }).catch(error => { pending.delete(path); throw error; }));
    pending.get(path)!.then(url => { if (active) setState({ path, url }); }).catch(() => { if (active) setState({ path, url: null }); });
    return () => { active = false; };
  }, [path]);
  return path ? cache.get(path) || (state.path === path ? state.url : null) : null;
}
