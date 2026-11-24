import type { Activity, Goal, Macros, Sex } from './types';

const ACTIVITY_FACTOR: Record<Activity, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export const ACTIVITY_LABEL: Record<Activity, { title: string; sub: string }> = {
  sedentary: { title: 'Mostly sitting', sub: 'Desk job, little exercise' },
  light: { title: 'Lightly active', sub: 'On your feet some, or 1–2 workouts/wk' },
  moderate: { title: 'Active', sub: '3–4 workouts/wk or a physical job' },
  active: { title: 'Very active', sub: '5–6 hard sessions/wk' },
  very_active: { title: 'Athlete', sub: 'Twice-a-day training or heavy labor' },
};

const KCAL_PER_KG = 7700;

export interface TargetInput {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activity: Activity;
  goal: Goal;
  /** kg per week; negative to lose */
  ratePerWeek: number;
}

/** Mifflin–St Jeor BMR. */
export function bmr({ sex, age, heightCm, weightKg }: Pick<TargetInput, 'sex' | 'age' | 'heightCm' | 'weightKg'>) {
  return 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'male' ? 5 : -161);
}

export function estimateTdee(input: TargetInput) {
  return bmr(input) * ACTIVITY_FACTOR[input.activity];
}

/**
 * Starting targets. Protein ~1.8 g/kg (higher on a cut), fat 25% of calories,
 * carbs fill the rest. Calories floored at a safe minimum.
 */
export function startingTargets(input: TargetInput): Macros & { tdee: number } {
  const tdee = estimateTdee(input);
  const rate = input.goal === 'maintain' ? 0 : input.ratePerWeek;
  const floor = input.sex === 'male' ? 1500 : 1200;
  const calories = Math.max(floor, Math.round((tdee + (rate * KCAL_PER_KG) / 7) / 10) * 10);
  return { ...macrosFor(calories, input.weightKg, input.goal), tdee: Math.round(tdee) };
}

export function macrosFor(calories: number, weightKg: number, goal: Goal): Macros {
  const proteinPerKg = goal === 'lose' ? 2.0 : 1.8;
  let protein = Math.round(weightKg * proteinPerKg);
  protein = Math.min(protein, Math.round((calories * 0.4) / 4));
  const fat = Math.round((calories * 0.25) / 9);
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));
  return { calories, protein_g: protein, carbs_g: carbs, fat_g: fat };
}

/** Calories implied by macros (for the editor). */
export function caloriesFromMacros(p: number, c: number, f: number) {
  return Math.round(p * 4 + c * 4 + f * 9);
}
