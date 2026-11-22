import { useCallback, useEffect, useState } from 'react';
import type { AppActions } from '../../app/types';
import type { ApiList } from '../../types';
import type { Dispatch, Sale } from '../../types';
import { api, isNetworkError } from '../../services/api';
import { icon } from '../../app/utils';
import { Skeletons } from '../../components/Skeletons';

export function Dispatches({ state, toast }: AppActions) {
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [filter, setFilter] = useState('TODOS');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const statuses = ['PROGRAMADO', 'EN_RUTA', 'ENTREGADO', 'CANCELADO'];
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, v] = await Promise.all([api<ApiList<Dispatch>>('/despachos/?limit=200'), api<ApiList<Sale>>('/ventas/?limit=200').catch(() => ({ results: [] }))]);
      setDispatches(d.results); setSales(v.results); setError('');
    } catch (err) { setError(isNetworkError(err) ? 'Esta pantalla necesita conexión a internet.' : err instanceof Error ? err.message : 'No se pudieron cargar los despachos.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const filtered = dispatches.filter(item => filter === 'TODOS' || item.estado === filter);
  return <>
    <section className="card"><div className="ph"><div><h2>Despachos</h2><small>{filtered.length} resultado(s)</small></div></div>
      <div className="chips">{['TODOS', ...statuses].map(status => <button key={status} className={`chip ${filter === status ? 'on' : ''}`} onClick={() => setFilter(status)}>{status === 'TODOS' ? 'Todos' : status}</button>)}</div>
      {error && <p role="alert">{error}</p>}
      {!loading && !error && !filtered.length && <small>No hay despachos con este filtro.</small>}
    </section>
    {loading && !dispatches.length && !error && <Skeletons variant="cards" count={3} />}
    {filtered.map(dispatch => {
      const sale = sales.find(item => item.id === dispatch.venta);
      return <DispatchCard key={dispatch.id} item={dispatch} customer={state.cat.clientes.find(c => c.id === sale?.cliente)?.nombre ?? `Venta ${dispatch.venta.slice(0, 8)}`} onSave={async patch => {
        try {
          const result = await api<Dispatch>(`/despachos/${dispatch.id}/`, { method: 'PATCH', body: patch });
          setDispatches(current => current.map(item => item.id === dispatch.id ? result : item)); toast('Despacho actualizado');
        } catch (err) { toast(err instanceof Error ? err.message : 'Error al actualizar despacho', true); }
      }} />
    })}
  </>;
}
function DispatchCard({ item, customer, onSave }: { item: Dispatch; customer: string; onSave: (patch: Partial<Dispatch>) => Promise<void> }) {
  const [status, setStatus] = useState(item.estado); const [driver, setDriver] = useState(item.transportista ?? '');
  const [plate, setPlate] = useState(item.patente ?? ''); const [notes, setNotes] = useState(item.observaciones ?? '');
  return <details className="card"><summary><b>{customer}</b> <span className={`bd ${item.estado === 'ENTREGADO' ? 'ok' : item.estado === 'CANCELADO' ? 'no' : ''}`}>{item.estado}</span>
    <br /><small>{item.fecha} {item.hora ?? ''} · {item.direccion} {item.comuna ?? ''}</small></summary>
    <label htmlFor={`dispatch-status-${item.id}`}>Estado</label><select id={`dispatch-status-${item.id}`} value={status} onChange={e => setStatus(e.target.value)}>{['PROGRAMADO', 'EN_RUTA', 'ENTREGADO', 'CANCELADO'].map(s => <option key={s}>{s}</option>)}</select>
    <label htmlFor={`dispatch-driver-${item.id}`}>Transportista</label><input id={`dispatch-driver-${item.id}`} value={driver} onChange={e => setDriver(e.target.value)} />
    <label htmlFor={`dispatch-plate-${item.id}`}>Patente</label><input id={`dispatch-plate-${item.id}`} maxLength={10} value={plate} onChange={e => setPlate(e.target.value)} />
    <label htmlFor={`dispatch-notes-${item.id}`}>Observaciones</label><input id={`dispatch-notes-${item.id}`} value={notes} onChange={e => setNotes(e.target.value)} />
    <button className="btn" onClick={() => void onSave({ estado: status, transportista: driver.trim(), patente: plate.trim(), observaciones: notes.trim() })}>{icon('check2-circle')} Guardar cambios</button>
    <a className="btn sm sec" href={`#/venta/${item.venta}`}>Ver venta</a>
  </details>;
}
