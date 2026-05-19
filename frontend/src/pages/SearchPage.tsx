import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search as SearchIcon, Calendar, Image as ImageIcon, FileText, User } from 'lucide-react';
import { search } from '../api/search';
import type { SearchResponse, SearchType } from '../types/search';

interface SearchItem {
  id: number;
  type: 'post' | 'album' | 'event';
  title: string;
  content: string;
  created_at: string;
  url: string;
  board_name?: string | null;
  author_name?: string | null;
}

const SearchPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryParam = searchParams.get('q') || '';
  const typeParam = (searchParams.get('type') as SearchType) || 'all';
  const boardParam = searchParams.get('board_id') || '';
  const authorParam = searchParams.get('author_name') || '';
  const dateFromParam = searchParams.get('date_from') || '';
  const dateToParam = searchParams.get('date_to') || '';

  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [inputQuery, setInputQuery] = useState(queryParam);
  const [boardId, setBoardId] = useState(boardParam);
  const [authorName, setAuthorName] = useState(authorParam);
  const [dateFrom, setDateFrom] = useState(dateFromParam);
  const [dateTo, setDateTo] = useState(dateToParam);

  useEffect(() => {
    setInputQuery(queryParam);
  }, [queryParam]);

  useEffect(() => {
    setBoardId(boardParam);
    setAuthorName(authorParam);
    setDateFrom(dateFromParam);
    setDateTo(dateToParam);
  }, [boardParam, authorParam, dateFromParam, dateToParam]);

  useEffect(() => {
    const fetchResults = async () => {
      if (!queryParam) {
        setResults(null);
        return;
      }
      setLoading(true);
      try {
          const data = await search({
            q: queryParam,
            type: typeParam,
            board_id: boardParam ? Number(boardParam) : undefined,
            author_name: authorParam || undefined,
            date_from: dateFromParam || undefined,
            date_to: dateToParam || undefined,
          });

        setResults(data);
      } catch (error) {
        console.error('Search failed', error);
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [queryParam, typeParam, boardParam, authorParam, dateFromParam, dateToParam]);

  const combinedResults = useMemo(() => {
    if (!results) return [] as SearchItem[];

    const items: SearchItem[] = [];

    results.posts.forEach((post) => {
      items.push({
        id: post.id,
        type: 'post',
        title: post.title,
        content: post.content,
        created_at: post.created_at,
        url: `/board/${post.board_id}/post/${post.id}`,
        board_name: post.board_name,
        author_name: post.author_name,
      });
    });

    results.albums.forEach((album) => {
      items.push({
        id: album.id,
        type: 'album',
        title: album.name,
        content: album.visibility === 'public' ? '공개 앨범' : album.visibility,
        created_at: album.created_at,
        url: `/gallery/${album.id}`,
        author_name: album.owner_name,
      });
    });

    results.events.forEach((event) => {
      items.push({
        id: event.id,
        type: 'event',
        title: event.title,
        content: event.description,
        created_at: event.start_time,
        url: `/events/${event.id}`,
        author_name: event.owner_name,
      });
    });

    return items;
  }, [results]);

  const updateSearchParams = (nextParams: {
    query?: string;
    type?: SearchType;
    boardId?: string;
    authorName?: string;
    dateFrom?: string;
    dateTo?: string;
  }) => {
    const params = new URLSearchParams();
    const nextQuery = nextParams.query ?? inputQuery;
    const nextType = nextParams.type ?? typeParam;
    const nextBoardId = nextParams.boardId ?? boardId;
    const nextAuthorName = nextParams.authorName ?? authorName;
    const nextDateFrom = nextParams.dateFrom ?? dateFrom;
    const nextDateTo = nextParams.dateTo ?? dateTo;

    if (nextQuery) {
      params.set('q', nextQuery);
    }
    if (nextType && nextType !== 'all') {
      params.set('type', nextType);
    }
    if (nextBoardId) {
      params.set('board_id', nextBoardId);
    }
    if (nextAuthorName) {
      params.set('author_name', nextAuthorName);
    }
    if (nextDateFrom) {
      params.set('date_from', nextDateFrom);
    }
    if (nextDateTo) {
      params.set('date_to', nextDateTo);
    }

    setSearchParams(params);
  };

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    updateSearchParams({ query: inputQuery });
  };

  const handleTypeChange = (newType: SearchType) => {
    updateSearchParams({ type: newType });
  };

  const getIcon = (itemType: string) => {
    switch (itemType) {
      case 'post':
        return <FileText className="w-5 h-5 text-blue-500" />;
      case 'album':
        return <ImageIcon className="w-5 h-5 text-green-500" />;
      case 'event':
        return <Calendar className="w-5 h-5 text-orange-500" />;
      default:
        return <FileText className="w-5 h-5" />;
    }
  };

  const renderItem = (item: SearchItem) => (
    <Link
      key={`${item.type}-${item.id}`}
      to={item.url}
      className="block p-4 sm:p-6 bg-dark-card border border-dark-line rounded-2xl hover:border-brand transition-all group"
    >
      <div className="flex items-start gap-4">
        <div className="p-3 bg-dark-cardSoft rounded-xl border border-dark-line group-hover:border-brand/30 transition-colors">
          {getIcon(item.type)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-brand px-2 py-0.5 rounded bg-brand-deep/20 border border-brand/20 uppercase tracking-wide">
              {item.type}
            </span>
            {item.board_name && (
              <span className="text-xs text-dark-muted">• {item.board_name}</span>
            )}
            <span className="text-xs text-dark-muted ml-auto">
              {new Date(item.created_at).toLocaleDateString()}
            </span>
          </div>
          <h3 className="text-lg font-bold text-white mb-2 group-hover:text-brand-light transition-colors line-clamp-1">
            {item.title}
          </h3>
          <p className="text-dark-muted text-sm line-clamp-2 mb-3">
            {item.content}
          </p>
          {item.author_name && (
            <div className="flex items-center gap-2 text-xs text-dark-muted">
              <User className="w-3 h-3" />
              <span>{item.author_name}</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-6">통합 검색</h1>
        <form onSubmit={handleSearch} className="relative">
          <input
            type="text"
            value={inputQuery}
            onChange={(event) => setInputQuery(event.target.value)}
            placeholder="게시글, 앨범, 일정 검색..."
            className="w-full bg-dark-bg border border-dark-line rounded-xl px-4 py-4 pl-12 text-white focus:outline-none focus:border-brand transition-colors text-lg"
          />
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-dark-muted w-5 h-5" />
          <button
            type="submit"
            className="absolute right-3 top-1/2 -translate-y-1/2 px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-light transition-colors font-medium"
          >
            검색
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 gap-4 mb-6 md:grid-cols-4">
          <input
            type="text"
            value={authorName}
            onChange={(event) => setAuthorName(event.target.value)}
            placeholder="작성자 이름"
            className="bg-dark-bg border border-dark-line rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand"
          />
          <input
            type="text"
            value={boardId}
            onChange={(event) => setBoardId(event.target.value)}
            placeholder="게시판 ID (숫자)"
            className="bg-dark-bg border border-dark-line rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand"
          />

        <div className="md:col-span-2 flex items-end gap-2">
          <div className="flex-1">
            <label htmlFor="search-date-from" className="block text-xs text-dark-muted mb-1">시작일</label>
            <input
              id="search-date-from"
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              className="w-full bg-dark-bg border border-dark-line rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand"
            />
          </div>
          <span className="text-dark-muted mb-2">~</span>
          <div className="flex-1">
            <label htmlFor="search-date-to" className="block text-xs text-dark-muted mb-1">종료일</label>
            <input
              id="search-date-to"
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              className="w-full bg-dark-bg border border-dark-line rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand"
            />
          </div>
        </div>
          <button
            type="button"
            onClick={() => updateSearchParams({ authorName, boardId, dateFrom, dateTo })}
            className="md:col-span-4 px-4 py-2 rounded-lg bg-dark-cardSoft text-dark-muted border border-dark-line hover:text-white hover:bg-dark-nav transition-colors text-sm"
          >
            필터 적용
          </button>

      </div>

      <div className="flex gap-2 overflow-x-auto pb-4 mb-6 border-b border-dark-line">
        {(['all', 'posts', 'albums', 'events'] as SearchType[]).map((tab) => {
          const labelMap: Record<SearchType, string> = {
            all: '전체',
            posts: '게시글',
            albums: '앨범',
            events: '일정',
          };

          return (
            <button
              type="button"
              key={tab}
              onClick={() => handleTypeChange(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                typeParam === tab
                  ? 'bg-white text-dark-bg'
                  : 'text-dark-muted hover:text-white hover:bg-dark-cardSoft'
              }`}
            >
              {labelMap[tab]}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-dark-muted">검색 중...</p>
        </div>
      ) : results ? (
        <div className="space-y-4">
          <div className="text-sm text-dark-muted mb-4">
            {results.total_count}건 결과
          </div>
          {combinedResults.length > 0 ? (
            combinedResults.map(renderItem)
          ) : (
            <div className="text-center py-12 bg-dark-cardSoft/50 rounded-2xl border border-dark-line/50">
              <p className="text-dark-muted">"{queryParam}"에 대한 결과가 없습니다</p>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-12 text-dark-muted">
          검색어를 입력하세요
        </div>
      )}
    </div>
  );
};

export default SearchPage;
