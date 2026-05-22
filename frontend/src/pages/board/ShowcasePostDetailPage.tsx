import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  ChevronRight,
  ExternalLink,
  Eye,
  Github,
  Home,
  MessageSquare,
  PencilLine,
  Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { createPostComment, deleteComment, updateComment } from '../../api/comments';
import type { ShowcaseCommentItem } from '../../types/board';
import { useBoardPermissions } from '../../hooks/useBoardPermissions';
import {
  getApiErrorMessage,
  useDeleteShowcasePostMutation,
  useInvalidateShowcaseQueries,
  useShowcaseDetailQuery,
} from '../../hooks/useShowcaseBoard';
import MarkdownViewer from '../../components/board/MarkdownViewer';
import TechStackBadges from '../../components/board/TechStackBadges';
import GithubRepoCard from '../../components/board/GithubRepoCard';
import ReportModal from '../../components/board/ReportModal';

const formatDate = (value: string) => {
  const date = new Date(value.includes('Z') || value.includes('+') ? value : `${value}Z`);
  return date.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
};

const flattenComments = (items: ShowcaseCommentItem[]): ShowcaseCommentItem[] => {
  const result: ShowcaseCommentItem[] = [];
  const walk = (list: ShowcaseCommentItem[]) => {
    list.forEach((item) => {
      result.push(item);
      if (item.replies?.length) walk(item.replies);
    });
  };
  walk(items);
  return result;
};

