import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import { CalendarCheck, ChevronLeft, History } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import TodayAttendanceCard from '../../components/attendance/TodayAttendanceCard';
import StampBoardWidget from '../../components/attendance/StampBoardWidget';
import AttendanceMonthCalendar from '../../components/attendance/AttendanceMonthCalendar';
import StampBoardCompleteModal from '../../components/attendance/StampBoardCompleteModal';
import {
  getAttendanceApiErrorMessage,
  useAttendanceCheckMutation,
  useAttendanceHistoryQuery,
  useTodayAttendanceStatusQuery,
} from '../../hooks/useAttendance';
import { attendanceQueryKeys } from '../../lib/attendanceQueryKeys';
import { isBoardCompleted, type AttendanceCheckResult } from '../../types/attendance';

const AttendancePage: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const now = new Date();
  const [calendarYear, setCalendarYear] = useState(now.getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(now.getMonth() + 1);
  const [lastCheck, setLastCheck] = useState<AttendanceCheckResult | null>(null);
  const [boardModalOpen, setBoardModalOpen] = useState(false);
  const [boardBonusPoints, setBoardBonusPoints] = useState(100);

  const { data: status, isLoading: statusLoading } = useTodayAttendanceStatusQuery(
    isAuthenticated,
  );
  const { data: history, isLoading: historyLoading } = useAttendanceHistoryQuery(
    calendarYear,
    calendarMonth,
    isAuthenticated,
  );

  const statusMonth = status?.today_kst
    ? parseISO(status.today_kst).getMonth() + 1
    : now.getMonth() + 1;
  const statusYear = status?.today_kst
    ? parseISO(status.today_kst).getFullYear()
    : now.getFullYear();

  const { data: todayMonthHistory } = useAttendanceHistoryQuery(
    statusYear,
    statusMonth,
    isAuthenticated && Boolean(status?.today_kst),
  );

  const checkMutation = useAttendanceCheckMutation();

  const todayPointsEarned = useMemo(() => {
    if (!status?.has_checked_in_today || !status.today_kst) return null;

    if (lastCheck && lastCheck.attendance_date === status.today_kst) {
      return lastCheck.total_points_earned;
    }

    const fromHistory = todayMonthHistory?.items.find(
      (item) => item.attendance_date === status.today_kst,
    );
    if (fromHistory) {
      return fromHistory.earned_points;
    }

    return status.policy.daily_attendance_points;
  }, [status, lastCheck, todayMonthHistory]);

  const refreshAttendanceQueries = async () => {
    await queryClient.invalidateQueries({ queryKey: attendanceQueryKeys.status() });
    await queryClient.invalidateQueries({
      queryKey: attendanceQueryKeys.history(calendarYear, calendarMonth),
    });
    if (statusYear && statusMonth) {
      await queryClient.invalidateQueries({
        queryKey: attendanceQueryKeys.history(statusYear, statusMonth),
      });
    }
  };

  const handleCheckIn = async () => {
    if (!isAuthenticated) return;

    try {
      const result = await checkMutation.mutateAsync();
      setLastCheck(result);
      await refreshAttendanceQueries();

      toast.success(result.message, { duration: 4000 });

      if (isBoardCompleted(result)) {
        setBoardBonusPoints(
          result.bonus_points || result.policy.board_complete_reward_points,
        );
        setBoardModalOpen(true);
      }
    } catch (error) {
      toast.error(
        getAttendanceApiErrorMessage(error, '출석 체크에 실패했습니다.'),
      );
    }
  };

  const goPrevMonth = () => {
    if (calendarMonth === 1) {
      setCalendarYear((y) => y - 1);
      setCalendarMonth(12);
    } else {
      setCalendarMonth((m) => m - 1);
    }
  };

  const goNextMonth = () => {
    const next =
      calendarMonth === 12
        ? { y: calendarYear + 1, m: 1 }
        : { y: calendarYear, m: calendarMonth + 1 };
    const limit = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const candidate = new Date(next.y, next.m - 1, 1);
    if (candidate > limit) return;
    setCalendarYear(next.y);
    setCalendarMonth(next.m);
  };

  const canGoNext = useMemo(() => {
    const next =
      calendarMonth === 12
        ? { y: calendarYear + 1, m: 1 }
        : { y: calendarYear, m: calendarMonth + 1 };
    const limit = new Date(now.getFullYear(), now.getMonth(), 1);
    return new Date(next.y, next.m - 1, 1) <= limit;
  }, [calendarYear, calendarMonth, now]);

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-12">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-brand">
            <CalendarCheck className="h-6 w-6" aria-hidden />
            <h1 className="text-2xl font-bold text-white">출석 체크</h1>
          </div>
          <p className="text-sm text-dark-muted">
            매일 출석하고 스탬프를 모아 포인트 보상을 받아보세요.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/activity"
            className="inline-flex items-center gap-2 rounded-lg border border-dark-line bg-dark-cardSoft px-4 py-2 text-sm font-semibold text-dark-text transition-colors hover:bg-dark-nav"
          >
            <History className="h-4 w-4" />
            활동 내역
          </Link>
          <Link
            to="/profile"
            className="inline-flex items-center gap-2 rounded-lg border border-dark-line bg-dark-cardSoft px-4 py-2 text-sm font-semibold text-dark-text transition-colors hover:bg-dark-nav"
          >
            <ChevronLeft className="h-4 w-4" />
            마이페이지
          </Link>
        </div>
      </div>

      <TodayAttendanceCard
        isAuthenticated={isAuthenticated}
        status={status}
        loading={isAuthenticated && statusLoading}
        todayPointsEarned={todayPointsEarned}
        onCheckIn={handleCheckIn}
        checking={checkMutation.isPending}
      />

      <StampBoardWidget
        status={isAuthenticated ? status : undefined}
        loading={isAuthenticated && statusLoading}
      />

      <AttendanceMonthCalendar
        year={calendarYear}
        month={calendarMonth}
        items={isAuthenticated ? (history?.items ?? []) : []}
        loading={isAuthenticated && historyLoading}
        onPrevMonth={goPrevMonth}
        onNextMonth={goNextMonth}
        canGoNext={canGoNext}
      />

      {status?.today_kst && isAuthenticated && !statusLoading && (
        <p className="text-center text-xs text-dark-muted">
          서버 기준 오늘:{' '}
          {format(parseISO(status.today_kst), 'yyyy.MM.dd (EEE)', { locale: ko })}
        </p>
      )}

      <StampBoardCompleteModal
        isOpen={boardModalOpen}
        onClose={() => setBoardModalOpen(false)}
        bonusPoints={boardBonusPoints}
      />
    </div>
  );
};

export default AttendancePage;
