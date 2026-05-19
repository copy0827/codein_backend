import api from './axios';

export interface AdminStats {
  users: number;
  posts: number;
  submissions: number;
  pending_reports: number;
  unanswered_questions: number;
  pending_event_approvals: number;
  pending_reviews: number;
}

export type ReportStatus = 'pending' | 'reviewing' | 'resolved' | 'rejected';
export type ReportTargetType = 'post' | 'comment' | 'album' | 'photo' | 'user';
export type ReportReason = 'spam' | 'harassment' | 'inappropriate' | 'copyright' | 'misinformation' | 'other';

export interface Report {
  id: number;
  reporter_id: number;
  reporter_name?: string | null;
  target_type: ReportTargetType;
  target_id: number;
  reason: ReportReason;
  description?: string | null;
  status: ReportStatus;
  resolved_by_id?: number | null;
  resolved_by_name?: string | null;
  resolution_note?: string | null;
  resolved_at?: string | null;
  action_taken?: string | null;
  created_at: string;
}

export interface ReportListResponse {
  items: Report[];
  total: number;
  pending_count: number;
}

export interface ReportFilters {
  status?: ReportStatus;
  target_type?: ReportTargetType;
  reason?: ReportReason;
  skip?: number;
  limit?: number;
}

export interface ReportResolvePayload {
  status: ReportStatus;
  resolution_note?: string;
  action_taken?: string;
}

export interface NoticeTemplate {
  id: number;
  name: string;
  content: string;
  description?: string | null;
  is_active: boolean;
  created_by?: number | null;
  created_at: string;
  updated_at?: string | null;
}

export interface NoticeTemplateCreate {
  name: string;
  content: string;
  description?: string;
  is_active?: boolean;
}

export interface NoticeTemplateUpdate {
  name?: string;
  content?: string;
  description?: string;
  is_active?: boolean;
}

export const getAdminStats = async (): Promise<AdminStats> => {
  const response = await api.get<AdminStats>('/admin/stats');
  return response.data;
};

export const getReports = async (filters: ReportFilters): Promise<ReportListResponse> => {
  const response = await api.get<ReportListResponse>('/reports/', { params: filters });
  return response.data;
};

export const resolveReport = async (reportId: number, payload: ReportResolvePayload): Promise<Report> => {
  const response = await api.post<Report>(`/reports/${reportId}/resolve`, payload);
  return response.data;
};

export const getNoticeTemplates = async (includeInactive = false): Promise<NoticeTemplate[]> => {
  const response = await api.get<NoticeTemplate[]>('/boards/notices/templates', {
    params: { include_inactive: includeInactive }
  });
  return response.data;
};

export const createNoticeTemplate = async (payload: NoticeTemplateCreate): Promise<NoticeTemplate> => {
  const response = await api.post<NoticeTemplate>('/boards/notices/templates', payload);
  return response.data;
};

export const updateNoticeTemplate = async (templateId: number, payload: NoticeTemplateUpdate): Promise<NoticeTemplate> => {
  const response = await api.put<NoticeTemplate>(`/boards/notices/templates/${templateId}`, payload);
  return response.data;
};


export const deleteNoticeTemplate = async (templateId: number): Promise<void> => {
  await api.delete(`/boards/notices/templates/${templateId}`);
};

export interface UserAdminOut {
  id: number;
  email: string;
  name: string;
  student_id: string;
  major: string;
  generation: string;
  role: string;
  rank: string;
  activity_points: number;
  is_active: boolean;
  is_suspended: boolean;
  suspended_until?: string | null;
  suspension_reason?: string | null;
  warning_count: number;
  created_at: string;
  updated_at?: string | null;
}

export interface UserAdminListResponse {
  items: UserAdminOut[];
  total: number;
}

export interface UserAdminFilters {
  search?: string;
  role?: string;
  rank?: string;
  is_active?: boolean;
  is_suspended?: boolean;
  skip?: number;
  limit?: number;
}

export interface UserAdminUpdate {
  role?: string;
  rank?: string;
  is_active?: boolean;
  is_suspended?: boolean;
  suspended_until?: string | null;
  suspension_reason?: string | null;
  warning_count?: number;
  activity_points?: number;
}

export const getUsers = async (filters: UserAdminFilters): Promise<UserAdminListResponse> => {
  const response = await api.get<UserAdminListResponse>('/admin/users', { params: filters });
  return response.data;
};

export const getUserDetail = async (userId: number): Promise<UserAdminOut> => {
  const response = await api.get<UserAdminOut>(`/admin/users/${userId}`);
  return response.data;
};

export const updateUser = async (userId: number, payload: UserAdminUpdate): Promise<UserAdminOut> => {
  const response = await api.patch<UserAdminOut>(`/admin/users/${userId}`, payload);
  return response.data;
};

export interface UserAdminSubmissionOut {
  id: number;
  problem_id: number;
  problem_title: string;
  test_id?: number | null;
  test_title?: string | null;
  code: string;
  language: string;
  result: string;
  execution_time: number | null;
  memory_used: number | null;
  test_cases_passed: number;
  test_cases_total: number;
  error_message: string | null;
  submitted_at: string;
}

export interface UserAdminSubmissionListResponse {
  items: UserAdminSubmissionOut[];
  total: number;
}

export const getUserSubmissions = async (userId: number, skip: number = 0, limit: number = 50): Promise<UserAdminSubmissionListResponse> => {
  const response = await api.get<UserAdminSubmissionListResponse>(`/admin/users/${userId}/submissions`, { params: { skip, limit } });
  return response.data;
};



export const deleteUser = async (userId: number, force = false): Promise<{ ok: boolean; mode: string }> => {
  const response = await api.delete<{ ok: boolean; mode: string }>(`/admin/users/${userId}`, { params: { force } });
  return response.data;
};


export interface AdminAuditItem {
  ts: string;
  action: string;
  payload: Record<string, unknown>;
}

export const getAdminAuditLogs = async (limit = 100): Promise<AdminAuditItem[]> => {
  const response = await api.get<{ items: AdminAuditItem[] }>('/admin/audit-logs', { params: { limit } });
  return response.data.items;
};

export interface UnansweredQnaItem {
  id: number;
  title: string;
  author_name: string;
  created_at: string;
}

export const getUnansweredQna = async (limit = 20): Promise<UnansweredQnaItem[]> => {
  const response = await api.get<UnansweredQnaItem[]>('/admin/qna/unanswered', { params: { limit } });
  return response.data;
};

export const resetUserPassword = async (userId: number, new_password: string): Promise<{ ok: boolean }> => {
  const response = await api.post<{ ok: boolean }>(`/admin/users/${userId}/password`, { new_password });
  return response.data;
};
