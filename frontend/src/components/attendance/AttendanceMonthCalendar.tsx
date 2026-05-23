import React, { useMemo } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import Card from '../ui/Card';
import type { AttendanceHistoryItem } from '../../types/attendance';

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const;

interface AttendanceMonthCalendarProps {
  year: number;
  month: number;
  items: AttendanceHistoryItem[];
  loading: boolean;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  canGoNext: boolean;
}

interface CalendarCell {
  key: string;
  day: number | null;
  dateStr: string | null;
}

function buildMonthGrid(year: number, month: number): CalendarCell[] {
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: CalendarCell[] = [];

  for (let i = 0; i < firstWeekday; i += 1) {
    cells.push({ key: `pad-start-${i}`, day: null, dateStr: null });
  }

  for (let d = 1; d <= daysInMonth; d += 1) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ key: dateStr, day: d, dateStr });
  }

  while (cells.length % 7 !== 0) {
    cells.push({ key: `pad-end-${cells.length}`, day: null, dateStr: null });
  }

  return cells;
}

const AttendanceMonthCalendar: React.FC<AttendanceMonthCalendarProps> = ({
  year,
  month,
  items,
  loading,
  onPrevMonth,
  onNextMonth,
  canGoNext,
}) => {
  const attendedMap = useMemo(() => {
    const map = new Map<string, AttendanceHistoryItem>();
    items.forEach((item) => map.set(item.attendance_date, item));
    return map;
  }, [items]);

  const cells = useMemo(() => buildMonthGrid(year, month), [year, month]);

  const monthLabel = format(new Date(year, month - 1, 1), 'yyyy년 M월', { locale: ko });

  return (
    <Card variant="elevated" padding="lg">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-brand" aria-hidden />
          <div>
            <h2 className="text-lg font-bold text-gray-900">월별 출석 달력</h2>
            <p className="text-xs text-gray-500">출석한 날에 획득 포인트가 표시됩니다.</p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 sm:justify-end">
          <button
            type="button"
            onClick={onPrevMonth}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-100 text-gray-600 transition-colors hover:border-brand/30 hover:bg-brand/5 hover:text-brand"
            aria-label="이전 달"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[7.5rem] text-center text-sm font-bold text-gray-900">
            {monthLabel}
          </span>
          <button
            type="button"
            onClick={onNextMonth}
            disabled={!canGoNext}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-100 text-gray-600 transition-colors hover:border-brand/30 hover:bg-brand/5 hover:text-brand disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="다음 달"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mb-2 grid grid-cols-7 gap-1 text-center">
        {WEEKDAY_LABELS.map((label, idx) => (
          <div
            key={label}
            className={`py-2 text-xs font-semibold ${
              idx === 0 ? 'text-red-500' : idx === 6 ? 'text-blue-500' : 'text-gray-500'
            }`}
          >
            {label}
          </div>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="aspect-square animate-pulse rounded-xl bg-gray-100" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-1">
          {cells.map((cell) => {
            if (cell.day === null) {
              return <div key={cell.key} className="aspect-square" aria-hidden />;
            }

            const record = cell.dateStr ? attendedMap.get(cell.dateStr) : undefined;
            const attended = Boolean(record);

            return (
              <div
                key={cell.key}
                className={`relative flex aspect-square flex-col items-center justify-center rounded-xl border text-center transition-colors ${
                  attended
                    ? 'border-brand/20 bg-brand/5'
                    : 'border-transparent bg-gray-50/50'
                }`}
              >
                {attended && (
                  <span
                    className="absolute inset-1 rounded-lg bg-brand/10"
                    aria-hidden
                  />
                )}
                <span
                  className={`relative z-[1] text-sm font-semibold ${
                    attended ? 'text-brand' : 'text-gray-700'
                  }`}
                >
                  {cell.day}
                </span>
                {attended && record && (
                  <span className="relative z-[1] mt-0.5 text-[10px] font-medium text-brand/80">
                    +{record.earned_points}P
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!loading && items.length > 0 && (
        <p className="mt-4 text-center text-xs text-gray-500">
          이번 달 출석 <span className="font-semibold text-gray-800">{items.length}</span>일
        </p>
      )}
    </Card>
  );
};

export default AttendanceMonthCalendar;
