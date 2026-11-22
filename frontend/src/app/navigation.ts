import type { Role } from '../types';
import type { ScreenName } from './types';

export const menu: { id: ScreenName; icon: string; label: string; roles?: Role[] }[] = [
  { id: 'inicio', icon: 'house', label: 'Inicio' },
  { id: 'ventas', icon: 'receipt', label: 'Ventas', roles: ['ADMIN', 'VENDEDOR'] },
  { id: 'despachos', icon: 'truck', label: 'Despachos', roles: ['ADMIN', 'VENDEDOR'] },
  { id: 'clientes', icon: 'people', label: 'Clientes', roles: ['ADMIN', 'VENDEDOR'] },
  { id: 'inventario', icon: 'box-seam', label: 'Bodega' },
  { id: 'terreno', icon: 'tree', label: 'Terreno', roles: ['ADMIN', 'SUPERVISOR'] },
  { id: 'equipo', icon: 'person-badge', label: 'Equipo', roles: ['ADMIN', 'SUPERVISOR'] },
  { id: 'finanzas', icon: 'cash-coin', label: 'Finanzas', roles: ['ADMIN'] },
  { id: 'nomina', icon: 'person-lines-fill', label: 'Nómina', roles: ['ADMIN'] },
];
