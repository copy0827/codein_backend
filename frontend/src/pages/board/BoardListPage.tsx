import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { getBoards, getBoardPosts } from '../../api/board';
import type { Board, Post } from '../../types/board';
import { useAuth } from '../../context/AuthContext';
import { Megaphone, MessageSquare, ChevronRight, Home, PencilLine, Eye } from 'lucide-react';

const getPreferredBoardId = (availableBoards: Board[], search: string) => {
  if (availableBoards.length === 0) return null;

  const params = new URLSearchParams(search);
  const boardParam = params.get('board');

  if (!boardParam) return availableBoards[0].id;

  const numericId = Number(boardParam);
  if (!Number.isNaN(numericId)) {
    const numericMatch = availableBoards.find((board) => board.id === numericId);
    if (numericMatch) return numericMatch.id;
  }

  const normalized = boardParam.toLowerCase();
  const noticeBoard = availableBoards.find((board) => board.board_type === 'notice');
  const generalBoard = availableBoards.find((board) => board.board_type === 'general');
  const qnaBoard = availableBoards.find((board) => board.board_type === 'qna');

  if (normalized === 'notice') return noticeBoard?.id ?? availableBoards[0].id;
  if (normalized === 'board' || normalized === 'general') {
    return generalBoard?.id ?? qnaBoard?.id ?? availableBoards[0].id;
  }
  if (normalized === 'qna') return qnaBoard?.id ?? availableBoards[0].id;

  return availableBoards[0].id;
};

