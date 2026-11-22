import { useState } from 'react';
import type { AppActions } from '../../app/types';
import type { HistoryItem, WorkLog } from '../../types';
import { deviceId, uuid } from '../../services/storage';
import { icon, laborNames, localDate } from '../../app/utils';
import { HistoryRow } from '../dashboard/Dashboard';

export function Terrain({ state, update, toast, sync }: AppActions) {
  const [worker, setWorker] = useState(''); const [labor, setLabor] = useState('COSECHA_PAPA');
  const [quantity, setQuantity] = useState(''); const [unit, setUnit] = useState('SACO'); const [rate, setRate] = useState('');
  const [date, setDate] = useState(localDate());
  const saveWork = () => {
    const count = Number(quantity);
    if (!worker) { toast('Elige un trabajador', true); return; }
    if (!(count > 0)) { toast('Indica la cantidad', true); return; }
    const work: WorkLog = { id: uuid(), trabajador: worker, fecha: date, labor, cantidad: String(count), unidad: unit, device_id: deviceId() };
    if (rate) work.tarifa_unitaria = String(Number(rate));
    const history: HistoryItem = { id: work.id, n: state.cat.trabajadores.find(item => item.id === worker)?.nombre ?? 'Trabajador', l: laborNames[labor][0], c: String(count), u: unit, f: date };
    update(draft => { draft.q.desempenos.push(work); draft.hist = [history, ...draft.hist].slice(0, 15); });
    setQuantity(''); toast('Registro guardado'); void sync(false);
  };
  return <>
    <section className="card"><h2>Registrar trabajo del día</h2>
      <label htmlFor="work-worker">Trabajador</label><select id="work-worker" value={worker} onChange={e => setWorker(e.target.value)}><option value="">Selecciona trabajador</option>{state.cat.trabajadores.map(item => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select>
      <label htmlFor="work-labor">Labor</label><select id="work-labor" value={labor} onChange={e => { setLabor(e.target.value); setUnit(laborNames[e.target.value][1]); }}>{Object.entries(laborNames).map(([key, item]) => <option key={key} value={key}>{item[0]}</option>)}</select>
      <div className="row"><div><label htmlFor="work-count">Cantidad</label><input id="work-count" type="number" min="0" step="any" value={quantity} onChange={e => setQuantity(e.target.value)} /></div>
        <div><label htmlFor="work-unit">Unidad</label><select id="work-unit" value={unit} onChange={e => setUnit(e.target.value)}><option value="SACO">Sacos</option><option value="KG">Kilos</option><option value="JORNADA">Jornadas</option></select></div></div>
      <label htmlFor="work-rate">Pago por unidad ($)</label><input id="work-rate" type="number" inputMode="numeric" placeholder="Vacío = tarifa diaria del trabajador" value={rate} onChange={e => setRate(e.target.value)} />
      <label htmlFor="work-date">Fecha</label><input id="work-date" type="date" value={date} onChange={e => setDate(e.target.value)} />
      <button className="btn" onClick={saveWork}>{icon('check2-circle')} Guardar registro</button>
    </section>
    <section className="card"><h2>Últimos registros</h2>{state.hist.map(item => <HistoryRow key={item.id} item={item} state={state} />)}{!state.hist.length && <small>Sin registros</small>}</section>
  </>;
}
