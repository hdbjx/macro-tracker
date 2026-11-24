import { supabase } from './supabase';
import type {
  Food,
  FoodLog,
  FoodServing,
  LogMethod,
  Macros,
  Meal,
  Profile,
  RecentFood,
  Target,
  WeightEntry,
} from './types';

function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

// ---------- profile ----------
export async function getProfile(userId: string): Promise<Profile | null> {
  const res = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  return check(res);
}

export async function updateProfile(userId: string, patch: Partial<Profile>) {
  check(await supabase.from('profiles').update(patch).eq('id', userId).select().single());
}

// ---------- targets ----------
export async function getActiveTarget(onDate: string): Promise<Target | null> {
  const res = await supabase
    .from('targets')
    .select('*')
    .lte('effective_from', onDate)
    .order('effective_from', { ascending: false })
    .limit(1)
    .maybeSingle();
  return check(res);
}

export async function setTarget(effectiveFrom: string, t: Macros, mode: 'manual' | 'adaptive' = 'manual', estTdee?: number) {
  check(
    await supabase
      .from('targets')
      .upsert(
        {
          effective_from: effectiveFrom,
          calories: Math.round(t.calories),
          protein_g: Math.round(t.protein_g),
          carbs_g: Math.round(t.carbs_g),
          fat_g: Math.round(t.fat_g),
          mode,
          est_tdee: estTdee ?? null,
        },
        { onConflict: 'user_id,effective_from' },
      )
      .select(),
  );
}

// ---------- logs ----------
export async function getLogs(day: string): Promise<FoodLog[]> {
  const res = await supabase.from('food_logs').select('*').eq('logged_on', day).order('logged_at');
  return check(res) ?? [];
}

export interface NewLog extends Macros {
  food_id?: string | null;
  serving_id?: string | null;
  logged_on: string;
  meal: Meal;
  quantity: number;
  name: string;
  method: LogMethod;
}

export async function addLog(log: NewLog) {
  check(await supabase.from('food_logs').insert(log).select());
}

export async function deleteLog(id: string) {
  check(await supabase.from('food_logs').delete().eq('id', id).select());
}

// ---------- foods ----------
export async function searchFoods(q: string): Promise<Food[]> {
  const res = await supabase.rpc('search_foods', { q, limit_n: 40 });
  return (check(res) as Food[]) ?? [];
}

export async function myFoods(): Promise<Food[]> {
  const res = await supabase.from('foods').select('*').eq('source', 'user').order('name');
  return check(res) ?? [];
}

export async function recentFoods(): Promise<RecentFood[]> {
  const res = await supabase.rpc('recent_foods', { limit_n: 25 });
  return (check(res) as RecentFood[]) ?? [];
}

export async function getFood(id: string): Promise<{ food: Food; servings: FoodServing[] } | null> {
  const [f, s] = await Promise.all([
    supabase.from('foods').select('*').eq('id', id).maybeSingle(),
    supabase.from('food_servings').select('*').eq('food_id', id).order('grams'),
  ]);
  const food = check(f) as Food | null;
  if (!food) return null;
  return { food, servings: (check(s) as FoodServing[]) ?? [] };
}

export type NewFood = Pick<Food, 'name' | 'brand' | 'serving_label' | 'serving_grams' | 'calories' | 'protein_g' | 'carbs_g' | 'fat_g'>;

export async function createFood(ownerId: string, food: NewFood): Promise<Food> {
  const res = await supabase
    .from('foods')
    .insert({ ...food, owner_id: ownerId, source: 'user', verified: false })
    .select()
    .single();
  return check(res) as Food;
}

// ---------- weights ----------
export async function getWeights(sinceDay: string): Promise<WeightEntry[]> {
  const res = await supabase
    .from('weight_entries')
    .select('id, measured_on, weight_kg')
    .gte('measured_on', sinceDay)
    .order('measured_on');
  return (check(res) as WeightEntry[]) ?? [];
}

export async function logWeight(day: string, weightKg: number) {
  check(
    await supabase
      .from('weight_entries')
      .upsert({ measured_on: day, weight_kg: Math.round(weightKg * 100) / 100 }, { onConflict: 'user_id,measured_on' })
      .select(),
  );
}

export async function deleteWeight(id: string) {
  check(await supabase.from('weight_entries').delete().eq('id', id).select());
}
