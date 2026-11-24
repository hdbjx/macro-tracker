// food-search: USDA FoodData Central search + barcode lookup, cached into public.foods.
//
// POST { q: string }        -> { foods: Food[] }   (USDA generic + branded)
// POST { barcode: string }  -> { food: Food | null }
//
// Secrets: USDA_API_KEY (set in Supabase → Edge Functions → Secrets).
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are provided automatically.

import { createClient } from 'npm:@supabase/supabase-js@2';

const USDA = 'https://api.nal.usda.gov/fdc/v1/foods/search';
const CACHE_DAYS = 14;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

// ---------------------------------------------------------------------------
// USDA parsing (defensive: search results use either number/amount or
// nutrientNumber/value depending on API version)
// ---------------------------------------------------------------------------
type UsdaNutrient = {
  nutrientId?: number;
  nutrientNumber?: string;
  number?: string;
  value?: number;
  amount?: number;
  unitName?: string;
};
type UsdaFood = {
  fdcId: number;
  description: string;
  dataType: string;
  brandOwner?: string;
  brandName?: string;
  gtinUpc?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  householdServingFullText?: string;
  foodNutrients?: UsdaNutrient[];
  foodMeasures?: { disseminationText?: string; gramWeight?: number }[];
};

// nutrient number -> id (both appear in the wild)
const N = {
  kcal: { num: ['208'], id: [1008] },
  kcalAtwater: { num: ['957', '958'], id: [2047, 2048] },
  kj: { num: ['268'], id: [1062] },
  protein: { num: ['203'], id: [1003] },
  carbs: { num: ['205'], id: [1005] },
  fat: { num: ['204'], id: [1004] },
  fiber: { num: ['291'], id: [1079] },
  sugar: { num: ['269'], id: [2000] },
  sodium: { num: ['307'], id: [1093] },
};

function nutrient(f: UsdaFood, key: keyof typeof N): number | null {
  const want = N[key];
  for (const n of f.foodNutrients ?? []) {
    const num = n.nutrientNumber ?? n.number;
    if ((num && want.num.includes(String(num))) || (n.nutrientId && want.id.includes(n.nutrientId))) {
      const v = n.value ?? n.amount;
      if (typeof v === 'number' && isFinite(v)) return v;
    }
  }
  return null;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

function titleCase(s: string) {
  // Branded descriptions come in ALL CAPS
  if (s !== s.toUpperCase()) return s;
  return s.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase());
}

/** Map a USDA result to a foods row (values per 100 g) plus extra servings. */
function mapUsda(f: UsdaFood) {
  const protein = nutrient(f, 'protein') ?? 0;
  const carbs = nutrient(f, 'carbs') ?? 0;
  const fat = nutrient(f, 'fat') ?? 0;
  let kcal = nutrient(f, 'kcal') ?? nutrient(f, 'kcalAtwater');
  if (kcal == null) {
    const kj = nutrient(f, 'kj');
    kcal = kj != null ? kj / 4.184 : protein * 4 + carbs * 4 + fat * 9;
  }
  if (!f.description || kcal == null || kcal < 0) return null;

  const branded = f.dataType === 'Branded';
  const brand = branded ? titleCase(f.brandName || f.brandOwner || '') || null : null;

  const servings: { label: string; grams: number }[] = [];
  const unit = (f.servingSizeUnit ?? '').toLowerCase();
  if (branded && f.servingSize && f.servingSize > 0 && ['g', 'grm', 'ml', 'mlt'].includes(unit)) {
    const household = f.householdServingFullText?.trim();
    const unitLabel = unit.startsWith('m') ? 'ml' : 'g';
    const label = household ? `${household} (${Math.round(f.servingSize)} ${unitLabel})` : `1 serving (${Math.round(f.servingSize)} ${unitLabel})`;
    servings.push({ label: label.slice(0, 80), grams: f.servingSize });
  }
  for (const m of f.foodMeasures ?? []) {
    if (m.disseminationText && m.gramWeight && m.gramWeight > 0 && servings.length < 6) {
      const label = m.disseminationText.trim().slice(0, 80);
      if (label && !servings.some((s) => s.label === label)) servings.push({ label, grams: m.gramWeight });
    }
  }

  return {
    row: {
      source: 'usda',
      source_id: String(f.fdcId),
      owner_id: null,
      barcode: f.gtinUpc ? f.gtinUpc.replace(/\D/g, '') || null : null,
      name: titleCase(f.description).slice(0, 200),
      brand,
      serving_label: '100 g',
      serving_grams: 100,
      calories: r1(kcal),
      protein_g: r1(protein),
      carbs_g: r1(carbs),
      fat_g: r1(fat),
      fiber_g: nutrient(f, 'fiber'),
      sugar_g: nutrient(f, 'sugar'),
      sodium_mg: nutrient(f, 'sodium'),
      verified: true,
    },
    servings,
  };
}

