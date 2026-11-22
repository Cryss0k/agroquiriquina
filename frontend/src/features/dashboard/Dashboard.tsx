import type { AppState, HistoryItem } from '../../types';
import type { AppActions, ScreenName } from '../../app/types';
import { formatDate, formatMoney, icon, initials, localDate, lowStock, pendingCount, sumSale } from '../../app/utils';
import { menu } from '../../app/navigation';

export function Dashboard({ state, sync, update }: AppActions) {
  const isAllowed = (name: ScreenName) => {
    const item = menu.find(entry => entry.id === (name === 'nueva-venta' ? 'ventas' : name));
    return !item?.roles || item.roles.includes(state.me!.rol);
  };
  const queued = new Set(state.q.ventas.map(sale => sale.id));
  const sales = [
    ...state.q.ventas.slice().reverse().map(sale => ({ id: sale.id, client: state.cat.clientes.find(c => c.id === sale.cliente)?.nombre ?? 'Cliente', date: sale.fecha, total: sumSale(sale), status: 'env', review: false })),
    ...state.ventas.filter(sale => !queued.has(sale.id)).map(sale => ({ id: sale.id, client: state.cat.clientes.find(c => c.id === sale.cliente)?.nombre ?? 'Cliente', date: sale.fecha, total: Number(sale.total), status: sale.estado === 'ANULADA' ? 'anu' : sale.estado_pago === 'PAGADO' ? 'pag' : sale.estado_pago === 'PARCIAL' ? 'par' : 'cob', review: !!sale.requiere_revision })),
  ];
  const lowProducts = state.cat.productos.filter(lowStock).length;
  const percentage = state.cat.productos.length ? Math.round((100 * (state.cat.productos.length - lowProducts)) / state.cat.productos.length) : 100;
  const todaySales = sales.filter(sale => sale.status !== 'anu' && sale.date.slice(0, 10) === localDate()).reduce((sum, sale) => sum + sale.total, 0);
  const pendingReceivables = sales.filter(sale => ['cob', 'par'].includes(sale.status)).length;
  const shortcuts = ([
    ['nueva-venta', 'receipt', 'Nueva venta', 150], ['terreno', 'tree', 'Registrar trabajo', 130],
    ['inventario', 'box-seam', 'Ver stock', 35], ['clientes', 'people', 'Clientes', 210],
    ['finanzas', 'cash-coin', 'Por cobrar', 45], ['nomina', 'person-lines-fill', 'Nómina', 270],
  ] as [ScreenName, string, string, number][]).filter(([screen]) => isAllowed(screen));
  const metrics = [
    ...(isAllowed('ventas') ? [['Vendido hoy', formatMoney(todaySales)], ['Ventas por cobrar', String(pendingReceivables)]] : []),
    ['Por enviar', String(pendingCount(state))], ['Productos con stock bajo', String(lowProducts)],
  ];
  return <>
    {Object.keys(state.errs).length > 0 && <section className="card">
      <h2>{icon('exclamation-triangle')} {Object.keys(state.errs).length} registro(s) con error</h2>
      {Object.values(state.errs).slice(0, 3).map((error, index) => <p key={index}><small>{error}</small></p>)}
      <button className="btn red sm" onClick={() => update(draft => {
        const ids = new Set(Object.keys(draft.errs));
        draft.q.clientes = draft.q.clientes.filter(item => !ids.has(item.id));
        draft.q.ventas = draft.q.ventas.filter(item => !ids.has(item.id));
        draft.q.desempenos = draft.q.desempenos.filter(item => !ids.has(item.id));
        draft.errs = {};
      })}>Descartar los que tienen error</button>
    </section>}
    <div className="tiles">{shortcuts.map(([screen, iconName, label, hue]) =>
      <a key={screen} className="tile" href={`#/${screen}`} style={{ ['--h' as string]: hue }}><i>{icon(iconName)}</i>{label}</a>)}</div>
    <div className="kpis">{metrics.map(([label, value]) => <div key={label} className="kpi"><span>{label}</span><b>{value}</b></div>)}</div>
    <div className="cols">
      <section className="card"><div className="ph"><div><h2>Estado de la bodega</h2><small>{lowProducts ? `${lowProducts} producto(s) bajo el mínimo` : 'Todo el stock en buen nivel'}</small></div></div>
        <svg className="ring" viewBox="0 0 120 120" role="img" aria-label={`${percentage}% del stock en buen nivel`}>
          <circle cx="60" cy="60" r="52" fill="none" stroke="var(--line)" strokeWidth="10" />
          <circle cx="60" cy="60" r="52" fill="none" stroke="var(--ac)" strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(3.267 * percentage).toFixed(1)} 400`} transform="rotate(-90 60 60)" />
          <text x="60" y="69" textAnchor="middle">{percentage}%</text>
        </svg>
        <p style={{ textAlign: 'center' }}><small>Última sincronización:<br />{state.last ? new Date(state.last).toLocaleString('es-CL') : 'nunca'}</small></p>
        <button className="btn" onClick={() => void sync(true)}>{icon('arrow-repeat')} Sincronizar ahora</button>
      </section>
      <section className="card">
        {isAllowed('ventas') ? <>
          <div className="ph"><div><h2>Ventas recientes</h2><small>{sales.length} registradas en este equipo</small></div><a className="btn sm" href="#/nueva-venta">Nueva venta</a></div>
          <SaleHeaders />{sales.slice(0, 6).map(sale => <SaleRow key={sale.id} sale={sale} />)}
          {!sales.length && <p><small>Aún no hay ventas. Registra la primera.</small></p>}<a className="btn sm sec" href="#/ventas">Ver todas</a>
        </> : <>
          <div className="ph"><div><h2>Trabajo registrado</h2><small>Últimos registros de terreno</small></div><a className="btn sm" href="#/terreno">Registrar trabajo</a></div>
          {state.hist.slice(0, 6).map(item => <HistoryRow key={item.id} item={item} state={state} />)}
          {!state.hist.length && <p><small>Aún no hay registros.</small></p>}
        </>}
      </section>
    </div>
  </>;
}

export function SaleHeaders() { return <div className="th"><span>Cliente</span><span>Total</span><span>Estado</span></div>; }
export function SaleRow({ sale }: { sale: { id: string; client: string; date: string; total: number; status: string; review?: boolean } }) {
  const status: Record<string, [string, string, string?]> = {
    env: ['Por enviar', ''], pag: ['Pagada', 'ok'], par: ['Abono', ''], cob: ['Por cobrar', ''], anu: ['Anulada', 'no'],
  };
  const [label, style, iconName] = status[sale.status] ?? status.cob;
  return <a className="tr sale-row" href={`#/venta/${sale.id}`}><span className="who"><i className="av">{initials(sale.client)}</i><span><b>{sale.client}</b><small>{formatDate(sale.date)}</small></span></span>
    <span className="num">{formatMoney(sale.total)}</span><span><span className={`bd ${style}`}>{iconName && icon(iconName)} {label}</span>{sale.review && <> <span className="bd no">Revisar stock</span></>}</span></a>;
}
export function HistoryRow({ item, state }: { item: HistoryItem; state: AppState }) {
  const queued = state.q.desempenos.some(work => work.id === item.id);
  return <div className="li"><span className="who"><i className="av">{initials(item.n)}</i><span><b>{item.n}</b><small>{item.l} · {item.c} {item.u} · {item.f}</small></span></span>
    <span className={`bd ${queued ? '' : 'ok'}`}>{queued ? 'Por enviar' : 'Enviado'}</span></div>;
}
