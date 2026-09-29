import { useEffect, useState } from 'react';
import { api } from './api';

const cache = new Map<string, string>();
const pending = new Map<string, Promise<string>>();
let cacheEpoch = 0;
function loadImage(path: string) {
  const cached = cache.get(path);
  if (cached) return Promise.resolve(cached);
  let request = pending.get(path);
  if (!request) {
    const epoch = cacheEpoch;
    const nextRequest = api.image(path).then(blob => {
      const url = URL.createObjectURL(blob);
      if (epoch !== cacheEpoch) { URL.revokeObjectURL(url); return ''; }
      cache.set(path, url);
      return url;
    }).finally(() => { if (pending.get(path) === nextRequest) pending.delete(path); });
    request = nextRequest;
    pending.set(path, request);
  }
  return request;
}

export async function warmThumbnails(paths: string[]) {
  const firstVisible = [...new Set(paths)].slice(0, 4);
  if (!firstVisible.length) return;
  await Promise.race([
    Promise.allSettled(firstVisible.map(loadImage)),
    new Promise<void>(resolve => window.setTimeout(resolve, 140)),
  ]);
}

export function clearImageCache() {
  cacheEpoch++;
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
    loadImage(path).then(url => { if (active) setState({ path, url }); }).catch(() => { if (active) setState({ path, url: null }); });
    return () => { active = false; };
  }, [path]);
  return path ? cache.get(path) || (state.path === path ? state.url : null) : null;
}
