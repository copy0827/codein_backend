import type { ApplicationStatus, RecruitmentStatus, RecruitmentType } from '../../types/activity';

export const RECRUITMENT_TYPE_TABS: {
  key: 'ALL' | RecruitmentType;
  label: string;
}[] = [
  { key: 'ALL', label: '전체' },
  { key: 'STUDY', label: '스터디' },
  { key: 'PROJECT', label: '프로젝트' },
  { key: 'CONTEST', label: '공모전' },
  { key: 'MENTORING', label: '멘토-멘티' },
];

export const TYPE_LABELS: Record<RecruitmentType, string> = {
  STUDY: '스터디',
  PROJECT: '프로젝트',
  CONTEST: '공모전',
  MENTORING: '멘토-멘티',
};

/** primary / secondary 테마 톤 (BoardList 탭·뱃지 컨벤션) */
export const TYPE_BADGE_STYLES: Record<
  RecruitmentType,
  { bg: string; text: string; accent: string }
> = {
  STUDY: {
    bg: 'bg-blue-100',
    text: 'text-blue-800',
    accent: 'text-blue-700',
  },
  PROJECT: {
    bg: 'bg-violet-100',
    text: 'text-violet-800',
    accent: 'text-violet-700',
  },
  CONTEST: {
    bg: 'bg-amber-100',
    text: 'text-amber-800',
    accent: 'text-amber-700',
  },
  MENTORING: {
    bg: 'bg-emerald-100',
    text: 'text-emerald-800',
    accent: 'text-emerald-700',
  },
};

export const STATUS_LABELS: Record<RecruitmentStatus, string> = {
  RECRUITING: '모집중',
  CLOSED: '마감',
  COMPLETED: '완료',
};

export const STATUS_BADGE_STYLES: Record<RecruitmentStatus, string> = {
  RECRUITING: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  CLOSED: 'bg-gray-100 text-gray-700 border-gray-200',
  COMPLETED: 'bg-indigo-100 text-indigo-800 border-indigo-200',
};

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  PENDING: '대기',
  APPROVED: '승인',
  REJECTED: '거절',
};

export const APPLICATION_STATUS_STYLES: Record<ApplicationStatus, string> = {
  PENDING: 'bg-amber-50 text-amber-800 border-amber-200',
  APPROVED: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  REJECTED: 'bg-red-50 text-red-800 border-red-200',
};

export const formatActivityDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}.${m}.${d}`;
};

export const parseMentoringInfo = (
  additional_info?: Record<string, unknown> | null,
) => {
  if (!additional_info || typeof additional_info !== 'object') {
    return { mentoring_field: null, mentor_intro: null };
  }
  const raw = additional_info as Record<string, unknown>;
  return {
    mentoring_field:
      typeof raw.mentoring_field === 'string' ? raw.mentoring_field : null,
    mentor_intro: typeof raw.mentor_intro === 'string' ? raw.mentor_intro : null,
  };
};
