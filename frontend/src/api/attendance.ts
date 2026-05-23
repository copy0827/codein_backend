import api from './axios';
import type {
  AdminAttendanceDailyStatus,
  AttendanceCheckResult,
  AttendanceHistory,
  TodayAttendanceStatus,
} from '../types/attendance';

/** 오늘 내 출석·스탬프 상태 */
export const getTodayAttendanceStatus = async (): Promise<TodayAttendanceStatus> => {
  const { data } = await api.get<TodayAttendanceStatus>('/attendance/me/status');
  return data;
};

/** 오늘 출석 체크 실행 */
export const checkAttendance = async (): Promise<AttendanceCheckResult> => {
  const { data } = await api.post<AttendanceCheckResult>('/attendance/me/check');
  return data;
};

/** 월별 내 출석 이력 */
export const getAttendanceHistory = async (
  year: number,
  month: number,
): Promise<AttendanceHistory> => {
  const { data } = await api.get<AttendanceHistory>('/attendance/me/history', {
    params: { year, month },
  });
  return data;
};

/** 관리자 — 특정 날짜 전체 부원 출석 현황 (YYYY-MM-DD) */
export const getAdminAttendanceStatus = async (
  date: string,
): Promise<AdminAttendanceDailyStatus> => {
  const { data } = await api.get<AdminAttendanceDailyStatus>(
    '/attendance/admin/status',
    { params: { date } },
  );
  return data;
};

/** @deprecated getTodayAttendanceStatus */
export const getMyAttendanceStatus = getTodayAttendanceStatus;

/** @deprecated checkAttendance */
export const postMyAttendanceCheck = checkAttendance;

/** @deprecated getAttendanceHistory */
export const getMyAttendanceHistory = getAttendanceHistory;
