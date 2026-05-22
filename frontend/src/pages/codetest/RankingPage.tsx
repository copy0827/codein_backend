import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import {
  ChevronLeft,
  ChevronRight,
  LayoutList,
  Loader2,
  Terminal,
  User,
} from 'lucide-react';
import RankBadge from '../../components/codetest/RankBadge';
import UserStatsModal from '../../components/codetest/UserStatsModal';
import { useAuth } from '../../context/AuthContext';
import { useCodetestRankingQuery } from '../../hooks/useCodetestRanking';
import type { CodetestStatPeriod, RankingItem } from '../../types/codetest';

const PAGE_SIZE = 10;

const PERIOD_OPTIONS: { value: CodetestStatPeriod; label: string }[] = [
  { value: 'ALL', label: '전체' },
  { value: 'SEMESTER', label: '이번 학기' },
  { value: 'MONTH', label: '이번 달' },
];

const formatActivityDate = (value: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return format(date, 'yyyy.MM.dd');
};

const RankingPage: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [period, setPeriod] = useState<CodetestStatPeriod>('ALL');
  const [page, setPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState<{
    userId: number;
    nickname: string;
  } | null>(null);

  const { data, isLoading, isError, isFetching } = useCodetestRankingQuery(
    period,
    page,
    PAGE_SIZE,
  );

  const handlePeriodChange = (next: CodetestStatPeriod) => {
    setPeriod(next);
    setPage(1);
  };

  const openUserStats = (row: RankingItem) => {
    setSelectedUser({ userId: row.user_id, nickname: row.nickname });
  };

  const totalPages = data?.total_pages ?? 0;
  const total = data?.total ?? 0;
  const myRank = data?.my_rank ?? null;
  const myItem = data?.my_item ?? null;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-dark-text flex items-center gap-2">
            <LayoutList className="w-8 h-8 text-indigo-600" />
            코딩테스트 랭킹
          </h1>
          <p className="text-gray-600 mt-1">
            제출 수·정답률·획득 점수 기준 동아리 랭킹을 확인하세요. 닉네임을 클릭하면 상세 통계를 볼 수 있습니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/contest"
            className="px-4 py-2 text-sm font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
          >
            <Terminal className="w-4 h-4 inline mr-1.5 -mt-0.5" />
            대회 목록
          </Link>
          <Link
            to="/practice"
            className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            연습 문제
          </Link>
        </div>
      </div>

      {isAuthenticated && myRank != null && myItem && (
        <div className="mb-6 rounded-xl border border-indigo-200 bg-indigo-50/80 px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="font-semibold text-indigo-900">내 순위</span>
          <span className="text-indigo-800">
            <strong className="text-lg">{myRank}</strong>위 · 정답률{' '}
            {myItem.correct_rate.toFixed(1)}% · 총점{' '}
            {myItem.total_score.toLocaleString()}점
          </span>
          <button
            type="button"
            onClick={() => openUserStats(myItem)}
            className="text-xs font-semibold text-indigo-700 underline hover:no-underline"
          >
            내 통계 보기
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
        <div className="flex flex-wrap gap-2 p-4 border-b border-gray-100 bg-gray-50/80">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handlePeriodChange(opt.value)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                period === opt.value
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-indigo-300 hover:text-indigo-700'
              }`}
            >
              {opt.label}
            </button>
          ))}
          {isFetching && !isLoading && (
            <Loader2 className="w-4 h-4 text-indigo-500 animate-spin self-center ml-1" />
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-bold uppercase tracking-wider text-gray-500 border-b border-gray-100">
                <th className="px-4 py-3 w-20 text-center">순위</th>
                <th className="px-4 py-3">닉네임</th>
                <th className="px-4 py-3 text-right">총 제출</th>
                <th className="px-4 py-3 text-right">정답률</th>
                <th className="px-4 py-3 text-right">총 점수</th>
                <th className="px-4 py-3 text-right">최근 활동</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                Array.from({ length: PAGE_SIZE }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td colSpan={6} className="px-4 py-4">
                      <div className="h-5 bg-gray-100 rounded w-full" />
                    </td>
                  </tr>
                ))
              ) : isError ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                    랭킹을 불러오지 못했습니다.
                  </td>
                </tr>
              ) : !data?.items?.length ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center text-gray-500">
                    해당 기간에 집계된 랭킹 데이터가 없습니다.
                  </td>
                </tr>
              ) : (
                data.items.map((row) => (
                  <tr
                    key={`${row.user_id}-${row.rank}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => openUserStats(row)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openUserStats(row);
                      }
                    }}
                    className={`cursor-pointer transition-colors ${
                      row.is_self
                        ? 'bg-blue-50/90 hover:bg-blue-50'
                        : 'hover:bg-gray-50/80'
                    }`}
                  >
                    <td className="px-4 py-3.5 text-center">
                      <RankBadge rank={row.rank} />
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openUserStats(row);
                          }}
                          className={`font-semibold truncate text-left hover:underline ${
                            row.is_self ? 'text-indigo-800' : 'text-gray-900'
                          }`}
                        >
                          {row.nickname}
                        </button>
                        {row.is_self && (
                          <span className="shrink-0 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">
                            나
                          </span>
                        )}
                        {row.rank_tier && row.rank_tier !== 'unranked' && (
                          <span className="shrink-0 text-[10px] text-gray-400 hidden sm:inline">
                            {row.rank_tier}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono text-gray-700">
                      {row.total_submissions}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <span
                        className={`font-mono font-medium ${
                          row.correct_rate >= 70
                            ? 'text-emerald-600'
                            : row.correct_rate >= 40
                              ? 'text-amber-600'
                              : 'text-gray-600'
                        }`}
                      >
                        {row.correct_rate.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono font-semibold text-gray-900">
                      {row.total_score.toLocaleString()}
                    </td>
                    <td className="px-4 py-3.5 text-right text-gray-500 whitespace-nowrap">
                      {formatActivityDate(row.last_activity_date)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-4 border-t border-gray-100 bg-gray-50/50">
            <p className="text-sm text-gray-500">
              총 <strong className="text-gray-800">{total}</strong>명 ·{' '}
              {page} / {totalPages} 페이지
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-2 rounded-lg border border-gray-200 bg-white disabled:opacity-40 hover:bg-gray-50 transition-colors"
                aria-label="이전 페이지"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-medium text-gray-700 min-w-[4rem] text-center">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="p-2 rounded-lg border border-gray-200 bg-white disabled:opacity-40 hover:bg-gray-50 transition-colors"
                aria-label="다음 페이지"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400 flex items-center gap-1.5">
        <User className="w-3.5 h-3.5" />
        순위는 총 점수 → 정답률 → 정답 수 순으로 산정됩니다.
        {isAuthenticated
          ? ' 로그인 시 본인 행이 강조 표시됩니다.'
          : ' 로그인하면 본인 순위가 강조 표시됩니다.'}
      </p>

      <UserStatsModal
        isOpen={selectedUser != null}
        onClose={() => setSelectedUser(null)}
        userId={selectedUser?.userId ?? null}
        nickname={selectedUser?.nickname ?? ''}
        period={period}
      />
    </div>
  );
};

export default RankingPage;
