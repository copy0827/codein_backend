/** 출석·스탬프 정책 스냅샷 (백엔드 AttendancePolicySnapshot) */
export interface AttendancePolicySnapshot {
  max_stamp_pieces: number;
  daily_attendance_points: number;
  board_complete_reward_points: number;
}

/** GET /attendance/me/status — 오늘 출석 상태 */
export interface TodayAttendanceStatus {
  user_id: number;
  today_kst: string;
  has_checked_in_today: boolean;
  total_attendance_days: number;
  current_streak_days: number;
  current_stamp_cycle: number;
  current_stamp_count: number;
  completed_stamp_boards: number;
  max_stamp_pieces: number;
  stamps_until_board_complete: number;
  policy: AttendancePolicySnapshot;
  last_attendance_date: string | null;
  last_attended_at: string | null;
}

/** POST /attendance/me/check — 출석 체크 결과 */
export interface AttendanceCheckResult {
  success: boolean;
  message: string;
  attendance_date: string;
  attended_at: string;
  earned_points: number;
  bonus_points: number;
  total_points_earned: number;
  stamp_filled: boolean;
  /** 백엔드 필드명 */
  board_completed: boolean;
  current_stamp_cycle: number;
  current_stamp_count: number;
  completed_stamp_boards: number;
  total_attendance_days: number;
  current_streak_days: number;
  policy: AttendancePolicySnapshot;
}

/** 스탬프판 완성 여부 (API `board_completed` 별칭) */
export function isBoardCompleted(result: AttendanceCheckResult): boolean {
  return result.board_completed;
}

/** GET /attendance/me/history — 월별 출석 이력 항목 */
export interface AttendanceHistoryItem {
  id: number;
  attendance_date: string;
  attended_at: string;
  earned_points: number;
}

/** GET /attendance/me/history — 월별 출석 이력 */
export interface AttendanceHistory {
  user_id: number;
  year: number;
  month: number;
  total_days_in_month: number;
  items: AttendanceHistoryItem[];
}

export type AttendanceMemberStatus = 'ATTENDED' | 'ABSENT';

/** GET /attendance/admin/status — 부원 1명 */
export interface AdminAttendanceMember {
  user_id: number;
  name: string;
  student_id: string;
  generation: string;
  major: string;
  role: string;
  status: AttendanceMemberStatus;
  attended_at: string | null;
}

/** GET /attendance/admin/status — 일자별 전체 현황 */
export interface AdminAttendanceDailyStatus {
  target_date: string;
  total_active_members: number;
  attended_count: number;
  absent_count: number;
  attendance_rate: number;
  members: AdminAttendanceMember[];
}

/** @deprecated TodayAttendanceStatus 사용 */
export type AttendanceStatus = TodayAttendanceStatus;
