export type Sex = 'male' | 'female';
export type Activity = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type Goal = 'lose' | 'maintain' | 'gain';
export type Units = 'imperial' | 'metric';
export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type LogMethod = 'search' | 'barcode' | 'recent' | 'quick_add' | 'ai_text' | 'ai_photo' | 'copy';

export const MEALS: Meal[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export interface Profile {
  id: string;
  display_name: string | null;
  sex: Sex | null;
  birth_year: number | null;
  height_cm: number | null;
  activity_level: Activity | null;
  goal: Goal | null;
  goal_rate_kg_per_week: number | null;
  units: Units;
  onboarded: boolean;
}

export interface Food {
  id: string;
  owner_id: string | null;
  source: 'usda' | 'fatsecret' | 'curated' | 'user';
  barcode: string | null;
  name: string;
  brand: string | null;
  serving_label: string;
  serving_grams: number | null;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number | null;
  verified: boolean;
}

export interface FoodServing {
  id: string;
  food_id: string;
  label: string;
  grams: number;
}

export interface FoodLog {
  id: string;
  food_id: string | null;
  serving_id: string | null;
  logged_on: string;
  meal: Meal;
  quantity: number;
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  method: LogMethod;
  logged_at: string;
}

export interface Target {
  id: string;
  effective_from: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  mode: 'manual' | 'adaptive';
}

export interface WeightEntry {
  id: string;
  measured_on: string;
  weight_kg: number;
}

export interface RecentFood {
  food_id: string;
  name: string;
  brand: string | null;
  serving_label: string;
  calories: number;
  last_quantity: number;
  last_serving_id: string | null;
  last_meal: Meal;
  times_logged: number;
}

export interface Macros {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}
