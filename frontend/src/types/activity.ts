/** 활동 포인트 / 히스토리 (기존 /activity API) */

export interface ActivityLog {
  id: number;
  user_id: number;
  activity_type: string;
  points: number;
  description: string | null;
  reference_type: string | null;
  reference_id: number | null;
  balance_after: number;
  created_at: string;
}

export interface ActivityHistoryResponse {
  items: ActivityLog[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface PointsSummary {
  current_points: number;
  total_earned: number;
  total_spent: number;
  this_month_earned: number;
  rank: string;
  next_rank: string | null;
  points_to_next_rank: number | null;
}

/** 활동 모집 · 멘토링 (/activities API) */

export const RECRUITMENT_TYPES = ['STUDY', 'PROJECT', 'CONTEST', 'MENTORING'] as const;
export type RecruitmentType = (typeof RECRUITMENT_TYPES)[number];

export const RECRUITMENT_STATUSES = ['RECRUITING', 'CLOSED', 'COMPLETED'] as const;
export type RecruitmentStatus = (typeof RECRUITMENT_STATUSES)[number];

export const APPLICATION_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const MENTORING_FIELD_OPTIONS = [
  '알고리즘·PS',
  '웹 프론트엔드',
  '웹 백엔드',
  '모바일',
  'DevOps·인프라',
  '데이터·AI',
  '취업·이력서',
  '기타',
] as const;

export type MentoringFieldOption = (typeof MENTORING_FIELD_OPTIONS)[number];

export interface ActivityOwnerSummary {
  id: number;
  name: string;
  profile_image?: string | null;
  rank: string;
  role: string;
}

export interface ProjectTeamMember {
  name: string;
  role?: string;
  contact?: string;
}

export interface MentoringAdditionalInfo {
  mentoring_field?: string | null;
  mentor_intro?: string | null;
}

export interface ProjectAdditionalInfo {
  team_members?: ProjectTeamMember[];
}

export type ActivityAdditionalInfo =
  | MentoringAdditionalInfo
  | ProjectAdditionalInfo
  | Record<string, unknown>;

export interface ActivityRecruitmentItem {
  id: number;
  title: string;
  content: string;
  recruitment_type: RecruitmentType;
  recruitment_status: RecruitmentStatus;
  max_participants: number;
  current_participants: number;
  deadline: string;
  activity_period: string;
  tech_stacks?: string[] | null;
  is_approved: boolean;
  owner_id: number;
  additional_info?: ActivityAdditionalInfo | null;
  created_at: string;
  updated_at?: string | null;
  owner?: ActivityOwnerSummary | null;
  spots_remaining: number;
  is_full: boolean;
  pending_application_count: number;
}

/** @deprecated ActivityRecruitmentItem 사용 권장 */
export type ActivityItem = ActivityRecruitmentItem;

export interface ActivityListResponse {
  items: ActivityRecruitmentItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface ActivityListParams {
  recruitment_type?: RecruitmentType;
  recruitment_status?: RecruitmentStatus;
  tech_stack?: string;
  search_keyword?: string;
  page?: number;
  size?: number;
}

export interface ActivityCreatePayload {
  title: string;
  content: string;
  recruitment_type: RecruitmentType;
  max_participants: number;
  deadline: string;
  activity_period: string;
  tech_stacks?: string[];
  additional_info?: ActivityAdditionalInfo | null;
  recruitment_status?: RecruitmentStatus;
}

export interface ActivityApplicationItem {
  id: number;
  activity_id: number;
  applicant_id: number;
  message: string;
  status: ApplicationStatus;
  applied_at: string;
  applicant?: ActivityOwnerSummary | null;
  activity_title?: string | null;
  process_message?: string | null;
}

export interface ApplicationListResponse {
  items: ActivityApplicationItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface ApplicationCreatePayload {
  message: string;
}

export interface ApplicationUpdatePayload {
  status: 'APPROVED' | 'REJECTED';
  process_message?: string;
}

export function isRecruitmentType(value: string): value is RecruitmentType {
  return (RECRUITMENT_TYPES as readonly string[]).includes(value);
}

export function parseTechStackInput(input: string): string[] {
  return input
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function buildAdditionalInfo(
  type: RecruitmentType,
  data: {
    teamMembers: ProjectTeamMember[];
    mentoringField: string;
    mentorIntro: string;
  },
): ActivityAdditionalInfo | undefined {
  if (type === 'MENTORING') {
    if (!data.mentoringField && !data.mentorIntro.trim()) return undefined;
    return {
      mentoring_field: data.mentoringField || null,
      mentor_intro: data.mentorIntro.trim() || null,
    };
  }
  if (type === 'PROJECT' || type === 'CONTEST') {
    const members = data.teamMembers.filter((m) => m.name.trim());
    if (members.length === 0) return undefined;
    return { team_members: members };
  }
  return undefined;
}

export function showsTeamAndTechFields(type: RecruitmentType): boolean {
  return type === 'PROJECT' || type === 'CONTEST';
}

export function showsMentoringFields(type: RecruitmentType): boolean {
  return type === 'MENTORING';
}
