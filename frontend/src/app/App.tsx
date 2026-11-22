import { useCallback, useEffect, useRef, useState } from 'react';
import type { ApiList, AppState, Movement, Product, Supply } from '../types';
import type { AppActions, ScreenName } from './types';
import { api, configureApi, isNetworkError } from '../services/api';
import { initialState, persist, read, remove, write } from '../services/storage';
import { useHashRoute } from '../features/useHashRoute';
import { Login } from '../features/auth/Login';
import { ScreenRouter } from '../features';
import { menu } from './navigation';
import { icon, pendingCount } from './utils';

type ThemeName = 'field' | 'harvest' | 'ocean' | 'terracotta';
type ThemeMode = 'system' | 'light' | 'dark';
interface ToastMessage { id: number; text: string; error?: boolean }

export function App() {
  const [state, setState] = useState<AppState>(initialState);
  const [toastValue, setToastValue] = useState<ToastMessage | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreDialog = useRef<HTMLDialogElement>(null);
  const route = useHashRoute();
  const [theme, setTheme] = useState<ThemeName>(() => read('theme', 'field'));
  const [mode, setMode] = useState<ThemeMode>(() => read('themeMode', 'system'));
  const update = useCallback((mutate: (draft: AppState) => void) => setState(previous => {
    const next = structuredClone(previous);
    mutate(next);
    persist(next);
    return next;
  }), []);
  const toast = useCallback((text: string, error = false) => {
    const id = Date.now();
    setToastValue({ id, text, error });
    window.setTimeout(() => setToastValue(current => current?.id === id ? null : current), 3500);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.mode = mode;
    write('theme', theme); write('themeMode', mode);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'harvest' ? '#8c4a16' : theme === 'ocean' ? '#176b78' : theme === 'terracotta' ? '#9a4638' : '#287449');
  }, [theme, mode]);
  useEffect(() => { configureApi(state.tok, token => update(draft => { draft.tok = token; }), () => {
    remove('tok'); remove('me');
    update(draft => { draft.tok = null; draft.me = null; });
  }); }, [state.tok, update]);
  const syncRef = useRef<(show?: boolean) => Promise<void>>(async () => undefined);
  const syncLock = useRef(false);
  useEffect(() => {
    const online = () => { update(draft => { draft.online = true; }); void syncRef.current(false); };
    const offline = () => update(draft => { draft.online = false; });
    window.addEventListener('online', online); window.addEventListener('offline', offline);
    return () => { window.removeEventListener('online', online); window.removeEventListener('offline', offline); };
  }, [update]);
  const sync = useCallback(async (show = false) => {
    if (syncLock.current || state.busy || !state.tok) return;
    syncLock.current = true;
    update(draft => { draft.busy = true; });
    try {
      for (const key of ['clientes', 'ventas', 'desempenos'] as const) {
        const batch = state.q[key].slice(0, 500);
        if (!batch.length) continue;
        const response = await api<{ resultados: { id: string; status: string; errors?: Record<string, unknown> }[] }>(`/sync/${key}/bulk/`, { method: 'POST', body: { [key]: batch } });
        const successful = new Set(response.resultados.filter(item => item.status !== 'error').map(item => item.id));
        update(draft => {
          response.resultados.filter(item => item.status === 'error').forEach(item => {
            draft.errs[item.id] = `${key}: ${Object.entries(item.errors ?? {}).map(([field, error]) => `${field} ${JSON.stringify(error)}`).join('; ')}`;
          });
          successful.forEach(id => delete draft.errs[id]);
          draft.q[key] = draft.q[key].filter(item => !successful.has(item.id)) as never;
        });
      }
      const catalog = await api<Partial<AppState['cat']> & { server_time?: string }>('/sync/catalogo/' + (state.catTime ? `?updated_since=${encodeURIComponent(state.catTime)}` : ''));
      update(draft => {
        for (const key of ['clientes', 'productos', 'trabajadores'] as const) {
          const records = catalog[key];
          if (!records) continue;
          const base = draft.catTime ? draft.cat[key] : key === 'clientes' ? draft.q.clientes : [];
          const map = new Map(base.map(item => [item.id, item]));
          records.forEach((item: { id: string; is_deleted?: boolean }) => item.is_deleted ? map.delete(item.id) : map.set(item.id, item as never));
          draft.cat[key] = [...map.values()] as never;
        }
        if (catalog.server_time) draft.catTime = catalog.server_time;
        draft.last = Date.now(); draft.online = true; draft.busy = false;
      });
      if (show) toast('Sincronizado');
    } catch (error) {
      update(draft => { draft.busy = false; if (isNetworkError(error)) draft.online = false; });
      if (show) toast(isNetworkError(error) ? 'Sin conexión: se enviará más tarde' : error instanceof Error ? error.message : 'Error de sincronización', true);
    } finally {
      syncLock.current = false;
    }
  }, [state.busy, state.tok, state.q, state.catTime, update, toast]);
  syncRef.current = sync;
  useEffect(() => {
    if (!state.tok) return;
    const timer = window.setInterval(() => { if (pendingCount(state) && navigator.onLine) void syncRef.current(false); }, 60000);
    return () => window.clearInterval(timer);
  }, [state.tok, state.q]);
  useEffect(() => { if (state.tok && state.me) void sync(false); }, [state.me?.id]);
  const refreshInventory = useCallback(async () => {
    if (!state.online || state.busy) return;
    try {
      const [products, supplies, movements] = await Promise.all([
        api<ApiList<Product>>('/productos/?limit=500'),
        state.me?.rol === 'ADMIN' || state.me?.rol === 'SUPERVISOR' ? api<ApiList<Supply>>('/insumos/?limit=200') : Promise.resolve({ results: [] }),
        state.me?.rol === 'ADMIN' ? api<ApiList<Movement>>('/movimientos/?limit=15') : Promise.resolve({ results: [] }),
      ]);
      update(draft => { draft.cat.productos = products.results; draft.ins = supplies.results; });
      setInventoryMovements(movements.results);
    } catch { /* cached catalog remains usable offline */ }
  }, [state.online, state.busy, state.me?.rol, update]);
  const [inventoryMovements, setInventoryMovements] = useState<Movement[]>([]);
  useEffect(() => { if ('serviceWorker' in navigator) void navigator.serviceWorker.register('/sw.js').catch(() => undefined); }, []);
  const logout = (force = false) => {
    if (!force && pendingCount(state) && !window.confirm('Hay datos sin enviar. Se conservarán en este teléfono. ¿Cerrar sesión?')) return;
    remove('tok'); remove('me');
    update(draft => { draft.tok = null; draft.me = null; });
    location.hash = '';
  };
  const actions: AppActions = { state, update, toast, sync, refreshInventory };
  if (!state.tok || !state.me) return <Login onLogin={(token, user) => {
    write('tok', token); write('me', user);
    update(draft => { draft.tok = token; draft.me = user; draft.catTime = null; });
  }} />;
  const role = state.me.rol;
  const routeId: ScreenName = route.screen === 'venta' || route.screen === 'nueva-venta' ? 'ventas' : route.screen;
  const availableMenu = menu.filter(item => !item.roles || item.roles.includes(role));
  const selectedMenu = availableMenu.find(item => item.id === routeId);
  const primaryIds: ScreenName[] = ['inicio', 'ventas', 'inventario', 'clientes', 'terreno', 'despachos', 'equipo', 'finanzas', 'nomina'];
  const mobilePrimary = primaryIds.map(id => availableMenu.find(item => item.id === id)).filter(item => item !== undefined).slice(0, 4);
  const mobileMore = availableMenu.filter(item => !mobilePrimary.includes(item));
  if (route.screen !== 'inicio' && (!selectedMenu || (selectedMenu.roles && !selectedMenu.roles.includes(role)))) {
    location.hash = '#/inicio';
    return null;
  }
  const screenTitle = route.screen === 'venta' ? 'Detalle de venta' : route.screen === 'nueva-venta' ? 'Nueva venta' : selectedMenu?.label ?? 'Inicio';
  return <>
    <div className="shell">
      <aside className="side">
        <div className="brand"><img src="/static/icons/logo.png" alt="" style={{ height: 28, verticalAlign: 'middle' }} /> AgroQuiriquina</div>
        <nav className="desktop-nav" aria-label="Navegación principal">{availableMenu.map(item =>
          <a key={item.id} href={`#/${item.id}`} className={routeId === item.id ? 'on' : ''} aria-current={routeId === item.id ? 'page' : undefined}>
            <b>{icon(item.icon)}</b><span>{item.label}</span>
          </a>)}</nav>
        <nav className="mobile-nav" aria-label="Navegación principal">
          {mobilePrimary.map(item =>
            <a key={item.id} href={`#/${item.id}`} className={routeId === item.id ? 'on' : ''} aria-current={routeId === item.id ? 'page' : undefined}>
              <b>{icon(item.icon)}</b><span>{item.label}</span>
            </a>)}
          {!!mobileMore.length && <button type="button" className={mobileMore.some(item => item.id === routeId) ? 'on' : ''} aria-haspopup="dialog" aria-expanded={moreOpen} onClick={() => {
            setMoreOpen(true);
            if (moreDialog.current && !moreDialog.current.open) moreDialog.current.showModal();
          }}>
            <b>{icon('three-dots')}</b><span>Más</span>
          </button>}
        </nav>
      </aside>
      <div className="cont">
        <header className="top">
          <div id="crumb">AgroQuiriquina / <b>{screenTitle}</b></div>
          <div className="top-tools">
            <button type="button" id="st" className="status" title="Sincronizar ahora" aria-label="Estado de sincronización. Sincronizar ahora" onClick={() => void sync(true)}>
              {state.busy ? icon('hourglass-split') : state.online ? icon('wifi') : icon('wifi-off')}
              {pendingCount(state) ? `${pendingCount(state)} pendiente(s)` : state.online ? 'En línea' : 'Sin conexión'}
            </button>
            <label className="visually-hidden" htmlFor="theme">Paleta de colores</label>
            <select id="theme" className="theme-picker" value={theme} onChange={event => setTheme(event.target.value as ThemeName)}>
              <option value="field">Campo</option><option value="harvest">Cosecha</option><option value="ocean">Agua</option><option value="terracotta">Tierra</option>
            </select>
            <label className="visually-hidden" htmlFor="theme-mode">Modo de color</label>
            <select id="theme-mode" className="theme-picker theme-mode" value={mode} onChange={event => setMode(event.target.value as ThemeMode)}>
              <option value="system">Sistema</option><option value="light">Claro</option><option value="dark">Oscuro</option>
            </select>
            <button type="button" className="btn sm sec" onClick={() => logout()} style={{ margin: 0 }}>Salir</button>
          </div>
        </header>
        <main key={`${route.screen}-${route.arg}`}>
          <ScreenRouter {...actions} route={route} movements={inventoryMovements} />
        </main>
      </div>
    </div>
    <dialog ref={moreDialog} className="mobile-more-dialog" aria-labelledby="more-title" onClose={() => setMoreOpen(false)} onCancel={() => setMoreOpen(false)} onClick={event => {
      if (event.target === event.currentTarget) moreDialog.current?.close();
    }}>
      <div className="mobile-more-heading">
        <h2 id="more-title">Más secciones</h2>
        <button type="button" className="icon-button" aria-label="Cerrar menú" autoFocus onClick={() => moreDialog.current?.close()}>{icon('x-lg')}</button>
      </div>
      <nav aria-label="Más secciones">{mobileMore.map(item =>
        <a key={item.id} href={`#/${item.id}`} className={routeId === item.id ? 'on' : ''} aria-current={routeId === item.id ? 'page' : undefined} onClick={() => moreDialog.current?.close()}>
          <b>{icon(item.icon)}</b><span>{item.label}</span>
        </a>)}</nav>
    </dialog>
    <div id="toast" role="status" aria-live="polite" style={{ display: toastValue ? 'block' : 'none' }}>
      {toastValue && <>{icon(toastValue.error ? 'exclamation-triangle' : 'check-circle')} {toastValue.text}</>}
    </div>
  </>;
}
