import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path, Circle as Dot } from 'react-native-svg';
import { fmt } from '@/lib/format';
import { colors, space } from './theme';
import { T } from './ui';

/** Big calorie ring: shows remaining, turns orange when over. */
export function CalorieRing({ eaten, target, size = 200 }: { eaten: number; target: number; size?: number }) {
  const stroke = 16;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = target > 0 ? Math.min(eaten / target, 1) : 0;
  const over = eaten > target && target > 0;
  const remaining = Math.round(target - eaten);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.cardHi} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={over ? colors.over : colors.accent}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={c * (1 - pct)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <T v="hero" color={over ? colors.over : colors.text}>
        {fmt(Math.abs(remaining))}
      </T>
      <T v="small" color={colors.muted}>
        {over ? 'over' : 'left'}
      </T>
    </View>
  );
}

export function MacroBar({
  label,
  value,
  target,
  color,
}: {
  label: string;
  value: number;
  target: number;
  color: string;
}) {
  const pct = target > 0 ? Math.min(value / target, 1) : 0;
  return (
    <View style={{ flex: 1 }}>
      <T v="label" color={colors.muted}>{label}</T>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 6 }}>
        <T v="h2">{Math.round(value)}</T>
        <T v="small" color={colors.muted}> / {Math.round(target)}g</T>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

/** Weight chart: daily dots + smoothed trend line. */
export function WeightChart({
  points,
  trend,
  width,
  height = 180,
}: {
  points: { x: number; y: number }[];
  trend: { x: number; y: number }[];
  width: number;
  height?: number;
}) {
  if (points.length === 0) return null;
  const pad = 12;
  const all = [...points, ...trend];
  const xs = all.map((p) => p.x);
  const ys = all.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys) - 0.5;
  const maxY = Math.max(...ys) + 0.5;
  const sx = (x: number) => pad + ((x - minX) / Math.max(1, maxX - minX)) * (width - pad * 2);
  const sy = (y: number) => pad + (1 - (y - minY) / Math.max(0.1, maxY - minY)) * (height - pad * 2);
  const path = trend.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ');
  return (
    <Svg width={width} height={height}>
      {[0.25, 0.5, 0.75].map((f) => (
        <Line
          key={f}
          x1={pad}
          x2={width - pad}
          y1={pad + f * (height - pad * 2)}
          y2={pad + f * (height - pad * 2)}
          stroke={colors.border}
          strokeWidth={1}
        />
      ))}
      {points.map((p) => (
        <Dot key={p.x} cx={sx(p.x)} cy={sy(p.y)} r={3.5} fill={colors.faint} />
      ))}
      {trend.length > 1 ? <Path d={path} stroke={colors.accent} strokeWidth={3} fill="none" strokeLinecap="round" /> : null}
    </Svg>
  );
}

export function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={{ flex: 1, gap: space.xs }}>
      <T v="label" color={colors.muted}>{label}</T>
      <T v="h2">{value}</T>
      {sub ? <T v="small" color={colors.muted}>{sub}</T> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 6, borderRadius: 3, backgroundColor: colors.cardHi, marginTop: 8, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
});
