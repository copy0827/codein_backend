import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { createPost, updatePost, getBoards, uploadPostAttachment } from '../../api/board';
import { getNoticeTemplates } from '../../api/admin';
import type { CreatePostPayload, Board, ShowcaseBoardType, ShowcaseDetail } from '../../types/board';
import type { NoticeTemplate } from '../../api/admin';
import { useAuth } from '../../context/AuthContext';
import { useBoardPermissions } from '../../hooks/useBoardPermissions';
import {
  getApiErrorMessage,
  useCreateShowcasePostMutation,
  useUpdateShowcasePostMutation,
} from '../../hooks/useShowcaseBoard';
import MarkdownEditor from '../../components/board/MarkdownEditor';
import toast from 'react-hot-toast';

const PostWritePage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { requireAuthForWrite } = useBoardPermissions();
  const createShowcaseMutation = useCreateShowcasePostMutation();
  const updateShowcaseMutation = useUpdateShowcasePostMutation();

  const isShowcaseMode =
    location.state?.showcase === true ||
    new URLSearchParams(location.search).get('mode') === 'showcase';

  const showcasePost = location.state?.showcasePost as ShowcaseDetail | undefined;
  const isShowcaseEdit = isShowcaseMode && !!showcasePost;

  const searchParams = new URLSearchParams(location.search);
  const initialTitle = searchParams.get('title') || '';
  const initialContent = searchParams.get('content') || '';

  const [boards, setBoards] = useState<Board[]>([]);
  const [templates, setTemplates] = useState<NoticeTemplate[]>([]);
  const [boardId, setBoardId] = useState<number>(location.state?.boardId || 0);
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [files, setFiles] = useState<File[]>([]);

  const editPost = location.state?.post;
  const isLegacyEdit = !isShowcaseMode && !!editPost;

  const [showcaseBoardType, setShowcaseBoardType] = useState<ShowcaseBoardType>(
    (location.state?.boardType as ShowcaseBoardType) || showcasePost?.board_type || 'PROJECT',
  );
  const [techStackInput, setTechStackInput] = useState('');
  const [period, setPeriod] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [teamInfo, setTeamInfo] = useState('');
  const [category, setCategory] = useState('');
  const [isPublished, setIsPublished] = useState(true);

  const [showAnnouncementOptions, setShowAnnouncementOptions] = useState(false);
  const [noticeType, setNoticeType] = useState('normal');
  const [targetAudience, setTargetAudience] = useState('all');
  const [targetRanks, setTargetRanks] = useState<string[]>([]);
  const [scheduledAt, setScheduledAt] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [isPinned, setIsPinned] = useState(false);

  const isStaffOrAdmin = user && ['staff', 'admin', 'superadmin'].includes(user.role);
  const availableBoards = isStaffOrAdmin
    ? boards
    : boards.filter((board) => !board.name.includes('공지'));

  useEffect(() => {
    if (isShowcaseMode) {
      requireAuthForWrite('글쓰기는 로그인 후 이용할 수 있습니다.');
    }
  }, [isShowcaseMode, requireAuthForWrite]);

  useEffect(() => {
    const fetchBoards = async () => {
      try {
        const data = await getBoards();
        setBoards(data);
        const filteredBoards = isStaffOrAdmin
          ? data
          : data.filter((board) => !board.name.includes('공지'));
        if (filteredBoards.length > 0) {
          const preferred =
            location.state?.boardId ||
            data.find((b) => b.board_type === 'general')?.id ||
            filteredBoards[0].id;
          if (!boardId || !filteredBoards.some((board) => board.id === boardId)) {
            setBoardId(preferred);
          }
        }
      } catch {
        toast.error('게시판 목록을 불러오는데 실패했습니다');
      }
    };
    fetchBoards();

    if (!isShowcaseMode && isStaffOrAdmin) {
      const fetchTemplates = async () => {
        try {
          const data = await getNoticeTemplates();
          setTemplates(data);
        } catch (error) {
          console.error('Failed to load templates', error);
        }
      };
      fetchTemplates();
    }
  }, [boardId, isStaffOrAdmin, isShowcaseMode, location.state?.boardId]);

  useEffect(() => {
    if (isShowcaseEdit && showcasePost) {
      setTitle(showcasePost.title);
      setContent(showcasePost.content);
      setShowcaseBoardType(showcasePost.board_type || 'PROJECT');
      setBoardId(showcasePost.board_id);
      setTechStackInput((showcasePost.tech_stack || []).join(', '));
      setPeriod(showcasePost.period || '');
      setGithubUrl(showcasePost.github_url || '');
      setTeamInfo(
        typeof showcasePost.team_info === 'string'
          ? showcasePost.team_info
          : showcasePost.team_info
            ? JSON.stringify(showcasePost.team_info)
            : '',
      );
      setCategory(showcasePost.category || '');
      setIsPublished(showcasePost.is_published);
    }
  }, [isShowcaseEdit, showcasePost]);

  useEffect(() => {
    if (isLegacyEdit && editPost) {
      setBoardId(editPost.board_id);
      setTitle(editPost.title);
      setContent(editPost.content);
      if (editPost.notice_type) {
        setShowAnnouncementOptions(true);
        setNoticeType(editPost.notice_type);
        setTargetAudience(editPost.target_audience || 'all');
        if (editPost.target_ranks) {
          setTargetRanks(editPost.target_ranks.split(','));
        }
        setScheduledAt(editPost.scheduled_at ? editPost.scheduled_at.substring(0, 16) : '');
        setExpiresAt(editPost.expires_at ? editPost.expires_at.substring(0, 16) : '');
        setIsPinned(editPost.is_pinned || false);
      }
    }
  }, [isLegacyEdit, editPost]);

  const handleTemplateSelect = (templateId: number) => {
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      if (content && !window.confirm('현재 내용이 대체됩니다. 계속하시겠습니까?')) {
        return;
      }
      setContent(template.content);
    }
  };

  const parseTechStack = () =>
    techStackInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

  const handleShowcaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      toast.error('제목과 내용을 입력해주세요');
      return;
    }
    if (!boardId) {
      toast.error('게시판 정보를 불러오지 못했습니다');
      return;
    }
    if (showcaseBoardType === 'PROJECT') {
      if (!githubUrl.trim()) {
        toast.error('PROJECT 유형은 GitHub 저장소 주소가 필수입니다');
        return;
      }
      if (!period.trim()) {
        toast.error('PROJECT 유형은 진행 기간이 필수입니다');
        return;
      }
    }

    if (!requireAuthForWrite()) return;

    setIsSubmitting(true);
    try {
      const payload = {
        title: title.trim(),
        content,
        board_type: showcaseBoardType,
        board_id: boardId,
        tech_stack: parseTechStack(),
        period: period.trim() || undefined,
        github_url: githubUrl.trim() || undefined,
        team_info: teamInfo.trim() || undefined,
        category: category.trim() || undefined,
        is_published: isPublished,
      };

      const result =
        isShowcaseEdit && showcasePost
          ? await updateShowcaseMutation.mutateAsync({
              postId: showcasePost.id,
              payload,
            })
          : await createShowcaseMutation.mutateAsync(payload);

      toast.success(isShowcaseEdit ? '게시글이 수정되었습니다' : '게시글이 작성되었습니다');
      navigate(`/board/showcase/${result.id}`);
    } catch (err) {
      toast.error(
        getApiErrorMessage(
          err,
          isShowcaseEdit ? '게시글 수정에 실패했습니다' : '게시글 작성에 실패했습니다',
        ),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLegacySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      toast.error('제목과 내용을 입력해주세요');
      return;
    }
    if (!boardId) {
      toast.error('게시판을 선택해주세요');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: CreatePostPayload = {
        title,
        content,
        board_id: boardId,
        ...(showAnnouncementOptions
          ? {
              notice_type: noticeType,
              target_audience: targetAudience,
              target_ranks: targetAudience === 'specific_ranks' ? targetRanks : undefined,
              scheduled_at: scheduledAt || undefined,
              expires_at: expiresAt || undefined,
              is_pinned: isPinned,
            }
          : {}),
      };

      let post;
      if (isLegacyEdit && editPost) {
        post = await updatePost(boardId, editPost.id, payload);
      } else {
        post = await createPost(boardId, payload);
      }

      if (files.length > 0) {
        try {
          await Promise.all(files.map((file) => uploadPostAttachment(boardId, post.id, file)));
        } catch {
          toast.error('게시글은 생성되었지만 일부 첨부파일 업로드에 실패했습니다');
        }
      }

      toast.success(isLegacyEdit ? '게시글이 수정되었습니다' : '게시글이 작성되었습니다');
      navigate(`/board/${boardId}/post/${post.id}`);
    } catch (error) {
      console.error(error);
      toast.error(isLegacyEdit ? '게시글 수정에 실패했습니다' : '게시글 작성에 실패했습니다');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isProject = showcaseBoardType === 'PROJECT';

  return (
    <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-8 max-w-4xl">
      <h1 className="text-2xl font-bold mb-2 text-dark-text">
        {isShowcaseMode
          ? isShowcaseEdit
            ? '전시/블로그 글 수정'
            : '전시/블로그 글쓰기'
          : isLegacyEdit
            ? '글 수정'
            : '글쓰기'}
      </h1>
      {isShowcaseMode && (
        <p className="text-sm text-gray-500 mb-6">
          마크다운으로 작성하고 미리보기로 확인할 수 있습니다.
        </p>
      )}

      <form
        onSubmit={isShowcaseMode ? handleShowcaseSubmit : handleLegacySubmit}
        className="bg-white shadow-md rounded-xl px-5 sm:px-8 pt-6 pb-8 border border-gray-100"
      >
        {isShowcaseMode ? (
          <>
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="board_type">
                게시판 유형
              </label>
              <select
                id="board_type"
                value={showcaseBoardType}
                onChange={(e) => setShowcaseBoardType(e.target.value as ShowcaseBoardType)}
                className="shadow border border-gray-200 rounded-lg w-full py-2.5 px-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="PROJECT">프로젝트 전시 (PROJECT)</option>
                <option value="BLOG">기술 블로그 (BLOG)</option>
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="title">
                제목
              </label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="shadow border border-gray-200 rounded-lg w-full py-2.5 px-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="제목을 입력하세요"
              />
            </div>

            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="category">
                카테고리
              </label>
              <input
                id="category"
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="shadow border border-gray-200 rounded-lg w-full py-2.5 px-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="예: Web, AI, DevOps"
              />
            </div>

            {isProject && (
              <div className="mb-6 p-4 rounded-xl bg-violet-50 border border-violet-100 space-y-4">
                <h3 className="text-sm font-bold text-violet-800">프로젝트 전용 정보</h3>
                <div>
                  <label className="block text-gray-700 text-sm font-bold mb-2">
                    사용 기술 스택
                  </label>
                  <input
                    type="text"
                    value={techStackInput}
                    onChange={(e) => setTechStackInput(e.target.value)}
                    className="shadow border border-gray-200 rounded-lg w-full py-2.5 px-3 text-gray-800 text-sm"
                    placeholder="React, TypeScript, FastAPI (쉼표로 구분)"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 text-sm font-bold mb-2">
                    프로젝트 진행 기간
                  </label>
                  <input
                    type="text"
                    value={period}
                    onChange={(e) => setPeriod(e.target.value)}
                    className="shadow border border-gray-200 rounded-lg w-full py-2.5 px-3 text-gray-800 text-sm"
                    placeholder="예: 2025.01 ~ 2025.03"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 text-sm font-bold mb-2">
                    GitHub 저장소 주소
                  </label>
                  <input
                    type="url"
                    value={githubUrl}
                    onChange={(e) => setGithubUrl(e.target.value)}
                    className="shadow border border-gray-200 rounded-lg w-full py-2.5 px-3 text-gray-800 text-sm"
                    placeholder="https://github.com/owner/repo"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 text-sm font-bold mb-2">팀원 정보</label>
                  <textarea
                    value={teamInfo}
                    onChange={(e) => setTeamInfo(e.target.value)}
                    className="shadow border border-gray-200 rounded-lg w-full py-2.5 px-3 text-gray-800 text-sm min-h-[80px]"
                    placeholder="팀원 이름, 역할 등"
                  />
                </div>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2">본문 (마크다운)</label>
              <MarkdownEditor value={content} onChange={setContent} />
            </div>

            <div className="mb-6">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPublished}
                  onChange={(e) => setIsPublished(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">즉시 발행</span>
              </label>
              <p className="text-xs text-gray-400 mt-1">체크 해제 시 임시 저장(미발행) 상태로 등록됩니다.</p>
            </div>
          </>
        ) : (
          <>
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="board">
                게시판
              </label>
              <select
                id="board"
                value={boardId}
                onChange={(e) => setBoardId(Number(e.target.value))}
                className="shadow border border-dark-line rounded w-full py-2 px-3 bg-dark-bg text-dark-text leading-tight focus:outline-none focus:shadow-outline"
              >
                {availableBoards.map((board) => (
                  <option key={board.id} value={board.id}>
                    {board.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="title">
                제목
              </label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                placeholder="제목을 입력하세요"
              />
            </div>

            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <label className="block text-gray-700 text-sm font-bold" htmlFor="content">
                  내용
                </label>
                {isStaffOrAdmin && templates.length > 0 && (
                  <select
                    className="text-sm border border-dark-line rounded px-2 py-1 bg-dark-bg text-dark-text"
                    onChange={(e) => handleTemplateSelect(Number(e.target.value))}
                    defaultValue=""
                  >
                    <option value="" disabled>
                      템플릿 불러오기
                    </option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline h-64"
                placeholder="내용을 입력하세요"
              />
            </div>

            <div className="mb-6">
              <label className="block text-gray-700 text-sm font-bold mb-2">첨부파일</label>
              <input
                type="file"
                multiple
                onChange={(e) => setFiles(Array.from(e.target.files || []))}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>

            {isStaffOrAdmin && (
              <div className="mb-6 border rounded p-4">
                <button
                  type="button"
                  onClick={() => setShowAnnouncementOptions(!showAnnouncementOptions)}
                  className="flex items-center justify-between w-full text-left font-bold text-gray-700 focus:outline-none"
                >
                  <span>공지 옵션</span>
                  <span>{showAnnouncementOptions ? '−' : '+'}</span>
                </button>
                {showAnnouncementOptions && (
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-gray-700 text-sm font-bold mb-2">공지 유형</label>
                      <select
                        value={noticeType}
                        onChange={(e) => setNoticeType(e.target.value)}
                        className="shadow border border-dark-line rounded w-full py-2 px-3 bg-dark-bg text-dark-text"
                      >
                        <option value="normal">일반 공지</option>
                        <option value="important">중요 공지</option>
                        <option value="urgent">긴급 공지</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-gray-700 text-sm font-bold mb-2">대상</label>
                      <select
                        value={targetAudience}
                        onChange={(e) => setTargetAudience(e.target.value)}
                        className="shadow border border-dark-line rounded w-full py-2 px-3 bg-dark-bg text-dark-text"
                      >
                        <option value="all">전체</option>
                        <option value="members">회원만</option>
                        <option value="admins">운영진만</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className={`bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isSubmitting ? '저장 중...' : isShowcaseEdit || isLegacyEdit ? '수정 완료' : '등록'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default PostWritePage;
