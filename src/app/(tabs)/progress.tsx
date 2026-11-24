import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Stat, WeightChart } from '@/components/charts';
import { colors, space } from '@/components/theme';
import { Button, Card, ErrorText, Field, Screen, T, confirm } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { deleteWeight, getWeights, logWeight } from '@/lib/db';
import { addDays, dayLabel, displayToKg, kgToDisplay, num, round, toISODate, weightUnit } from '@/lib/format';
import { weeklyRate, weightTrend } from '@/lib/trend';
import type { WeightEntry } from '@/lib/types';

export default function Progress() {
  const { profile } = useAuth();
  const units = profile?.units ?? 'imperial';
  const unit = weightUnit(units);
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [width, setWidth] = useState(0);

  const load = useCallback(async () => {
    try {
      setEntries(await getWeights(addDays(toISODate(), -90)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load.');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const trend = useMemo(() => weightTrend(entries), [entries]);
  const rate = weeklyRate(trend);
  const today = toISODate();
  const todayEntry = entries.find((e) => e.measured_on === today);
  const show = (kg: number) => round(kgToDisplay(kg, units), 1);

  async function save() {
    const v = num(input);
    if (!(v > 0)) return setError(`Enter your weight in ${unit}.`);
    setBusy(true);
    setError(null);
    try {
      await logWeight(today, displayToKg(v, units));
      setInput('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
    }
    setBusy(false);
  }

  async function remove(e: WeightEntry) {
    if (await confirm('Delete weigh-in?', `${dayLabel(e.measured_on)} · ${show(e.weight_kg)} ${unit}`)) {
      await deleteWeight(e.id);
      load();
    }
  }

  const last = trend[trend.length - 1];

  return (
    <Screen>
      <T v="h1" style={{ marginBottom: space.lg }}>Progress</T>

      <Card>
        <T v="label" color={colors.muted}>{todayEntry ? `Today · ${show(todayEntry.weight_kg)} ${unit}` : 'Log today’s weight'}</T>
        <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md }}>
          <Field
            style={{ flex: 1 }}
            value={input}
            onChangeText={setInput}
            keyboardType="decimal-pad"
            placeholder={last ? String(show(last.raw)) : units === 'imperial' ? '175.0' : '80.0'}
            suffix={unit}
            onSubmitEditing={save}
          />
          <Button title={todayEntry ? 'Update' : 'Save'} onPress={save} loading={busy} style={{ width: 100 }} />
        </View>
        <ErrorText>{error}</ErrorText>
        <T v="small" color={colors.faint} style={{ marginTop: space.sm }}>
          Weigh in first thing in the morning. Daily swings are normal — the trend line is what counts.
        </T>
      </Card>

      {trend.length > 0 ? (
        <Card style={{ marginTop: space.lg }}>
          <View style={{ flexDirection: 'row', marginBottom: space.lg }}>
            <Stat label="Trend" value={`${show(last.trend)} ${unit}`} />
            <Stat
              label="Per week"
              value={rate == null ? '—' : `${rate > 0 ? '+' : ''}${round(kgToDisplay(rate, units), 2)} ${unit}`}
              sub={rate == null ? 'Need ~1 week of data' : undefined}
            />
          </View>
          <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
            {width > 0 ? (
              <WeightChart
                width={width}
                points={trend.map((p) => ({ x: p.x, y: kgToDisplay(p.raw, units) }))}
                trend={trend.map((p) => ({ x: p.x, y: kgToDisplay(p.trend, units) }))}
              />
            ) : null}
          </View>
        </Card>
      ) : null}

      {entries.length > 0 ? (
        <>
          <T v="label" color={colors.muted} style={{ marginTop: space.xl, marginBottom: space.sm }}>History</T>
          <Card style={{ padding: 0 }}>
            {[...entries].reverse().slice(0, 30).map((e, i) => (
              <Pressable
                key={e.id}
                onLongPress={() => remove(e)}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  padding: space.lg,
                  borderTopWidth: i ? 1 : 0,
                  borderTopColor: colors.border,
                }}
              >
                <T color={colors.muted}>{dayLabel(e.measured_on)}</T>
                <T style={{ fontWeight: '700' }}>{show(e.weight_kg)} {unit}</T>
              </Pressable>
            ))}
          </Card>
          <T v="small" color={colors.faint} style={{ marginTop: space.sm }}>Long-press an entry to delete it.</T>
        </>
      ) : null}
    </Screen>
  );
}
