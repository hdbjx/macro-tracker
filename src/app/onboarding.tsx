import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { ChevronIcon } from '@/components/icons';
import { colors, radius, space } from '@/components/theme';
import { Button, Card, Choice, ErrorText, Field, Screen, Segmented, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { logWeight, setTarget, updateProfile } from '@/lib/db';
import { CM_PER_IN, KG_PER_LB, fmt, num, round, toISODate } from '@/lib/format';
import { ACTIVITY_LABEL, startingTargets } from '@/lib/targets';
import type { Activity, Goal, Sex, Units } from '@/lib/types';

const STEPS = ['name', 'basics', 'body', 'activity', 'goal', 'plan'] as const;

const RATES: Record<'lose' | 'gain', { kg: number; imperial: string; metric: string; sub: string }[]> = {
  lose: [
    { kg: -0.25, imperial: '0.5 lb / week', metric: '0.25 kg / week', sub: 'Easy to stick to' },
    { kg: -0.5, imperial: '1 lb / week', metric: '0.5 kg / week', sub: 'Recommended' },
    { kg: -0.75, imperial: '1.5 lb / week', metric: '0.75 kg / week', sub: 'Aggressive' },
  ],
  gain: [
    { kg: 0.125, imperial: '0.25 lb / week', metric: '0.125 kg / week', sub: 'Lean gain' },
    { kg: 0.25, imperial: '0.5 lb / week', metric: '0.25 kg / week', sub: 'Recommended' },
    { kg: 0.5, imperial: '1 lb / week', metric: '0.5 kg / week', sub: 'Fast' },
  ],
};

export default function Onboarding() {
  const { session, profile, refreshProfile } = useAuth();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(profile?.display_name ?? '');
  const [sex, setSex] = useState<Sex | null>(null);
  const [age, setAge] = useState('');
  const [units, setUnits] = useState<Units>('imperial');
  const [ft, setFt] = useState('');
  const [inch, setInch] = useState('');
  const [cm, setCm] = useState('');
  const [weight, setWeight] = useState('');
  const [activity, setActivity] = useState<Activity | null>(null);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [rate, setRate] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const heightCm = units === 'imperial' ? (num(ft) * 12 + (num(inch) || 0)) * CM_PER_IN : num(cm);
  const weightKg = units === 'imperial' ? num(weight) * KG_PER_LB : num(weight);
  const ageN = num(age);

  const plan = useMemo(() => {
    if (!sex || !activity || !goal || !(heightCm > 0) || !(weightKg > 0) || !(ageN > 0)) return null;
    return startingTargets({
      sex,
      age: ageN,
      heightCm,
      weightKg,
      activity,
      goal,
      ratePerWeek: goal === 'maintain' ? 0 : rate ?? 0,
    });
  }, [sex, activity, goal, heightCm, weightKg, ageN, rate]);

  function validate(): string | null {
    switch (STEPS[step]) {
      case 'name':
        return name.trim() ? null : 'What should we call you?';
      case 'basics':
        if (!sex) return 'Pick one — it changes the calorie math.';
        if (!(ageN >= 13 && ageN <= 100)) return 'Enter an age between 13 and 100.';
        return null;
      case 'body':
        if (!(heightCm >= 120 && heightCm <= 230)) return 'That height looks off.';
        if (!(weightKg >= 30 && weightKg <= 300)) return 'That weight looks off.';
        return null;
      case 'activity':
        return activity ? null : 'Pick the closest match.';
      case 'goal':
        if (!goal) return 'Pick a goal.';
        if (goal !== 'maintain' && rate == null) return 'Pick a pace.';
        return null;
      default:
        return null;
    }
  }

  function next() {
    const err = validate();
    setError(err);
    if (!err) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  async function finish() {
    if (!session || !plan || !sex || !activity || !goal) return;
    setBusy(true);
    setError(null);
    try {
      const today = toISODate();
      await logWeight(today, weightKg);
      await setTarget(today, plan, 'manual', plan.tdee);
      await updateProfile(session.user.id, {
        display_name: name.trim(),
        sex,
        birth_year: new Date().getFullYear() - ageN,
        height_cm: round(heightCm, 1),
        activity_level: activity,
        goal,
        goal_rate_kg_per_week: goal === 'maintain' ? 0 : rate,
        units,
        onboarded: true,
      });
      await refreshProfile();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      setBusy(false);
    }
  }

  const current = STEPS[step];

  return (
    <Screen style={{ flexGrow: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: space.xl, gap: space.md }}>
        {step > 0 ? (
          <Pressable onPress={() => setStep(step - 1)} hitSlop={12}>
            <ChevronIcon dir="left" color={colors.text} size={24} />
          </Pressable>
        ) : (
          <View style={{ width: 24 }} />
        )}
        <View style={{ flex: 1, flexDirection: 'row', gap: 6 }}>
          {STEPS.map((s, i) => (
            <View
              key={s}
              style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= step ? colors.accent : colors.cardHi }}
            />
          ))}
        </View>
      </View>

      {current === 'name' && (
        <Step title="First, what's your name?">
          <Field value={name} onChangeText={setName} placeholder="Name" autoFocus onSubmitEditing={next} />
        </Step>
      )}

      {current === 'basics' && (
        <Step title="A couple basics" sub="Used only to estimate how much you burn.">
          <T v="label" color={colors.muted}>Sex</T>
          <Segmented
            options={[
              { value: 'male', label: 'Male' },
              { value: 'female', label: 'Female' },
            ]}
            value={(sex ?? '') as Sex}
            onChange={setSex}
          />
          <Field label="Age" value={age} onChangeText={setAge} keyboardType="number-pad" placeholder="20" suffix="years" />
        </Step>
      )}

      {current === 'body' && (
        <Step title="Height and weight">
          <Segmented
            options={[
              { value: 'imperial', label: 'lb / ft' },
              { value: 'metric', label: 'kg / cm' },
            ]}
            value={units}
            onChange={setUnits}
          />
          {units === 'imperial' ? (
            <View style={{ flexDirection: 'row', gap: space.md }}>
              <Field style={{ flex: 1 }} label="Height" value={ft} onChangeText={setFt} keyboardType="number-pad" placeholder="5" suffix="ft" />
              <Field style={{ flex: 1 }} label=" " value={inch} onChangeText={setInch} keyboardType="number-pad" placeholder="10" suffix="in" />
            </View>
          ) : (
            <Field label="Height" value={cm} onChangeText={setCm} keyboardType="decimal-pad" placeholder="178" suffix="cm" />
          )}
          <Field
            label="Current weight"
            value={weight}
            onChangeText={setWeight}
            keyboardType="decimal-pad"
            placeholder={units === 'imperial' ? '175' : '80'}
            suffix={units === 'imperial' ? 'lb' : 'kg'}
          />
        </Step>
      )}

      {current === 'activity' && (
        <Step title="How active are you?" sub="Don't overthink it — targets adjust as you log.">
          {(Object.keys(ACTIVITY_LABEL) as Activity[]).map((a) => (
            <Choice
              key={a}
              title={ACTIVITY_LABEL[a].title}
              sub={ACTIVITY_LABEL[a].sub}
              selected={activity === a}
              onPress={() => setActivity(a)}
            />
          ))}
        </Step>
      )}

      {current === 'goal' && (
        <Step title="What's the goal?">
          <Segmented
            options={[
              { value: 'lose', label: 'Lose' },
              { value: 'maintain', label: 'Maintain' },
              { value: 'gain', label: 'Gain' },
            ]}
            value={(goal ?? '') as Goal}
            onChange={(g) => {
              setGoal(g);
              setRate(g === 'maintain' ? 0 : RATES[g][1].kg);
            }}
          />
          {goal && goal !== 'maintain'
            ? RATES[goal].map((r) => (
                <Choice
                  key={r.kg}
                  title={units === 'imperial' ? r.imperial : r.metric}
                  sub={r.sub}
                  selected={rate === r.kg}
                  onPress={() => setRate(r.kg)}
                />
              ))
            : null}
        </Step>
      )}

      {current === 'plan' && plan && (
        <Step title={`Your plan, ${name.trim()}`} sub={`Estimated burn: ${fmt(plan.tdee)} cal/day`}>
          <Card style={{ alignItems: 'center', paddingVertical: space.xl }}>
            <T v="label" color={colors.muted}>Daily calories</T>
            <T v="hero" color={colors.accent} style={{ marginTop: space.sm }}>{fmt(plan.calories)}</T>
          </Card>
          <View style={{ flexDirection: 'row', gap: space.md }}>
            <MacroTile label="Protein" value={plan.protein_g} color={colors.protein} />
            <MacroTile label="Carbs" value={plan.carbs_g} color={colors.carbs} />
            <MacroTile label="Fat" value={plan.fat_g} color={colors.fat} />
          </View>
          <T v="small" color={colors.muted}>You can edit these anytime from Profile.</T>
        </Step>
      )}

      <View style={{ flex: 1 }} />
      <ErrorText>{error}</ErrorText>
      <Button
        title={current === 'plan' ? "Let's go" : 'Continue'}
        onPress={current === 'plan' ? finish : next}
        loading={busy}
        style={{ marginTop: space.lg }}
      />
    </Screen>
  );
}

function Step({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: space.lg }}>
      <View style={{ marginBottom: space.sm }}>
        <T v="h1">{title}</T>
        {sub ? <T color={colors.muted} style={{ marginTop: space.sm }}>{sub}</T> : null}
      </View>
      {children}
    </View>
  );
}

function MacroTile({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.card,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        padding: space.lg,
        borderTopWidth: 3,
        borderTopColor: color,
      }}
    >
      <T v="label" color={colors.muted}>{label}</T>
      <T v="h2" style={{ marginTop: space.xs }}>{value}g</T>
    </View>
  );
}
