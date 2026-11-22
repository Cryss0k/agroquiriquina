import type { AppState, Movement } from '../types';

export type ScreenName = 'inicio' | 'ventas' | 'venta' | 'nueva-venta' | 'clientes' | 'despachos' | 'inventario' | 'terreno' | 'equipo' | 'finanzas' | 'nomina';
export interface HashRoute { screen: ScreenName; arg: string }
export interface AppActions {
  state: AppState;
  update: (fn: (draft: AppState) => void) => void;
  toast: (text: string, error?: boolean) => void;
  sync: (show?: boolean) => Promise<void>;
  refreshInventory: () => Promise<void>;
}
export interface ScreenProps extends AppActions { route: HashRoute; movements: Movement[] }
