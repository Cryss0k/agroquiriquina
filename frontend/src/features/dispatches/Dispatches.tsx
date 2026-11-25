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
  const deleteDispatch = async (dispatch: Dispatch) => {
    if (!window.confirm('¿Eliminar este despacho?')) return;
    if (!state.online) { toast('Necesitas conexión para eliminar el despacho', true); return; }
    try {
      await api(`/despachos/${dispatch.id}/`, { method: 'DELETE' });
      setDispatches(current => current.filter(item => item.id !== dispatch.id));
      toast('Despacho eliminado');
    } catch (err) { toast(err instanceof Error ? err.message : 'No se pudo eliminar el despacho', true); }
  };
  return <>
    <section className="card"><div className="ph"><div><h2>Despachos</h2><small>{filtered.length} resultado(s)</small></div></div>
      <div className="chips">{['TODOS', ...statuses].map(status => <button key={status} className={`chip ${filter === status ? 'on' : ''}`} onClick={() => setFilter(status)}>{status === 'TODOS' ? 'Todos' : status}</button>)}</div>
      {error && <p role="alert">{error}</p>}
      {!loading && !error && !filtered.length && <small>No hay despachos con este filtro.</small>}
    </section>
    {loading && !dispatches.length && !error && <Skeletons variant="cards" count={3} />}
    {filtered.map(dispatch => {
      const sale = sales.find(item => item.id === dispatch.venta);
      const customer = state.cat.clientes.find(c => c.id === sale?.cliente);
      return <DispatchCard key={dispatch.id} item={dispatch} customer={customer} customerName={customer?.nombre ?? `Venta ${dispatch.venta.slice(0, 8)}`} toast={toast} onDelete={() => void deleteDispatch(dispatch)} onSave={async patch => {
        try {
          const result = await api<Dispatch>(`/despachos/${dispatch.id}/`, { method: 'PATCH', body: patch });
          setDispatches(current => current.map(item => item.id === dispatch.id ? result : item)); toast('Despacho actualizado');
        } catch (err) { toast(err instanceof Error ? err.message : 'Error al actualizar despacho', true); }
      }} />
    })}
  </>;
}
function DispatchCard({ item, customer, customerName, toast, onSave, onDelete }: { item: Dispatch; customer?: AppActions['state']['cat']['clientes'][number]; customerName: string; toast: AppActions['toast']; onSave: (patch: Partial<Dispatch>) => Promise<void>; onDelete: () => void }) {
  const [status, setStatus] = useState(item.estado); const [driver, setDriver] = useState(item.transportista ?? '');
  const [plate, setPlate] = useState(item.patente ?? ''); const [notes, setNotes] = useState(item.observaciones ?? '');
  const [date, setDate] = useState(item.fecha); const [time, setTime] = useState(item.hora ?? '');
  const [address, setAddress] = useState(item.direccion); const [commune, setCommune] = useState(item.comuna ?? '');
  return <details className="card"><summary><b>{customerName}</b> <span className={`bd ${item.estado === 'ENTREGADO' ? 'ok' : item.estado === 'CANCELADO' ? 'no' : ''}`}>{item.estado}</span>
    <br /><small>{item.fecha} {item.hora ?? ''} · {item.direccion} {item.comuna ?? ''}</small></summary>
    {customer && <small>Receptor: {customer.nombre} · {customer.telefono ?? 'Sin teléfono'} · {customer.email ?? 'Sin correo'}</small>}
    <label htmlFor={`dispatch-date-${item.id}`}>Fecha acordada</label><input id={`dispatch-date-${item.id}`} type="date" required value={date} onChange={e => setDate(e.target.value)} />
    <label htmlFor={`dispatch-time-${item.id}`}>Hora acordada</label><input id={`dispatch-time-${item.id}`} type="time" required value={time} onChange={e => setTime(e.target.value)} />
    <label htmlFor={`dispatch-address-${item.id}`}>Dirección de entrega</label><input id={`dispatch-address-${item.id}`} value={address} onChange={e => setAddress(e.target.value)} />
    <label htmlFor={`dispatch-commune-${item.id}`}>Comuna de entrega</label><input id={`dispatch-commune-${item.id}`} value={commune} onChange={e => setCommune(e.target.value)} />
    <label htmlFor={`dispatch-status-${item.id}`}>Estado</label><select id={`dispatch-status-${item.id}`} value={status} onChange={e => setStatus(e.target.value)}>{['PROGRAMADO', 'EN_RUTA', 'ENTREGADO', 'CANCELADO'].map(s => <option key={s}>{s}</option>)}</select>
    <label htmlFor={`dispatch-driver-${item.id}`}>Transportista</label><input id={`dispatch-driver-${item.id}`} value={driver} onChange={e => setDriver(e.target.value)} />
    <label htmlFor={`dispatch-plate-${item.id}`}>Patente</label><input id={`dispatch-plate-${item.id}`} maxLength={10} value={plate} onChange={e => setPlate(e.target.value)} />
    <label htmlFor={`dispatch-notes-${item.id}`}>Observaciones</label><input id={`dispatch-notes-${item.id}`} value={notes} onChange={e => setNotes(e.target.value)} />
    <button className="btn" onClick={() => {
      if (!date || !time || !address.trim()) { toast('Indica fecha, hora y dirección del despacho', true); return; }
      void onSave({ fecha: date, hora: time, direccion: address.trim(), comuna: commune.trim(), estado: status, transportista: driver.trim(), patente: plate.trim(), observaciones: notes.trim() });
    }}>{icon('check2-circle')} Guardar cambios</button>
    <button className="btn sm red" onClick={onDelete}>{icon('trash')} Eliminar</button>
    <a className="btn sm sec" href={`#/venta/${item.venta}`}>Ver venta</a>
  </details>;
}
