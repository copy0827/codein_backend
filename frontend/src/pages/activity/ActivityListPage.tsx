import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Home,
  ChevronRight as ChevronRightIcon,
  LayoutGrid,
  PencilLine,
  Search,
  Users,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import ActivityCard from '../../components/activity/ActivityCard';
import { RECRUITMENT_TYPE_TABS } from '../../components/activity/activityUi';
import { useActivityListQuery } from '../../hooks/useActivityRecruitment';
import type { RecruitmentType } from '../../types/activity';

type TabKey = 'ALL' | RecruitmentType;

const ActivityListPage: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const tabFromUrl = (searchParams.get('type')?.toUpperCase() || 'ALL') as TabKey;
  const [activeTab, setActiveTab] = useState<TabKey>(
    RECRUITMENT_TYPE_TABS.some((t) => t.key === tabFromUrl) ? tabFromUrl : 'ALL',
  );
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1);
  const [searchKeyword, setSearchKeyword] = useState(searchParams.get('q') ?? '');
  const [appliedKeyword, setAppliedKeyword] = useState(searchParams.get('q') ?? '');

  const listParams = useMemo(
    () => ({
      recruitment_type: activeTab === 'ALL' ? undefined : activeTab,
      search_keyword: appliedKeyword.trim() || undefined,
      page,
      size: 12,
    }),
    [activeTab, appliedKeyword, page],
  );

  const { data, isLoading, isError } = useActivityListQuery(listParams);

  useEffect(() => {
    const params = new URLSearchParams();
    if (activeTab !== 'ALL') params.set('type', activeTab);
    if (appliedKeyword.trim()) params.set('q', appliedKeyword.trim());
    if (page > 1) params.set('page', String(page));
    navigate(`/activities?${params.toString()}`, { replace: true });
  }, [activeTab, appliedKeyword, page, navigate]);

  useEffect(() => {
    const next = (searchParams.get('type')?.toUpperCase() || 'ALL') as TabKey;
    if (RECRUITMENT_TYPE_TABS.some((t) => t.key === next)) {
      setActiveTab(next);
    }
  }, [searchParams]);

  useEffect(() => {
    setPage(1);
  }, [activeTab, appliedKeyword]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedKeyword(searchKeyword);
    setPage(1);
  };

  const items = data?.items ?? [];
  const totalPages = data?.total_pages ?? 0;
  const total = data?.total ?? 0;

  const tabAccent: Record<TabKey, string> = {
    ALL: 'text-blue-700',
    STUDY: 'text-blue-700',
    PROJECT: 'text-violet-700',
    CONTEST: 'text-amber-700',
    MENTORING: 'text-emerald-700',
  };

  return (
    <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-8">
      <nav className="flex items-center text-sm text-gray-500 mb-6 space-x-2">
        <Home className="w-4 h-4" />
        <Link to="/" className="hover:text-blue-600">
          홈
        </Link>
        <ChevronRightIcon className="w-4 h-4" />
        <span className="font-semibold text-blue-600">활동 모집</span>
      </nav>

      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-indigo-100 text-indigo-600">
              <LayoutGrid className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-dark-text">활동 모집</h1>
              <p className="text-sm text-gray-500 mt-1">
                스터디·프로젝트·공모전·멘토-멘티 모집을 한곳에서 확인하세요.
              </p>
            </div>
          </div>
          {isAuthenticated && (
            <Link
              to="/activities/write"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg transition-colors shadow-sm"
            >
              <PencilLine className="w-4 h-4" />
              모집글 작성
            </Link>
          )}
        </div>

        <div className="flex flex-wrap gap-2 p-1 bg-gray-100 rounded-xl w-full sm:w-fit">
          {RECRUITMENT_TYPE_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === tab.key
                  ? `bg-white ${tabAccent[tab.key]} shadow-sm`
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.key === 'MENTORING' ? (
                <Users className="w-4 h-4" />
              ) : null}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSearch} className="mb-6 flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            placeholder="제목·내용 검색"
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2.5 rounded-lg bg-gray-800 text-white text-sm font-medium hover:bg-gray-900 transition-colors"
        >
          검색
        </button>
      </form>

      {isLoading ? (
        <div className="py-16 text-center text-gray-500">로딩중...</div>
      ) : isError ? (
        <div className="py-16 text-center text-gray-500">목록을 불러오지 못했습니다.</div>
      ) : items.length === 0 ? (
        <div className="bg-white shadow-xl rounded-xl border border-gray-100 p-12 text-center text-gray-500">
          등록된 모집글이 없습니다.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {items.map((activity) => (
            <ActivityCard key={activity.id} activity={activity} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-8 text-sm">
          <span className="text-gray-500">총 {total}건</span>
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
            <span className="font-medium text-gray-700">
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
  );
};

export default ActivityListPage;
