import { useState } from 'react';
import type { AppActions } from '../../app/types';
import type { Client } from '../../types';
import { uuid } from '../../services/storage';
import { formatRut, initials, validRut, icon } from '../../app/utils';

export function Clients({ state, update, toast, sync }: AppActions) {
  const [name, setName] = useState(''); const [rut, setRut] = useState(''); const [phone, setPhone] = useState(''); const [commune, setCommune] = useState(''); const [search, setSearch] = useState('');
  const submit = () => {
    if (!name.trim()) { toast('Falta el nombre', true); return; }
    if (!validRut(rut)) { toast('RUT inválido, revísalo', true); return; }
    const client: Client = { id: uuid(), rut: formatRut(rut), nombre: name.trim(), telefono: phone.trim(), comuna: commune.trim() };
    update(draft => { draft.q.clientes.push(client); draft.cat.clientes.push(client); });
    setName(''); setRut(''); setPhone(''); setCommune('');
    toast('Cliente guardado'); void sync(false);
  };
  const filtered = state.cat.clientes.filter(client => `${client.nombre}${client.rut}`.toLowerCase().includes(search.toLowerCase()));
  return <>
    <details className="card"><summary><b>{icon('person-plus')} Nuevo cliente</b></summary>
      <label htmlFor="client-name">Nombre</label><input id="client-name" value={name} onChange={e => setName(e.target.value)} />
      <label htmlFor="client-rut">RUT</label><input id="client-rut" placeholder="12.345.678-5" value={rut} onChange={e => setRut(e.target.value)} />
      <label htmlFor="client-phone">Teléfono</label><input id="client-phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} />
      <label htmlFor="client-commune">Comuna</label><input id="client-commune" value={commune} onChange={e => setCommune(e.target.value)} />
      <button className="btn" onClick={submit}>{icon('check2-circle')} Guardar cliente</button>
    </details>
    <section className="card"><h2>Clientes</h2><label className="visually-hidden" htmlFor="client-search">Buscar por nombre o RUT</label>
      <input id="client-search" placeholder="Buscar por nombre o RUT" value={search} onChange={e => setSearch(e.target.value)} />
      {filtered.map(client => <div className="li" key={client.id}><span className="who"><i className="av">{initials(client.nombre)}</i><span>{client.nombre}<br /><small>{client.rut} {client.telefono ?? ''}</small></span></span>
        {state.q.clientes.some(item => item.id === client.id) && <span className="bd">{icon('clock-history')} por enviar</span>}</div>)}
      {!filtered.length && <small>Sin resultados</small>}
    </section>
  </>;
}
