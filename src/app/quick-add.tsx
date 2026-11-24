import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Header, backToToday } from '@/components/Header';
import { colors, space } from '@/components/theme';
import { Button, ErrorText, Field, Screen, T } from '@/components/ui';
import { addLog } from '@/lib/db';
import { MEAL_LABEL, num, toISODate } from '@/lib/format';
import { caloriesFromMacros } from '@/lib/targets';
import { MEALS, type Meal } from '@/lib/types';

export default function QuickAdd() {
  const p = useLocalSearchParams<{ meal?: string; day?: string }>();
  const meal: Meal = MEALS.includes(p.meal as Meal) ? (p.meal as Meal) : 'snack';
  const [name, setName] = useState('');
  const [cal, setCal] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pN = num(protein) || 0;
  const cN = num(carbs) || 0;
  const fN = num(fat) || 0;
  const calories = num(cal) > 0 ? num(cal) : caloriesFromMacros(pN, cN, fN);

  async function save() {
    if (!(calories > 0)) return setError('Enter calories or macros.');
    setBusy(true);
    try {
      await addLog({
        logged_on: p.day || toISODate(),
        meal,
        quantity: 1,
        name: name.trim() || 'Quick add',
        method: 'quick_add',
        calories,
        protein_g: pN,
        carbs_g: cN,
        fat_g: fN,
      });
      backToToday();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not log.');
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Header title="Quick add" />
      <T v="small" color={colors.muted} style={{ marginBottom: space.lg }}>
        For restaurant meals or anything you just want to estimate. Leave calories blank to calculate it from the macros.
      </T>
      <View style={{ gap: space.lg }}>
        <Field label="Name (optional)" value={name} onChangeText={setName} placeholder="Chipotle bowl" />
        <Field
          label="Calories"
          value={cal}
          onChangeText={setCal}
          keyboardType="decimal-pad"
          placeholder={calories > 0 ? String(calories) : '650'}
          suffix="cal"
        />
        <View style={{ flexDirection: 'row', gap: space.md }}>
          <Field style={{ flex: 1 }} label="Protein" value={protein} onChangeText={setProtein} keyboardType="decimal-pad" placeholder="0" suffix="g" />
          <Field style={{ flex: 1 }} label="Carbs" value={carbs} onChangeText={setCarbs} keyboardType="decimal-pad" placeholder="0" suffix="g" />
          <Field style={{ flex: 1 }} label="Fat" value={fat} onChangeText={setFat} keyboardType="decimal-pad" placeholder="0" suffix="g" />
        </View>
      </View>
      <ErrorText>{error}</ErrorText>
      <Button title={`Add to ${MEAL_LABEL[meal]}`} onPress={save} loading={busy} style={{ marginTop: space.xl }} />
    </Screen>
  );
}
