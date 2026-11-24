import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Header } from '@/components/Header';
import { colors, space } from '@/components/theme';
import { Button, Card, ErrorText, Field, Screen, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { getActiveTarget, getWeights, setTarget } from '@/lib/db';
import { addDays, fmt, num, toISODate } from '@/lib/format';
import { caloriesFromMacros, startingTargets } from '@/lib/targets';

export default function Targets() {
  const { profile } = useAuth();
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getActiveTarget(toISODate()).then((t) => {
      if (!t) return;
      setProtein(String(t.protein_g));
      setCarbs(String(t.carbs_g));
      setFat(String(t.fat_g));
    });
  }, []);

  const calories = caloriesFromMacros(num(protein) || 0, num(carbs) || 0, num(fat) || 0);

  async function recalc() {
    if (!profile?.sex || !profile.birth_year || !profile.height_cm || !profile.activity_level || !profile.goal) return;
    const w = await getWeights(addDays(toISODate(), -30));
    const latest = w[w.length - 1];
    if (!latest) return setError('Log your weight on Progress first.');
    const t = startingTargets({
      sex: profile.sex,
      age: new Date().getFullYear() - profile.birth_year,
      heightCm: Number(profile.height_cm),
      weightKg: Number(latest.weight_kg),
      activity: profile.activity_level,
      goal: profile.goal,
      ratePerWeek: Number(profile.goal_rate_kg_per_week ?? 0),
    });
    setProtein(String(t.protein_g));
    setCarbs(String(t.carbs_g));
    setFat(String(t.fat_g));
  }

  async function save() {
    if (calories < 800) return setError('That adds up to under 800 calories.');
    setBusy(true);
    try {
      await setTarget(toISODate(), {
        calories,
        protein_g: num(protein) || 0,
        carbs_g: num(carbs) || 0,
        fat_g: num(fat) || 0,
      });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Header title="Daily targets" />
      <Card style={{ alignItems: 'center', paddingVertical: space.xl, marginBottom: space.xl }}>
        <T v="label" color={colors.muted}>Calories</T>
        <T v="hero" color={colors.accent} style={{ marginTop: space.xs }}>{fmt(calories)}</T>
        <T v="small" color={colors.muted}>calculated from your macros</T>
      </Card>
      <View style={{ gap: space.lg }}>
        <Field label="Protein" value={protein} onChangeText={setProtein} keyboardType="number-pad" suffix="g" />
        <Field label="Carbs" value={carbs} onChangeText={setCarbs} keyboardType="number-pad" suffix="g" />
        <Field label="Fat" value={fat} onChangeText={setFat} keyboardType="number-pad" suffix="g" />
      </View>
      <ErrorText>{error}</ErrorText>
      <Button title="Save targets" onPress={save} loading={busy} style={{ marginTop: space.xl }} />
      <Button title="Recalculate from my stats" variant="ghost" onPress={recalc} style={{ marginTop: space.sm }} />
      <T v="small" color={colors.faint} style={{ textAlign: 'center', marginTop: space.sm }}>
        Changes apply from today forward. Past days keep their old targets.
      </T>
    </Screen>
  );
}
