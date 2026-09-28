export const demoAvailable = import.meta.env.DEV && ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
const DEMO_KEY = 'cullpilot.local-demo';

export function isDemoSession() {
  return demoAvailable && sessionStorage.getItem(DEMO_KEY) === '1';
}

export function setDemoSession(active: boolean) {
  if (!demoAvailable) return;
  if (active) sessionStorage.setItem(DEMO_KEY, '1');
  else sessionStorage.removeItem(DEMO_KEY);
}
