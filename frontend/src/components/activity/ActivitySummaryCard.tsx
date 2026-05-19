import React from 'react';
import type { PointsSummary } from '../../types/activity';
import { Trophy, TrendingUp, TrendingDown, Calendar, Crown, Award, Medal, Star, Hexagon } from 'lucide-react';

interface ActivitySummaryCardProps {
  summary?: PointsSummary | null;
  loading?: boolean;
}

export const getRankColor = (rank: string) => {
  switch (rank.toLowerCase()) {
    case 'bronze': return { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200', icon: 'text-amber-600', bar: 'bg-amber-500' };
    case 'silver': return { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-200', icon: 'text-gray-500', bar: 'bg-gray-400' };
    case 'gold': return { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-200', icon: 'text-yellow-600', bar: 'bg-yellow-500' };
    case 'platinum': return { bg: 'bg-cyan-100', text: 'text-cyan-700', border: 'border-cyan-200', icon: 'text-cyan-600', bar: 'bg-cyan-500' };
    case 'diamond': return { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200', icon: 'text-purple-600', bar: 'bg-purple-500' };
    default: return { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200', icon: 'text-gray-400', bar: 'bg-gray-400' };
  }
};

export const getRankIcon = (rank: string, className = 'w-6 h-6') => {
  switch (rank.toLowerCase()) {
    case 'diamond': return <Crown className={className} />;
    case 'platinum': return <Star className={className} />;
    case 'gold': return <Trophy className={className} />;
    case 'silver': return <Medal className={className} />;
    case 'bronze': return <Award className={className} />;
    default: return <Hexagon className={className} />;
  }
};

const RANK_LABELS: Record<string, string> = {
  unranked: '언랭크',
  bronze: '브론즈',
  silver: '실버',
  gold: '골드',
  platinum: '플래티넘',
  diamond: '다이아',
};

const getRankLabel = (rank?: string | null) => {
  if (!rank) return '-';
  return RANK_LABELS[rank] || rank;
};

const ActivitySummaryCard: React.FC<ActivitySummaryCardProps> = ({ summary, loading }) => {
  if (loading || !summary) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="h-8 bg-gray-200 rounded w-1/2"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        </div>
      </div>
    );
  }

  const colors = getRankColor(summary.rank);
  const nextRankThreshold = summary.points_to_next_rank ? summary.current_points + summary.points_to_next_rank : summary.current_points;
  const progressPercent = summary.next_rank 
    ? Math.min(100, Math.max(0, (summary.current_points / nextRankThreshold) * 100))
    : 100;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-1">활동 포인트 현황</h2>
            <p className="text-sm text-gray-500">기여도와 랭크 진행 상황을 확인하세요.</p>
          </div>
          
          <div className={`flex items-center gap-3 px-4 py-2 rounded-xl border ${colors.bg} ${colors.border} ${colors.text}`}>
            <div className={colors.icon}>
              {getRankIcon(summary.rank)}
            </div>
            <div>
              <p className="text-xs uppercase font-bold opacity-70">현재 랭크</p>
              <p className="font-bold text-lg">{getRankLabel(summary.rank)}</p>
            </div>
          </div>
        </div>

        <div className="mb-8">
          <div className="flex justify-between items-end mb-2">
            <div>
              <span className="text-3xl font-extrabold text-gray-900">{summary.current_points.toLocaleString()}</span>
              <span className="text-sm text-gray-500 ml-1">pts</span>
            </div>
            {summary.next_rank && (
              <div className="text-right">
                <p className="text-xs text-gray-500 mb-0.5">다음 랭크: {getRankLabel(summary.next_rank)}</p>
                <p className="text-sm font-medium text-indigo-600">
                  {summary.points_to_next_rank?.toLocaleString()} pts 남음
                </p>
              </div>
            )}
          </div>
          
          <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-500 ease-out ${colors.bar}`}
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 border-t border-gray-50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">총 적립</p>
              <p className="text-lg font-bold text-gray-900">+{summary.total_earned.toLocaleString()}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-rose-50 text-rose-600">
              <TrendingDown className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">총 사용</p>
              <p className="text-lg font-bold text-gray-900">-{summary.total_spent.toLocaleString()}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">이번 달</p>
              <p className="text-lg font-bold text-gray-900">+{summary.this_month_earned.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActivitySummaryCard;
