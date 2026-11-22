import { useEffect, useState } from 'react';
import type { AppActions } from '../../app/types';
import type { Movement } from '../../types';
import { api } from '../../services/api';
import { formatDate, icon, lowStock, units } from '../../app/utils';

export function Inventory({ state, toast, refreshInventory, movements }: AppActions & { movements: Movement[] }) {
  const [itemType, setItemType] = useState<'productos' | 'insumos'>('productos');
  const [itemId, setItemId] = useState('');
  const [movementType, setMovementType] = useState('ENTRADA');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [supplyId, setSupplyId] = useState('');
  const [hectares, setHectares] = useState('');
  const [calculation, setCalculation] = useState('');
  const [productForm, setProductForm] = useState({ nombre: '', categoria: 'PAPA', variedad: '', unidad_medida: 'SACO', stock_minimo: '0', precio_referencia: '0', peso_saco_kg: '' });
  const [supplyForm, setSupplyForm] = useState({ nombre: '', tipo: 'OTRO', unidad_medida: 'SACO', stock_minimo: '0', dosis_por_hectarea: '0' });
  const admin = state.me?.rol === 'ADMIN';
  const canSeeSupplies = state.me?.rol === 'ADMIN' || state.me?.rol === 'SUPERVISOR';
  useEffect(() => { void refreshInventory(); }, []);
  const updateProduct = <K extends keyof typeof productForm>(key: K, value: (typeof productForm)[K]) => setProductForm(current => ({ ...current, [key]: value }));
  const updateSupply = <K extends keyof typeof supplyForm>(key: K, value: (typeof supplyForm)[K]) => setSupplyForm(current => ({ ...current, [key]: value }));
  const createProduct = async () => {
    if (!productForm.nombre.trim()) { toast('Falta el nombre', true); return; }
    try {
      await api('/productos/', { method: 'POST', body: { ...productForm, nombre: productForm.nombre.trim(), stock_minimo: String(Number(productForm.stock_minimo) || 0), precio_referencia: Math.round(Number(productForm.precio_referencia) || 0), peso_saco_kg: productForm.peso_saco_kg || null } });
      toast('Producto creado. Carga su stock con una ENTRADA.'); setProductForm({ nombre: '', categoria: 'PAPA', variedad: '', unidad_medida: 'SACO', stock_minimo: '0', precio_referencia: '0', peso_saco_kg: '' }); await refreshInventory();
    } catch (error) { toast(error instanceof Error ? error.message : 'Error al crear el producto', true); }
  };
  const createSupply = async () => {
    if (!supplyForm.nombre.trim()) { toast('Falta el nombre', true); return; }
    try {
      await api('/insumos/', { method: 'POST', body: { ...supplyForm, nombre: supplyForm.nombre.trim(), stock_minimo: String(Number(supplyForm.stock_minimo) || 0), dosis_por_hectarea: String(Number(supplyForm.dosis_por_hectarea) || 0) } });
      toast('Insumo creado. Carga su stock con una ENTRADA.'); setSupplyForm({ nombre: '', tipo: 'OTRO', unidad_medida: 'SACO', stock_minimo: '0', dosis_por_hectarea: '0' }); await refreshInventory();
    } catch (error) { toast(error instanceof Error ? error.message : 'Error al crear el insumo', true); }
  };
  const saveMovement = async () => {
    const count = Number(quantity);
    if (!itemId) { toast('Elige un ítem', true); return; }
    if (!(count >= 0) || (movementType !== 'AJUSTE' && !(count > 0))) { toast('Indica una cantidad válida', true); return; }
    try {
      await api(`/${itemType}/${itemId}/movimiento/`, { method: 'POST', body: { tipo: movementType, cantidad: String(count), motivo: reason.trim() } });
      toast('Movimiento registrado'); setQuantity(''); setReason(''); await refreshInventory();
    } catch (error) { toast(error instanceof Error ? error.message : 'Error al registrar el movimiento', true); }
  };
  const stockMaximum = Math.max(1, ...state.cat.productos.map(product => Number(product.cantidad_disponible)));
  const required = Number(hectares) * Number(state.ins.find(item => item.id === supplyId)?.dosis_por_hectarea ?? 0);
  const selectedSupply = state.ins.find(item => item.id === supplyId);
  const selectedItems = itemType === 'productos' ? state.cat.productos : state.ins;
  return <>
    <section className="card"><h2>Stock de productos</h2>{state.cat.productos.map(product => <div className="li bar" key={product.id}>
      <span>{product.nombre}</span><span><b>{Number(product.cantidad_disponible)}</b> {product.unidad_medida} {lowStock(product) && <span className="bd no">Stock bajo</span>}</span>
      <i className={`pb ${lowStock(product) ? 'lo' : ''}`} aria-label={`Stock ${Number(product.cantidad_disponible)} de ${product.nombre}`}><u style={{ width: `${Math.min(100, Math.round(100 * Number(product.cantidad_disponible) / stockMaximum))}%` }} /></i>
    </div>)}{!state.cat.productos.length && <small>Sin datos. Sincroniza con conexión.</small>}</section>
    {canSeeSupplies && <section className="card"><h2>Insumos por hectárea</h2>
      <label htmlFor="supply-calc">Insumo</label><select id="supply-calc" value={supplyId} onChange={event => { setSupplyId(event.target.value); setCalculation(''); }}><option value="">Selecciona un insumo</option>{state.ins.map(item => <option key={item.id} value={item.id}>{item.nombre} ({Number(item.cantidad_disponible)} {item.unidad_medida})</option>)}</select>
      <label htmlFor="hectares">Hectáreas</label><input id="hectares" type="number" step="any" min="0" value={hectares} onChange={event => setHectares(event.target.value)} />
      <button className="btn" onClick={() => {
        if (!selectedSupply || !(Number(hectares) > 0)) { toast('Elige insumo e indica hectáreas', true); return; }
        setCalculation(`${required.toFixed(1)}|${Number(selectedSupply.cantidad_disponible)}`);
      }}>Calcular</button>
      {calculation && selectedSupply && <p aria-live="polite">
        Necesitas <b>{Number(calculation.split('|')[0]).toFixed(1)} {selectedSupply.unidad_medida}</b>. Tienes {Number(selectedSupply.cantidad_disponible)}.<br />
        {Number(selectedSupply.cantidad_disponible) >= required ? <span className="bd ok">{icon('check-circle')} Alcanza</span> : <span className="bd no">{icon('x-circle')} Faltan <b>{(required - Number(selectedSupply.cantidad_disponible)).toFixed(1)}</b></span>}
      </p>}
    </section>}
    {admin && <>
      <details className="card"><summary><b>{icon('plus-circle')} Nuevo producto de venta</b></summary>
        <label htmlFor="product-name">Nombre</label><input id="product-name" value={productForm.nombre} onChange={e => updateProduct('nombre', e.target.value)} />
        <label htmlFor="product-category">Categoría</label><select id="product-category" value={productForm.categoria} onChange={e => updateProduct('categoria', e.target.value)}>{[['PAPA', 'Papa'], ['TRIGO', 'Trigo'], ['AVENA', 'Avena'], ['MAIZ', 'Maíz'], ['GANADO', 'Ganado']].map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
        <label htmlFor="product-variety">Variedad</label><input id="product-variety" value={productForm.variedad} onChange={e => updateProduct('variedad', e.target.value)} />
        <label htmlFor="product-unit">Unidad de medida</label><select id="product-unit" value={productForm.unidad_medida} onChange={e => updateProduct('unidad_medida', e.target.value)}>{units.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
        <div className="row"><div><label htmlFor="product-min">Stock mínimo</label><input id="product-min" type="number" min="0" step="any" value={productForm.stock_minimo} onChange={e => updateProduct('stock_minimo', e.target.value)} /></div><div><label htmlFor="product-price">Precio referencia ($)</label><input id="product-price" type="number" min="0" value={productForm.precio_referencia} onChange={e => updateProduct('precio_referencia', e.target.value)} /></div></div>
        <label htmlFor="product-weight">Peso del saco (kg, opcional)</label><input id="product-weight" type="number" min="0" step="any" value={productForm.peso_saco_kg} onChange={e => updateProduct('peso_saco_kg', e.target.value)} />
        <button className="btn" onClick={() => void createProduct()}>{icon('check2-circle')} Guardar producto</button>
      </details>
      {canSeeSupplies && <details className="card"><summary><b>{icon('plus-circle')} Nuevo insumo agrícola</b></summary>
        <label htmlFor="supply-name">Nombre</label><input id="supply-name" value={supplyForm.nombre} onChange={e => updateSupply('nombre', e.target.value)} />
        <label htmlFor="supply-type">Tipo</label><select id="supply-type" value={supplyForm.tipo} onChange={e => updateSupply('tipo', e.target.value)}>{[['SEMILLA', 'Semilla'], ['FERTILIZANTE', 'Fertilizante'], ['PESTICIDA', 'Pesticida / Fungicida'], ['OTRO', 'Otro']].map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
        <label htmlFor="supply-unit">Unidad de medida</label><select id="supply-unit" value={supplyForm.unidad_medida} onChange={e => updateSupply('unidad_medida', e.target.value)}>{units.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
        <div className="row"><div><label htmlFor="supply-min">Stock mínimo</label><input id="supply-min" type="number" min="0" step="any" value={supplyForm.stock_minimo} onChange={e => updateSupply('stock_minimo', e.target.value)} /></div><div><label htmlFor="supply-dose">Dosis por hectárea</label><input id="supply-dose" type="number" min="0" step="any" value={supplyForm.dosis_por_hectarea} onChange={e => updateSupply('dosis_por_hectarea', e.target.value)} /></div></div>
        <button className="btn" onClick={() => void createSupply()}>{icon('check2-circle')} Guardar insumo</button>
      </details>}
      <details className="card"><summary><b>{icon('arrow-left-right')} Registrar movimiento de stock</b></summary>
        <label htmlFor="movement-kind">Tipo de ítem</label><select id="movement-kind" value={itemType} onChange={e => { setItemType(e.target.value as typeof itemType); setItemId(''); }}><option value="productos">Producto</option><option value="insumos">Insumo</option></select>
        <label htmlFor="movement-item">Ítem</label><select id="movement-item" value={itemId} onChange={e => setItemId(e.target.value)}><option value="">Selecciona un ítem</option>{selectedItems.map(item => <option key={item.id} value={item.id}>{item.nombre} ({Number(item.cantidad_disponible)} {item.unidad_medida})</option>)}</select>
        <label htmlFor="movement-type">Movimiento</label><select id="movement-type" value={movementType} onChange={e => setMovementType(e.target.value)}><option value="ENTRADA">Entrada</option><option value="SALIDA">Salida</option><option value="AJUSTE">Ajuste (nuevo stock total)</option></select>
        <label htmlFor="movement-quantity">Cantidad</label><input id="movement-quantity" type="number" min="0" step="any" value={quantity} onChange={e => setQuantity(e.target.value)} />
        <label htmlFor="movement-reason">Motivo</label><input id="movement-reason" maxLength={200} value={reason} onChange={e => setReason(e.target.value)} />
        <button className="btn" onClick={() => void saveMovement()}>{icon('check2-circle')} Registrar movimiento</button>
      </details>
      <section className="card"><h2>Movimientos recientes</h2>{movements.map(movement => <div className="li" key={movement.id}><span>{state.cat.productos.find(p => p.id === movement.item)?.nombre ?? state.ins.find(p => p.id === movement.item)?.nombre ?? 'Ítem'}<br /><small>{formatDate(movement.created_at)} {movement.motivo}</small></span>
        <span style={{ textAlign: 'right' }}><span className={`bd ${movement.tipo === 'ENTRADA' ? 'ok' : movement.tipo === 'SALIDA' ? 'no' : ''}`}>{movement.tipo}</span><br /><b>{Number(movement.cantidad)}</b></span></div>)}
        {!movements.length && <small>Sin movimientos</small>}</section>
    </>}
  </>;
}
