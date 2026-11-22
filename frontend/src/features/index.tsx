import type { ScreenProps } from '../app/types';
import { Dashboard } from './dashboard/Dashboard';
import { Sales, NewSale, SaleDetail } from './sales/Sales';
import { Clients } from './clients/Clients';
import { Dispatches } from './dispatches/Dispatches';
import { Inventory } from './inventory/Inventory';
import { Terrain } from './terrain/Terrain';
import { Team } from './team/Team';
import { Finance } from './finance/Finance';
import { PayrollScreen } from './payroll/Payroll';

export function ScreenRouter({ route, movements, ...actions }: ScreenProps) {
  switch (route.screen) {
    case 'inicio': return <Dashboard {...actions} />;
    case 'ventas': return <Sales {...actions} />;
    case 'nueva-venta': return <NewSale {...actions} />;
    case 'venta': return <SaleDetail {...actions} id={route.arg} />;
    case 'clientes': return <Clients {...actions} />;
    case 'despachos': return <Dispatches {...actions} />;
    case 'inventario': return <Inventory {...actions} movements={movements} />;
    case 'terreno': return <Terrain {...actions} />;
    case 'equipo': return <Team {...actions} />;
    case 'finanzas': return <Finance {...actions} />;
    case 'nomina': return <PayrollScreen {...actions} />;
    default: return <Dashboard {...actions} />;
  }
}
