import { useEffect, useState } from 'react';
import type { AppActions } from '../../app/types';
import type { ApiList, Client, Supplier } from '../../types';
import { api } from '../../services/api';
import { uuid } from '../../services/storage';
import { formatRut, initials, validRut, icon } from '../../app/utils';

type Directory = 'clientes' | 'proveedores';
type ClientForm = {
  rut: string; nombre: string; telefono: string; email: string; direccion: string;
  comuna: string; region: string; tipo: string; razon_social: string; limite_credito: string;
};
type SupplierForm = {
  rut: string; nombre: string; telefono: string; email: string; direccion: string;
  comuna: string; region: string; rubro: string; condiciones_pago: string;
};

const emptyClient = (): ClientForm => ({
  rut: '', nombre: '', telefono: '', email: '', direccion: '', comuna: '', region: '',
  tipo: 'MINORISTA', razon_social: '', limite_credito: '0',
});
const emptySupplier = (): SupplierForm => ({
  rut: '', nombre: '', telefono: '', email: '', direccion: '', comuna: '', region: '',
  rubro: '', condiciones_pago: '',
});

export function Clients({ state, update, toast, sync }: AppActions) {
  const [directory, setDirectory] = useState<Directory>('clientes');
  const [clientForm, setClientForm] = useState<ClientForm>(emptyClient);
  const [supplierForm, setSupplierForm] = useState<SupplierForm>(emptySupplier);
  const [editingClient, setEditingClient] = useState<string | null>(null);
  const [editingSupplier, setEditingSupplier] = useState<string | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState('');
  const admin = state.me?.rol === 'ADMIN';

  useEffect(() => {
    if (!admin || !state.online) return;
    void api<ApiList<Supplier>>('/proveedores/?limit=500')
      .then(result => setSuppliers(result.results))
      .catch(error => toast(error instanceof Error ? error.message : 'No se pudieron cargar los proveedores', true));
  }, [admin, state.online, toast]);

  const saveClient = async () => {
    if (!clientForm.nombre?.trim()) { toast('Falta el nombre', true); return; }
    if (!validRut(clientForm.rut)) { toast('RUT inválido, revísalo', true); return; }
    const values: ClientForm = {
      ...clientForm, rut: formatRut(clientForm.rut), nombre: clientForm.nombre.trim(),
      telefono: clientForm.telefono?.trim() ?? '', email: clientForm.email?.trim() ?? '',
      direccion: clientForm.direccion?.trim() ?? '', comuna: clientForm.comuna?.trim() ?? '',
      region: clientForm.region?.trim() ?? '', razon_social: clientForm.razon_social?.trim() ?? '',
      limite_credito: String(Number(clientForm.limite_credito) || 0),
    };
    if (editingClient) {
      if (!state.online) { toast('Necesitas conexión para actualizar un cliente existente', true); return; }
      try {
        const saved = await api<Client>(`/clientes/${editingClient}/`, { method: 'PATCH', body: values });
        update(draft => { draft.cat.clientes = draft.cat.clientes.map(item => item.id === saved.id ? saved : item); });
        setEditingClient(null); setClientForm(emptyClient()); toast('Cliente actualizado');
      } catch (error) { toast(error instanceof Error ? error.message : 'No se pudo actualizar el cliente', true); }
      return;
    }
    const client: Client = { id: uuid(), ...values };
    update(draft => { draft.q.clientes.push(client); draft.cat.clientes.push(client); });
    setClientForm(emptyClient()); toast('Cliente guardado'); void sync(false);
  };

  const editClient = (client: Client) => {
    setEditingClient(client.id);
    setClientForm({
      rut: client.rut, nombre: client.nombre, telefono: client.telefono ?? '',
      email: client.email ?? '', direccion: client.direccion ?? '', comuna: client.comuna ?? '',
      region: client.region ?? '', tipo: client.tipo ?? 'MINORISTA',
      razon_social: client.razon_social ?? '', limite_credito: String(client.limite_credito ?? 0),
    });
  };

  const saveSupplier = async () => {
    if (!state.online) { toast('Necesitas conexión para gestionar proveedores', true); return; }
    if (!supplierForm.nombre?.trim()) { toast('Falta el nombre', true); return; }
    if (!validRut(supplierForm.rut)) { toast('RUT inválido, revísalo', true); return; }
    const values: SupplierForm = {
      ...supplierForm, rut: formatRut(supplierForm.rut), nombre: supplierForm.nombre.trim(),
      telefono: supplierForm.telefono?.trim() ?? '', email: supplierForm.email?.trim() ?? '',
      direccion: supplierForm.direccion?.trim() ?? '', comuna: supplierForm.comuna?.trim() ?? '',
      region: supplierForm.region?.trim() ?? '', rubro: supplierForm.rubro?.trim() ?? '',
      condiciones_pago: supplierForm.condiciones_pago?.trim() ?? '',
    };
    try {
      const saved = editingSupplier
        ? await api<Supplier>(`/proveedores/${editingSupplier}/`, { method: 'PATCH', body: values })
        : await api<Supplier>('/proveedores/', { method: 'POST', body: values });
      setSuppliers(current => editingSupplier
        ? current.map(item => item.id === saved.id ? saved : item)
        : [saved, ...current]);
      setEditingSupplier(null); setSupplierForm(emptySupplier());
      toast(editingSupplier ? 'Proveedor actualizado' : 'Proveedor creado');
    } catch (error) { toast(error instanceof Error ? error.message : 'No se pudo guardar el proveedor', true); }
  };

  const deleteClient = async (client: Client) => {
    if (!window.confirm(`¿Eliminar a ${client.nombre}?`)) return;
    if (!state.online) { toast('Necesitas conexión para eliminar un cliente', true); return; }
    try {
      await api(`/clientes/${client.id}/`, { method: 'DELETE' });
      update(draft => {
        draft.cat.clientes = draft.cat.clientes.filter(item => item.id !== client.id);
        draft.q.clientes = draft.q.clientes.filter(item => item.id !== client.id);
      });
      if (editingClient === client.id) { setEditingClient(null); setClientForm(emptyClient()); }
      toast('Cliente eliminado');
    } catch (error) { toast(error instanceof Error ? error.message : 'No se pudo eliminar el cliente', true); }
  };

  const deleteSupplier = async (supplier: Supplier) => {
    if (!window.confirm(`¿Eliminar a ${supplier.nombre}?`)) return;
    if (!state.online) { toast('Necesitas conexión para eliminar un proveedor', true); return; }
    try {
      await api(`/proveedores/${supplier.id}/`, { method: 'DELETE' });
      setSuppliers(current => current.filter(item => item.id !== supplier.id));
      if (editingSupplier === supplier.id) { setEditingSupplier(null); setSupplierForm(emptySupplier()); }
      toast('Proveedor eliminado');
    } catch (error) { toast(error instanceof Error ? error.message : 'No se pudo eliminar el proveedor', true); }
  };

  const visibleClients = state.cat.clientes.filter(item => `${item.nombre} ${item.rut}`.toLowerCase().includes(search.toLowerCase()));
  const visibleSuppliers = suppliers.filter(item => `${item.nombre} ${item.rut}`.toLowerCase().includes(search.toLowerCase()));
  const clientField = (key: keyof ClientForm, label: string, type = 'text') => (
    <><label htmlFor={`client-${key}`}>{label}</label><input id={`client-${key}`} type={type} value={String(clientForm[key] ?? '')}
      onChange={event => setClientForm(current => ({ ...current, [key]: event.target.value }))} /></>
  );
  const supplierField = (key: keyof SupplierForm, label: string, type = 'text') => (
    <><label htmlFor={`supplier-${key}`}>{label}</label><input id={`supplier-${key}`} type={type} value={String(supplierForm[key] ?? '')}
      onChange={event => setSupplierForm(current => ({ ...current, [key]: event.target.value }))} /></>
  );

  return <>
    {admin && <div className="chips" aria-label="Directorio">
      {(['clientes', 'proveedores'] as const).map(item => <button key={item} className={`chip ${directory === item ? 'on' : ''}`} onClick={() => { setDirectory(item); setSearch(''); }}>
        {item === 'clientes' ? 'Clientes' : 'Proveedores'}
      </button>)}
    </div>}
    {directory === 'clientes' ? <>
      <details className="card" open={!!editingClient}><summary><b>{icon('person-plus')} {editingClient ? 'Actualizar cliente' : 'Nuevo cliente'}</b></summary>
        {clientField('nombre', 'Nombre')}
        {clientField('rut', 'RUT', 'text')}
        {clientField('telefono', 'Teléfono', 'tel')}
        {clientField('email', 'Correo electrónico', 'email')}
        {clientField('direccion', 'Dirección')}
        <div className="row"><div>{clientField('comuna', 'Comuna')}</div><div>{clientField('region', 'Región')}</div></div>
        <label htmlFor="client-tipo">Tipo</label><select id="client-tipo" value={clientForm.tipo ?? 'MINORISTA'} onChange={event => setClientForm(current => ({ ...current, tipo: event.target.value }))}>
          <option value="MAYORISTA">Mayorista</option><option value="MINORISTA">Minorista</option><option value="FERIA">Feria / Locatario</option>
        </select>
        {clientField('razon_social', 'Razón social')}
        {clientField('limite_credito', 'Límite de crédito ($)', 'number')}
        <button className="btn" onClick={() => void saveClient()}>{icon('check2-circle')} {editingClient ? 'Guardar cambios' : 'Guardar cliente'}</button>
        {editingClient && <button className="btn sec" onClick={() => { setEditingClient(null); setClientForm(emptyClient()); }}>Cancelar</button>}
      </details>
      <section className="card"><h2>Clientes</h2><label className="visually-hidden" htmlFor="directory-search">Buscar por nombre o RUT</label>
        <input id="directory-search" placeholder="Buscar por nombre o RUT" value={search} onChange={event => setSearch(event.target.value)} />
        {visibleClients.map(client => <div className="li" key={client.id}>
          <span className="who"><i className="av">{initials(client.nombre)}</i><span>{client.nombre}<br /><small>{client.rut} · {client.telefono ?? ''} · {client.email ?? ''}</small><br /><small>{client.direccion ?? ''} {client.comuna ?? ''} {client.region ?? ''}</small></span></span>
          <button className="btn sm sec" disabled={!state.online} onClick={() => editClient(client)}>{icon('pencil')} Editar</button>
          <button className="btn sm red" disabled={!state.online} onClick={() => void deleteClient(client)}>{icon('trash')} Eliminar</button>
          {state.q.clientes.some(item => item.id === client.id) && <span className="bd">{icon('clock-history')} por enviar</span>}
        </div>)}
        {!visibleClients.length && <small>Sin resultados</small>}
      </section>
    </> : <>
      <details className="card" open={!!editingSupplier}><summary><b>{icon('building')} {editingSupplier ? 'Actualizar proveedor' : 'Nuevo proveedor'}</b></summary>
        {supplierField('nombre', 'Nombre / razón social')}
        {supplierField('rut', 'RUT')}
        {supplierField('telefono', 'Teléfono', 'tel')}
        {supplierField('email', 'Correo electrónico', 'email')}
        {supplierField('direccion', 'Dirección')}
        <div className="row"><div>{supplierField('comuna', 'Comuna')}</div><div>{supplierField('region', 'Región')}</div></div>
        {supplierField('rubro', 'Rubro')}
        {supplierField('condiciones_pago', 'Condiciones de pago')}
        <button className="btn" onClick={() => void saveSupplier()}>{icon('check2-circle')} {editingSupplier ? 'Guardar cambios' : 'Guardar proveedor'}</button>
        {editingSupplier && <button className="btn sec" onClick={() => { setEditingSupplier(null); setSupplierForm(emptySupplier()); }}>Cancelar</button>}
      </details>
      <section className="card"><h2>Proveedores</h2><label className="visually-hidden" htmlFor="directory-search">Buscar por nombre o RUT</label>
        <input id="directory-search" placeholder="Buscar por nombre o RUT" value={search} onChange={event => setSearch(event.target.value)} />
        {visibleSuppliers.map(supplier => <div className="li" key={supplier.id}>
          <span className="who"><i className="av">{initials(supplier.nombre)}</i><span>{supplier.nombre}<br /><small>{supplier.rut} · {supplier.telefono ?? ''} · {supplier.email ?? ''}</small><br /><small>{supplier.rubro ?? ''} · {supplier.condiciones_pago ?? ''}</small></span></span>
          <button className="btn sm sec" onClick={() => { setEditingSupplier(supplier.id); setSupplierForm({ ...emptySupplier(), ...supplier }); }}>{icon('pencil')} Editar</button>
          <button className="btn sm red" disabled={!state.online} onClick={() => void deleteSupplier(supplier)}>{icon('trash')} Eliminar</button>
        </div>)}
        {!visibleSuppliers.length && <small>{state.online ? 'Sin resultados' : 'Conéctate para cargar proveedores'}</small>}
      </section>
    </>}
  </>;
}
