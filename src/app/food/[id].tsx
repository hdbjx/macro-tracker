import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Header, backToToday } from '@/components/Header';
import { colors, radius, space } from '@/components/theme';
import { Button, Card, ErrorText, Field, Loading, Screen, T } from '@/components/ui';
import { addLog, getFood } from '@/lib/db';
import { MEAL_LABEL, fmt, num, toISODate } from '@/lib/format';
import { logName, portionOptions, scaleMacros } from '@/lib/portion';
import { MEALS, type Food, type FoodServing, type Meal } from '@/lib/types';

export default function FoodDetail() {
  const p = useLocalSearchParams<{ id: string; meal?: string; day?: string; qty?: string; serving?: string; method?: string }>();
  const meal: Meal = MEALS.includes(p.meal as Meal) ? (p.meal as Meal) : 'snack';
  const day = p.day ?? toISODate();
  const [food, setFood] = useState<Food | null>(null);
  const [servings, setServings] = useState<FoodServing[]>([]);
  const [qty, setQty] = useState(p.qty ?? '1');
  const [portionId, setPortionId] = useState<string | null>(p.serving ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getFood(p.id)
      .then((d) => {
        if (!d) return setError('Food not found.');
        setFood(d.food);
        setServings(d.servings);
        // Default to the label/household serving (e.g. "1 bar (52 g)") rather than 100 g.
        if (!p.serving && d.servings.length && Number(d.food.serving_grams) > 0) setPortionId(d.servings[0].id);
      })
      .catch((e) => setError(e.message));
  }, [p.id, p.serving]);

  const options = useMemo(() => (food ? portionOptions(food, servings) : []), [food, servings]);
  const portion = options.find((o) => o.id === portionId) ?? options[0];
  const q = num(qty);
  const macros = food && portion && q > 0 ? scaleMacros(food, portion.factor, q) : null;

  async function log() {
    if (!food || !macros || !portion) return;
    setBusy(true);
    try {
      await addLog({
        food_id: food.id,
        serving_id: portion.id && portion.id !== 'g' ? portion.id : null,
        logged_on: day,
        meal,
        quantity: q,
        name: logName(food),
        method: p.method === 'barcode' ? 'barcode' : 'search',
        ...macros,
      });
      backToToday();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not log.');
      setBusy(false);
    }
  }

  if (!food) {
    return error ? (
      <Screen>
        <Header title="Food" />
        <ErrorText>{error}</ErrorText>
      </Screen>
    ) : (
      <Loading />
    );
  }

  return (
    <Screen>
      <Header title={food.name} />
      {food.brand ? <T color={colors.muted} style={{ marginTop: -space.lg, marginBottom: space.lg, marginLeft: 52 }}>{food.brand}</T> : null}

      {!food.verified && food.source !== 'user' ? (
        <T v="small" color={colors.over} style={{ marginBottom: space.md }}>
          Community-submitted data — double-check it against the label.
        </T>
      ) : null}
      <Card style={{ alignItems: 'center', paddingVertical: space.xl }}>
        <T v="hero" color={colors.accent}>{fmt(macros?.calories ?? 0)}</T>
        <T v="small" color={colors.muted}>calories</T>
        <View style={styles.macroRow}>
          <Macro label="Protein" value={macros?.protein_g ?? 0} color={colors.protein} />
          <Macro label="Carbs" value={macros?.carbs_g ?? 0} color={colors.carbs} />
          <Macro label="Fat" value={macros?.fat_g ?? 0} color={colors.fat} />
        </View>
      </Card>

      <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.xl, alignItems: 'flex-end' }}>
        <Field
          style={{ flex: 1 }}
          label="Amount"
          value={qty}
          onChangeText={setQty}
          keyboardType="decimal-pad"
          selectTextOnFocus
        />
        <Step label="−" onPress={() => setQty(String(Math.max(0.25, (q || 1) - (portion?.id === 'g' ? 10 : 0.5))))} />
        <Step label="+" onPress={() => setQty(String((q || 0) + (portion?.id === 'g' ? 10 : 0.5)))} />
      </View>

      <T v="label" color={colors.muted} style={{ marginTop: space.xl, marginBottom: space.sm }}>Serving</T>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
        {options.map((o) => {
          const on = o.id === portion?.id;
          return (
            <Pressable
              key={o.id ?? 'base'}
              onPress={() => {
                if (o.id === 'g' && portion?.id !== 'g') setQty(String(Math.round(Number(food.serving_grams) * (q || 1))));
                if (o.id !== 'g' && portion?.id === 'g') setQty('1');
                setPortionId(o.id);
              }}
              style={[styles.chip, on && styles.chipOn]}
            >
              <T v="small" color={on ? colors.accentInk : colors.text} style={{ fontWeight: '700' }}>{o.label}</T>
            </Pressable>
          );
        })}
      </ScrollView>

      <ErrorText>{error}</ErrorText>
      <Button title={`Add to ${MEAL_LABEL[meal]}`} onPress={log} loading={busy} disabled={!macros} style={{ marginTop: space.xxl }} />
    </Screen>
  );
}

function Macro({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color, marginBottom: 6 }} />
      <T v="h2">{Math.round(value * 10) / 10}g</T>
      <T v="small" color={colors.muted}>{label}</T>
    </View>
  );
}

function Step({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.step}>
      <T v="h2">{label}</T>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  macroRow: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    marginTop: space.xl,
    paddingTop: space.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  step: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    paddingHorizontal: space.lg,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
  },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
});
