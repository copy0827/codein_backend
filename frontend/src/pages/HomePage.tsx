import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Settings, RefreshCw, ArrowRight, Calendar, MapPin } from 'lucide-react';
import { getNotices } from '../api/board';
import { getEventOccurrences } from '../api/events';
import { getPopularPosts } from '../api/dashboard';
import { getTests } from '../api/codetest';
import { galleryApi } from '../api/gallery';
import { useAuth } from '../context/AuthContext';
import type { Post } from '../types/board';
import type { Event } from '../api/events';
import type { PopularPost } from '../api/dashboard';
import type { Album } from '../types/gallery';
import type { Test } from '../types/codetest';

const HomePage: React.FC = () => {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState('all');
  const [boardId, setBoardId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const { isAuthenticated } = useAuth();
  const [notices, setNotices] = useState<Post[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [tests, setTests] = useState<Test[]>([]);
  const [popularPosts, setPopularPosts] = useState<PopularPost[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const navigate = useNavigate();

  const fetchNotices = useCallback(async () => {
    try {
      const data = await getNotices({ limit: 3 });
      setNotices(data);
    } catch (error) {
      console.error('Failed to fetch notices', error);
    }
  }, []);

  const fetchEvents = useCallback(async () => {
    try {
      const now = new Date();
      const start = now.toISOString();
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();
      
      const data = await getEventOccurrences(start, end);
      setEvents(data.slice(0, 3));
    } catch (error) {
      console.error('Failed to fetch events', error);
    }
  }, []);

  const fetchPopularPosts = useCallback(async () => {
    try {
      const data = await getPopularPosts('week', 5);
      setPopularPosts(data.posts);
    } catch (error) {
      console.error('Failed to fetch popular posts', error);
    }
  }, []);

  const fetchTests = useCallback(async () => {
    try {
      const data = await getTests();
      setTests(data);
    } catch (error) {
      console.error('Failed to fetch tests', error);
    }
  }, []);

  const fetchAlbums = useCallback(async () => {
    try {
      const data = await galleryApi.getAlbums(0, 6);
      setAlbums(data.albums);
    } catch (error) {
      console.error('Failed to fetch albums', error);
    }
  }, []);

  useEffect(() => {
    fetchNotices();
    if (isAuthenticated) {
      fetchEvents();
      fetchPopularPosts();
      fetchTests();
      fetchAlbums();
    }
  }, [isAuthenticated, fetchNotices, fetchEvents, fetchPopularPosts, fetchTests, fetchAlbums]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      return;
    }

    const params = new URLSearchParams();
    params.set('q', searchQuery.trim());
    if (searchType !== 'all') {
      params.set('type', searchType);
    }
    if (boardId) {
      params.set('board_id', boardId);
    }
    if (dateFrom) {
      params.set('date_from', dateFrom);
    }
    if (dateTo) {
      params.set('date_to', dateTo);
    }

    navigate(`/search?${params.toString()}`);
  };

  const handleScrollToPopular = () => {
    const element = document.getElementById('popular-posts-section');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="space-y-0">
      <section className="relative overflow-hidden pt-10 pb-8 md:pt-14 md:pb-10">
        <div className="absolute inset-0 bg-gradient-to-b from-dark-bg/65 to-dark-bg/45 pointer-events-none z-0"></div>
        <div
          className="absolute inset-0 bg-[url('/assets/bg/hero.png')] bg-cover bg-center opacity-30 pointer-events-none z-0"
          aria-hidden="true"
        ></div>
        <div 
          className="absolute -bottom-[40%] -left-[20%] -right-[20%] h-[380px] bg-[radial-gradient(closest-side,rgba(37,99,235,0.18),transparent_70%)] blur-[2px] pointer-events-none z-0" 
          aria-hidden="true"
        ></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-6 items-center">
            <div className="hero__copy">
              <h1 className="text-3xl sm:text-4xl md:text-[44px] font-extrabold text-dark-text mt-3.5 mb-2.5 leading-[1.15] tracking-tight" style={{ textShadow: '0 8px 24px rgba(0,0,0,0.22)' }}>
                동아리 운영을<br />
                한 페이지에서
              </h1>
              <p className="text-base text-dark-muted max-w-[52ch]">
                공지/게시판/캘린더/갤러리를 빠르게 확인하고, 필요한 정보만 깔끔하게 정리합니다.
              </p>
              <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2.5 my-4.5">
                {isAuthenticated ? (
                  <>
                    <Link to="/contest" className="w-full sm:w-auto px-4 py-3 rounded-2xl bg-transparent text-dark-text font-bold border border-dark-line hover:bg-brand-light hover:text-white transition-colors text-base">
                      코딩테스트 응시
                    </Link>
                    <Link to="/events" className="w-full sm:w-auto px-4 py-3 rounded-2xl bg-brand text-white font-bold border border-dark-line hover:bg-brand-light transition-colors text-base">
                      활동 보기
                    </Link>
                    <Link to="/events" className="w-full sm:w-auto px-4 py-3 rounded-2xl bg-transparent text-dark-text font-bold border border-dark-line hover:bg-brand-light hover:text-white transition-colors text-base">
                      일정 확인
                    </Link>
                  </>
                ) : (
                  <>
                    <Link to="/register" className="w-full sm:w-auto px-4 py-3 rounded-2xl bg-brand text-white font-bold border border-dark-line hover:bg-brand-light transition-colors text-base">
                      가입하기
                    </Link>
                    <Link to="/login" className="w-full sm:w-auto px-4 py-3 rounded-2xl bg-transparent text-dark-text font-bold border border-dark-line hover:bg-brand-light hover:text-white transition-colors text-base">
                      로그인
                    </Link>
                  </>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-2">
                <Link
                  to="/events"
                  className="p-3 rounded-2xl bg-dark-cardSoft border border-dark-line transition-all hover:-translate-y-0.5 hover:border-brand/35 hover:bg-dark-cardSoft"
                >
                  <div className="text-xs text-dark-muted">오늘 일정</div>
                  <div className="text-base font-bold text-dark-text mt-1.5">
                    {(() => {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const todayEnd = new Date(today);
                      todayEnd.setHours(23, 59, 59, 999);
                      const todayEvents = events.filter(event => {
                        const eventDate = new Date(event.start_time);
                        return eventDate >= today && eventDate <= todayEnd;
                      });
                      return todayEvents.length > 0 ? `${todayEvents.length}건` : '없음';
                    })()}
                  </div>
                </Link>
                <Link
                  to={events.length > 0 ? `/events/${events[0].id}` : '/events'}
                  className="p-3 rounded-2xl bg-dark-cardSoft border border-dark-line transition-all hover:-translate-y-0.5 hover:border-brand/35 hover:bg-dark-cardSoft"
                >
                  <div className="text-xs text-dark-muted">다음 일정</div>
                  <div className="text-base font-bold text-dark-text mt-1.5 truncate">
                    {events.length > 0 ? events[0].title : '예정 없음'}
                  </div>
                </Link>
                <Link
                  to="/board?board=notice"
                  className="p-3 rounded-2xl bg-dark-cardSoft border border-dark-line transition-all hover:-translate-y-0.5 hover:border-brand/35 hover:bg-dark-cardSoft"
                >
                  <div className="text-xs text-dark-muted">공지</div>
                  <div className="text-base font-bold text-dark-text mt-1.5">
                    {notices.length > 0 ? `${notices.length}건` : '없음'}
                  </div>
                </Link>
              </div>
            </div>

            <div className="hero__panel">
              <div className="bg-gradient-to-b from-dark-cardSoft to-dark-cardSoft/70 border border-dark-line rounded-[22px] p-4 shadow-lg transition-all hover:-translate-y-0.5 hover:border-brand/35 hover:bg-dark-cardSoft">
                <div className="flex justify-between items-center mb-2.5">
                  <div className="font-extrabold text-dark-text">현황 요약</div>
                  <div className="text-[13px] bg-dark-cardSoft text-dark-muted px-2.5 py-1.5 rounded-full border border-dark-line">
                    {tests.length > 0 || events.length > 0 ? '🟢 활성' : '🔵 대기'}
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-2.5 mt-2">
                  <Link to="/contest" className="p-3 rounded-2xl bg-dark-cardSoft border border-dark-line hover:border-brand/50 transition-colors">
                    <div className="text-xs text-dark-muted">코딩테스트</div>
                    <div className="text-sm font-bold text-dark-text mt-1.5">
                      {tests.length > 0
                        ? `등록된 테스트 ${tests.length}개`
                        : '등록된 테스트 없음'}
                    </div>
                  </Link>
                  <Link to="/events" className="p-3 rounded-2xl bg-dark-cardSoft border border-dark-line hover:border-brand/50 transition-colors">
                    <div className="text-xs text-dark-muted">이번 달 일정</div>
                    <div className="text-sm font-bold text-dark-text mt-1.5">
                      {events.length > 0
                        ? `${events.length}개 예정`
                        : '예정된 일정 없음'}
                    </div>
                  </Link>
                  <Link to="/gallery" className="p-3 rounded-2xl bg-dark-cardSoft border border-dark-line hover:border-brand/50 transition-colors">
                    <div className="text-xs text-dark-muted">갤러리</div>
                    <div className="text-sm font-bold text-dark-text mt-1.5">
                      {albums.length > 0
                        ? `${albums.length}개 앨범`
                        : '등록된 앨범 없음'}
                    </div>
                  </Link>
                  <button 
                    type="button"
                    onClick={handleScrollToPopular}
                    className="p-3 rounded-2xl bg-dark-cardSoft border border-dark-line text-left hover:border-brand/50 transition-colors w-full"
                  >
                    <div className="text-xs text-dark-muted">인기글</div>
                    <div className="text-sm font-bold text-dark-text mt-1.5">
                      {popularPosts.length > 0
                        ? `주간 TOP ${popularPosts.length}`
                        : '데이터 수집 중'}
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12 pb-12">
        <section>
          <div className="bg-gradient-to-b from-dark-cardSoft to-dark-cardSoft/70 border border-dark-line rounded-3xl p-6 shadow-lg">
          <form onSubmit={handleSearch} className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="검색어를 입력하세요..." 
                className="w-full bg-dark-bg border border-dark-line rounded-xl px-4 py-3 text-dark-text focus:outline-none focus:border-brand transition-colors"
              />
            </div>
            <button type="submit" className="px-6 py-3 rounded-xl bg-brand text-white font-semibold hover:bg-brand-light transition-colors flex items-center gap-2">
              <Search className="w-4 h-4" /> <span className="hidden md:inline">검색</span>
            </button>
            <button 
              type="button"
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className="px-4 py-3 rounded-xl bg-dark-cardSoft text-dark-muted border border-dark-line hover:text-dark-text hover:bg-dark-nav transition-colors"
            >
              <Settings className="w-5 h-5" />
            </button>
          </form>
          
          {isFilterOpen && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-dark-line animate-in fade-in slide-in-from-top-2">
              <div className="space-y-2">
                <span className="text-sm text-dark-muted">유형</span>
                <select
                  id="search-type"
                  value={searchType}
                  onChange={(event) => setSearchType(event.target.value)}
                  className="w-full bg-dark-bg border border-dark-line rounded-lg px-3 py-2 text-dark-text focus:outline-none focus:border-brand"
                >
                  <option value="all">전체</option>
                  <option value="posts">게시글</option>
                  <option value="albums">앨범</option>
                  <option value="events">일정</option>
                </select>
              </div>
              <div className="space-y-2">
                <span className="text-sm text-dark-muted">게시판</span>
                <select
                  id="search-board"
                  value={boardId}
                  onChange={(event) => setBoardId(event.target.value)}
                  className="w-full bg-dark-bg border border-dark-line rounded-lg px-3 py-2 text-dark-text focus:outline-none focus:border-brand"
                >
                  <option value="">전체</option>
                  <option value="2">자유게시판</option>
                  <option value="3">QA게시판</option>
                </select>
              </div>
              <div className="space-y-2">
                <span className="text-sm text-dark-muted">기간</span>
                <div className="flex gap-2 items-center">
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(event) => setDateFrom(event.target.value)}
                    className="w-full bg-dark-bg border border-dark-line rounded-lg px-3 py-2 text-dark-text focus:outline-none focus:border-brand"
                  />
                  <span className="text-dark-muted">~</span>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(event) => setDateTo(event.target.value)}
                    className="w-full bg-dark-bg border border-dark-line rounded-lg px-3 py-2 text-dark-text focus:outline-none focus:border-brand"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <section>
        <div className="flex justify-between items-end mb-6">
          <div>
            <h2 className="text-2xl font-bold text-dark-text mb-2">공지 미리보기</h2>
            <p className="text-dark-muted">중요한 소식은 여기서 빠르게 확인하세요.</p>
          </div>
          <div className="flex gap-2">
            <button 
              type="button" 
              onClick={fetchNotices}
              className="px-4 py-2 rounded-lg bg-dark-cardSoft text-dark-muted border border-dark-line hover:text-dark-text hover:bg-dark-nav transition-colors text-sm flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" /> <span className="hidden sm:inline">새로고침</span>
            </button>
            <Link to="/board?board=notice" className="px-4 py-2 rounded-lg border border-brand text-brand hover:bg-brand/10 transition-colors text-sm whitespace-nowrap">
              공지 전체
            </Link>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           {notices.length > 0 ? (
             notices.map((notice) => (
               <Link 
                 key={notice.id} 
                 to={`/board/${notice.board_id}/post/${notice.id}`}
                 className="block p-6 rounded-2xl bg-dark-card border border-dark-line hover:border-brand transition-colors cursor-pointer group"
               >
                 <div className="flex items-start justify-between mb-4">
                   <div className={`w-12 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                     notice.notice_type === 'urgent' ? 'bg-red-500/20 text-red-500' :
                     notice.notice_type === 'important' ? 'bg-yellow-500/20 text-yellow-500' :
                     'bg-brand-deep/30 text-brand-light'
                   }`}>
                     {notice.notice_type === 'urgent' ? '긴급' : notice.notice_type === 'important' ? '중요' : '공지'}
                   </div>
                   <span className="text-xs text-dark-muted">
                     {new Date(notice.created_at).toLocaleDateString()}
                   </span>
                 </div>
                 <h3 className="text-lg font-bold text-dark-text mb-2 group-hover:text-brand-light transition-colors line-clamp-1">
                   {notice.title}
                 </h3>
                 <p className="text-sm text-dark-muted line-clamp-2">
                   {notice.content}
                 </p>
               </Link>
             ))
           ) : (
             <div className="col-span-3 text-center text-dark-muted py-12 bg-dark-cardSoft rounded-2xl border border-dark-line">
               등록된 공지사항이 없습니다.
             </div>
           )}
        </div>
      </section>

      <section>
        <div className="flex justify-between items-end mb-6">
          <div>
            <h2 className="text-2xl font-bold text-dark-text mb-2">이번 달 일정</h2>
            <p className="text-dark-muted">놓치지 말아야 할 주요 일정입니다.</p>
          </div>
          <Link to="/events" className="px-4 py-2 rounded-lg border border-brand text-brand hover:bg-brand/10 transition-colors text-sm whitespace-nowrap">
            일정 전체
          </Link>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           {events.length > 0 ? (
             events.map((event) => (
               <Link 
                 key={event.id} 
                 to={`/events/${event.id}`}
                 className="block p-6 rounded-2xl bg-dark-card border border-dark-line hover:border-brand transition-colors cursor-pointer group"
               >
                 <div className="flex items-start justify-between mb-4">
                   <div className="w-12 h-12 rounded-xl bg-dark-bg border border-dark-line flex flex-col items-center justify-center text-center">
                     <span className="text-[10px] text-red-500 font-bold uppercase">
                       {new Date(event.start_time).toLocaleString('en-US', { month: 'short' })}
                     </span>
                     <span className="text-lg font-bold text-dark-text leading-none mt-0.5">
                       {new Date(event.start_time).getDate()}
                     </span>
                   </div>
                   <div className="px-2 py-1 rounded-md bg-dark-cardSoft border border-dark-line text-xs text-dark-muted flex items-center gap-1">
                     <Calendar className="w-3 h-3" />
                     {new Date(event.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                   </div>
                 </div>
                 <h3 className="text-lg font-bold text-dark-text mb-2 group-hover:text-brand-light transition-colors line-clamp-1">
                   {event.title}
                 </h3>
                 <div className="flex items-center gap-1.5 text-sm text-dark-muted">
                   <MapPin className="w-4 h-4 text-dark-muted" />
                   <span className="line-clamp-1">{event.location || '온라인'}</span>
                 </div>
               </Link>
             ))
           ) : (
             <div className="col-span-3 text-center text-dark-muted py-12 bg-dark-cardSoft rounded-2xl border border-dark-line">
               {isAuthenticated ? '이번 달 예정된 일정이 없습니다.' : '로그인 후 일정 확인이 가능합니다.'}
             </div>
           )}
        </div>
      </section>

      <section id="popular-posts-section">
        <div className="flex justify-between items-end mb-6">
          <div>
            <h2 className="text-2xl font-bold text-dark-text mb-2">인기글 / 핫 Q&A</h2>
            <p className="text-dark-muted">지금 가장 뜨거운 반응을 얻고 있는 게시글입니다.</p>
          </div>
        </div>
        
        <div className="bg-dark-card border border-dark-line rounded-2xl overflow-hidden">
          {popularPosts.length > 0 ? (
            <div className="divide-y divide-dark-line">
              {popularPosts.map((post) => (
                <Link 
                  key={post.id} 
                  to={`/board/${post.board_id}/post/${post.id}`}
                  className="flex items-center justify-between p-4 hover:bg-dark-cardSoft transition-colors group"
                >
                  <div className="flex-1 min-w-0 pr-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs px-2 py-0.5 rounded bg-dark-bg border border-dark-line text-dark-muted">
                        {post.board_name}
                      </span>
                      <h3 className="text-base font-bold text-dark-text group-hover:text-brand-light transition-colors truncate">
                        {post.title}
                      </h3>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-dark-muted">
                      <span>{post.author_name}</span>
                      <span>•</span>
                      <span>조회 {post.view_count}</span>
                      <span>•</span>
                      <span>댓글 {post.comment_count}</span>
                    </div>
                  </div>
                  <div className="text-brand">
                    <ArrowRight className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center text-dark-muted py-8">
              데이터가 없습니다.
            </div>
          )}
        </div>
      </section>

      <section>
        <div className="flex justify-between items-end mb-6">
          <div>
            <h2 className="text-2xl font-bold text-dark-text mb-2">최근 갤러리</h2>
            <p className="text-dark-muted">동아리의 생생한 활동 모습을 확인하세요.</p>
          </div>
          <Link to="/gallery" className="px-4 py-2 rounded-lg border border-brand text-brand hover:bg-brand/10 transition-colors text-sm whitespace-nowrap">
            갤러리 전체
          </Link>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          {albums.length > 0 ? (
            albums.map((album) => (
              <Link 
                key={album.id} 
                to={`/gallery/${album.id}`}
                className="group"
              >
                <div className="aspect-square rounded-xl overflow-hidden bg-dark-bg border border-dark-line relative">
                  {album.cover_photo ? (
                    <img 
                      src={album.cover_photo.thumbnail_url} 
                      alt={album.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-dark-muted bg-dark-cardSoft">
                      <span className="text-xs">No Image</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-colors" />
                </div>
                <div className="mt-2 text-sm font-medium text-dark-text truncate group-hover:text-brand-light transition-colors">
                  {album.name}
                </div>
                <div className="text-xs text-dark-muted">
                  {new Date(album.created_at).toLocaleDateString()}
                </div>
              </Link>
            ))
          ) : (
            <div className="col-span-6 text-center text-dark-muted py-12 bg-dark-cardSoft rounded-2xl border border-dark-line">
              {isAuthenticated ? '등록된 앨범이 없습니다.' : '로그인 후 갤러리 확인이 가능합니다.'}
            </div>
          )}
        </div>
      </section>

      <section>
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-dark-text mb-2">활동 하이라이트</h2>
          <p className="text-dark-muted">CodeIn이 제공하는 다양한 활동을 만나보세요.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
          <div className="min-w-0 p-6 rounded-2xl bg-gradient-to-br from-purple-900/50 to-dark-card border border-dark-line hover:border-purple-500/50 transition-colors group">
            <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400 mb-4 group-hover:scale-110 transition-transform">
              <span className="text-2xl">🚀</span>
            </div>
            <h3 className="text-lg font-bold text-dark-text mb-2 break-keep">해커톤</h3>
            <p className="text-sm text-dark-muted break-words leading-6">
              매 학기 진행되는 무박 2일간의 치열한 개발 마라톤. 아이디어를 현실로 만듭니다.
            </p>
          </div>
          <div className="min-w-0 p-6 rounded-2xl bg-gradient-to-br from-blue-900/50 to-dark-card border border-dark-line hover:border-blue-500/50 transition-colors group">
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400 mb-4 group-hover:scale-110 transition-transform">
              <span className="text-2xl">📚</span>
            </div>
            <h3 className="text-lg font-bold text-dark-text mb-2 break-keep">스터디</h3>
            <p className="text-sm text-dark-muted break-words leading-6">
              서로 배우고 성장하는 스터디 그룹. 관심 분야를 깊이 파고듭니다.
            </p>
          </div>
          <div className="min-w-0 p-6 rounded-2xl bg-gradient-to-br from-green-900/50 to-dark-card border border-dark-line hover:border-green-500/50 transition-colors group">
            <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center text-green-400 mb-4 group-hover:scale-110 transition-transform">
              <span className="text-2xl">🎤</span>
            </div>
            <h3 className="text-lg font-bold text-dark-text mb-2 break-keep">세션</h3>
            <p className="text-sm text-dark-muted break-words leading-6">
              현업 선배와 함께하는 기술 세미나. 실무 경험과 노하우를 공유합니다.
            </p>
          </div>
          <div className="min-w-0 p-6 rounded-2xl bg-gradient-to-br from-orange-900/50 to-dark-card border border-dark-line hover:border-orange-500/50 transition-colors group">
            <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center text-orange-400 mb-4 group-hover:scale-110 transition-transform">
              <span className="text-2xl">⛺</span>
            </div>
            <h3 className="text-lg font-bold text-dark-text mb-2 break-keep">MT/친목</h3>
            <p className="text-sm text-dark-muted break-words leading-6">
              동아리원들과 함께하는 즐거운 추억 만들기. 끈끈한 네트워크 형성.
            </p>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-dark-text mb-2">CodeIn 시작 가이드</h2>
          <p className="text-dark-muted">신규 회원을 위한 단계별 안내입니다.</p>
        </div>
        <div className="bg-dark-card border border-dark-line rounded-2xl p-6">
          <div className="space-y-6 relative before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-0.5 before:bg-dark-line">
            <div className="relative flex gap-4 items-start group">
              <div className="w-10 h-10 rounded-full bg-brand text-white flex items-center justify-center font-bold relative z-10 shrink-0 group-hover:scale-110 transition-transform">
                1
              </div>
              <div className="pt-1">
                <h3 className="text-lg font-bold text-dark-text mb-1 group-hover:text-brand-light transition-colors">회원가입</h3>
                <p className="text-dark-muted text-sm">
                  CodeIn 계정을 생성하고 동아리 멤버가 되어보세요.
                </p>
              </div>
            </div>
            <div className="relative flex gap-4 items-start group">
              <div className="w-10 h-10 rounded-full bg-dark-card border border-dark-line text-dark-muted flex items-center justify-center font-bold relative z-10 shrink-0 group-hover:border-brand group-hover:text-brand-light transition-colors">
                2
              </div>
              <div className="pt-1">
                <h3 className="text-lg font-bold text-dark-text mb-1 group-hover:text-brand-light transition-colors">프로필 작성</h3>
                <p className="text-dark-muted text-sm">
                  관심 분야와 기술 스택을 입력하여 나를 소개하세요.
                </p>
              </div>
            </div>
            <div className="relative flex gap-4 items-start group">
              <div className="w-10 h-10 rounded-full bg-dark-card border border-dark-line text-dark-muted flex items-center justify-center font-bold relative z-10 shrink-0 group-hover:border-brand group-hover:text-brand-light transition-colors">
                3
              </div>
              <div className="pt-1">
                <h3 className="text-lg font-bold text-dark-text mb-1 group-hover:text-brand-light transition-colors">코딩테스트 응시</h3>
                <p className="text-dark-muted text-sm">
                  레벨 테스트에 응시하여 나의 실력을 증명하세요.
                </p>
              </div>
            </div>
            <div className="relative flex gap-4 items-start group">
              <div className="w-10 h-10 rounded-full bg-dark-card border border-dark-line text-dark-muted flex items-center justify-center font-bold relative z-10 shrink-0 group-hover:border-brand group-hover:text-brand-light transition-colors">
                4
              </div>
              <div className="pt-1">
                <h3 className="text-lg font-bold text-dark-text mb-1 group-hover:text-brand-light transition-colors">랭크 배정</h3>
                <p className="text-dark-muted text-sm">
                  테스트 결과에 따라 초기 랭크를 부여받습니다.
                </p>
              </div>
            </div>
            <div className="relative flex gap-4 items-start group">
              <div className="w-10 h-10 rounded-full bg-dark-card border border-dark-line text-dark-muted flex items-center justify-center font-bold relative z-10 shrink-0 group-hover:border-brand group-hover:text-brand-light transition-colors">
                5
              </div>
              <div className="pt-1">
                <h3 className="text-lg font-bold text-dark-text mb-1 group-hover:text-brand-light transition-colors">추천 스터디 안내</h3>
                <p className="text-dark-muted text-sm">
                  나의 관심사와 레벨에 맞는 스터디를 추천받고 참여하세요.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="pb-12">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-dark-text mb-2">바로가기</h2>
          <p className="text-dark-muted">필요한 페이지로 빠르게 이동하세요.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link to="/board?board=board" className="group p-6 rounded-2xl bg-dark-cardSoft border border-dark-line hover:border-brand transition-colors">
            <h3 className="text-xl font-bold text-dark-text mb-2 group-hover:text-brand-light transition-colors">게시판</h3>
            <p className="text-dark-muted mb-4">자유게시판 바로가기</p>
            <span className="text-sm text-brand font-medium flex items-center gap-1">
              이동 <ArrowRight className="w-4 h-4" />
            </span>
          </Link>
          <Link to="/events" className="group p-6 rounded-2xl bg-dark-cardSoft border border-dark-line hover:border-brand transition-colors">
            <h3 className="text-xl font-bold text-dark-text mb-2 group-hover:text-brand-light transition-colors">캘린더</h3>
            <p className="text-dark-muted mb-4">행사/스터디/모임 일정</p>
            <span className="text-sm text-brand font-medium flex items-center gap-1">
              이동 <ArrowRight className="w-4 h-4" />
            </span>
          </Link>
          <Link to="/gallery" className="group p-6 rounded-2xl bg-dark-cardSoft border border-dark-line hover:border-brand transition-colors">
            <h3 className="text-xl font-bold text-dark-text mb-2 group-hover:text-brand-light transition-colors">갤러리</h3>
            <p className="text-dark-muted mb-4">앨범/사진 열람</p>
            <span className="text-sm text-brand font-medium flex items-center gap-1">
              이동 <ArrowRight className="w-4 h-4" />
            </span>
          </Link>
        </div>
      </section>
      </div>
    </div>
  );
};

export default HomePage;
