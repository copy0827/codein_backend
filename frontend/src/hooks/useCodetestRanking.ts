import { useQuery } from '@tanstack/react-query';
import { getMyWidgetData, getRankingList, getUserStats } from '../api/codetest';
import { codetestRankingQueryKeys } from '../lib/codetestRankingQueryKeys';
import type { CodetestStatPeriod } from '../types/codetest';

export const useCodetestRankingQuery = (
  period: CodetestStatPeriod,
  page: number,
  size = 10,
) =>
  useQuery({
    queryKey: codetestRankingQueryKeys.list(period, page, size),
    queryFn: () => getRankingList(period, page, size),
    staleTime: 30_000,
  });

export const useCodetestUserStatsQuery = (
  userId: number | null,
  period: CodetestStatPeriod,
  enabled = true,
) =>
  useQuery({
    queryKey: codetestRankingQueryKeys.stat(userId ?? 0, period),
    queryFn: () => getUserStats(userId!, period),
    enabled: enabled && userId != null && userId > 0,
    staleTime: 20_000,
  });

export const useCodetestRankingWidgetQuery = (enabled = true) =>
  useQuery({
    queryKey: codetestRankingQueryKeys.widget(),
    queryFn: getMyWidgetData,
    enabled,
    staleTime: 60_000,
    retry: 1,
  });