async function usdaSearch(query: string, dataType: string[], pageSize: number): Promise<UsdaFood[]> {
  const res = await fetch(`${USDA}?api_key=${Deno.env.get('USDA_API_KEY')}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, dataType, pageSize }),
  });
  if (!res.ok) throw new Error(`USDA ${res.status}`);
  const body = await res.json();
  return (body.foods ?? []) as UsdaFood[];
}

/** Upsert mapped foods + their servings; returns rows in input order. */
async function saveFoods(mapped: NonNullable<ReturnType<typeof mapUsda>>[]) {
  if (!mapped.length) return [];
  const { data, error } = await admin
    .from('foods')
    .upsert(mapped.map((m) => m.row), { onConflict: 'source,source_id' })
    .select();
  if (error) throw error;
  const byId = new Map((data ?? []).map((r) => [`${r.source}:${r.source_id}`, r]));

  const servingRows = mapped.flatMap((m) => {
    const food = byId.get(`${m.row.source}:${m.row.source_id}`);
    return food ? m.servings.map((s) => ({ food_id: food.id, label: s.label, grams: s.grams })) : [];
  });
  if (servingRows.length) {
    await admin.from('food_servings').upsert(servingRows, { onConflict: 'food_id,label', ignoreDuplicates: true });
  }
  return mapped.map((m) => byId.get(`${m.row.source}:${m.row.source_id}`)).filter(Boolean);
}

async function foodsBySourceIds(ids: string[]) {
  if (!ids.length) return [];
  const { data } = await admin.from('foods').select('*').eq('source', 'usda').in('source_id', ids);
  const map = new Map((data ?? []).map((r) => [r.source_id, r]));
  return ids.map((id) => map.get(id)).filter(Boolean);
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------
async function search(raw: string) {
  const q = raw.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 80);
  if (q.length < 2) return [];

  const { data: cached } = await admin.from('usda_query_cache').select('*').eq('q', q).maybeSingle();
  if (cached && Date.now() - new Date(cached.fetched_at).getTime() < CACHE_DAYS * 86400000) {
    return foodsBySourceIds(cached.source_ids);
  }

  // Generic foods first (clean whole-food data), then branded.
  const [generic, branded] = await Promise.all([
    usdaSearch(q, ['Foundation', 'SR Legacy'], 12).catch(() => []),
    usdaSearch(q, ['Branded'], 25).catch(() => []),
  ]);
  const mapped = [...generic, ...branded].map(mapUsda).filter((m): m is NonNullable<typeof m> => !!m);

  // Drop near-duplicate branded entries (same brand + name)
  const seen = new Set<string>();
  const unique = mapped.filter((m) => {
    const k = `${m.row.brand ?? ''}|${m.row.name}`.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  const saved = await saveFoods(unique);
  await admin
    .from('usda_query_cache')
    .upsert({ q, source_ids: unique.map((m) => m.row.source_id), fetched_at: new Date().toISOString() });
  return saved;
}

// ---------------------------------------------------------------------------
// Barcode
// ---------------------------------------------------------------------------
/** All the forms a UPC/EAN might be stored in (UPC-A 12, EAN-13 with leading 0, GTIN-14). */
function barcodeVariants(code: string) {
  const d = code.replace(/\D/g, '');
  const core = d.replace(/^0+/, '');
  const set = new Set<string>([d, core]);
  for (const len of [12, 13, 14]) if (core.length <= len) set.add(core.padStart(len, '0'));
  return [...set].filter(Boolean);
}

async function lookupBarcode(code: string) {
  const variants = barcodeVariants(code);
  if (!variants.length) return null;

  // 1. Already in our database? Prefer verified sources.
  const { data: existing } = await admin
    .from('foods')
    .select('*')
    .is('owner_id', null)
    .in('barcode', variants)
    .order('verified', { ascending: false })
    .limit(1);
  if (existing?.length) return existing[0];

  // 2. USDA branded foods
  const core = variants.reduce((a, b) => (b.length < a.length ? b : a));
  const usda = await usdaSearch(code.replace(/\D/g, ''), ['Branded'], 10).catch(() => []);
  const hit = usda.find((f) => f.gtinUpc && f.gtinUpc.replace(/\D/g, '').replace(/^0+/, '') === core);
  if (hit) {
    const m = mapUsda(hit);
    if (m) {
      const [row] = await saveFoods([m]);
      if (row) return row;
    }
  }

  // 3. Open Food Facts fallback (crowdsourced → stored unverified)
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${variants[0]}.json?fields=product_name,brands,nutriments,serving_size,serving_quantity`, {
      headers: { 'User-Agent': 'MacroTracker/0.1 (everydetail.co)' },
    });
    if (res.ok) {
      const body = await res.json();
      const p = body.product;
      const n = p?.nutriments ?? {};
      const kcal = n['energy-kcal_100g'] ?? (n['energy_100g'] ? n['energy_100g'] / 4.184 : null);
      if (body.status === 1 && p?.product_name && typeof kcal === 'number') {
        const row = {
          source: 'openfoodfacts',
          source_id: variants[0],
          owner_id: null,
          barcode: variants[0],
          name: String(p.product_name).slice(0, 200),
          brand: p.brands ? String(p.brands).split(',')[0].trim() : null,
          serving_label: '100 g',
          serving_grams: 100,
          calories: r1(kcal),
          protein_g: r1(n.proteins_100g ?? 0),
          carbs_g: r1(n.carbohydrates_100g ?? 0),
          fat_g: r1(n.fat_100g ?? 0),
          fiber_g: n.fiber_100g ?? null,
          sugar_g: n.sugars_100g ?? null,
          sodium_mg: typeof n.sodium_100g === 'number' ? n.sodium_100g * 1000 : null,
          verified: false,
        };
        const servings =
          p.serving_quantity && Number(p.serving_quantity) > 0
            ? [{ label: String(p.serving_size || `1 serving (${p.serving_quantity} g)`).slice(0, 80), grams: Number(p.serving_quantity) }]
            : [];
        const [saved] = await saveFoods([{ row, servings } as never]);
        if (saved) return saved;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

// ---------------------------------------------------------------------------
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  // Only signed-in users may call this.
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: auth } = await admin.auth.getUser(token);
  if (!auth?.user) return json({ error: 'Not signed in' }, 401);

  try {
    const body = await req.json().catch(() => ({}));
    if (typeof body.barcode === 'string') return json({ food: await lookupBarcode(body.barcode) });
    if (typeof body.q === 'string') return json({ foods: await search(body.q) });
    return json({ error: 'Send { q } or { barcode }' }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : 'Search failed' }, 500);
  }
});
