import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Header } from '@/components/Header';
import { colors, space } from '@/components/theme';
import { Button, ErrorText, Field, Screen, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { createFood } from '@/lib/db';
import { num } from '@/lib/format';
import { caloriesFromMacros } from '@/lib/targets';

export default function NewFood() {
  const p = useLocalSearchParams<{ meal?: string; day?: string; name?: string; barcode?: string }>();
  const { session } = useAuth();
  const [name, setName] = useState(p.name ?? '');
  const [brand, setBrand] = useState('');
  const [serving, setServing] = useState('1 serving');
  const [grams, setGrams] = useState('');
  const [cal, setCal] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const implied = caloriesFromMacros(num(protein) || 0, num(carbs) || 0, num(fat) || 0);

  async function save() {
    setError(null);
    const c = num(cal);
    if (!name.trim()) return setError('Give it a name.');
    if (!serving.trim()) return setError('Describe the serving (e.g. "1 bar").');
    if (!(c >= 0)) return setError('Enter calories per serving.');
    if (!session) return;
    setBusy(true);
    try {
      const food = await createFood(session.user.id, {
        name: name.trim(),
        brand: brand.trim() || null,
        serving_label: serving.trim(),
        serving_grams: num(grams) > 0 ? num(grams) : null,
        calories: c,
        protein_g: num(protein) || 0,
        carbs_g: num(carbs) || 0,
        fat_g: num(fat) || 0,
        barcode: p.barcode || null,
      });
      router.replace({ pathname: '/food/[id]', params: { id: food.id, meal: p.meal ?? 'snack', day: p.day ?? '' } });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Header title="Create food" />
      <T v="small" color={colors.muted} style={{ marginBottom: space.lg }}>
        Copy it straight from the nutrition label. Only you can see foods you create.
        {p.barcode ? ` Barcode ${p.barcode} will be saved so it scans next time.` : ''}
      </T>
      <View style={{ gap: space.lg }}>
        <Field label="Name" value={name} onChangeText={setName} placeholder="Protein bar" />
        <Field label="Brand (optional)" value={brand} onChangeText={setBrand} placeholder="RXBAR" />
        <View style={{ flexDirection: 'row', gap: space.md }}>
          <Field style={{ flex: 3 }} label="Serving" value={serving} onChangeText={setServing} placeholder="1 bar" />
          <Field style={{ flex: 2 }} label="Grams" value={grams} onChangeText={setGrams} keyboardType="decimal-pad" placeholder="52" suffix="g" />
        </View>
        <Field label="Calories" value={cal} onChangeText={setCal} keyboardType="decimal-pad" placeholder="210" suffix="cal" />
        <View style={{ flexDirection: 'row', gap: space.md }}>
          <Field style={{ flex: 1 }} label="Protein" value={protein} onChangeText={setProtein} keyboardType="decimal-pad" placeholder="12" suffix="g" />
          <Field style={{ flex: 1 }} label="Carbs" value={carbs} onChangeText={setCarbs} keyboardType="decimal-pad" placeholder="23" suffix="g" />
          <Field style={{ flex: 1 }} label="Fat" value={fat} onChangeText={setFat} keyboardType="decimal-pad" placeholder="9" suffix="g" />
        </View>
        {num(cal) > 0 && implied > 0 && Math.abs(implied - num(cal)) / num(cal) > 0.2 ? (
          <T v="small" color={colors.over}>
            Heads up: those macros add up to about {implied} cal. Double-check the label.
          </T>
        ) : null}
      </View>
      <ErrorText>{error}</ErrorText>
      <Button title="Save and log" onPress={save} loading={busy} style={{ marginTop: space.xl }} />
    </Screen>
  );
}
