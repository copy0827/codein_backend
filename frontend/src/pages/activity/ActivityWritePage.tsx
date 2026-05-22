import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, Home, Loader2, PencilLine, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import {
  getActivityApiErrorMessage,
  useCreateActivityMutation,
} from '../../hooks/useActivityRecruitment';
import {
  RECRUITMENT_TYPES,
  type ProjectTeamMember,
  type RecruitmentType,
  buildAdditionalInfo,
  parseTechStackInput,
  showsMentoringFields,
  showsTeamAndTechFields,
  MENTORING_FIELD_OPTIONS,
} from '../../types/activity';
import { TYPE_LABELS } from '../../components/activity/activityUi';

const emptyMember = (): ProjectTeamMember => ({ name: '', role: '', contact: '' });

const toDatetimeLocalValue = (date: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const ActivityWritePage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const createMutation = useCreateActivityMutation();

  const [recruitmentType, setRecruitmentType] = useState<RecruitmentType>('STUDY');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [maxParticipants, setMaxParticipants] = useState(4);
  const [deadline, setDeadline] = useState('');
  const [activityPeriod, setActivityPeriod] = useState('');
  const [techStackInput, setTechStackInput] = useState('');
  const [teamMembers, setTeamMembers] = useState<ProjectTeamMember[]>([emptyMember()]);
  const [mentoringField, setMentoringField] = useState('');
  const [mentorIntro, setMentorIntro] = useState('');

  const showTeamTech = showsTeamAndTechFields(recruitmentType);
  const showMentoring = showsMentoringFields(recruitmentType);

  useEffect(() => {
    if (!isAuthenticated) {
      toast.error('모집글 작성은 로그인 후 이용할 수 있습니다.');
      navigate('/login', { state: { from: '/activities/write' } });
    }
  }, [isAuthenticated, navigate]);

  const defaultDeadline = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return toDatetimeLocalValue(d);
  }, []);

  useEffect(() => {
    if (!deadline) setDeadline(defaultDeadline);
  }, [deadline, defaultDeadline]);

  const handleTypeChange = (next: RecruitmentType) => {
    setRecruitmentType(next);
  };

  const updateMember = (index: number, field: keyof ProjectTeamMember, value: string) => {
    setTeamMembers((prev) =>
      prev.map((m, i) => (i === index ? { ...m, [field]: value } : m)),
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedTitle = title.trim();
    const trimmedContent = content.trim();
    const trimmedPeriod = activityPeriod.trim();

    if (!trimmedTitle || !trimmedContent) {
      toast.error('제목과 내용을 입력해 주세요.');
      return;
    }
    if (!trimmedPeriod) {
      toast.error('활동 기간을 입력해 주세요.');
      return;
    }
    if (maxParticipants < 1) {
      toast.error('최대 모집 인원은 1명 이상이어야 합니다.');
      return;
    }
    if (!deadline) {
      toast.error('모집 마감일을 선택해 주세요.');
      return;
    }

    if (showMentoring) {
      if (!mentoringField) {
        toast.error('멘토링 분야를 선택해 주세요.');
        return;
      }
      if (!mentorIntro.trim()) {
        toast.error('멘토 소개 정보를 입력해 주세요.');
        return;
      }
    }

    const deadlineIso = new Date(deadline).toISOString();
    const tech_stacks = showTeamTech ? parseTechStackInput(techStackInput) : undefined;
    const additional_info = buildAdditionalInfo(recruitmentType, {
      teamMembers,
      mentoringField,
      mentorIntro,
    });

    try {
      const created = await createMutation.mutateAsync({
        title: trimmedTitle,
        content: trimmedContent,
        recruitment_type: recruitmentType,
        max_participants: maxParticipants,
        deadline: deadlineIso,
        activity_period: trimmedPeriod,
        tech_stacks: tech_stacks?.length ? tech_stacks : undefined,
        additional_info,
      });
      toast.success(
        recruitmentType === 'MENTORING'
          ? '멘토링 모집글이 등록되었습니다. 관리자 승인 후 공개됩니다.'
          : '모집글이 등록되었습니다.',
      );
      navigate(`/activities/${created.id}`);
    } catch (err) {
      toast.error(getActivityApiErrorMessage(err, '모집글 작성에 실패했습니다.'));
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-8 text-center text-gray-500">
        로그인이 필요합니다.
      </div>
    );
  }

  return (
    <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-8 max-w-4xl">
      <nav className="flex items-center text-sm text-gray-500 mb-6 space-x-2">
        <Home className="w-4 h-4" />
        <Link to="/" className="hover:text-blue-600">
          홈
        </Link>
        <ChevronRight className="w-4 h-4" />
        <Link to="/activities" className="hover:text-blue-600">
          활동 모집
        </Link>
        <ChevronRight className="w-4 h-4" />
        <span className="font-medium text-gray-700">모집글 작성</span>
      </nav>

      <h1 className="text-2xl font-bold mb-2 text-dark-text flex items-center gap-2">
        <PencilLine className="w-7 h-7 text-indigo-600" />
        활동 모집글 작성
      </h1>
      <p className="text-sm text-gray-500 mb-6">
        모집 유형에 따라 입력 항목이 달라집니다.
      </p>

      <form
        onSubmit={handleSubmit}
        className="bg-white shadow-md rounded-xl px-5 sm:px-8 pt-6 pb-8 border border-gray-100"
      >
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="recruitment_type">
            모집 유형
          </label>
          <select
            id="recruitment_type"
            value={recruitmentType}
            onChange={(e) => handleTypeChange(e.target.value as RecruitmentType)}
            className="shadow border border-gray-200 rounded-lg w-full py-2.5 px-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {RECRUITMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t]}
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
            className="shadow border border-gray-200 rounded-lg w-full py-2.5 px-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="모집 제목"
            maxLength={255}
          />
        </div>

        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="content">
            상세 내용
          </label>
          <textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={8}
            className="shadow border border-gray-200 rounded-lg w-full py-2.5 px-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="활동 소개, 참여 조건, 진행 방식 등"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="max_participants">
              최대 모집 인원
            </label>
            <input
              id="max_participants"
              type="number"
              min={1}
              value={maxParticipants}
              onChange={(e) => setMaxParticipants(Number(e.target.value) || 1)}
              className="shadow border border-gray-200 rounded-lg w-full py-2.5 px-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="deadline">
              모집 마감일
            </label>
            <input
              id="deadline"
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="shadow border border-gray-200 rounded-lg w-full py-2.5 px-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="activity_period">
            활동 기간
          </label>
          <input
            id="activity_period"
            type="text"
            value={activityPeriod}
            onChange={(e) => setActivityPeriod(e.target.value)}
            className="shadow border border-gray-200 rounded-lg w-full py-2.5 px-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="예: 2026.03 ~ 2026.06"
          />
        </div>

        {showTeamTech && (
          <div className="mb-6 p-4 rounded-xl border border-violet-100 bg-violet-50/50 space-y-4">
            <p className="text-sm font-bold text-violet-800">
              {recruitmentType === 'PROJECT' ? '프로젝트' : '공모전'} 추가 정보
            </p>

            <div>
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="tech_stacks">
                기술 스택 태그
              </label>
              <input
                id="tech_stacks"
                type="text"
                value={techStackInput}
                onChange={(e) => setTechStackInput(e.target.value)}
                className="shadow border border-gray-200 rounded-lg w-full py-2.5 px-3 text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                placeholder="React, TypeScript, Python (쉼표로 구분)"
              />
              <p className="text-xs text-gray-500 mt-1">쉼표(,)로 여러 태그를 입력하세요.</p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-700 text-sm font-bold">팀원 정보</span>
                <button
                  type="button"
                  onClick={() => setTeamMembers((prev) => [...prev, emptyMember()])}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-violet-700 hover:text-violet-900"
                >
                  <Plus className="w-3.5 h-3.5" />
                  팀원 추가
                </button>
              </div>
              <div className="space-y-3">
                {teamMembers.map((member, index) => (
                  <div
                    key={`member-${index}`}
                    className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-start bg-white rounded-lg border border-gray-200 p-3"
                  >
                    <input
                      type="text"
                      value={member.name}
                      onChange={(e) => updateMember(index, 'name', e.target.value)}
                      placeholder="이름"
                      className="sm:col-span-3 border border-gray-200 rounded-lg py-2 px-3 text-sm"
                    />
                    <input
                      type="text"
                      value={member.role ?? ''}
                      onChange={(e) => updateMember(index, 'role', e.target.value)}
                      placeholder="역할"
                      className="sm:col-span-3 border border-gray-200 rounded-lg py-2 px-3 text-sm"
                    />
                    <input
                      type="text"
                      value={member.contact ?? ''}
                      onChange={(e) => updateMember(index, 'contact', e.target.value)}
                      placeholder="연락처 (선택)"
                      className="sm:col-span-5 border border-gray-200 rounded-lg py-2 px-3 text-sm"
                    />
                    {teamMembers.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setTeamMembers((prev) => prev.filter((_, i) => i !== index))
                        }
                        className="sm:col-span-1 p-2 text-gray-400 hover:text-red-600"
                        aria-label="팀원 삭제"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {showMentoring && (
          <div className="mb-6 p-4 rounded-xl border border-emerald-100 bg-emerald-50/50 space-y-4">
            <p className="text-sm font-bold text-emerald-800">멘토링 정보</p>

            <div>
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="mentoring_field">
                멘토링 분야
              </label>
              <select
                id="mentoring_field"
                value={mentoringField}
                onChange={(e) => setMentoringField(e.target.value)}
                className="shadow border border-gray-200 rounded-lg w-full py-2.5 px-3 text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">분야 선택</option>
                {MENTORING_FIELD_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="mentor_intro">
                멘토 소개 정보
              </label>
              <textarea
                id="mentor_intro"
                value={mentorIntro}
                onChange={(e) => setMentorIntro(e.target.value)}
                rows={5}
                className="shadow border border-gray-200 rounded-lg w-full py-2.5 px-3 text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="경력, 멘토링 방식, 기대 효과 등"
              />
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate('/activities')}
            className="px-6 py-2.5 rounded-lg border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-sm disabled:opacity-50"
          >
            {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            등록하기
          </button>
        </div>
      </form>
    </div>
  );
};

export default ActivityWritePage;
