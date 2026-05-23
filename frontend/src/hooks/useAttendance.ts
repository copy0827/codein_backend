import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import {
  checkAttendance,
  getAdminAttendanceStatus,
  getAttendanceHistory,
  getTodayAttendanceStatus,
} from '../api/attendance';
import { attendanceQueryKeys } from '../lib/attendanceQueryKeys';

export const getAttendanceApiErrorMessage = (
  error: unknown,
  fallback: string,
): string => {
  if (isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail) && detail[0]?.msg) return String(detail[0].msg);
  }
  return fallback;
};

export const useTodayAttendanceStatusQuery = (enabled = true) =>
  useQuery({
    queryKey: attendanceQueryKeys.status(),
    queryFn: getTodayAttendanceStatus,
    enabled,
    staleTime: 15_000,
  });

/** @deprecated useTodayAttendanceStatusQuery */
export const useAttendanceStatusQuery = useTodayAttendanceStatusQuery;

export const useAttendanceHistoryQuery = (
  year: number,
  month: number,
  enabled = true,
) =>
  useQuery({
    queryKey: attendanceQueryKeys.history(year, month),
    queryFn: () => getAttendanceHistory(year, month),
    enabled,
    staleTime: 30_000,
  });

export const useAdminAttendanceStatusQuery = (
  date: string,
  enabled = true,
) =>
  useQuery({
    queryKey: attendanceQueryKeys.adminStatus(date),
    queryFn: () => getAdminAttendanceStatus(date),
    enabled: enabled && Boolean(date),
    staleTime: 20_000,
  });

export const useAttendanceCheckMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: checkAttendance,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: attendanceQueryKeys.status() });
      queryClient.invalidateQueries({ queryKey: attendanceQueryKeys.all });
    },
  });
};
