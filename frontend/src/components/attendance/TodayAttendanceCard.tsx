import React from 'react';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  CalendarCheck,
  CheckCircle2,
  Coins,
  Flame,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import Card from '../ui/Card';
import type { TodayAttendanceStatus } from '../../types/attendance';

interface TodayAttendanceCardProps {
  isAuthenticated: boolean;
  status: TodayAttendanceStatus | undefined;
  loading: boolean;
  todayPointsEarned: number | null;
  onCheckIn: () => void;
  checking: boolean;
}

const TodayAttendanceCard: React.FC<TodayAttendanceCardProps> = ({
  isAuthenticated,
  status,
  loading,
  todayPointsEarned,
  onCheckIn,
  checking,
}) => {
  const checkedIn = status?.has_checked_in_today ?? false;
  const attendedAt =
    status?.last_attendance_date === status?.today_kst && status?.last_attended_at
      ? parseISO(status.last_attended_at)
      : null;

  return (
    <Card variant="elevated" padding="lg" className="relative overflow-hidden">
      <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-brand/5 pointer-events-none" />

      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-brand">
            <CalendarCheck className="h-5 w-5" aria-hidden />
            <span className="text-sm font-semibold tracking-tight">오늘의 출석</span>
          </div>
          {loading ? (
            <div className="h-8 w-48 animate-pulse rounded-lg bg-gray-100" />
          ) : (
            <>
              <h2 className="text-xl font-bold text-gray-900 sm:text-2xl">
                {checkedIn ? '오늘 출석을 완료했어요' : '오늘 아직 출석 전이에요'}
              </h2>
              <p className="text-sm text-gray-500">
                {status?.today_kst
                  ? format(parseISO(status.today_kst), 'yyyy년 M월 d일 (EEE)', {
                      locale: ko,
                    })
                  : '—'}
                {' · KST 기준'}
              </p>
            </>
          )}
        </div>

        {!loading && status && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
            <span className="inline-flex items-center gap-1 rounded-full border border-gray-100 bg-gray-50 px-3 py-1.5">
              <Flame className="h-3.5 w-3.5 text-orange-500" />
              연속 {status.current_streak_days}일
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-gray-100 bg-gray-50 px-3 py-1.5">
              누적 {status.total_attendance_days}일
            </span>
          </div>
        )}
      </div>

      <div className="relative mt-6 border-t border-gray-100 pt-6">
        {!isAuthenticated ? (
          <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-gray-200 bg-gray-50/80 px-4 py-8 text-center">
            <p className="text-sm text-gray-600">
              로그인 후 출석 체크가 가능합니다.
            </p>
            <button
              type="button"
              disabled
              className="inline-flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-gray-200 bg-gray-100 px-5 py-2.5 text-sm font-semibold text-gray-400 sm:w-auto"
            >
              <Sparkles className="h-4 w-4" aria-hidden />
              오늘의 출석 체크하기
            </button>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-sm font-semibold text-brand hover:text-brand-light transition-colors"
            >
              <LogIn className="h-4 w-4" aria-hidden />
              로그인하기
            </Link>
          </div>
        ) : loading ? (
          <div className="h-12 animate-pulse rounded-xl bg-gray-100" />
        ) : checkedIn ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="h-6 w-6" aria-hidden />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">출석 완료 시각</p>
                <p className="text-lg font-bold text-gray-900">
                  {attendedAt
                    ? format(attendedAt, 'a h:mm', { locale: ko })
                    : '—'}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 sm:text-right">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand sm:order-2">
                <Coins className="h-6 w-6" aria-hidden />
              </div>
              <div className="sm:order-1">
                <p className="text-sm font-medium text-gray-500">오늘 획득 포인트</p>
                <p className="text-lg font-bold text-brand">
                  +{todayPointsEarned ?? status?.policy.daily_attendance_points ?? 0}P
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-600">
              출석하면{' '}
              <span className="font-semibold text-brand">
                {status?.policy.daily_attendance_points ?? 10}P
              </span>
              와 스탬프 1칸을 받을 수 있어요.
            </p>
            <button
              type="button"
              onClick={onCheckIn}
              disabled={checking}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand/20 transition-all duration-200 hover:bg-brand-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              {checking ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  출석 처리 중…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" aria-hidden />
                  오늘의 출석 체크하기
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </Card>
  );
};

export default TodayAttendanceCard;