const ShowcasePostDetailPage: React.FC = () => {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const { user, canManagePost, requireAuthForWrite } = useBoardPermissions();
  const { invalidateDetail } = useInvalidateShowcaseQueries();
  const deleteMutation = useDeleteShowcasePostMutation();

  const numericPostId = postId ? parseInt(postId, 10) : NaN;
  const {
    data: post,
    isLoading,
    isError,
    error,
  } = useShowcaseDetailQuery(numericPostId);

  const [commentContent, setCommentContent] = useState('');
  const [replyTargetId, setReplyTargetId] = useState<number | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');
  const [reportModalOpen, setReportModalOpen] = useState(false);

  const canManage = post ? canManagePost(post) : false;

  const refetchPost = () => invalidateDetail(numericPostId);

  const handleSubmitComment = async (e: React.FormEvent, parentId?: number) => {
    e.preventDefault();
    if (!requireAuthForWrite('댓글 작성은 로그인 후 이용할 수 있습니다.')) return;
    if (Number.isNaN(numericPostId)) return;

    const content = (parentId ? replyContent : commentContent).trim();
    if (!content) {
      toast.error('댓글 내용을 입력해주세요');
      return;
    }
    setCommentSubmitting(true);
    try {
      await createPostComment(numericPostId, { content, parent_id: parentId });
      setCommentContent('');
      setReplyContent('');
      setReplyTargetId(null);
      await refetchPost();
      toast.success(parentId ? '답글이 작성되었습니다' : '댓글이 작성되었습니다');
    } catch {
      toast.error('댓글 작성에 실패했습니다');
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleSaveEdit = async (commentId: number) => {
    const content = editContent.trim();
    if (!content) return;
    try {
      await updateComment(commentId, { content });
      setEditingCommentId(null);
      setEditContent('');
      await refetchPost();
      toast.success('댓글이 수정되었습니다');
    } catch {
      toast.error('댓글 수정에 실패했습니다');
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    if (!window.confirm('댓글을 삭제할까요?')) return;
    try {
      await deleteComment(commentId);
      await refetchPost();
      toast.success('댓글이 삭제되었습니다');
    } catch {
      toast.error('댓글 삭제에 실패했습니다');
    }
  };

  const handleDeletePost = async () => {
    if (!post || !window.confirm('게시글을 삭제할까요?')) return;
    try {
      await deleteMutation.mutateAsync(post.id);
      toast.success('게시글이 삭제되었습니다');
      navigate(`/board?tab=showcase&board_type=${post.board_type || 'PROJECT'}`);
    } catch (err) {
      toast.error(getApiErrorMessage(err, '게시글 삭제에 실패했습니다'));
    }
  };

  const handleEditClick = () => {
    if (!post) return;
    if (!canManage) {
      requireAuthForWrite('글 수정은 로그인 후 본인 글만 가능합니다.');
      return;
    }
    navigate('/board/write', {
      state: { showcase: true, showcasePost: post },
    });
  };

  const renderComment = (comment: ShowcaseCommentItem, depth = 0) => (
    <div
      key={comment.id}
      className={depth > 0 ? 'mt-3 ml-4 border-l-2 border-gray-100 pl-4' : 'border-b border-gray-100 pb-4'}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm text-gray-600">
          <span className="font-semibold text-gray-800">{comment.author?.name || '알 수 없음'}</span>
          <span className="mx-2 text-gray-300">·</span>
          <span>{formatDate(comment.created_at)}</span>
        </div>
        {user && !comment.is_deleted && (
          <div className="flex items-center gap-2 text-xs">
            {depth === 0 && (
              <button
                type="button"
                onClick={() => {
                  if (!requireAuthForWrite('답글은 로그인 후 작성할 수 있습니다.')) return;
                  setReplyTargetId((c) => (c === comment.id ? null : comment.id));
                }}
                className="text-blue-600 hover:text-blue-800"
              >
                답글
              </button>
            )}
            {user.id === comment.author_id && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setEditingCommentId(comment.id);
                    setEditContent(comment.content);
                  }}
                  className="text-gray-600 hover:text-gray-800"
                >
                  수정
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteComment(comment.id)}
                  className="text-red-500 hover:text-red-600"
                >
                  삭제
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {editingCommentId === comment.id ? (
        <div className="mt-2 space-y-2">
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full border rounded-lg p-2 text-sm"
            rows={3}
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditingCommentId(null)}
              className="px-3 py-1.5 text-xs border rounded"
            >
              취소
            </button>
            <button
              type="button"
              onClick={() => handleSaveEdit(comment.id)}
              className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded"
            >
              저장
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-2 text-sm text-gray-800 whitespace-pre-wrap">{comment.content}</p>
      )}

      {replyTargetId === comment.id && user && (
        <form onSubmit={(e) => handleSubmitComment(e, comment.id)} className="mt-3 bg-gray-50 rounded-lg p-3">
          <textarea
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            className="w-full border rounded-lg p-2 text-sm"
            rows={3}
            placeholder="답글을 입력하세요"
          />
          <div className="flex justify-end mt-2">
            <button
              type="submit"
              disabled={commentSubmitting}
              className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded disabled:opacity-50"
            >
              답글 작성
            </button>
          </div>
        </form>
      )}

      {comment.replies?.map((reply) => renderComment(reply, depth + 1))}
    </div>
  );

  if (isLoading) {
    return <div className="container mx-auto px-4 py-8 text-center text-gray-500">로딩중...</div>;
  }

  if (isError || !post) {
    return (
      <div className="container mx-auto px-4 py-8 text-center text-gray-500">
        {getApiErrorMessage(error, '게시글을 찾을 수 없습니다')}
      </div>
    );
  }

  const isProject = post.board_type === 'PROJECT';
  const showGithubCard = isProject && !!post.github_url?.trim();
  const totalComments = post.comment_count || flattenComments(post.comments).length;

  return (
    <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-8">
      <nav className="flex items-center text-sm text-gray-500 mb-6 space-x-2">
        <Home className="w-4 h-4" />
        <Link to="/" className="hover:text-blue-600">홈</Link>
        <ChevronRight className="w-4 h-4" />
        <Link to={`/board?tab=showcase&board_type=${post.board_type}`} className="hover:text-blue-600">
          {isProject ? '프로젝트 전시' : '기술 블로그'}
        </Link>
        <ChevronRight className="w-4 h-4" />
        <span className="font-medium text-gray-700 truncate max-w-[200px]">{post.title}</span>
      </nav>

      <button
        type="button"
        onClick={() => navigate(`/board?tab=showcase&board_type=${post.board_type}`)}
        className="mb-6 flex items-center gap-2 text-gray-600 hover:text-gray-900 group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        <span className="text-sm font-medium">목록으로</span>
      </button>

      <div className="bg-white shadow-xl rounded-2xl border border-gray-100 overflow-hidden">
        <div className={`h-1.5 ${isProject ? 'bg-gradient-to-r from-violet-500 to-blue-500' : 'bg-gradient-to-r from-emerald-500 to-teal-500'}`} />
        <div className="p-6 sm:p-8 border-b border-gray-100">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span
              className={`text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${
                isProject ? 'bg-violet-100 text-violet-700' : 'bg-emerald-100 text-emerald-700'
              }`}
            >
              {isProject ? 'PROJECT' : 'BLOG'}
            </span>
            {post.category && (
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">
                {post.category}
              </span>
            )}
            {post.has_github && (
              <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-gray-900 text-white">
                <Github className="w-3.5 h-3.5" />
                GitHub
              </span>
            )}
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">{post.title}</h1>

          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 mb-4">
            <span>{post.author?.name || '알 수 없음'}</span>
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {formatDate(post.created_at)}
            </span>
            <span className="flex items-center gap-1">
              <Eye className="w-4 h-4" />
              {post.views}
            </span>
            <span className="flex items-center gap-1">
              <MessageSquare className="w-4 h-4" />
              {totalComments}
            </span>
          </div>

          {post.tech_stack.length > 0 && <TechStackBadges items={post.tech_stack} size="md" />}

          {isProject && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              {post.period && (
                <div className="flex items-center gap-2 text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span>{post.period}</span>
                </div>
              )}
              {post.github_url && (
                <a
                  href={post.github_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-blue-600 bg-blue-50 rounded-lg px-3 py-2 hover:bg-blue-100 transition-colors"
                >
                  <Github className="w-4 h-4" />
                  <span className="truncate">저장소 바로가기</span>
                  <ExternalLink className="w-3.5 h-3.5 ml-auto" />
                </a>
              )}
              {post.team_info && (
                <div className="sm:col-span-2 flex items-start gap-2 text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                  <Users className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                  <span className="whitespace-pre-wrap">
                    {typeof post.team_info === 'string'
                      ? post.team_info
                      : JSON.stringify(post.team_info, null, 2)}
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 mt-6 pt-4 border-t border-gray-100">
            {canManage && (
              <>
                <button
                  type="button"
                  onClick={handleEditClick}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-800"
                >
                  <PencilLine className="w-4 h-4" />
                  수정
                </button>
                <button
                  type="button"
                  onClick={handleDeletePost}
                  disabled={deleteMutation.isPending}
                  className="text-sm font-medium text-red-500 hover:text-red-700 disabled:opacity-50"
                >
                  삭제
                </button>
              </>
            )}
            {user && (
              <button
                type="button"
                onClick={() => setReportModalOpen(true)}
                className="inline-flex items-center gap-1 text-sm text-red-500 hover:text-red-600"
              >
                <AlertTriangle className="w-4 h-4" />
                신고
              </button>
            )}
          </div>
        </div>

        <div className="p-6 sm:p-8">
          <MarkdownViewer content={post.content} />
        </div>
      </div>

      {showGithubCard && (
        <div className="mt-8">
          <GithubRepoCard
            postId={post.id}
            githubUrl={post.github_url}
          />
        </div>
      )}

      <div className="mt-8 bg-white shadow rounded-2xl border border-gray-100 p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4">댓글 {totalComments}</h2>

        {user ? (
          <form onSubmit={handleSubmitComment} className="mb-6">
            <textarea
              value={commentContent}
              onChange={(e) => setCommentContent(e.target.value)}
              className="w-full border rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              rows={4}
              placeholder="댓글을 입력하세요"
            />
            <div className="flex justify-end mt-2">
              <button
                type="submit"
                disabled={commentSubmitting}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                댓글 작성
              </button>
            </div>
          </form>
        ) : (
          <p className="text-sm text-gray-500 mb-6">
            로그인 후 댓글을 작성할 수 있습니다.{' '}
            <button
              type="button"
              onClick={() => requireAuthForWrite('댓글 작성은 로그인 후 이용할 수 있습니다.')}
              className="text-blue-600 hover:underline font-medium"
            >
              로그인하기
            </button>
          </p>
        )}

        <div className="space-y-4">
          {post.comments.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">댓글이 없습니다</p>
          ) : (
            post.comments.map((comment) => renderComment(comment))
          )}
        </div>
      </div>

      <ReportModal
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        targetType="post"
        targetId={post.id}
        targetTitle={post.title}
      />
    </div>
  );
};

export default ShowcasePostDetailPage;
