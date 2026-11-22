import type { ReactNode } from 'react';
import type { AppState, Product, QueuedSale } from '../types';

export const laborNames: Record<string, [string, string]> = {
  COSECHA_PAPA: ['Cosecha de papa', 'SACO'], ENSACADO: ['Ensacado', 'SACO'], SIEMBRA: ['Siembra', 'JORNADA'],
  CARGA: ['Carga / estiba', 'SACO'], JORNAL: ['Jornal diario', 'JORNADA'], OTRA: ['Otra labor', 'JORNADA'],
};
export const units: [string, string][] = [['SACO', 'Saco'], ['KG', 'Kilogramo'], ['QQ', 'Quintal (100 kg)'], ['TON', 'Tonelada'], ['UN', 'Unidad'], ['LT', 'Litro'], ['CABEZA', 'Cabeza (ganado)']];
export const formatMoney = (amount: number | string | null | undefined): string => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Number(amount) || 0);
export const formatDate = (date?: string): string => date ? new Date(date).toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' }) : '';
export const localDate = (): string => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
export const initials = (name?: string): string => String(name || '?').trim().split(/\s+/).slice(0, 2).map(part => part[0] ?? '').join('').toUpperCase();
export const validRut = (input: string): boolean => {
  const rut = input.replace(/[.\-\s]/g, '').toUpperCase();
  if (!/^\d{6,8}[\dK]$/.test(rut)) return false;
  let sum = 0; let multiplier = 2;
  for (const digit of rut.slice(0, -1).split('').reverse()) { sum += Number(digit) * multiplier; multiplier = multiplier === 7 ? 2 : multiplier + 1; }
  const result = 11 - sum % 11;
  return rut.slice(-1) === (result === 11 ? '0' : result === 10 ? 'K' : String(result));
};
export const formatRut = (input: string): string => { const value = input.replace(/[.\-\s]/g, '').toUpperCase(); return `${value.slice(0, -1)}-${value.slice(-1)}`; };
export const sumSale = (sale: Pick<QueuedSale, 'detalles'>): number => sale.detalles.reduce((sum, line) => sum + Number(line.cantidad) * Number(line.precio_unitario), 0);
export const lowStock = (product: Product): boolean => Number(product.cantidad_disponible) <= Number(product.stock_minimo);
export const pendingCount = (state: AppState): number => state.q.clientes.length + state.q.ventas.length + state.q.desempenos.length;
export const icon = (name: string): ReactNode => <i className={`bi bi-${name}`} aria-hidden="true" />;
