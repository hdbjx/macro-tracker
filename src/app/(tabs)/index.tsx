import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CalorieRing, MacroBar } from '@/components/charts';
import { ChevronIcon, PlusIcon } from '@/components/icons';
import { colors, radius, space } from '@/components/theme';
import { Card, ErrorText, T, confirm } from '@/components/ui';
import { deleteLog, getActiveTarget, getLogs } from '@/lib/db';
import { MEAL_LABEL, addDays, dayLabel, fmt, toISODate } from '@/lib/format';
import { MEALS, type FoodLog, type Meal, type Target } from '@/lib/types';

export default function Today() {
  const [day, setDay] = useState(toISODate());
  const [logs, setLogs] = useState<FoodLog[]>([]);
  const [target, setTarget] = useState<Target | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [l, t] = await Promise.all([getLogs(day), getActiveTarget(day)]);
      setLogs(l);
      setTarget(t);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load.');
    }
  }, [day]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const totals = useMemo(
    () =>
      logs.reduce(
        (a, l) => ({
          calories: a.calories + Number(l.calories),
          protein_g: a.protein_g + Number(l.protein_g),
          carbs_g: a.carbs_g + Number(l.carbs_g),
          fat_g: a.fat_g + Number(l.fat_g),
        }),
        { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
      ),
    [logs],
  );

  const byMeal = useMemo(() => {
    const m: Record<Meal, FoodLog[]> = { breakfast: [], lunch: [], dinner: [], snack: [] };
    logs.forEach((l) => m[l.meal].push(l));
    return m;
  }, [logs]);

  async function remove(l: FoodLog) {
    if (await confirm('Remove entry?', l.name, 'Remove')) {
      setLogs((prev) => prev.filter((x) => x.id !== l.id));
      try {
        await deleteLog(l.id);
      } catch {
        load();
      }
    }
  }

  const isToday = day === toISODate();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: space.lg, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            tintColor={colors.accent}
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
      >
        <View style={styles.header}>
          <Pressable hitSlop={12} onPress={() => setDay(addDays(day, -1))} style={styles.navBtn}>
            <ChevronIcon dir="left" color={colors.text} />
          </Pressable>
          <Pressable onPress={() => setDay(toISODate())}>
            <T v="h2">{dayLabel(day)}</T>
          </Pressable>
          <Pressable
            hitSlop={12}
            onPress={() => setDay(addDays(day, 1))}
            style={[styles.navBtn, isToday && { opacity: 0.3 }]}
            disabled={isToday}
          >
            <ChevronIcon dir="right" color={colors.text} />
          </Pressable>
        </View>

        <Card style={{ alignItems: 'center', paddingVertical: space.xl }}>
          <CalorieRing eaten={totals.calories} target={target?.calories ?? 0} />
          <View style={styles.ringMeta}>
            <Meta label="Goal" value={fmt(target?.calories ?? 0)} />
            <Meta label="Eaten" value={fmt(totals.calories)} />
          </View>
          <View style={styles.macros}>
            <MacroBar label="Protein" value={totals.protein_g} target={target?.protein_g ?? 0} color={colors.protein} />
            <MacroBar label="Carbs" value={totals.carbs_g} target={target?.carbs_g ?? 0} color={colors.carbs} />
            <MacroBar label="Fat" value={totals.fat_g} target={target?.fat_g ?? 0} color={colors.fat} />
          </View>
        </Card>
        <ErrorText>{error}</ErrorText>

        {MEALS.map((meal) => {
          const entries = byMeal[meal];
          const kcal = entries.reduce((a, l) => a + Number(l.calories), 0);
          return (
            <View key={meal} style={styles.meal}>
              <Pressable
                style={styles.mealHead}
                onPress={() => router.push({ pathname: '/log/[meal]', params: { meal, day } })}
              >
                <View style={{ flex: 1 }}>
                  <T v="h2">{MEAL_LABEL[meal]}</T>
                  <T v="small" color={colors.muted}>
                    {entries.length ? `${fmt(kcal)} cal` : 'Nothing yet'}
                  </T>
                </View>
                <View style={styles.addBtn}>
                  <PlusIcon color={colors.accentInk} size={18} />
                </View>
              </Pressable>
              {entries.map((l) => (
                <Pressable
                  key={l.id}
                  onLongPress={() => remove(l)}
                  onPress={() => remove(l)}
                  style={({ pressed }) => [styles.entry, pressed && { backgroundColor: colors.cardHi }]}
                >
                  <View style={{ flex: 1, paddingRight: space.md }}>
                    <T numberOfLines={1}>{l.name}</T>
                    <T v="small" color={colors.muted}>
                      {Number(l.quantity) !== 1 ? `×${Number(l.quantity)} · ` : ''}
                      {Math.round(Number(l.protein_g))}p · {Math.round(Number(l.carbs_g))}c · {Math.round(Number(l.fat_g))}f
                    </T>
                  </View>
                  <T style={{ fontWeight: '700' }}>{fmt(Number(l.calories))}</T>
                </Pressable>
              ))}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <T v="label" color={colors.muted}>{label}</T>
      <T v="body" style={{ fontWeight: '700', marginTop: 2 }}>{value}</T>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.lg,
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringMeta: { flexDirection: 'row', gap: space.xxl * 1.5, marginTop: space.lg },
  macros: {
    flexDirection: 'row',
    gap: space.lg,
    marginTop: space.xl,
    paddingTop: space.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignSelf: 'stretch',
  },
  meal: {
    marginTop: space.lg,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  mealHead: { flexDirection: 'row', alignItems: 'center', padding: space.lg },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
