import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, LayoutGrid, Loader2 } from 'lucide-react';
import { useActivityListQuery } from '../../hooks/useActivityRecruitment';
import ActivityCard from './ActivityCard';
import { RECRUITMENT_TYPE_TABS } from './activityUi';

/**
 * 홈 화면용 활동 모집 미리보기 (스터디·프로젝트·멘토-멘티).
 */
const ActivityRecruitmentHomeSection: React.FC = () => {
  const { data, isLoading, isError } = useActivityListQuery({ page: 1, size: 6 });

  const items = data?.items ?? [];
  const mentoringCount = items.filter((a) => a.recruitment_type === 'MENTORING').length;
  const projectCount = items.filter((a) => a.recruitment_type === 'PROJECT').length;

  return (
    <section className="py-10 md:py-12 border-t border-dark-line">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
            <LayoutGrid className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-dark-text">활동 모집 · 멘토-멘티</h2>
            <p className="text-sm text-dark-muted mt-1">
              스터디, 프로젝트, 공모전, 멘토-멘티 모집을 확인하고 참여하세요.
            </p>
          </div>
        </div>
        <Link
          to="/activities"
          className="inline-flex items-center gap-2 text-sm font-semibold text-brand-light hover:text-white transition-colors"
        >
          전체 보기
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {RECRUITMENT_TYPE_TABS.filter((t) => t.key !== 'ALL').map((tab) => (
          <Link
            key={tab.key}
            to={`/activities?type=${tab.key}`}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-dark-cardSoft border border-dark-line text-dark-muted hover:text-dark-text hover:border-brand/40 transition-colors"
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-dark-muted">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">모집글 불러오는 중...</span>
        </div>
      ) : isError ? (
        <div className="rounded-2xl border border-dark-line bg-dark-cardSoft p-8 text-center text-dark-muted text-sm">
          모집 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dark-line bg-dark-cardSoft p-8 text-center">
          <p className="text-dark-muted text-sm mb-4">등록된 모집글이 없습니다.</p>
          <Link
            to="/activities/write"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand text-white text-sm font-bold hover:bg-brand-light transition-colors"
          >
            첫 모집글 작성하기
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            {items.slice(0, 3).map((activity) => (
              <ActivityCard key={activity.id} activity={activity} />
            ))}
          </div>
          <p className="text-xs text-dark-muted">
            {projectCount > 0 && `프로젝트 ${projectCount}건`}
            {projectCount > 0 && mentoringCount > 0 && ' · '}
            {mentoringCount > 0 && `멘토-멘티 ${mentoringCount}건`}
            {items.length >= 3 && ' (미리보기)'}
          </p>
        </>
      )}
    </section>
  );
};

export default ActivityRecruitmentHomeSection;
