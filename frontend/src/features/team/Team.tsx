import { useCallback, useEffect, useState } from 'react';
import type { AppActions } from '../../app/types';
import type { Account, ApiList, Supplier, Worker } from '../../types';
import { api, isNetworkError } from '../../services/api';
import { CheckField, SelectField, TextField } from '../../components/FormFields';
import { Skeletons } from '../../components/Skeletons';
import { formatMoney, formatRut, icon, initials, validRut } from '../../app/utils';

const teamEndpoints = { t: ['/trabajadores/', 'Trabajadores'], p: ['/proveedores/', 'Proveedores'], u: ['/usuarios/', 'Usuarios'] } as const;
type TeamTab = keyof typeof teamEndpoints;
type TeamRecord = Worker | Supplier | Account;

const passwordError = (password: string) => {
  const missing = [
    [...password].length >= 8,
    /\p{Lu}/u.test(password),
    /\p{Ll}/u.test(password),
    /\p{Nd}/u.test(password),
    /[^\p{L}\p{N}]/u.test(password),
  ];
  return missing.every(Boolean) ? '' : 'La contraseña debe tener 8 caracteres como mínimo e incluir mayúscula, minúscula, número y símbolo.';
};

export function Team({ state, toast }: AppActions) {
  const isAdmin = state.me?.rol === 'ADMIN';
  const tabs: TeamTab[] = isAdmin ? ['t', 'p', 'u'] : ['t'];
  const [tab, setTab] = useState<TeamTab>('t');
  const [rows, setRows] = useState<Record<TeamTab, TeamRecord[]>>({ t: [], p: [], u: [] });
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<TeamRecord | null>(null);
  const [open, setOpen] = useState(false);
  const [fields, setFields] = useState<Record<string, string | boolean>>({});
  const endpoint = teamEndpoints[tab][0];
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [records, workerRows] = await Promise.all([
        api<ApiList<TeamRecord>>(`${endpoint}?limit=300`),
        tab === 'u' ? api<ApiList<Worker>>('/trabajadores/?limit=300') : Promise.resolve({ results: [] }),
      ]);
      setRows(current => ({ ...current, [tab]: records.results }));
      if (tab === 't') setWorkers(records.results as Worker[]);
      if (tab === 'u') setWorkers(workerRows.results);
      setError('');
    } catch (err) { setError(isNetworkError(err) ? 'Esta pantalla necesita conexión a internet.' : err instanceof Error ? err.message : 'No se pudo cargar el equipo.'); }
    finally { setLoading(false); }
  }, [tab, endpoint]);
  useEffect(() => { if (!tabs.includes(tab)) setTab('t'); else void load(); }, [tab, load]);
  const changeTab = (next: TeamTab) => { setTab(next); setEditing(null); setOpen(false); };
  const edit = (record: TeamRecord) => {
    setEditing(record); setOpen(true);
    if (tab === 't') {
      const item = record as Worker;
      setFields({ ru: item.rut ?? '', nm: item.nombre ?? '', tc: item.tipo_contrato ?? 'TEMPORERO', cg: item.cargo ?? '', tf: String(Math.round(Number(item.tarifa_diaria) || 0)), ac: item.activo ?? true });
    } else if (tab === 'p') {
      const item = record as Supplier;
      setFields({ ru: item.rut ?? '', nm: item.nombre ?? '', rb: item.rubro ?? '', tl: item.telefono ?? '', cp: item.condiciones_pago ?? '' });
    } else {
      const item = record as Account;
      setFields({ un: item.username ?? '', fn: item.first_name ?? '', ln: item.last_name ?? '', rl: item.rol ?? 'VENDEDOR', ps: item.persona ?? '', pw: '', ac: item.is_active ?? true });
    }
  };
  const fresh = () => {
    setEditing(null); setOpen(true);
    setFields(tab === 't' ? { ru: '', nm: '', tc: 'TEMPORERO', cg: '', tf: '0', ac: true } :
      tab === 'p' ? { ru: '', nm: '', rb: '', tl: '', cp: '' } :
        { un: '', fn: '', ln: '', rl: 'VENDEDOR', ps: '', pw: '', ac: true });
  };
  const field = (key: string) => String(fields[key] ?? '');
  const setField = (key: string, value: string | boolean) => setFields(current => ({ ...current, [key]: value }));
  const save = async () => {
    let body: Record<string, unknown>;
    if (tab === 't' || tab === 'p') {
      if (!field('nm').trim()) { toast('Falta el nombre', true); return; }
      if (!validRut(field('ru'))) { toast('RUT inválido, revísalo', true); return; }
      body = { rut: formatRut(field('ru')), nombre: field('nm').trim() };
      if (tab === 't') Object.assign(body, { tipo_contrato: field('tc'), cargo: field('cg').trim(), tarifa_diaria: Math.round(Number(field('tf')) || 0), activo: !!fields.ac });
      else Object.assign(body, { rubro: field('rb').trim(), telefono: field('tl').trim(), condiciones_pago: field('cp').trim() });
    } else {
      if (!field('un').trim()) { toast('Falta el nombre de usuario', true); return; }
      if (!editing && !field('pw')) { toast('Falta la contraseña', true); return; }
      if (field('pw')) {
        const error = passwordError(field('pw'));
        if (error) { toast(error, true); return; }
      }
      body = { username: field('un').trim(), first_name: field('fn').trim(), last_name: field('ln').trim(), rol: field('rl'), persona: field('ps') || null, is_active: !!fields.ac };
      if (field('pw')) body.password = field('pw');
    }
    try {
      const path = endpoint + (editing ? `${editing.id}/` : '');
      await api(path, { method: editing ? 'PATCH' : 'POST', body });
      toast('Guardado'); setOpen(false); setEditing(null); await load();
    } catch (err) { toast(err instanceof Error ? err.message : 'No se pudo guardar', true); }
  };
  const unlock = async (account: Account) => {
    try {
      await api(`/usuarios/${account.id}/desbloquear/`, { method: 'POST' });
      toast('Usuario desbloqueado');
      await load();
    } catch (err) { toast(err instanceof Error ? err.message : 'No se pudo desbloquear el usuario', true); }
  };
  const personName = (record: TeamRecord) => tab === 'u' ? (record as Account).first_name || (record as Account).username : (record as Worker | Supplier).nombre;
  const formFields = tab === 't' ? <>
    <TextField id="ru" label="RUT" value={field('ru')} onChange={setField} placeholder="12.345.678-5" />
    <TextField id="nm" label="Nombre" value={field('nm')} onChange={setField} />
    <SelectField id="tc" label="Tipo de contrato" value={field('tc')} onChange={setField} options={[['TEMPORERO', 'Temporero'], ['PLAZO_FIJO', 'Plazo fijo'], ['INDEFINIDO', 'Indefinido']]} />
    <TextField id="cg" label="Cargo" value={field('cg')} onChange={setField} />
    <TextField id="tf" label="Tarifa diaria ($)" type="number" value={field('tf')} onChange={setField} />
    <CheckField id="ac" label="Activo" checked={!!fields.ac} onChange={value => setField('ac', value)} />
  </> : tab === 'p' ? <>
    <TextField id="ru" label="RUT" value={field('ru')} onChange={setField} placeholder="76.123.456-7" />
    <TextField id="nm" label="Nombre" value={field('nm')} onChange={setField} />
    <TextField id="rb" label="Rubro" value={field('rb')} onChange={setField} />
    <TextField id="tl" label="Teléfono" type="tel" value={field('tl')} onChange={setField} />
    <TextField id="cp" label="Condiciones de pago" value={field('cp')} onChange={setField} />
  </> : <>
    <TextField id="un" label="Usuario" value={field('un')} onChange={setField} />
    <TextField id="fn" label="Nombre" value={field('fn')} onChange={setField} />
    <TextField id="ln" label="Apellido" value={field('ln')} onChange={setField} />
    <SelectField id="rl" label="Rol" value={field('rl')} onChange={setField} options={[['ADMIN', 'Administrador'], ['VENDEDOR', 'Vendedor'], ['SUPERVISOR', 'Supervisor de Terreno']]} />
    <SelectField id="ps" label="Trabajador vinculado" value={field('ps')} onChange={setField} options={[['', '— Sin vincular —'], ...workers.map(worker => [worker.id, worker.nombre])]} />
    <TextField id="pw" label={`Contraseña${editing ? ' (vacía = no cambiar)' : ''}`} type="password" value={field('pw')} onChange={setField} />
    <small>8 caracteres como mínimo: mayúscula, minúscula, número y símbolo.</small>
    <CheckField id="ac" label="Activo" checked={!!fields.ac} onChange={value => setField('ac', value)} />
  </>;
  return <>
    <section className="card"><div className="ph"><div><h2>Equipo y contactos</h2><small>{rows[tab].length} registro(s)</small></div><button className="btn sm" onClick={fresh}>{icon('plus-lg')} Nuevo</button></div>
      {tabs.length > 1 && <div className="chips">{tabs.map(key => <button key={key} className={`chip ${tab === key ? 'on' : ''}`} onClick={() => changeTab(key)}>{teamEndpoints[key][1]}</button>)}</div>}
    </section>
    <details className="card" open={open} onToggle={event => setOpen(event.currentTarget.open)}><summary><b>{editing ? 'Editar' : 'Nuevo'} — {teamEndpoints[tab][1]}</b></summary>
      {formFields}<button className="btn" onClick={() => void save()}>{icon('check2-circle')} Guardar</button>{open && <button className="btn sec" onClick={() => { setOpen(false); setEditing(null); }}>Cancelar</button>}
    </details>
    <section className="card"><h2>{teamEndpoints[tab][1]}</h2>{loading && !rows[tab].length && <Skeletons count={3} />}{error && <p role="alert">{error}</p>}
      {rows[tab].map(record => <div className="li" key={record.id}><span className="who"><i className="av">{initials(personName(record))}</i><span><b>{personName(record)}</b><br /><small>{tab === 't' ? `${(record as Worker).rut} · ${(record as Worker).cargo || 'Sin cargo'} · ${(record as Worker).tipo_contrato} · ${formatMoney((record as Worker).tarifa_diaria)}/día` : tab === 'p' ? `${(record as Supplier).rut} · ${(record as Supplier).rubro || 'Sin rubro'} ${(record as Supplier).telefono || ''}` : `${(record as Account).rol}`}</small></span></span>
        <span className="form-actions">{((record as Worker).activo === false || (record as Account).is_active === false) && <span className="bd no">Inactivo</span>}{tab === 'u' && (record as Account).bloqueado && <><span className="bd no">Bloqueado ({(record as Account).intentos_fallidos} intentos)</span><button className="btn sm sec" onClick={() => void unlock(record as Account)}>Desbloquear</button></>}<button className="btn sm sec" onClick={() => edit(record)}>Editar</button></span></div>)}
      {!loading && !error && !rows[tab].length && <small>Sin registros</small>}
    </section>
  </>;
}
