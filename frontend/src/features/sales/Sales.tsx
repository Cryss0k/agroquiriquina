import { useEffect, useMemo, useState } from 'react';
import type { ApiList, QueuedSale, Sale } from '../../types';
import type { AppActions } from '../../app/types';
import { api } from '../../services/api';
import { deviceId, uuid } from '../../services/storage';
import { formatDate, formatMoney, icon, sumSale, localDate } from '../../app/utils';
import { SaleHeaders, SaleRow } from '../dashboard/Dashboard';
import { Skeletons } from '../../components/Skeletons';

export function Sales({ state, update }: AppActions) {
  const [filter, setFilter] = useState('todas');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(state.online && !state.busy && !state.ventas.length && !state.q.ventas.length);
  useEffect(() => {
    if (!state.online || state.busy) return;
    if (!state.ventas.length && !state.q.ventas.length) setLoading(true);
    const timer = window.setTimeout(() => {
      void api<ApiList<Sale>>('/ventas/?limit=40').then(result => update(draft => { draft.ventas = result.results; })).catch(() => undefined).finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  const sales = useMemo(() => {
    const queued = new Set(state.q.ventas.map(sale => sale.id));
    const rows = [
      ...state.q.ventas.slice().reverse().map(sale => ({ id: sale.id, client: state.cat.clientes.find(item => item.id === sale.cliente)?.nombre ?? 'Cliente', date: sale.fecha, total: sumSale(sale), status: 'env', review: false })),
      ...state.ventas.filter(sale => !queued.has(sale.id)).map(sale => ({ id: sale.id, client: state.cat.clientes.find(item => item.id === sale.cliente)?.nombre ?? 'Cliente', date: sale.fecha, total: Number(sale.total), status: sale.estado === 'ANULADA' ? 'anu' : sale.estado_pago === 'PAGADO' ? 'pag' : sale.estado_pago === 'PARCIAL' ? 'par' : 'cob', review: !!sale.requiere_revision })),
    ];
    return rows.filter(sale => (filter === 'todas' || filter === 'cobrar' && ['cob', 'par'].includes(sale.status) || filter === 'enviar' && sale.status === 'env') && sale.client.toLowerCase().includes(search.toLowerCase()));
  }, [state.q.ventas, state.ventas, state.cat.clientes, filter, search]);
  return <section className="card">
    <div className="ph"><div><h2>Ventas</h2><small>{sales.length} resultado(s)</small></div><a className="btn sm" href="#/nueva-venta">Nueva venta</a></div>
    <div className="chips">{[['todas', 'Todas'], ['cobrar', 'Por cobrar'], ['enviar', 'Por enviar']].map(([key, label]) =>
      <button key={key} className={`chip ${filter === key ? 'on' : ''}`} onClick={() => setFilter(key)}>{label}</button>)}</div>
    <label htmlFor="sale-search" className="visually-hidden">Buscar por cliente</label>
    <input id="sale-search" placeholder="Buscar por cliente" value={search} onChange={event => setSearch(event.target.value)} style={{ marginBottom: 12 }} />
    {loading && !state.ventas.length && !state.q.ventas.length ? <Skeletons count={3} /> : <>
      <SaleHeaders />{sales.map(sale => <SaleRow key={sale.id} sale={sale} />)}
      {!sales.length && <p><small>No hay ventas con este filtro.</small></p>}
    </>}
  </section>;
}

interface LineDraft { producto: string; nombre: string; cantidad: number; precio_unitario: number }
export function NewSale({ state, update, toast, sync }: AppActions) {
  const [client, setClient] = useState('');
  const [product, setProduct] = useState('');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [credit, setCredit] = useState(false);
  const [dueDate, setDueDate] = useState('');
  const [dispatch, setDispatch] = useState(false);
  const [dispatchDate, setDispatchDate] = useState(localDate());
  const [address, setAddress] = useState('');
  const [commune, setCommune] = useState('');
  const selectedProduct = state.cat.productos.find(item => item.id === product);
  useEffect(() => { setPrice(selectedProduct ? String(Math.round(Number(selectedProduct.precio_referencia))) : ''); }, [product]);
  const addLine = () => {
    const qty = Number(quantity); const unitPrice = Number(price);
    if (!selectedProduct || !(qty > 0) || !(unitPrice >= 0)) { toast('Indica producto, cantidad y precio', true); return; }
    setLines(current => [...current, { producto: selectedProduct.id, nombre: selectedProduct.nombre, cantidad: qty, precio_unitario: unitPrice }]);
    setQuantity('');
  };
  const saveSale = () => {
    if (!client) { toast('Elige un cliente', true); return; }
    if (!lines.length) { toast('Agrega productos', true); return; }
    if (dispatch && !address.trim()) { toast('Indica la dirección de despacho', true); return; }
    const total = Math.round(lines.reduce((sum, line) => sum + line.cantidad * line.precio_unitario, 0));
    const sale: QueuedSale = {
      id: uuid(), cliente: client, fecha: new Date().toISOString(), device_id: deviceId(),
      detalles: lines.map(line => ({ id: uuid(), producto: line.producto, cantidad: String(line.cantidad), precio_unitario: Math.round(line.precio_unitario) })),
      pagos: [{ id: uuid(), monto: total, estado: credit ? 'PENDIENTE' : 'PAGADO', metodo: credit ? 'CREDITO' : 'EFECTIVO', ...(credit && dueDate ? { fecha_vencimiento: dueDate } : {}) }],
      ...(dispatch ? { despacho: { id: uuid(), fecha: dispatchDate, direccion: address.trim(), comuna: commune.trim() } } : {}),
    };
    update(draft => {
      draft.q.ventas.push(sale);
      lines.forEach(line => { const item = draft.cat.productos.find(productItem => productItem.id === line.producto); if (item) item.cantidad_disponible = String(Math.max(0, Number(item.cantidad_disponible) - line.cantidad)); });
    });
    toast(`Venta guardada${state.online ? '' : ' (se enviará al tener conexión)'}`);
    location.hash = '#/ventas';
    void sync(false);
  };
  const total = lines.reduce((sum, line) => sum + line.cantidad * line.precio_unitario, 0);
  return <>
    <section className="card"><h2>Nueva venta</h2>
      <label htmlFor="sale-client">Cliente</label><select id="sale-client" value={client} onChange={e => setClient(e.target.value)}><option value="">Selecciona un cliente</option>{state.cat.clientes.map(item => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select>
      <small><a href="#/clientes">¿Cliente nuevo? Créalo aquí</a></small>
      <label htmlFor="sale-product">Producto</label><select id="sale-product" value={product} onChange={e => setProduct(e.target.value)}><option value="">Selecciona un producto</option>{state.cat.productos.map(item => <option key={item.id} value={item.id}>{item.nombre} ({Number(item.cantidad_disponible)} {item.unidad_medida})</option>)}</select>
      <div className="row"><div><label htmlFor="sale-quantity">Cantidad</label><input id="sale-quantity" type="number" inputMode="decimal" min="0" step="any" value={quantity} onChange={e => setQuantity(e.target.value)} /></div><div><label htmlFor="sale-price">Precio c/u</label><input id="sale-price" type="number" inputMode="numeric" min="0" value={price} onChange={e => setPrice(e.target.value)} /></div></div>
      <button className="btn sec" type="button" onClick={addLine}>{icon('plus-lg')} Agregar producto</button>
    </section>
    <section className="card" aria-live="polite">
      {lines.length ? <>{lines.map((line, index) => <div className="li" key={`${line.producto}-${index}`}><span>{line.nombre}<br /><small>{line.cantidad} × {formatMoney(line.precio_unitario)}</small></span>
        <span><b>{formatMoney(line.cantidad * line.precio_unitario)}</b> <button className="btn sm red" aria-label={`Quitar ${line.nombre}`} onClick={() => setLines(current => current.filter((_, itemIndex) => itemIndex !== index))}>{icon('x-lg')}</button></span></div>)}<p className="tot">Total: {formatMoney(total)}</p></> : <small>Agrega al menos un producto</small>}
    </section>
    <section className="card">
      <label htmlFor="payment-type">Forma de pago</label><select id="payment-type" value={credit ? 'C' : 'P'} onChange={e => setCredit(e.target.value === 'C')}><option value="P">Pagado ahora</option><option value="C">A crédito (queda por cobrar)</option></select>
      {credit && <><label htmlFor="due-date">Vence el</label><input id="due-date" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} /></>}
      <label><input type="checkbox" checked={dispatch} onChange={e => setDispatch(e.target.checked)} /> Programar despacho</label>
      {dispatch && <><label htmlFor="dispatch-date">Fecha</label><input id="dispatch-date" type="date" value={dispatchDate} onChange={e => setDispatchDate(e.target.value)} />
        <label htmlFor="dispatch-address">Dirección</label><input id="dispatch-address" value={address} onChange={e => setAddress(e.target.value)} />
        <label htmlFor="dispatch-commune">Comuna</label><input id="dispatch-commune" value={commune} onChange={e => setCommune(e.target.value)} /></>}
    </section>
    <button className="btn" onClick={saveSale}>{icon('check2-circle')} Guardar venta</button>
  </>;
}

export function SaleDetail({ state, update, toast, refreshInventory, id }: AppActions & { id: string }) {
  const cachedSale = state.q.ventas.find(item => item.id === id) ?? state.ventas.find(item => item.id === id) ?? null;
  const [sale, setSale] = useState<Sale | QueuedSale | null>(cachedSale);
  const [loading, setLoading] = useState(!cachedSale && !!id && state.online);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('EFECTIVO');
  useEffect(() => {
    const queued = state.q.ventas.find(item => item.id === id);
    if (queued) { setSale(queued); return; }
    if (!id) return;
    setLoading(true);
    void api<Sale>(`/ventas/${id}/`).then(value => {
      setSale(value);
      update(draft => { const index = draft.ventas.findIndex(item => item.id === id); if (index >= 0) draft.ventas[index] = value; else draft.ventas.unshift(value); });
    }).catch(() => {
      setSale(state.ventas.find(item => item.id === id) ?? null);
    }).finally(() => setLoading(false));
  }, [id]);
  const isQueued = !!state.q.ventas.some(item => item.id === id);
  const detail = sale as Sale | null;
  if (loading && !sale) return <Skeletons variant="detail" count={3} />;
  if (!sale) return <section className="card"><a className="btn sm sec" href="#/ventas">Volver</a><p>{state.online ? 'No se encontró la venta.' : 'Esta pantalla necesita conexión a internet.'}</p></section>;
  const clientName = state.cat.clientes.find(client => client.id === sale.cliente)?.nombre ?? 'Cliente';
  const productName = (productId: string) => state.cat.productos.find(product => product.id === productId)?.nombre ?? 'Producto';
  const total = 'total' in sale ? Number(sale.total) : sumSale(sale);
  const balance = 'saldo_pendiente' in sale ? Number(sale.saldo_pendiente) : total;
  const canceled = 'estado' in sale && sale.estado === 'ANULADA';
  const paid = total - balance;
  const paymentStatus = canceled ? ['Anulada', 'no'] : detail?.estado_pago === 'PAGADO' ? ['Pagada', 'ok'] : detail?.estado_pago === 'PARCIAL' ? ['Abono', ''] : isQueued ? ['Por enviar', ''] : ['Por cobrar', ''];
  const pay = async () => {
    const value = Math.round(Number(amount));
    if (!(value > 0)) { toast('Indica un monto mayor que 0', true); return; }
    if (value > balance) { toast('El abono supera el saldo pendiente', true); return; }
    try {
      await api('/pagos/', { method: 'POST', body: { id: uuid(), venta: id, monto: value, metodo: method, estado: 'PAGADO' } });
      toast('Abono registrado');
      setSale(await api<Sale>(`/ventas/${id}/`));
    } catch (error) { toast(error instanceof Error ? error.message : 'No fue posible registrar el abono', true); }
  };
  const cancel = async () => {
    if (!window.confirm('¿Anular esta venta? Se repondrá el stock y se anularán los pagos pendientes.')) return;
    try {
      await api(`/ventas/${id}/anular/`, { method: 'POST' });
      toast('Venta anulada'); await refreshInventory(); setSale(await api<Sale>(`/ventas/${id}/`));
    } catch (error) { toast(error instanceof Error ? error.message : 'No fue posible anular la venta', true); }
  };
  const review = async () => {
    try { await api(`/ventas/${id}/marcar-revisada/`, { method: 'POST' }); toast('Stock marcado como revisado'); setSale(await api<Sale>(`/ventas/${id}/`)); }
    catch (error) { toast(error instanceof Error ? error.message : 'No fue posible actualizar la venta', true); }
  };
  return <>
    <section className="card"><a className="btn sm sec" href="#/ventas">{icon('arrow-left')} Volver</a>
      <div className="ph" style={{ marginTop: 12 }}><div><h2>{clientName}</h2><small>{formatDate(sale.fecha)}</small></div>
        <span className={`bd ${paymentStatus[1]}`}>{paymentStatus[0]}</span></div>
      {'requiere_revision' in sale && sale.requiere_revision && <p><span className="bd no">Revisar stock</span></p>}
      <h2>Productos</h2>{sale.detalles.map(line => <div className="li" key={line.id}><span>{productName(line.producto)}<br /><small>{Number(line.cantidad)} × {formatMoney(line.precio_unitario)}</small></span><b>{formatMoney(Number(line.cantidad) * Number(line.precio_unitario))}</b></div>)}
      <p className="tot">{formatMoney(total)}</p>
      {isQueued && <small>Podrás abonar o anular cuando la venta se haya sincronizado.</small>}
    </section>
    {!isQueued && detail && <>
      <section className="card"><h2>Pagos</h2>{detail.pagos.map(payment => <div className="li" key={payment.id}><span>{payment.metodo}<br /><small>{payment.fecha_pago ? formatDate(payment.fecha_pago) : payment.fecha_vencimiento ? `Vence ${payment.fecha_vencimiento}` : ''}</small></span>
        <span style={{ textAlign: 'right' }}><b>{formatMoney(payment.monto)}</b><br /><span className={`bd ${payment.estado === 'PAGADO' ? 'ok' : payment.estado === 'ANULADO' ? 'no' : ''}`}>{payment.estado}</span></span></div>)}
        {!detail.pagos.length && <small>Sin pagos registrados</small>}<div className="li"><span>Pagado</span><b>{formatMoney(paid)}</b></div><div className="li"><span>Saldo pendiente</span><b>{formatMoney(balance)}</b></div>
      </section>
      {detail.despacho && <section className="card"><h2>Despacho</h2><div className="li"><span>{detail.despacho.fecha} {detail.despacho.hora ?? ''}<br /><small>{detail.despacho.direccion} {detail.despacho.comuna ?? ''}</small>
        {(detail.despacho.transportista || detail.despacho.patente) && <><br /><small>{detail.despacho.transportista} {detail.despacho.patente}</small></>}</span><span className="bd">{detail.despacho.estado}</span></div>
        {(state.me?.rol === 'ADMIN' || state.me?.rol === 'VENDEDOR') && <a className="btn sm sec" href="#/despachos">Gestionar despachos</a>}</section>}
      {balance > 0 && !canceled && <section className="card"><h2>Registrar abono</h2><label htmlFor="pay-amount">Monto ($)</label><input id="pay-amount" type="number" inputMode="numeric" min="1" max={Math.round(balance)} value={amount || String(Math.round(balance))} onChange={event => setAmount(event.target.value)} />
        <label htmlFor="pay-method">Método</label><select id="pay-method" value={method} onChange={event => setMethod(event.target.value)}><option value="EFECTIVO">Efectivo</option><option value="TRANSFERENCIA">Transferencia</option><option value="CHEQUE">Cheque</option></select>
        <button className="btn" onClick={() => void pay()}>{icon('cash-coin')} Registrar abono</button></section>}
      {detail.estado === 'CONFIRMADA' && <section className="card"><button className="btn red" onClick={() => void cancel()}>{icon('x-octagon')} Anular venta</button></section>}
      {state.me?.rol === 'ADMIN' && detail.requiere_revision === true && <section className="card"><button className="btn sec" onClick={() => void review()}>{icon('check2-square')} Marcar stock revisado</button></section>}
    </>}
  </>;
}
