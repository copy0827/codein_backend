import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getPost, markPostAsRead, getPostReadStatus, deletePost } from '../../api/board';
import { getPostComments, createPostComment, updateComment, deleteComment } from '../../api/comments';
import type { Post, PostReadStatusResponse } from '../../types/board';
import type { Comment } from '../../types/comment';
import { useAuth } from '../../context/AuthContext';
import ReportModal from '../../components/board/ReportModal';
import { AlertTriangle, Home, ChevronRight, Megaphone, MessageSquare, ArrowLeft, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import { getBoards } from '../../api/board';
import type { Board } from '../../types/board';

const PostDetailPage: React.FC = () => {
  const { boardId, postId } = useParams<{ boardId: string; postId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [showReadStatus, setShowReadStatus] = useState(false);
  const [readStatus, setReadStatus] = useState<PostReadStatusResponse | null>(null);
  const [loadingReadStatus, setLoadingReadStatus] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [commentsPage, setCommentsPage] = useState(1);
  const [commentsHasMore, setCommentsHasMore] = useState(false);
  const [commentsTotal, setCommentsTotal] = useState(0);
  const [commentContent, setCommentContent] = useState('');
  const [replyTargetId, setReplyTargetId] = useState<number | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentActionLoading, setCommentActionLoading] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');
  const [loadingMoreComments, setLoadingMoreComments] = useState(false);
  
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportTargetType, setReportTargetType] = useState<'post' | 'comment'>('post');
  const [reportTargetId, setReportTargetId] = useState<number>(0);
  const [reportTargetTitle, setReportTargetTitle] = useState<string>('');
  const [board, setBoard] = useState<Board | null>(null);

  const lastFetchedKey = useRef<string | null>(null);

  const isAdmin = user && ['staff', 'admin', 'superadmin'].includes(user.role);
  const isAuthor = user && post && post.author_id === user.id;
  const canManagePost = isAuthor || isAdmin;

  useEffect(() => {
    const fetchPost = async () => {
      if (!boardId || !postId) return;

      const fetchKey = `${boardId}-${postId}`;
      if (lastFetchedKey.current === fetchKey) {
        return;
      }
      lastFetchedKey.current = fetchKey;

      try {
        const bId = parseInt(boardId);
        const pId = parseInt(postId);
        
        const data = await getPost(bId, pId);
        setPost(data);
      } catch (error) {
        console.error('Failed to fetch post', error);
        toast.error('게시글을 불러오는데 실패했습니다');
        navigate('/board');
      } finally {
        setLoading(false);
      }
    };

    fetchPost();
  }, [boardId, postId, navigate]);

  useEffect(() => {
    const fetchBoard = async () => {
      if (!boardId) return;
      try {
        const boards = await getBoards();
        const found = boards.find(b => b.id === parseInt(boardId));
        setBoard(found || null);
      } catch (error) {
        console.error('Failed to fetch board info', error);
      }
    };
    fetchBoard();
  }, [boardId]);

  useEffect(() => {
    const markAsRead = async () => {
      if (!user || !boardId || !postId) return;
      try {
        await markPostAsRead(parseInt(boardId), parseInt(postId));
      } catch (error) {
        console.error('Failed to mark post as read', error);
      }
    };

    markAsRead();
  }, [user, boardId, postId]);

  const loadComments = useCallback(
    async (page: number, append = false, showError = true) => {
      if (!postId) return false;
      const numericPostId = parseInt(postId);
      if (Number.isNaN(numericPostId)) return false;

      if (append) {
        setLoadingMoreComments(true);
      } else {
        setCommentsLoading(true);
      }

      let success = true;
      try {
        const data = await getPostComments(numericPostId, { page, page_size: 20 });
        setComments((prev) => (append ? [...prev, ...data.comments] : data.comments));
        setCommentsHasMore(data.has_more);
        setCommentsTotal(data.total);
        setCommentsPage(page);
      } catch (error) {
        success = false;
        console.error('Failed to fetch comments', error);
        if (showError) {
          toast.error('댓글을 불러오는데 실패했습니다');
        }
      } finally {
        if (append) {
          setLoadingMoreComments(false);
        } else {
          setCommentsLoading(false);
        }
      }

      return success;
    },
    [postId]
  );

  useEffect(() => {
    loadComments(1, false);
  }, [loadComments]);

  const handleLoadMoreComments = async () => {
    if (!commentsHasMore || loadingMoreComments) return;
    await loadComments(commentsPage + 1, true);
  };

  const handleSubmitComment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!postId) return;

    const content = commentContent.trim();
    if (!content) {
      toast.error('댓글 내용을 입력해주세요');
      return;
    }

    setCommentSubmitting(true);
    setCommentActionLoading(true);
    try {
      const numericPostId = parseInt(postId);
      if (Number.isNaN(numericPostId)) {
        throw new Error('Invalid post id');
      }
      await createPostComment(numericPostId, { content });
      setCommentContent('');
      const refreshed = await loadComments(1, false, false);
      if (!refreshed) {
        toast.error('댓글은 작성되었지만 목록 갱신에 실패했습니다');
      } else {
        toast.success('댓글이 작성되었습니다');
      }
    } catch (error) {
      console.error('Failed to create comment', error);
      toast.error('댓글 작성에 실패했습니다');
    } finally {
      setCommentSubmitting(false);
      setCommentActionLoading(false);
    }
  };

  const handleSubmitReply = async (commentId: number) => {
    if (!postId) return;

    const content = replyContent.trim();
    if (!content) {
      toast.error('답글 내용을 입력해주세요');
      return;
    }

    setCommentSubmitting(true);
    setCommentActionLoading(true);
    try {
      const numericPostId = parseInt(postId);
      if (Number.isNaN(numericPostId)) {
        throw new Error('Invalid post id');
      }
      await createPostComment(numericPostId, { content, parent_id: commentId });
      setReplyContent('');
      setReplyTargetId(null);
      const refreshed = await loadComments(1, false, false);
      if (!refreshed) {
        toast.error('답글은 작성되었지만 목록 갱신에 실패했습니다');
      } else {
        toast.success('답글이 작성되었습니다');
      }
    } catch (error) {
      console.error('Failed to create reply', error);
      toast.error('답글 작성에 실패했습니다');
    } finally {
      setCommentSubmitting(false);
      setCommentActionLoading(false);
    }
  };

  const handleEditComment = (commentId: number, content: string) => {
    setEditingCommentId(commentId);
    setEditContent(content);
    setReplyTargetId(null);
  };

  const handleCancelEdit = () => {
    setEditingCommentId(null);
    setEditContent('');
  };

  const handleSaveEdit = async (commentId: number) => {
    const content = editContent.trim();
    if (!content) {
      toast.error('수정할 내용을 입력해주세요');
      return;
    }

    setCommentActionLoading(true);
    try {
      await updateComment(commentId, { content });
      setEditingCommentId(null);
      setEditContent('');
      const refreshed = await loadComments(1, false, false);
      if (!refreshed) {
        toast.error('댓글은 수정되었지만 목록 갱신에 실패했습니다');
      } else {
        toast.success('댓글이 수정되었습니다');
      }
    } catch (error) {
      console.error('Failed to update comment', error);
      toast.error('댓글 수정에 실패했습니다');
    } finally {
      setCommentActionLoading(false);
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    if (!window.confirm('댓글을 삭제할까요?')) return;

    setCommentActionLoading(true);
    try {
      await deleteComment(commentId);
      if (editingCommentId === commentId) {
        setEditingCommentId(null);
        setEditContent('');
      }
      const refreshed = await loadComments(1, false, false);
      if (!refreshed) {
        toast.error('댓글은 삭제되었지만 목록 갱신에 실패했습니다');
      } else {
        toast.success('댓글이 삭제되었습니다');
      }
    } catch (error) {
      console.error('Failed to delete comment', error);
      toast.error('댓글 삭제에 실패했습니다');
    } finally {
      setCommentActionLoading(false);
    }
  };

  const handleEditPost = () => {
    if (!post || !boardId) return;
    navigate('/board/write', { state: { boardId: parseInt(boardId), post } });
  };

  const handleDeletePost = async () => {
    if (!post || !boardId) return;
    if (!window.confirm('정말로 이 게시글을 삭제하시겠습니까?')) return;

    try {
      await deletePost(parseInt(boardId), post.id);
      toast.success('게시글이 삭제되었습니다');
      navigate('/board', { state: { boardId: post.board_id } });
    } catch (error) {
      console.error('Failed to delete post', error);
      toast.error('게시글 삭제에 실패했습니다');
    }
  };

  const handleOpenPostReport = () => {
    if (!post) return;
    setReportTargetType('post');
    setReportTargetId(post.id);
    setReportTargetTitle(post.title);
    setReportModalOpen(true);
  };

  const handleOpenCommentReport = (commentId: number, content: string) => {
    setReportTargetType('comment');
    setReportTargetId(commentId);
    setReportTargetTitle(content.length > 20 ? `${content.substring(0, 20)}...` : content);
    setReportModalOpen(true);
  };

  if (loading) {
    return <div className="container mx-auto px-4 py-8 text-center">로딩중...</div>;
  }

  if (!post) {
    return <div className="container mx-auto px-4 py-8 text-center">게시글을 찾을 수 없습니다</div>;
  }

  const getNoticeBadge = (type?: string | null, isBlinded?: boolean) => {
    const badges = [];
    
    if (isBlinded) {
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
      case 'recruit':
        badges.push(<span key="recruit" className="bg-purple-100 text-purple-800 text-xs font-medium mr-2 px-2.5 py-0.5 rounded">모집</span>);
        break;
      case 'event':
        badges.push(<span key="event" className="bg-green-100 text-green-800 text-xs font-medium mr-2 px-2.5 py-0.5 rounded">행사</span>);
        break;
      case 'contest':
        badges.push(<span key="contest" className="bg-indigo-100 text-indigo-800 text-xs font-medium mr-2 px-2.5 py-0.5 rounded">코테</span>);
        break;
      default:
        break;
    }
    return badges.length > 0 ? <>{badges}</> : null;
  };

  const handleFetchReadStatus = async () => {
    if (!boardId || !postId) return;
    setLoadingReadStatus(true);
    try {
      const data = await getPostReadStatus(parseInt(boardId), parseInt(postId));
      setReadStatus(data);
      setShowReadStatus(true);
    } catch (error) {
      console.error('Failed to fetch read status', error);
      toast.error('읽음 현황을 불러오는데 실패했습니다');
    } finally {
      setLoadingReadStatus(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const parseDateValue = (value: string) => {
    if (!value) return new Date('');
    const hasTimezone = value.includes('Z') || value.includes('+');
    return new Date(hasTimezone ? value : `${value}Z`);
  };

  const formatPostDate = (value: string) => {
    const date = parseDateValue(value);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}.${month}.${day}`;
  };

  const formatCommentDate = (value: string) => (
    parseDateValue(value).toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  );

  const isNoticeBoard = board?.board_type === 'notice';

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumbs */}
      <nav className="flex items-center text-sm text-gray-500 mb-6 space-x-2">
        <Home className="w-4 h-4" />
        <Link to="/" className="hover:text-blue-600">홈</Link>
        <ChevronRight className="w-4 h-4" />
        <Link to="/board" className="hover:text-blue-600">게시판</Link>
        {board && (
          <>
            <ChevronRight className="w-4 h-4" />
            <Link 
              to={`/board?board=${board.id}`} 
              className={`hover:underline ${isNoticeBoard ? 'text-indigo-600 font-medium' : 'text-blue-600 font-medium'}`}
            >
              {board.name}
            </Link>
          </>
        )}
      </nav>

      <button
        type="button"
        onClick={() => navigate('/board', { state: { boardId: post.board_id } })}
        className="mb-6 flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        <span className="text-sm font-medium">목록으로 돌아가기</span>
      </button>

      <div className={`bg-white shadow-xl overflow-hidden sm:rounded-2xl border-t-4 ${isNoticeBoard ? 'border-indigo-500' : 'border-blue-500'}`}>
        <div className="p-8">
          <div className="border-b border-gray-100 pb-6 mb-8">
            <div className="flex items-center gap-2 mb-4">
              <div className={`p-1.5 rounded-lg ${isNoticeBoard ? 'bg-indigo-100 text-indigo-600' : 'bg-blue-100 text-blue-600'}`}>
                {isNoticeBoard ? <Megaphone className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
              </div>
              <span className={`text-xs font-bold uppercase tracking-widest ${isNoticeBoard ? 'text-indigo-500' : 'text-blue-500'}`}>
                {board?.name}
              </span>
            </div>
            {getNoticeBadge(post.notice_type, post.is_blinded)}
            <h1 className={`text-2xl font-bold ${post.is_blinded ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{post.title}</h1>
          </div>
          <div className="flex items-center justify-between text-sm text-gray-500">
            <div className="flex items-center space-x-4">
              <span>{post.author?.name || '알 수 없음'}</span>
              <span>{formatPostDate(post.created_at)}</span>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center gap-1">
                <Eye className="w-4 h-4" />
                <span>{post.view_count}</span>
              </div>
              {post.read_count !== undefined && <span>읽음: {post.read_count}</span>}
              {canManagePost && (
                <div className="flex items-center space-x-2 border-l pl-4 ml-4">
                  <button
                    onClick={handleEditPost}
                    className="text-blue-600 hover:text-blue-800 transition-colors text-sm font-medium"
                  >
                    수정
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    onClick={handleDeletePost}
                    className="text-red-500 hover:text-red-700 transition-colors text-sm font-medium"
                  >
                    삭제
                  </button>
                </div>
              )}
              {user && (
                <button
                  onClick={handleOpenPostReport}
                  className="flex items-center gap-1 text-red-500 hover:text-red-600 transition-colors"
                  title="신고하기"
                >
                  <AlertTriangle className="w-4 h-4" />
                  <span>신고</span>
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="px-8 pb-8">

        {post.is_blinded && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-red-800">이 게시글은 블라인드 처리되었습니다.</h3>
              <p className="text-sm text-red-600 mt-1">
                관리자에게만 노출되며, 일반 사용자에게는 보이지 않습니다. 콘텐츠를 확인하고 필요한 조치를 취해주세요.
              </p>
            </div>
          </div>
        )}

        <div className={`prose max-w-none whitespace-pre-wrap ${post.is_blinded ? 'text-gray-400' : 'text-gray-800'}`}>
          {post.content}
        </div>

        {/* 첨부파일 섹션 */}
        {post.attachments && post.attachments.length > 0 && (
          <div className="mt-6 border-t pt-4">
            <h3 className="text-sm font-bold text-gray-700 mb-3">첨부파일 ({post.attachments.length})</h3>
            <ul className="space-y-2">
              {post.attachments.map((attachment) => (
                <li key={attachment.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center space-x-3">
                    <span className="text-lg">📎</span>
                    <div>
                      <p className="text-sm font-medium text-gray-800">{attachment.original_filename}</p>
                      <p className="text-xs text-gray-500">{formatFileSize(attachment.file_size)}</p>
                    </div>
                  </div>
                  <a
                    href={attachment.file_url}
                    download={attachment.original_filename}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition-colors"
                  >
                    다운로드
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 읽음 현황 섹션 (관리자용) */}
        {isAdmin && post.notice_type && (
          <div className="mt-6 border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-700">읽음 현황</h3>
              <button
                type="button"
                onClick={handleFetchReadStatus}
                disabled={loadingReadStatus}
                className="px-3 py-1.5 bg-gray-600 text-white text-sm font-medium rounded hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                {loadingReadStatus ? '로딩중...' : showReadStatus ? '새로고침' : '현황 보기'}
              </button>
            </div>
            
            {showReadStatus && readStatus && (
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-700 mb-3">
                  총 <span className="font-bold text-blue-600">{readStatus.total_readers}</span>명이 읽었습니다
                </p>
                {readStatus.read_logs.length > 0 ? (
                  <ul className="space-y-2 max-h-60 overflow-y-auto">
                    {readStatus.read_logs.map((log) => (
                      <li key={log.user_id} className="flex items-center justify-between text-sm py-2 border-b border-gray-200 last:border-0">
                        <span className="font-medium text-gray-800">{log.user_name}</span>
                        <span className="text-gray-500">
                          {new Date(log.read_at).toLocaleString('ko-KR', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500">아직 읽은 사람이 없습니다</p>
                )}
              </div>
            )}
          </div>
        )}
        </div>
      </div>

      <div className="mt-8 bg-white shadow sm:rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-800">댓글 {commentsTotal}</h2>
          {commentsLoading && <span className="text-sm text-gray-500">로딩중...</span>}
        </div>

        {user ? (
          <form onSubmit={handleSubmitComment} className="mb-6">
            <textarea
              value={commentContent}
              onChange={(event) => setCommentContent(event.target.value)}
              className="w-full border rounded-lg p-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={4}
              placeholder="댓글을 입력하세요"
            />
            <div className="flex justify-end mt-2">
              <button
                type="submit"
                disabled={commentSubmitting}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {commentSubmitting ? '작성중...' : '댓글 작성'}
              </button>
            </div>
          </form>
        ) : (
          <div className="mb-6 text-sm text-gray-500">로그인 후 댓글을 작성할 수 있습니다.</div>
        )}

        {commentsLoading ? (
          <div className="text-center text-sm text-gray-500">댓글을 불러오는 중...</div>
        ) : comments.length === 0 ? (
          <div className="text-center text-sm text-gray-500">댓글이 없습니다.</div>
        ) : (
          <div className="space-y-4">
            {comments.map((comment) => (
              <div key={comment.id} className="border-b border-gray-100 pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="font-semibold text-gray-800">{comment.author?.name || '알 수 없음'}</span>
                    <span>{formatCommentDate(comment.created_at)}</span>
                    {comment.reply_count ? (
                      <span className="text-xs text-gray-400">답글 {comment.reply_count}</span>
                    ) : null}
                  </div>
                  {user && !comment.is_deleted && !comment.is_blinded && (
                    <div className="flex items-center gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setReplyTargetId((current) => (current === comment.id ? null : comment.id));
                          setReplyContent('');
                          setEditingCommentId(null);
                        }}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        {replyTargetId === comment.id ? '답글 취소' : '답글'}
                      </button>
                      {user?.id === comment.author_id && (
                        <>
                          <span className="text-gray-300">|</span>
                        <button
                          type="button"
                          onClick={() => handleEditComment(comment.id, comment.content)}
                          disabled={commentActionLoading}
                          className="text-gray-600 hover:text-gray-800 disabled:opacity-50"
                        >
                          수정
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteComment(comment.id)}
                          disabled={commentActionLoading}
                          className="text-red-500 hover:text-red-600 disabled:opacity-50"
                        >
                          삭제
                        </button>

                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => handleOpenCommentReport(comment.id, comment.content)}
                        className="text-gray-400 hover:text-red-500 transition-colors flex items-center gap-0.5"
                        title="신고하기"
                      >
                        <AlertTriangle className="w-3 h-3" />
                        신고
                      </button>
                    </div>
                  )}
                </div>
                {editingCommentId === comment.id ? (
                  <div className="mt-3 bg-gray-50 rounded-lg p-3">
                    <textarea
                      value={editContent}
                      onChange={(event) => setEditContent(event.target.value)}
                      className="w-full border rounded-lg p-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={3}
                      placeholder="댓글을 수정하세요"
                    />
                    <div className="flex justify-end gap-2 mt-2">
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded hover:bg-gray-100"
                      >
                        취소
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(comment.id)}
                        disabled={commentActionLoading}
                        className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 disabled:opacity-50"
                      >
                        {commentActionLoading ? '저장중...' : '수정 저장'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-gray-800 whitespace-pre-wrap">{comment.content}</p>
                )}

                {replyTargetId === comment.id && user && editingCommentId !== comment.id && (
                  <div className="mt-3 bg-gray-50 rounded-lg p-3">
                    <textarea
                      value={replyContent}
                      onChange={(event) => setReplyContent(event.target.value)}
                      className="w-full border rounded-lg p-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={3}
                      placeholder="답글을 입력하세요"
                    />
                    <div className="flex justify-end mt-2">
                      <button
                        type="button"
                        onClick={() => handleSubmitReply(comment.id)}
                        disabled={commentSubmitting}
                        className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 disabled:opacity-50"
                      >
                        {commentSubmitting ? '작성중...' : '답글 작성'}
                      </button>
                    </div>
                  </div>
                )}

                {comment.replies && comment.replies.length > 0 && (
                  <div className="mt-4 space-y-3 border-l-2 border-gray-100 pl-4">
                    {comment.replies.map((reply) => (
                      <div key={reply.id} className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-700">{reply.author?.name || '알 수 없음'}</span>
                            <span>{formatCommentDate(reply.created_at)}</span>
                          </div>
                          {user?.id === reply.author_id && !reply.is_deleted && !reply.is_blinded && (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleEditComment(reply.id, reply.content)}
                                disabled={commentActionLoading}
                                className="text-gray-600 hover:text-gray-800 disabled:opacity-50"
                              >
                                수정
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteComment(reply.id)}
                                disabled={commentActionLoading}
                                className="text-red-500 hover:text-red-600 disabled:opacity-50"
                              >
                                삭제
                              </button>
                            </div>
                          )}
                          {!reply.is_deleted && !reply.is_blinded && (
                            <button
                              type="button"
                              onClick={() => handleOpenCommentReport(reply.id, reply.content)}
                              className="text-gray-400 hover:text-red-500 transition-colors flex items-center gap-0.5"
                              title="신고하기"
                            >
                              <AlertTriangle className="w-3 h-3" />
                              신고
                            </button>
                          )}
                        </div>
                        {editingCommentId === reply.id ? (
                          <div className="mt-3 bg-white rounded-lg p-3">
                            <textarea
                              value={editContent}
                              onChange={(event) => setEditContent(event.target.value)}
                              className="w-full border rounded-lg p-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              rows={3}
                              placeholder="답글을 수정하세요"
                            />
                            <div className="flex justify-end gap-2 mt-2">
                              <button
                                type="button"
                                onClick={handleCancelEdit}
                                className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded hover:bg-gray-100"
                              >
                                취소
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveEdit(reply.id)}
                                disabled={commentActionLoading}
                                className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 disabled:opacity-50"
                              >
                                {commentActionLoading ? '저장중...' : '수정 저장'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="mt-2 text-sm text-gray-800 whitespace-pre-wrap">{reply.content}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {commentsHasMore && (
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={handleLoadMoreComments}
              disabled={loadingMoreComments}
              className="px-4 py-2 text-sm font-medium text-blue-600 border border-blue-200 rounded hover:bg-blue-50 disabled:opacity-50"
            >
              {loadingMoreComments ? '로딩중...' : '댓글 더 보기'}
            </button>
          </div>
        )}
      </div>

      <ReportModal
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        targetType={reportTargetType}
        targetId={reportTargetId}
        targetTitle={reportTargetTitle}
      />
    </div>
  );
};

export default PostDetailPage;
