import { useEffect, useState } from 'react';
import type { AppActions } from '../../app/types';
import type { ApiList, Sale } from '../../types';
import { api, isNetworkError } from '../../services/api';
import { formatDate, formatMoney, icon } from '../../app/utils';
import { Skeletons } from '../../components/Skeletons';

interface ReceivableCustomer { cliente: string; nombre: string; ventas: number; deuda: number }
export function Finance({ toast }: AppActions) {
  const [summary, setSummary] = useState<{ ventas_totales: number; cobrado: number; por_cobrar: number; costo_nomina: number; margen_estimado: number; nota: string } | null>(null);
  const [receivables, setReceivables] = useState<{ total_por_cobrar: number; clientes: ReceivableCustomer[] } | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    void Promise.all([api<typeof receivables>('/finanzas/cuentas-por-cobrar/'), api<typeof summary>('/finanzas/rentabilidad/')])
      .then(([accounts, profit]) => { if (accounts && profit) { setReceivables(accounts); setSummary(profit); } })
      .catch(err => setError(isNetworkError(err) ? 'Esta pantalla necesita conexión a internet.' : err instanceof Error ? err.message : 'No se pudieron cargar las finanzas.'));
  }, []);
  if (error) return <section className="card" role="alert">{error}</section>;
  if (!summary || !receivables) return <Skeletons variant="finance" />;
  return <>
    <section className="card"><h2>Resumen del mes</h2>
      <Metric label="Ventas" value={formatMoney(summary.ventas_totales)} /><Metric label="Cobrado" value={formatMoney(summary.cobrado)} />
      <Metric label="Por cobrar" value={formatMoney(summary.por_cobrar)} /><Metric label="Nómina" value={formatMoney(summary.costo_nomina)} />
      <Metric label="Margen estimado" value={formatMoney(summary.margen_estimado)} /><small>{summary.nota}</small>
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
