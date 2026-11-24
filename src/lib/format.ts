import type { Meal, Units } from './types';

/** Local calendar date as YYYY-MM-DD (not UTC). */
export function toISODate(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fromISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s: string, n: number): string {
  const d = fromISODate(s);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

export function dayLabel(s: string): string {
  const today = toISODate();
  if (s === today) return 'Today';
  if (s === addDays(today, -1)) return 'Yesterday';
  if (s === addDays(today, 1)) return 'Tomorrow';
  return fromISODate(s).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export const MEAL_LABEL: Record<Meal, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snacks',
};

/** Default meal based on time of day. */
export function mealForNow(d: Date = new Date()): Meal {
  const h = d.getHours();
  if (h < 11) return 'breakfast';
  if (h < 15) return 'lunch';
  if (h < 21) return 'dinner';
  return 'snack';
}

export const KG_PER_LB = 0.45359237;
export const CM_PER_IN = 2.54;

export function kgToDisplay(kg: number, units: Units): number {
  return units === 'imperial' ? kg / KG_PER_LB : kg;
}
export function displayToKg(v: number, units: Units): number {
  return units === 'imperial' ? v * KG_PER_LB : v;
}
export function weightUnit(units: Units) {
  return units === 'imperial' ? 'lb' : 'kg';
}

export function round(n: number, places = 0): number {
  const f = 10 ** places;
  return Math.round(n * f) / f;
}

export function fmt(n: number): string {
  return Math.round(n).toLocaleString();
}

/** Parse user-typed numbers; returns NaN if empty/invalid. */
export function num(s: string): number {
  if (!s.trim()) return NaN;
  return Number(s.replace(',', '.'));
}
