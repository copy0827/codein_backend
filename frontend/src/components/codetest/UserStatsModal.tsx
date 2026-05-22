import React, { useEffect, useRef } from 'react';
import { format } from 'date-fns';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3, Inbox, Loader2, TrendingUp, X } from 'lucide-react';
import { useCodetestUserStatsQuery } from '../../hooks/useCodetestRanking';
import type { CodetestStatPeriod } from '../../types/codetest';
import {
  difficultyToBarChartData,
  hasChartableActivity,
  trendToLineChartData,
} from '../../utils/codetestCharts';

const PERIOD_LABELS: Record<CodetestStatPeriod, string> = {
  ALL: '전체',
  SEMESTER: '이번 학기',
  MONTH: '이번 달',
};

const formatActivityDate = (value: string | null | undefined) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return format(date, 'yyyy.MM.dd HH:mm');
};

interface UserStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: number | null;
  nickname: string;
  period: CodetestStatPeriod;
}

const ChartPlaceholder: React.FC<{ message: string }> = ({ message }) => (
  <div className="flex flex-col items-center justify-center h-48 rounded-xl border border-dashed border-gray-200 bg-gray-50 text-gray-500">
    <Inbox className="w-10 h-10 text-gray-300 mb-2" />
    <p className="text-sm text-center px-4">{message}</p>
  </div>
);

const UserStatsModal: React.FC<UserStatsModalProps> = ({
  isOpen,
  onClose,
  userId,
  nickname,
  period,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const shouldShow = isOpen && userId != null;

  const { data, isLoading, isError } = useCodetestUserStatsQuery(
    userId,
    period,
    shouldShow,
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (shouldShow) {
      if (!dialog.open) {
        dialog.showModal();
      }
      document.body.style.overflow = 'hidden';
    } else if (dialog.open) {
      dialog.close();
    }

    return () => {
      if (dialog.open) {
        dialog.close();
      }
      document.body.style.overflow = '';
    };
  }, [shouldShow]);

  const handleDialogClose = () => {
    document.body.style.overflow = '';
    onClose();
  };

  const barData = difficultyToBarChartData(data?.difficulty_distribution ?? {});
  const lineData = trendToLineChartData(data?.submission_trend ?? []);
  const showCharts = data
    ? hasChartableActivity(
        data.total_submissions,
        data.difficulty_distribution,
        data.submission_trend,
      )
    : false;

  return (
    <dialog
      ref={dialogRef}
      className="user-stats-dialog"
      aria-labelledby="user-stats-modal-title"
      onClose={handleDialogClose}
      onCancel={(e) => {
        e.preventDefault();
        handleDialogClose();
      }}
    >
      <div
        className="user-stats-dialog__scrim"
        onClick={handleDialogClose}
        role="presentation"
      >
        <div
          className="user-stats-dialog__panel"
          onClick={(e) => e.stopPropagation()}
        >
        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-gray-100">
          <div>
            <h2 id="user-stats-modal-title" className="text-xl font-bold text-gray-900">
              {nickname} · 통계 상세
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {PERIOD_LABELS[period]} 기준
              {data?.rank != null && (
                <span className="ml-2 text-indigo-600 font-medium">{data.rank}위</span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={handleDialogClose}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            aria-label="닫기"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-500">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-3" />
              <p className="text-sm">통계를 불러오는 중...</p>
            </div>
          ) : isError ? (
            <ChartPlaceholder message="통계를 불러오지 못했습니다." />
          ) : data ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-3">
                  <p className="text-xs text-indigo-600 font-medium">총 제출</p>
                  <p className="text-2xl font-bold text-indigo-900 tabular-nums">
                    {data.total_submissions}
                  </p>
                </div>
                <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3">
                  <p className="text-xs text-emerald-600 font-medium">정답률</p>
                  <p className="text-2xl font-bold text-emerald-900 tabular-nums">
                    {data.correct_rate.toFixed(1)}%
                  </p>
                </div>
                <div className="rounded-xl bg-amber-50 border border-amber-100 p-3">
                  <p className="text-xs text-amber-700 font-medium">총 점수</p>
                  <p className="text-2xl font-bold text-amber-900 tabular-nums">
                    {data.total_score.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-xl bg-gray-50 border border-gray-200 p-3">
                  <p className="text-xs text-gray-500 font-medium">최근 활동</p>
                  <p className="text-sm font-semibold text-gray-800 mt-1">
                    {formatActivityDate(data.last_activity_date)}
                  </p>
                </div>
              </div>

              {!showCharts ? (
                <ChartPlaceholder message="이 기간 동안의 제출 기록이 없습니다." />
              ) : (
                <>
                  <section>
                    <h3 className="flex items-center gap-2 text-sm font-bold text-gray-800 mb-3">
                      <BarChart3 className="w-4 h-4 text-indigo-600" />
                      난이도별 제출 · 정답
                    </h3>
                    {barData.length === 0 ? (
                      <ChartPlaceholder message="난이도별 분포 데이터가 없습니다." />
                    ) : (
                      <div className="h-56 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={barData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis dataKey="tier" tick={{ fontSize: 12 }} />
                            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                            <Tooltip
                              contentStyle={{
                                borderRadius: 8,
                                border: '1px solid #e5e7eb',
                                fontSize: 12,
                              }}
                            />
                            <Legend />
                            <Bar
                              dataKey="total"
                              name="제출"
                              fill="#818cf8"
                              radius={[4, 4, 0, 0]}
                            />
                            <Bar
                              dataKey="correct"
                              name="정답"
                              fill="#34d399"
                              radius={[4, 4, 0, 0]}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </section>

                  <section>
                    <h3 className="flex items-center gap-2 text-sm font-bold text-gray-800 mb-3">
                      <TrendingUp className="w-4 h-4 text-emerald-600" />
                      기간별 제출 · 정답 추이
                    </h3>
                    {lineData.length === 0 ||
                    !lineData.some((p) => p.submissions > 0) ? (
                      <ChartPlaceholder message="제출 추이 데이터가 없습니다." />
                    ) : (
                      <div className="h-56 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart
                            data={lineData}
                            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis
                              dataKey="label"
                              tick={{ fontSize: 11 }}
                              interval="preserveStartEnd"
                            />
                            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                            <Tooltip
                              contentStyle={{
                                borderRadius: 8,
                                border: '1px solid #e5e7eb',
                                fontSize: 12,
                              }}
                            />
                            <Legend />
                            <Line
                              type="monotone"
                              dataKey="submissions"
                              name="제출 수"
                              stroke="#6366f1"
                              strokeWidth={2}
                              dot={{ r: 3 }}
                              activeDot={{ r: 5 }}
                            />
                            <Line
                              type="monotone"
                              dataKey="correct"
                              name="정답 수"
                              stroke="#10b981"
                              strokeWidth={2}
                              dot={{ r: 3 }}
                              activeDot={{ r: 5 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </section>
                </>
              )}
            </>
          ) : null}
        </div>
      </div>
      </div>
    </dialog>
  );
};

export default UserStatsModal;
