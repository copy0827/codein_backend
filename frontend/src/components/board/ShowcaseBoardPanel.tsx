import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Github,
  MessageSquare,
  PencilLine,
  Search,
} from 'lucide-react';
import { useShowcaseListQuery } from '../../hooks/useShowcaseBoard';
import { useBoardPermissions } from '../../hooks/useBoardPermissions';
import type { ShowcaseBoardType } from '../../types/board';
import TechStackBadges from './TechStackBadges';

interface ShowcaseBoardPanelProps {
  boardType: ShowcaseBoardType;
  defaultBoardId?: number;
}

const formatDate = (value: string) => {
  const date = new Date(value.includes('Z') || value.includes('+') ? value : `${value}Z`);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}.${m}.${d}`;
};

const ShowcaseBoardPanel: React.FC<ShowcaseBoardPanelProps> = ({
  boardType,
  defaultBoardId,
}) => {
  const { canWrite } = useBoardPermissions();
  const [page, setPage] = useState(1);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchType, setSearchType] = useState<'title' | 'author'>('title');
  const [appliedKeyword, setAppliedKeyword] = useState('');
  const size = 10;

  const listParams = useMemo(
    () => ({
      board_type: boardType,
      page,
      size,
      search_keyword: appliedKeyword.trim() || undefined,
      search_type: searchType,
    }),
    [boardType, page, size, appliedKeyword, searchType],
  );

  const { data, isLoading, isError } = useShowcaseListQuery(listParams);

  const items = data?.items ?? [];
  const totalPages = data?.total_pages ?? 0;
  const total = data?.total ?? 0;

  useEffect(() => {
    setPage(1);
  }, [boardType, appliedKeyword, searchType]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedKeyword(searchKeyword);
    setPage(1);
  };

  const isProject = boardType === 'PROJECT';

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <p className="text-sm text-gray-500">
          {isProject
            ? '동아리 프로젝트를 소개하고 GitHub 활동을 공유합니다.'
            : '기술 인사이트와 개발 경험을 기록합니다.'}
        </p>
        {canWrite && (
          <Link
            to="/board/write"
            state={{ showcase: true, boardType, boardId: defaultBoardId }}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg transition-colors shadow-sm"
          >
            <PencilLine className="w-4 h-4" />
            글쓰기
          </Link>
        )}
      </div>

      <form onSubmit={handleSearchSubmit} className="mb-4 flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            placeholder={searchType === 'title' ? '제목 검색' : '작성자 검색'}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={searchType}
          onChange={(e) => setSearchType(e.target.value as 'title' | 'author')}
          className="px-3 py-2.5 rounded-lg border border-gray-200 text-sm bg-white"
        >
          <option value="title">제목</option>
          <option value="author">작성자</option>
        </select>
        <button
          type="submit"
          className="px-4 py-2.5 rounded-lg bg-gray-800 text-white text-sm font-medium hover:bg-gray-900"
        >
          검색
        </button>
      </form>

      <div className="bg-white shadow-xl rounded-xl border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">로딩중...</div>
        ) : isError ? (
          <div className="p-8 text-center text-gray-500">목록을 불러오지 못했습니다.</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-gray-500">게시글이 없습니다.</div>
        ) : (
          <>
            <div className="hidden md:grid md:grid-cols-12 gap-3 px-5 py-3 bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100">
              <div className="col-span-5">제목</div>
              <div className="col-span-2">작성자</div>
              <div className="col-span-3">기술 스택</div>
              <div className="col-span-2 text-right">조회/댓글</div>
            </div>

            <ul className="divide-y divide-gray-100">
              {items.map((item) => (
                <li key={item.id} className="hover:bg-gray-50/80 transition-colors">
                  <Link
                    to={`/board/showcase/${item.id}`}
                    className="block p-4 sm:p-5"
                  >
                    <div className="md:grid md:grid-cols-12 md:gap-3 md:items-center">
                      <div className="md:col-span-5 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {item.is_pinned && (
                            <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">
                              고정
                            </span>
                          )}
                          {isProject && item.has_github && (
                            <Github className="w-4 h-4 text-gray-800 shrink-0" aria-label="GitHub 연동" />
                          )}
                          <p className="font-semibold text-gray-900 truncate">{item.title}</p>
                        </div>
                        <div className="md:hidden flex flex-wrap items-center gap-3 mt-2 text-xs text-gray-500">
                          <span>{item.author?.name || '알 수 없음'}</span>
                          <span>{formatDate(item.created_at)}</span>
                        </div>
                      </div>

                      <div className="hidden md:block md:col-span-2 text-sm text-gray-600 truncate">
                        {item.author?.name || '알 수 없음'}
                      </div>

                      <div className="md:col-span-3 mt-2 md:mt-0">
                        {isProject ? (
                          <TechStackBadges items={item.tech_stack} max={4} />
                        ) : (
                          <span className="text-xs text-gray-400">
                            {item.category || '—'}
                          </span>
                        )}
                      </div>

                      <div className="flex md:col-span-2 md:justify-end items-center gap-4 mt-2 md:mt-0 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Eye className="w-4 h-4" />
                          {item.views}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageSquare className="w-4 h-4" />
                          {item.comment_count}
                        </span>
                        <span className="hidden lg:inline text-xs">{formatDate(item.created_at)}</span>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <span className="text-gray-500">총 {total}건</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="p-2 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
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
              className="p-2 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShowcaseBoardPanel;
