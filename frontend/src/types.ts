export type Role = 'ADMIN' | 'VENDEDOR' | 'SUPERVISOR';
export interface Token { access: string; refresh: string }
export interface User { id: string; username: string; first_name?: string; last_name?: string; rol: Role; persona?: string | null; is_active?: boolean }
export interface Client { id: string; rut: string; nombre: string; telefono?: string; comuna?: string; is_deleted?: boolean }
export interface Product { id: string; nombre: string; categoria?: string; variedad?: string; unidad_medida: string; cantidad_disponible: number | string; stock_minimo: number | string; precio_referencia: number | string; peso_saco_kg?: number | string | null; is_deleted?: boolean }
export interface Worker { id: string; rut: string; nombre: string; tipo_contrato?: string; cargo?: string; tarifa_diaria?: number; activo?: boolean; is_deleted?: boolean }
export interface Supply extends Product { tipo?: string; dosis_por_hectarea: number }
export interface Catalog { clientes: Client[]; productos: Product[]; trabajadores: Worker[] }
export interface SaleLine { id: string; producto: string; cantidad: number | string; precio_unitario: number }
export interface Payment { id: string; monto: number; estado: string; metodo: string; fecha_pago?: string; fecha_vencimiento?: string }
export interface Dispatch { id: string; venta: string; fecha: string; hora?: string; direccion: string; comuna?: string; estado: string; transportista?: string; patente?: string; observaciones?: string }
export interface Sale { id: string; cliente: string; fecha: string; detalles: SaleLine[]; pagos: Payment[]; total: number; saldo_pendiente: number; estado: string; estado_pago: string; requiere_revision?: boolean; despacho?: Dispatch }
export interface QueuedSale { id: string; cliente: string; fecha: string; device_id: string; detalles: SaleLine[]; pagos: Payment[]; despacho?: Pick<Dispatch, 'id' | 'fecha' | 'direccion' | 'comuna'> }
export interface WorkLog { id: string; trabajador: string; fecha: string; labor: string; cantidad: string; unidad: string; device_id: string; tarifa_unitaria?: string }
export interface HistoryItem { id: string; n: string; l: string; c: string; u: string; f: string }
export interface Supplier { id: string; rut: string; nombre: string; rubro?: string; telefono?: string; condiciones_pago?: string }
export interface Account { id: string; username: string; first_name: string; last_name: string; rol: Role; persona?: string | null; is_active: boolean; intentos_fallidos: number; bloqueado: boolean }
export interface Payroll { id: string; trabajador: string; periodo_inicio: string; periodo_fin: string; total_liquido: number; estado: string }
export interface Movement { id: string; item: string; created_at: string; motivo?: string; tipo: string; cantidad: number }
export interface AppState {
  tok: Token | null; me: User | null; cat: Catalog; q: { clientes: Client[]; ventas: QueuedSale[]; desempenos: WorkLog[] };
  last: number | null; catTime: string | null; ventas: Sale[]; hist: HistoryItem[]; ins: Supply[];
  errs: Record<string, string>; online: boolean; busy: boolean;
}
export interface ApiList<T> { results: T[] }
