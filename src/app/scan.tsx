import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CloseIcon } from '@/components/icons';
import { colors, radius, space } from '@/components/theme';
import { Button, T } from '@/components/ui';
import { lookupBarcode } from '@/lib/db';

type State = { kind: 'scanning' } | { kind: 'looking'; code: string } | { kind: 'missing'; code: string } | { kind: 'error'; msg: string };

export default function Scan() {
  const p = useLocalSearchParams<{ meal?: string; day?: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [state, setState] = useState<State>({ kind: 'scanning' });
  const locked = useRef(false);

  async function onScan({ data }: BarcodeScanningResult) {
    if (locked.current) return;
    const code = data.replace(/\D/g, '');
    if (code.length < 8) return;
    locked.current = true;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setState({ kind: 'looking', code });
    try {
      const food = await lookupBarcode(code);
      if (food) {
        router.replace({ pathname: '/food/[id]', params: { id: food.id, meal: p.meal ?? 'snack', day: p.day ?? '', method: 'barcode' } });
      } else {
        setState({ kind: 'missing', code });
      }
    } catch (e) {
      setState({ kind: 'error', msg: e instanceof Error ? e.message : 'Lookup failed' });
    }
  }

  function again() {
    locked.current = false;
    setState({ kind: 'scanning' });
  }

  if (!permission) return <View style={{ flex: 1, backgroundColor: '#000' }} />;

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.center}>
        <T v="h2" style={{ textAlign: 'center' }}>Camera access needed</T>
        <T color={colors.muted} style={{ textAlign: 'center', marginTop: space.sm, marginBottom: space.xl }}>
          To scan barcodes, allow camera access.
        </T>
        <Button title="Allow camera" onPress={requestPermission} style={{ alignSelf: 'stretch' }} />
        <Button title="Not now" variant="ghost" onPress={() => router.back()} style={{ alignSelf: 'stretch' }} />
      </SafeAreaView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
        onBarcodeScanned={state.kind === 'scanning' ? onScan : undefined}
      />
      <SafeAreaView style={StyleSheet.absoluteFill} edges={['top', 'bottom']} pointerEvents="box-none">
        <View style={styles.top}>
          <Pressable hitSlop={12} onPress={() => router.back()} style={styles.close}>
            <CloseIcon color="#fff" size={20} />
          </Pressable>
        </View>

        <View style={styles.frameWrap} pointerEvents="none">
          <View style={styles.frame} />
          <T color="#fff" style={{ marginTop: space.lg, fontWeight: '700' }}>
            {state.kind === 'scanning' ? 'Line up the barcode' : ' '}
          </T>
        </View>

        {state.kind !== 'scanning' ? (
          <View style={styles.sheet}>
            {state.kind === 'looking' ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                <ActivityIndicator color={colors.accent} />
                <T>Looking up {state.code}…</T>
              </View>
            ) : state.kind === 'missing' ? (
              <>
                <T v="h2">Not in the database yet</T>
                <T color={colors.muted} style={{ marginTop: space.xs, marginBottom: space.lg }}>
                  Add it from the label once and it'll scan instantly next time.
                </T>
                <Button
                  title="Create from label"
                  onPress={() =>
                    router.replace({ pathname: '/food/new', params: { meal: p.meal ?? 'snack', day: p.day ?? '', barcode: state.code } })
                  }
                />
                <Button title="Scan again" variant="ghost" onPress={again} style={{ marginTop: space.xs }} />
              </>
            ) : (
              <>
                <T v="h2">Couldn't look that up</T>
                <T color={colors.muted} style={{ marginTop: space.xs, marginBottom: space.lg }}>{state.msg}</T>
                <Button title="Try again" onPress={again} />
              </>
            )}
          </View>
        ) : null}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', padding: space.xl },
  top: { flexDirection: 'row', justifyContent: 'flex-end', padding: space.lg },
  close: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  frameWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  frame: {
    width: 280,
    height: 160,
    borderRadius: radius.lg,
    borderWidth: 3,
    borderColor: colors.accent,
    backgroundColor: 'transparent',
  },
  sheet: {
    margin: space.lg,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: space.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
