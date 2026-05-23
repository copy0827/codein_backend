import React from 'react';
import { Check, LayoutGrid, Trophy } from 'lucide-react';
import Card from '../ui/Card';
import type { TodayAttendanceStatus } from '../../types/attendance';

interface StampBoardWidgetProps {
  status: TodayAttendanceStatus | undefined;
  loading: boolean;
}

const StampBoardWidget: React.FC<StampBoardWidgetProps> = ({ status, loading }) => {
  const maxPieces = status?.max_stamp_pieces ?? 10;
  const filled = status?.current_stamp_count ?? 0;
  const cycle = status?.current_stamp_cycle ?? 1;
  const untilComplete = status?.stamps_until_board_complete ?? maxPieces;
  const completedBoards = status?.completed_stamp_boards ?? 0;

  const slots = Array.from({ length: maxPieces }, (_, i) => i < filled);

  return (
    <Card variant="elevated" padding="lg">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-brand">
            <LayoutGrid className="h-5 w-5" aria-hidden />
            <span className="text-sm font-semibold">내 스탬프판</span>
          </div>
          <p className="text-xs text-gray-500">
            <span className="font-medium text-gray-700">{cycle}번째</span> 스탬프판 · 완성까지{' '}
            <span className="font-semibold text-brand">{untilComplete}</span>칸
          </p>
        </div>
        {!loading && (
          <div className="inline-flex items-center gap-1.5 self-start rounded-full border border-amber-100 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
            <Trophy className="h-3.5 w-3.5" aria-hidden />
            완성 {completedBoards}회
          </div>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-5 gap-3 sm:grid-cols-10">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="aspect-square animate-pulse rounded-full bg-gray-100"
            />
          ))}
        </div>
      ) : (
        <div
          className={`grid grid-cols-5 gap-3 ${
            maxPieces > 5 ? 'sm:grid-cols-10' : ''
          }`}
          role="list"
          aria-label={`스탬프 ${filled}칸 / ${maxPieces}칸`}
        >
          {slots.map((isFilled, index) => (
            <div
              key={index}
              role="listitem"
              className="flex aspect-square items-center justify-center"
            >
              {isFilled ? (
                <div className="flex h-full w-full max-w-[3.25rem] items-center justify-center rounded-full bg-brand text-white shadow-md shadow-brand/25 transition-transform hover:scale-105 sm:max-w-none">
                  <Check className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={2.5} aria-hidden />
                </div>
              ) : (
                <div
                  className="h-full w-full max-w-[3.25rem] rounded-full border-2 border-dashed border-gray-200 bg-gray-50/80 sm:max-w-none"
                  aria-hidden
                />
              )}
            </div>
          ))}
        </div>
      )}

      {!loading && status && (
        <p className="mt-5 text-center text-xs text-gray-500">
          스탬프판을 모두 채우면{' '}
          <span className="font-semibold text-brand">
            +{status.policy.board_complete_reward_points}P
          </span>{' '}
          보너스를 받아요.
        </p>
      )}
    </Card>
  );
};

export default StampBoardWidget;
