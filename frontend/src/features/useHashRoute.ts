import { useEffect, useState } from 'react';
import type { HashRoute, ScreenName } from '../app/types';

const routeFromHash = (): HashRoute => {
  const [screen = 'inicio', arg = ''] = location.hash.replace(/^#\/?/, '').split('/');
  const available: ScreenName[] = ['inicio', 'ventas', 'venta', 'nueva-venta', 'clientes', 'despachos', 'inventario', 'terreno', 'equipo', 'finanzas', 'nomina'];
  return { screen: available.includes(screen as ScreenName) ? screen as ScreenName : 'inicio', arg };
};

export function useHashRoute(): HashRoute {
  const [route, setRoute] = useState(routeFromHash);
  useEffect(() => {
    const change = () => setRoute(routeFromHash());
    window.addEventListener('hashchange', change);
    if (!location.hash) location.hash = '#/inicio';
    return () => window.removeEventListener('hashchange', change);
  }, []);
  return route;
}
