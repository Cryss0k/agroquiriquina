import { useEffect, useState } from 'react';
import type { AppActions } from '../../app/types';
import type { ApiList, Sale, Supplier, Supply } from '../../types';
import { api, isNetworkError } from '../../services/api';
import { formatDate, formatMoney, icon, localDate } from '../../app/utils';
import { Skeletons } from '../../components/Skeletons';

interface ReceivableCustomer { cliente: string; nombre: string; ventas: number; deuda: number }
interface ProductProfit { producto: string; nombre: string; categoria: string; cantidad_vendida: number; ventas: number; costo: number | null; utilidad: number | null; rentabilidad_porcentaje: number | null }
interface Report {
  desde: string; hasta: string; ventas_totales: number; cobrado: number; por_cobrar: number;
  costo_nomina: number; gastos_compras: number; costo_productos: number;
  productos_sin_costo: number; resultado_neto: number | null; margen_estimado: number | null;
  productos: ProductProfit[]; nota: string;
}
interface PurchaseDraft { proveedor: string; insumo: string; cantidad: string; costo: string }

const today = localDate();
const monthStart = `${today.slice(0, 7)}-01`;

export function Finance({ state, toast }: AppActions) {
  const [report, setReport] = useState<Report | null>(null);
  const [receivables, setReceivables] = useState<{ total_por_cobrar: number; clientes: ReceivableCustomer[] } | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [dates, setDates] = useState({ desde: monthStart, hasta: today });
  const [purchase, setPurchase] = useState<PurchaseDraft>({ proveedor: '', insumo: '', cantidad: '', costo: '' });
  const [error, setError] = useState('');
  const [purchaseLoading, setPurchaseLoading] = useState(false);

  const generateReport = async () => {
    if (!dates.desde || !dates.hasta || dates.hasta < dates.desde) { toast('Indica un rango de fechas válido', true); return; }
    try {
      const result = await api<Report>(`/finanzas/rentabilidad/?desde=${dates.desde}&hasta=${dates.hasta}`);
      setReport(result); setError('');
    } catch (err) {
      const message = isNetworkError(err) ? 'Esta pantalla necesita conexión a internet.' : err instanceof Error ? err.message : 'No se pudo generar el reporte.';
      setError(message); toast(message, true);
    }
  };

  useEffect(() => {
    void Promise.all([
      api<{ total_por_cobrar: number; clientes: ReceivableCustomer[] }>('/finanzas/cuentas-por-cobrar/'),
      api<Report>(`/finanzas/rentabilidad/?desde=${dates.desde}&hasta=${dates.hasta}`),
      api<ApiList<Supplier>>('/proveedores/?limit=500'),
      api<ApiList<Supply>>('/insumos/?limit=500'),
    ]).then(([accounts, profit, supplierList, supplyList]) => {
      setReceivables(accounts); setReport(profit);
      setSuppliers(supplierList.results); setSupplies(supplyList.results);
    }).catch(err => setError(isNetworkError(err) ? 'Esta pantalla necesita conexión a internet.' : err instanceof Error ? err.message : 'No se pudieron cargar las finanzas.'));
  }, []);

  const registerPurchase = async () => {
    if (!state.online) { toast('Necesitas conexión para registrar una compra', true); return; }
    const quantity = Number(purchase.cantidad);
    const cost = Number(purchase.costo);
    if (!purchase.proveedor || !purchase.insumo || !(quantity > 0) || !(cost >= 0)) { toast('Completa proveedor, insumo, cantidad y costo unitario', true); return; }
    setPurchaseLoading(true);
    try {
      await api('/compras/', { method: 'POST', body: {
        proveedor: purchase.proveedor, fecha: new Date().toISOString(),
        detalles: [{ insumo: purchase.insumo, cantidad: String(quantity), costo_unitario: Math.round(cost) }],
      } });
      setPurchase({ proveedor: '', insumo: '', cantidad: '', costo: '' });
      toast('Compra registrada. Actualiza el reporte para incluirla.');
    } catch (err) { toast(err instanceof Error ? err.message : 'No se pudo registrar la compra', true); }
    finally { setPurchaseLoading(false); }
  };

  if (error && !report && !receivables) return <section className="card" role="alert">{error}</section>;
  if (!report || !receivables) return <Skeletons variant="finance" />;
  return <>
    <section className="card"><h2>Generar reporte de rentabilidad</h2>
      <div className="row"><div><label htmlFor="report-from">Desde</label><input id="report-from" type="date" value={dates.desde} onChange={event => setDates(current => ({ ...current, desde: event.target.value }))} /></div>
        <div><label htmlFor="report-to">Hasta</label><input id="report-to" type="date" value={dates.hasta} onChange={event => setDates(current => ({ ...current, hasta: event.target.value }))} /></div></div>
      <button className="btn" onClick={() => void generateReport()}>{icon('bar-chart-line')} Generar reporte</button>
      {error && <p role="alert">{error}</p>}
      <small>Período del reporte: {report.desde} a {report.hasta}</small>
      <Metric label="Ventas" value={formatMoney(report.ventas_totales)} />
      <Metric label="Costos directos configurados" value={formatMoney(report.costo_productos)} />
      <Metric label="Compras registradas/recepcionadas (egresos)" value={formatMoney(report.gastos_compras)} />
      <Metric label="Nómina aprobada/pagada" value={formatMoney(report.costo_nomina)} />
      <Metric label="Cobrado" value={formatMoney(report.cobrado)} />
      <Metric label="Por cobrar" value={formatMoney(report.por_cobrar)} />
      <Metric label={report.resultado_neto === null ? 'Resultado neto estimado' : report.resultado_neto >= 0 ? 'Resultado neto estimado' : 'Pérdida neta estimada'}
        value={report.resultado_neto === null ? 'No disponible: faltan costos unitarios' : formatMoney(report.resultado_neto)} />
      {report.productos_sin_costo > 0 && <p role="status">{report.productos_sin_costo} producto(s) vendido(s) no tienen costo unitario configurado.</p>}
      <small>{report.nota}</small>
    </section>
    <section className="card"><h2>Rentabilidad por producto</h2>
      {report.productos.map(product => <div className="li" key={product.producto}>
        <span>{product.nombre}<br /><small>{product.cantidad_vendida} vendido(s) · Ventas {formatMoney(product.ventas)} · {product.costo === null ? 'Falta costo unitario' : `Costo ${formatMoney(product.costo)}`}</small></span>
        <span style={{ textAlign: 'right' }}><b>{product.utilidad === null ? 'No calculable' : formatMoney(product.utilidad)}</b><br /><small>{product.rentabilidad_porcentaje === null ? 'Configura costo unitario' : `${Number(product.rentabilidad_porcentaje).toFixed(1)}% margen`}</small></span>
      </div>)}
      {!report.productos.length && <small>Sin ventas de productos en este período.</small>}
    </section>
    <section className="card"><h2>Registrar compra / egreso</h2>
      <label htmlFor="purchase-supplier">Proveedor</label><select id="purchase-supplier" value={purchase.proveedor} onChange={event => setPurchase(current => ({ ...current, proveedor: event.target.value }))}>
        <option value="">Selecciona un proveedor</option>{suppliers.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.nombre}</option>)}
      </select>
      <label htmlFor="purchase-supply">Insumo</label><select id="purchase-supply" value={purchase.insumo} onChange={event => setPurchase(current => ({ ...current, insumo: event.target.value }))}>
        <option value="">Selecciona un insumo</option>{supplies.map(supply => <option key={supply.id} value={supply.id}>{supply.nombre}</option>)}
      </select>
      <div className="row"><div><label htmlFor="purchase-quantity">Cantidad</label><input id="purchase-quantity" type="number" min="0.001" step="any" value={purchase.cantidad} onChange={event => setPurchase(current => ({ ...current, cantidad: event.target.value }))} /></div>
        <div><label htmlFor="purchase-cost">Costo unitario ($)</label><input id="purchase-cost" type="number" min="0" value={purchase.costo} onChange={event => setPurchase(current => ({ ...current, costo: event.target.value }))} /></div></div>
      <button className="btn" disabled={purchaseLoading} onClick={() => void registerPurchase()}>{icon('plus-circle')} Registrar compra</button>
    </section>
    <section className="card"><h2>Cuentas por cobrar: {formatMoney(receivables.total_por_cobrar)}</h2>
      {receivables.clientes.map(customer => <Receivable key={customer.cliente} customer={customer} toast={toast} />)}
      {!receivables.clientes.length && <p>Nadie te debe.</p>}
    </section>
  </>;
}
function Metric({ label, value }: { label: string; value: string }) { return <div className="li"><span>{label}</span><b>{value}</b></div>; }
function Receivable({ customer, toast }: { customer: ReceivableCustomer; toast: AppActions['toast'] }) {
  const [expanded, setExpanded] = useState(false); const [loading, setLoading] = useState(false); const [sales, setSales] = useState<Sale[]>([]);
  const showSales = async () => {
    if (expanded) { setExpanded(false); return; }
    setExpanded(true); setLoading(true);
    try { const result = await api<ApiList<Sale>>(`/ventas/?cliente=${customer.cliente}&estado=CONFIRMADA&limit=200`); setSales(result.results.filter(sale => Number(sale.saldo_pendiente) > 0)); }
    catch (error) { setExpanded(false); toast(error instanceof Error ? error.message : 'No se pudieron cargar las ventas', true); }
    finally { setLoading(false); }
  };
  return <div className="li" style={{ flexWrap: 'wrap' }}><span>{customer.nombre}<br /><small>{customer.ventas} venta(s)</small></span><span><b>{formatMoney(customer.deuda)}</b> <button className="btn sm" onClick={() => void showSales()}>{icon('cash-coin')} Abonar</button></span>
    {expanded && <div style={{ flex: '0 0 100%' }}>{loading ? <Skeletons count={1} /> : sales.map(sale => <div className="li" key={sale.id}><span><small>{formatDate(sale.fecha)}</small><br />Saldo <b>{formatMoney(sale.saldo_pendiente)}</b></span><a className="btn sm" href={`#/venta/${sale.id}`}>Abonar</a></div>)}
      {!loading && !sales.length && <small>Sin ventas con saldo pendiente</small>}</div>}
  </div>;
}
