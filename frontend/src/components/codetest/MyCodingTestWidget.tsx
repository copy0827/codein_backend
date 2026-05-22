import React from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import {
  BarChart3,
  CalendarClock,
  ChevronRight,
  Hash,
  Percent,
  Send,
  Trophy,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCodetestRankingWidgetQuery } from '../../hooks/useCodetestRanking';

const formatActivityDate = (value: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return format(date, 'yyyy.MM.dd');
};

interface StatBlockProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}

const StatBlock: React.FC<StatBlockProps> = ({ icon, label, value, sub }) => (
  <div className="bg-dark-cardSoft border border-dark-line rounded-xl p-4 min-w-0">
    <div className="flex items-center gap-2 text-dark-muted mb-2">
      {icon}
      <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
    </div>
    <p className="text-2xl font-bold text-dark-text tabular-nums truncate">{value}</p>
    {sub && <p className="text-xs text-dark-muted mt-1">{sub}</p>}
  </div>
);

const MyCodingTestWidget: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { data, isLoading, isError } = useCodetestRankingWidgetQuery(isAuthenticated);

  if (!isAuthenticated) {
    return null;
  }

  const handleClick = () => {
    navigate('/contest/ranking');
  };

  const rankLabel =
    data?.my_rank != null ? `${data.my_rank}위` : '—';
  const correctRateLabel = `${(data?.correct_rate ?? 0).toFixed(1)}%`;
  const submissionsLabel = String(data?.month_total_submissions ?? 0);
  const submissionsSub =
    data && data.month_total_submissions > 0
      ? `정답 ${data.month_correct_submissions}건`
      : '이번 달 기록 없음';

  return (
    <button
      type="button"
      onClick={handleClick}
      className="w-full text-left bg-dark-card rounded-2xl shadow-sm border border-dark-line p-6 hover:border-indigo-500/40 hover:shadow-md transition-all group focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
    >
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <h3 className="text-lg font-bold text-dark-text flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-400" />
            코딩테스트 랭킹
          </h3>
          <p className="text-sm text-dark-muted mt-0.5">이번 달 활동 요약 · 탭하여 전체 랭킹 보기</p>
        </div>
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-400 group-hover:translate-x-0.5 transition-transform shrink-0">
          상세
          <ChevronRight className="w-4 h-4" />
        </span>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-pulse">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-dark-cardSoft rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <p className="text-sm text-dark-muted">랭킹 정보를 불러오지 못했습니다.</p>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatBlock
            icon={<Trophy className="w-4 h-4 text-amber-400" />}
            label="내 순위"
            value={rankLabel}
            sub="이번 달 기준"
          />
          <StatBlock
            icon={<Percent className="w-4 h-4 text-emerald-400" />}
            label="정답률"
            value={correctRateLabel}
          />
          <StatBlock
            icon={<Send className="w-4 h-4 text-sky-400" />}
            label="이번 달 제출"
            value={submissionsLabel}
            sub={submissionsSub}
          />
          <StatBlock
            icon={<CalendarClock className="w-4 h-4 text-violet-400" />}
            label="최근 제출일"
            value={formatActivityDate(data?.last_activity_date ?? null)}
          />
        </div>
      )}

      {data && data.total_score_month > 0 && (
        <p className="mt-4 text-xs text-dark-muted flex items-center gap-1.5">
          <Hash className="w-3.5 h-3.5" />
          이번 달 획득 점수 {data.total_score_month.toLocaleString()}점
        </p>
      )}
    </button>
  );
};

export default MyCodingTestWidget;
