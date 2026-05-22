import type { DifficultyDistribution, PeriodTrendPoint } from '../types/codetest';

export const formatTierLabel = (key: string): string => {
  const normalized = key.trim().toLowerCase();
  if (normalized.startsWith('tier_')) {
    const num = normalized.replace('tier_', '');
    return num ? `Tier ${num}` : key;
  }
  if (normalized === 'easy') return 'Easy';
  if (normalized === 'medium') return 'Medium';
  if (normalized === 'hard') return 'Hard';
  return key;
};

export const difficultyToBarChartData = (distribution: DifficultyDistribution) =>
  Object.entries(distribution ?? {})
    .map(([tier, stats]) => ({
      tier: formatTierLabel(tier),
      total: stats?.total ?? 0,
      correct: stats?.correct ?? 0,
    }))
    .filter((row) => row.total > 0 || row.correct > 0)
    .sort((a, b) => a.tier.localeCompare(b.tier, undefined, { numeric: true }));

export const trendToLineChartData = (trend: PeriodTrendPoint[]) =>
  (trend ?? []).map((point) => ({
    label: point.period_label,
    submissions: point.total_submissions ?? 0,
    correct: point.correct_submissions ?? 0,
    rate: point.correct_rate ?? 0,
  }));

export const hasChartableActivity = (
  totalSubmissions: number,
  distribution: DifficultyDistribution,
  trend: PeriodTrendPoint[],
): boolean => {
  if ((totalSubmissions ?? 0) > 0) return true;
  if (difficultyToBarChartData(distribution).length > 0) return true;
  if (trendToLineChartData(trend).some((p) => p.submissions > 0)) return true;
  return false;
};
