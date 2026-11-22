import type { AppState } from '../types';

export const read = <T>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(`aq_${key}`);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
};

export const write = (key: string, value: unknown): void => {
  try { localStorage.setItem(`aq_${key}`, JSON.stringify(value)); } catch { /* quota errors are reported by the app */ }
};

export const remove = (key: string): void => {
  try { localStorage.removeItem(`aq_${key}`); } catch { /* storage may be unavailable */ }
};

export const initialState = (): AppState => ({
  tok: read('tok', null),
  me: read('me', null),
  cat: read('cat', { clientes: [], productos: [], trabajadores: [] }),
  q: read('q', { clientes: [], ventas: [], desempenos: [] }),
  last: read('last', null),
  catTime: read('catTime', null),
  ventas: read('ventas', []),
  hist: read('hist', []),
  ins: read('ins', []),
  errs: read('errs', {}),
  online: navigator.onLine,
  busy: false,
});

export const persist = (state: AppState): void => {
  if (state.tok) write('tok', state.tok); else remove('tok');
  if (state.me) write('me', state.me); else remove('me');
  for (const key of ['cat', 'q', 'ventas', 'hist', 'ins', 'errs'] as const) write(key, state[key]);
  write('last', state.last);
  write('catTime', state.catTime);
};

export const uuid = (): string => crypto.randomUUID();
export const deviceId = (): string => {
  const found = read<string | null>('dev', null);
  if (found) return found;
  const created = uuid().slice(0, 8);
  write('dev', created);
  return created;
};