const BoardListPage: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [boards, setBoards] = useState<Board[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState<number | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  const selectedBoard = boards.find((board) => board.id === selectedBoardId);
  const isNoticeBoard = selectedBoard?.board_type === 'notice';
  const unreadNoticeCount = user && isNoticeBoard
    ? posts.filter((post) => post.notice_type && !post.is_read).length
    : 0;

  useEffect(() => {
    const fetchBoards = async () => {
      try {
        const data = await getBoards();
        const visibleBoards = data.filter((board) => 
          board.board_type === 'general' || board.board_type === 'notice' || board.board_type === 'qna'
        );
        setBoards(visibleBoards);

        const stateBoardId = location.state && typeof location.state === 'object'
          ? (location.state as { boardId?: number }).boardId
          : undefined;
        const matchedBoardId = stateBoardId
          ? data.find((board) => board.id === stateBoardId)?.id
          : undefined;

        setSelectedBoardId(matchedBoardId ?? getPreferredBoardId(data, location.search));
      } catch (error) {
        console.error('Failed to fetch boards', error);
      }
    };
    fetchBoards();
  }, [location.search, location.state, user]);

  useEffect(() => {
    if (selectedBoardId) {
      const fetchPosts = async () => {
        setLoading(true);
        try {
          const data = await getBoardPosts(selectedBoardId, {
            notice_only: isNoticeBoard,
          });
          setPosts(data);
        } catch (error) {
          console.error('Failed to fetch posts', error);
        } finally {
          setLoading(false);
        }
      };
      fetchPosts();
    }
  }, [selectedBoardId, isNoticeBoard]);

  const getNoticeBadge = (type?: string | null, isBlinded?: boolean) => {
    const badges = [];
    
    if (isBlinded && user?.role === 'superadmin') {
      badges.push(
        <span key="blinded" className="bg-gray-500 text-white text-xs font-medium mr-2 px-2.5 py-0.5 rounded">
          블라인드
        </span>
      );
    }

    switch (type) {
      case 'urgent':
        badges.push(<span key="urgent" className="bg-red-100 text-red-800 text-xs font-medium mr-2 px-2.5 py-0.5 rounded">긴급</span>);
        break;
      case 'important':
        badges.push(<span key="important" className="bg-yellow-100 text-yellow-800 text-xs font-medium mr-2 px-2.5 py-0.5 rounded">중요</span>);
        break;
      case 'normal':
        badges.push(<span key="normal" className="bg-blue-100 text-blue-800 text-xs font-medium mr-2 px-2.5 py-0.5 rounded">공지</span>);
        break;
      default:
        break;
    }
    
    return badges.length > 0 ? <>{badges}</> : null;
  };

  const formatPostDate = (value: string) => {
    const date = new Date(value);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}.${month}.${day}`;
  };


  const noticeBoards = boards.filter((board) => board.board_type === 'notice');
  const generalBoards = boards.filter((board) => board.board_type !== 'notice');
  const showNoticeSection = !selectedBoardId || isNoticeBoard;
  const showGeneralSection = !selectedBoardId || !isNoticeBoard;

  const sortedPosts = [...posts].sort((a, c) => {
    const pinDiff = Number(c.is_pinned) - Number(a.is_pinned);
    if (pinDiff !== 0) return pinDiff;
    const aTime = new Date(a.created_at).getTime();
    const cTime = new Date(c.created_at).getTime();
    return cTime - aTime;
  });

  return (
    <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-8">
      {/* Breadcrumbs */}
      <nav className="flex items-center text-sm text-gray-500 mb-6 space-x-2">
        <Home className="w-4 h-4" />
        <Link to="/" className="hover:text-blue-600">홈</Link>
        <ChevronRight className="w-4 h-4" />
        <span className="font-medium text-gray-700">게시판</span>
        {selectedBoard && (
          <>
            <ChevronRight className="w-4 h-4" />
            <span className="font-semibold text-blue-600">{selectedBoard.name}</span>
          </>
        )}
      </nav>

      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <div className="flex items-start sm:items-center gap-3">
          <div className={`p-2 rounded-lg ${isNoticeBoard ? 'bg-indigo-100 text-indigo-600' : 'bg-blue-100 text-blue-600'}`}>
            {isNoticeBoard ? <Megaphone className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-dark-text">
              {isNoticeBoard ? '공지사항' : selectedBoard?.name || '커뮤니티'}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {isNoticeBoard ? '중요한 소식과 안내를 확인하세요.' : '자유로운 소통과 정보를 공유하는 공간입니다.'}
            </p>
          </div>
        </div>
        {user && selectedBoardId !== 2 && (!isNoticeBoard || ['staff', 'admin', 'superadmin'].includes(user.role)) && (
          <Link
            to="/board/write"
            state={{ boardId: selectedBoardId }}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg transition-colors shadow-sm"
          >
            <PencilLine className="w-4 h-4" />
            글쓰기
          </Link>
        )}
      </div>

      {!isNoticeBoard && (
        <div className="mb-8 p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-4">
          {showNoticeSection && noticeBoards.length > 0 && (
            <div className="pb-2 border-b border-gray-200 last:border-0 last:pb-0">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-1 h-4 bg-indigo-500 rounded-full"></span>
                <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">SYSTEM NOTICES</h2>
                {unreadNoticeCount > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold">
                    {unreadNoticeCount}
                  </span>
                )}
              </div>
              <div className="flex space-x-2 overflow-x-auto">
                {noticeBoards.map((board) => (
                  <button
                    type="button"
                    key={board.id}
                    onClick={() => {
                      setSelectedBoardId(board.id);
                      navigate(`/board?board=${board.id}`, { replace: true });
                    }}
                    className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${selectedBoardId === board.id
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'bg-white text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 border border-gray-200'
                      }`}
                  >
                    {board.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {showGeneralSection && generalBoards.length > 0 && (
            <div className="last:pb-0">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-1 h-4 bg-blue-500 rounded-full"></span>
                <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">COMMUNITY BOARDS</h2>
              </div>
              <div className="flex space-x-2 overflow-x-auto">
                {generalBoards.map((board) => (
                  <button
                    type="button"
                    key={board.id}
                    onClick={() => {
                      setSelectedBoardId(board.id);
                      navigate(`/board?board=${board.id}`, { replace: true });
                    }}
                    className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${selectedBoardId === board.id
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-white text-gray-600 hover:bg-blue-50 hover:text-blue-600 border border-gray-200'
                      }`}
                  >
                    {board.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {isNoticeBoard && (
        <div className="mb-6 bg-indigo-600 rounded-xl p-6 text-white shadow-lg overflow-hidden relative">
          <div className="relative z-10">
            <h3 className="text-lg font-bold mb-1">📢 공지사항 안내</h3>
            <p className="text-indigo-100 text-sm">CodeIn의 최신 소식과 중요 안내를 가장 먼저 확인하세요.</p>
          </div>
          <Megaphone className="absolute -bottom-6 -right-6 w-32 h-32 text-indigo-500 opacity-20 transform -rotate-12" />
        </div>
      )}

      <div className="bg-white shadow-xl overflow-hidden sm:rounded-xl border border-gray-100">
        {loading ? (
          <div className="p-4 text-center text-gray-500">로딩중...</div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {posts.length === 0 ? (
              <li className="p-4 text-center text-gray-500">게시글이 없습니다.</li>
            ) : (
              sortedPosts.map((post) => (
                <li key={post.id} className={`transition-all hover:bg-gray-50 border-l-4 ${isNoticeBoard ? 'border-indigo-500 bg-indigo-50/30' : 'border-transparent'}`}>
                  <Link to={`/board/${selectedBoardId}/post/${post.id}`} state={{ boardId: selectedBoardId }} className="block p-5">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center mb-1">
                          {getNoticeBadge(post.notice_type, post.is_blinded)}
                          {post.is_pinned && (
                            <span className="bg-purple-100 text-purple-800 text-xs font-medium mr-2 px-2 py-0.5 rounded">고정</span>
                          )}
                          {post.scheduled_at && new Date(post.scheduled_at).getTime() > Date.now() && (
                            <span className="bg-cyan-100 text-cyan-800 text-xs font-medium mr-2 px-2 py-0.5 rounded">예약</span>
                          )}
                          {post.expires_at && new Date(post.expires_at).getTime() < Date.now() && (
                            <span className="bg-gray-200 text-gray-600 text-xs font-medium mr-2 px-2 py-0.5 rounded">만료</span>
                          )}
                          <p className={`text-sm font-medium truncate ${post.is_blinded ? 'text-gray-400 line-through' : 'text-blue-600'}`}>
                            {post.title}
                          </p>
                        </div>
                        <div className="flex items-center text-sm text-gray-500">
                          <span className="truncate mr-4">{post.author?.name || '알 수 없음'}</span>
                          <span>{formatPostDate(post.created_at)}</span>
                        </div>
                      </div>
                      <div className="flex items-center text-sm text-gray-400 ml-4 group-hover:text-blue-500 transition-colors">
                        <div className="flex items-center mr-4">
                          <Eye className="w-4 h-4 mr-1" />
                          {post.view_count}
                        </div>
                      </div>
                    </div>
                  </Link>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </div>
  );
};

export default BoardListPage;
