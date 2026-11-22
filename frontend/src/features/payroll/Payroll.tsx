import { useCallback, useEffect, useState } from 'react';
import type { AppActions } from '../../app/types';
import type { ApiList, Payroll } from '../../types';
import { api, ApiError, isNetworkError } from '../../services/api';
import { formatMoney, icon, localDate } from '../../app/utils';
import { Skeletons } from '../../components/Skeletons';

export function PayrollScreen({ state, toast }: AppActions) {
  const [records, setRecords] = useState<Payroll[]>([]);
  const [worker, setWorker] = useState(''); const [startDate, setStartDate] = useState(`${localDate().slice(0, 8)}01`);
  const [endDate, setEndDate] = useState(localDate()); const [bonus, setBonus] = useState('0'); const [discount, setDiscount] = useState('0');
  const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    try { const response = await api<ApiList<Payroll>>('/remuneraciones/?limit=30'); setRecords(response.results); setError(''); }
    catch (err) { setError(isNetworkError(err) ? 'Esta pantalla necesita conexión a internet.' : err instanceof Error ? err.message : 'No se pudieron cargar las remuneraciones.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const calculate = async () => {
    try {
      await api('/remuneraciones/', { method: 'POST', body: { trabajador: worker, periodo_inicio: startDate, periodo_fin: endDate, bonos: Number(bonus) || 0, descuentos: Number(discount) || 0 } });
      toast('Calculado'); await load();
    } catch (err) { toast(err instanceof Error ? err.message : 'No se pudo calcular', true); }
  };
  const transition = async (record: Payroll, operation: 'aprobar' | 'pagar') => {
    try { await api(`/remuneraciones/${record.id}/${operation}/`, { method: 'POST' }); await load(); }
    catch (err) { toast(err instanceof Error ? err.message : 'No se pudo actualizar la remuneración', true); }
  };
  const exportCsv = async () => {
    try {
      const response = await fetch('/api/v1/remuneraciones/exportar/', { headers: { Authorization: `Bearer ${state.tok?.access ?? ''}` } });
      if (!response.ok) throw new ApiError(response.status === 403 ? 'Sin permiso para esto' : `Error ${response.status}`, response.status);
      const url = URL.createObjectURL(await response.blob()); const link = document.createElement('a');
      link.href = url; link.download = 'remuneraciones.csv'; document.body.append(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err) { toast(err instanceof Error ? err.message : 'No se pudo exportar', true); }
  };
  return <>
    <details className="card"><summary><b>{icon('calculator')} Calcular pago de un trabajador</b></summary>
      <label htmlFor="payroll-worker">Trabajador</label><select id="payroll-worker" value={worker} onChange={e => setWorker(e.target.value)}><option value="">Selecciona un trabajador</option>{state.cat.trabajadores.map(item => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select>
      <div className="row"><div><label htmlFor="payroll-start">Desde</label><input id="payroll-start" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></div><div><label htmlFor="payroll-end">Hasta</label><input id="payroll-end" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></div></div>
      <div className="row"><div><label htmlFor="payroll-bonus">Bonos ($)</label><input id="payroll-bonus" type="number" value={bonus} onChange={e => setBonus(e.target.value)} /></div><div><label htmlFor="payroll-discount">Descuentos ($)</label><input id="payroll-discount" type="number" value={discount} onChange={e => setDiscount(e.target.value)} /></div></div>
      <button className="btn" onClick={() => void calculate()}>Calcular</button>
    </details>
    <section className="card"><div className="ph"><h2>Remuneraciones</h2><button className="btn sm sec" onClick={() => void exportCsv()}>{icon('download')} Exportar CSV</button></div>
      {loading && !records.length && <Skeletons count={3} />}{error && <p role="alert">{error}</p>}
      {records.map(record => <div className="li" key={record.id}><span>{state.cat.trabajadores.find(item => item.id === record.trabajador)?.nombre ?? 'Trabajador'}<br /><small>{record.periodo_inicio} → {record.periodo_fin}</small><br />
        {record.estado === 'BORRADOR' && <button className="btn sm" onClick={() => void transition(record, 'aprobar')}>Aprobar</button>}
        {record.estado === 'APROBADA' && <button className="btn sm" onClick={() => void transition(record, 'pagar')}>Marcar pagada</button>}
      </span><span style={{ textAlign: 'right' }}><b>{formatMoney(record.total_liquido)}</b><br /><span className={`bd ${record.estado === 'PAGADA' ? 'ok' : ''}`}>{record.estado}</span></span></div>)}
      {!loading && !error && !records.length && <small>Aún no hay remuneraciones</small>}
    </section>
  </>;
}
