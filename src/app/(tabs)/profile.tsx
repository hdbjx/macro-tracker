import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { ChevronIcon } from '@/components/icons';
import { colors, space } from '@/components/theme';
import { Button, Card, Screen, Segmented, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { getActiveTarget, updateProfile } from '@/lib/db';
import { fmt, toISODate } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type { Target, Units } from '@/lib/types';

export default function Profile() {
  const { session, profile, refreshProfile } = useAuth();
  const [target, setTarget] = useState<Target | null>(null);

  useFocusEffect(
    useCallback(() => {
      getActiveTarget(toISODate()).then(setTarget).catch(() => {});
    }, []),
  );

  async function setUnits(u: Units) {
    if (!session) return;
    await updateProfile(session.user.id, { units: u });
    await refreshProfile();
  }

  return (
    <Screen>
      <T v="h1">{profile?.display_name ?? 'Profile'}</T>
      <T color={colors.muted} style={{ marginBottom: space.xl }}>{session?.user.email}</T>

      <Pressable onPress={() => router.push('/targets')}>
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <T v="label" color={colors.muted}>Daily targets</T>
              <T v="h2" style={{ marginTop: space.xs }}>{fmt(target?.calories ?? 0)} cal</T>
              <T v="small" color={colors.muted} style={{ marginTop: 2 }}>
                {target ? `${target.protein_g}p · ${target.carbs_g}c · ${target.fat_g}f` : 'Not set'}
              </T>
            </View>
            <ChevronIcon color={colors.muted} />
          </View>
        </Card>
      </Pressable>

      <T v="label" color={colors.muted} style={{ marginTop: space.xl, marginBottom: space.sm }}>Units</T>
      <Segmented
        options={[
          { value: 'imperial', label: 'lb / ft' },
          { value: 'metric', label: 'kg / cm' },
        ]}
        value={profile?.units ?? 'imperial'}
        onChange={setUnits}
      />

      <Button title="Sign out" variant="secondary" onPress={() => supabase.auth.signOut()} style={{ marginTop: space.xxl }} />
    </Screen>
  );
}
