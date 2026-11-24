import { fromISODate } from './format';
import type { WeightEntry } from './types';

const DAY = 86400000;

/**
 * Exponentially smoothed weight trend (smooths out water-weight noise).
 * Gaps between weigh-ins are handled by applying the smoothing per day.
 */
export function weightTrend(entries: WeightEntry[], alpha = 0.1) {
  if (!entries.length) return [];
  const sorted = [...entries].sort((a, b) => a.measured_on.localeCompare(b.measured_on));
  let t = Number(sorted[0].weight_kg);
  let prevDay = fromISODate(sorted[0].measured_on).getTime();
  return sorted.map((e) => {
    const d = fromISODate(e.measured_on).getTime();
    const gap = Math.max(1, Math.round((d - prevDay) / DAY));
    const a = 1 - Math.pow(1 - alpha, gap);
    t = t + a * (Number(e.weight_kg) - t);
    prevDay = d;
    return { day: e.measured_on, x: d / DAY, raw: Number(e.weight_kg), trend: t };
  });
}

/** Trend change per week over the last `days` days (kg/week), or null if not enough data. */
export function weeklyRate(trend: ReturnType<typeof weightTrend>, days = 14): number | null {
  if (trend.length < 2) return null;
  const last = trend[trend.length - 1];
  const start = [...trend].reverse().find((p) => last.x - p.x >= days) ?? trend[0];
  const span = last.x - start.x;
  if (span < 5) return null;
  return ((last.trend - start.trend) / span) * 7;
}
