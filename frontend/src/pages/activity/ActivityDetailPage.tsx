import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  ChevronRight,
  Clock,
  GraduationCap,
  Home,
  Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Card from '../../components/ui/Card';
import ActivityApplyBar from '../../components/activity/ActivityApplyBar';
import ActivityTypeBadge from '../../components/activity/ActivityTypeBadge';
import ActivityStatusBadge from '../../components/activity/ActivityStatusBadge';
import ActivityApplicationsPanel from '../../components/activity/ActivityApplicationsPanel';
import TechStackBadges from '../../components/board/TechStackBadges';
import {
  formatActivityDate,
  parseMentoringInfo,
  STATUS_LABELS,
} from '../../components/activity/activityUi';
import { useAuth } from '../../context/AuthContext';
import {
  useActivityDetailQuery,
  useApplyActivityMutation,
  getActivityApiErrorMessage,
} from '../../hooks/useActivityRecruitment';

const ActivityDetailPage: React.FC = () => {
  const { activityId } = useParams<{ activityId: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const numericId = activityId ? parseInt(activityId, 10) : NaN;
  const isValidId = Number.isFinite(numericId) && numericId > 0;

  const { data: activity, isLoading, isError, error } = useActivityDetailQuery(
    numericId,
    isValidId,
  );
  const applyMutation = useApplyActivityMutation(numericId);
  const [applyMessage, setApplyMessage] = useState('');

  const isOwner = !!user && !!activity && user.id === activity.owner_id;
  const showApplySection =
    !!activity &&
    !isOwner &&
    activity.recruitment_status === 'RECRUITING' &&
    !activity.is_full;

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) return;

    const message = applyMessage.trim();
    if (!message) {
      toast.error('신청 메시지를 입력해 주세요.');
      return;
    }
    try {
      await applyMutation.mutateAsync({ message });
      setApplyMessage('');
      toast.success('신청이 완료되었습니다.');
    } catch (err) {
      toast.error(getActivityApiErrorMessage(err, '신청에 실패했습니다.'));
    }
  };

  if (!isValidId) {
    return (
      <div className="container mx-auto px-4 py-8 text-center text-gray-500">
        <p className="mb-4">잘못된 모집글 주소입니다.</p>
        <Link to="/activities" className="text-blue-600 font-semibold hover:underline">
          활동 모집 목록으로
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 text-center text-gray-500">
        로딩중...
      </div>
    );
  }

  if (isError || !activity) {
    return (
      <div className="container mx-auto px-4 py-8 text-center text-gray-500">
        {getActivityApiErrorMessage(error, '모집글을 찾을 수 없습니다.')}
      </div>
    );
  }

  const isMentoring = activity.recruitment_type === 'MENTORING';
  const mentoringInfo = parseMentoringInfo(
    activity.additional_info as Record<string, unknown> | null | undefined,
  );
  const stacks = activity.tech_stacks ?? [];

  return (
    <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-8">
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
        <span className="font-medium text-gray-700 truncate max-w-[200px]">
          {activity.title}
        </span>
      </nav>

      <button
        type="button"
        onClick={() => navigate('/activities')}
        className="mb-6 flex items-center gap-2 text-gray-600 hover:text-gray-900 group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        <span className="text-sm font-medium">목록으로</span>
      </button>

      <Card padding="none" className="mb-8">
        <div
          className={`h-1.5 ${
            isMentoring
              ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
              : 'bg-gradient-to-r from-blue-500 to-indigo-500'
          }`}
        />
        <div className="p-6 sm:p-8 border-b border-gray-100">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <ActivityTypeBadge type={activity.recruitment_type} size="md" />
            <ActivityStatusBadge status={activity.recruitment_status} />
            {isMentoring && !activity.is_approved && (
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                승인 대기
              </span>
            )}
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">
            {activity.title}
          </h1>

          <p className="text-sm text-gray-500">
            작성자 {activity.owner?.name ?? '알 수 없음'} ·{' '}
            {formatActivityDate(activity.created_at)}
          </p>
        </div>

        {isMentoring && (mentoringInfo.mentoring_field || mentoringInfo.mentor_intro) && (
          <div className="mx-6 sm:mx-8 mt-6 mb-2 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <GraduationCap className="w-5 h-5 text-emerald-700" />
              <h2 className="text-lg font-bold text-emerald-900">멘토링 안내</h2>
            </div>
            {mentoringInfo.mentoring_field && (
              <div className="mb-4">
                <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-1">
                  멘토링 분야
                </p>
                <p className="text-base font-semibold text-gray-900">
                  {mentoringInfo.mentoring_field}
                </p>
              </div>
            )}
            {mentoringInfo.mentor_intro && (
              <div>
                <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-1">
                  멘토 소개
                </p>
                <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                  {mentoringInfo.mentor_intro}
                </p>
              </div>
            )}
          </div>
        )}

        <div className="p-6 sm:p-8 border-b border-gray-100 bg-gray-50/50">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4">
            활동 정보
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCell
              icon={<Users className="w-4 h-4 text-indigo-500" />}
              label="모집 인원"
              value={
                <span className="tabular-nums">
                  <strong>{activity.current_participants}</strong>
                  <span className="text-gray-400 font-normal"> / </span>
                  {activity.max_participants}명
                  {activity.is_full && (
                    <span className="ml-2 text-xs text-gray-500">(마감)</span>
                  )}
                </span>
              }
            />
            <SummaryCell
              icon={<Calendar className="w-4 h-4 text-indigo-500" />}
              label="모집 마감일"
              value={formatActivityDate(activity.deadline)}
            />
            <SummaryCell
              icon={<Clock className="w-4 h-4 text-indigo-500" />}
              label="활동 기간"
              value={activity.activity_period}
            />
            <SummaryCell
              icon={<Users className="w-4 h-4 text-indigo-500" />}
              label="모집 상태"
              value={STATUS_LABELS[activity.recruitment_status]}
            />
          </div>
          {stacks.length > 0 && (
            <div className="mt-5 pt-5 border-t border-gray-200">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                기술 스택
              </p>
              <TechStackBadges items={stacks} max={12} size="md" />
            </div>
          )}
        </div>

        <div className="p-6 sm:p-8">
          <h2 className="text-lg font-bold text-gray-900 mb-4">상세 내용</h2>
          <div className="prose prose-sm max-w-none text-gray-800 whitespace-pre-wrap leading-relaxed">
            {activity.content}
          </div>
        </div>
      </Card>

      {showApplySection && (
        <ActivityApplyBar
          message={applyMessage}
          onMessageChange={setApplyMessage}
          onSubmit={handleApply}
          isPending={applyMutation.isPending}
          isAuthenticated={isAuthenticated}
          loginReturnPath={`/activities/${numericId}`}
        />
      )}

      <section className="mt-8">
        <ActivityApplicationsPanel
          activityId={activity.id}
          isOwner={isOwner}
          currentUserId={user?.id}
          enabled={isAuthenticated}
        />
      </section>
    </div>
  );
};

const SummaryCell: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}> = ({ icon, label, value }) => (
  <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
    <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
      {icon}
      {label}
    </div>
    <div className="text-sm font-semibold text-gray-900">{value}</div>
  </div>
);

export default ActivityDetailPage;
