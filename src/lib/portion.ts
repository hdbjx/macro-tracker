import type { Food, FoodServing, Macros } from './types';

export interface PortionOption {
  /** null = the food's base serving; 'g' = raw grams; otherwise a food_servings id */
  id: string | null;
  label: string;
  /** multiplier of the base serving for quantity = 1 */
  factor: number;
}

export function portionOptions(food: Food, servings: FoodServing[]): PortionOption[] {
  const opts: PortionOption[] = [{ id: null, label: food.serving_label, factor: 1 }];
  const base = Number(food.serving_grams) || 0;
  if (base > 0) {
    servings.forEach((s) => opts.push({ id: s.id, label: s.label, factor: Number(s.grams) / base }));
    if (food.serving_label.trim().toLowerCase() !== '1 g') opts.push({ id: 'g', label: 'g', factor: 1 / base });
  }
  return opts;
}

export function scaleMacros(food: Food, factor: number, qty: number): Macros {
  const k = factor * qty;
  return {
    calories: Math.round(Number(food.calories) * k * 10) / 10,
    protein_g: Math.round(Number(food.protein_g) * k * 10) / 10,
    carbs_g: Math.round(Number(food.carbs_g) * k * 10) / 10,
    fat_g: Math.round(Number(food.fat_g) * k * 10) / 10,
  };
}

/** Name stored on the log entry. */
export function logName(food: Food) {
  return food.brand ? `${food.name} (${food.brand})` : food.name;
}
