import api from './axios';
import type {
  Report,
  ReportListResponse,
  ReportStats,
  ReportResolveRequest,
  ReportFilters,
  ReportCreateRequest
} from '../types/report';

export type {
  Report,
  ReportListResponse,
  ReportStats,
  ReportResolveRequest,
  ReportFilters,
} from '../types/report';
export { type ReportTargetType, type ReportStatus, type ReportReason, type ActionTaken } from '../types/report';

export const getReports = async (params?: ReportFilters): Promise<ReportListResponse> => {
  const response = await api.get<ReportListResponse>('/reports', { params });
  return response.data;
};

export const getReport = async (id: number): Promise<Report> => {
  const response = await api.get<Report>(`/reports/${id}`);
  return response.data;
};

export const getReportStats = async (): Promise<ReportStats> => {
  // Assuming the backend has a stats endpoint or we extract it from other calls.
  // The user prompt says `getReportStats()` → GET /reports/stats
  // But wait, existing backend code in `AdminDashboardPage` uses `getAdminStats` from `/admin/stats`.
  // The prompt explicitly asked for `GET /reports/stats`. I'll assume that endpoint exists or I should use it.
  // Let me check if backend supports /reports/stats.
  // If not, I might need to clarify or just try it.
  // Actually, I'll check backend/app/api/v1/reports.py to see if the endpoint exists.
  const response = await api.get<ReportStats>('/reports/stats');
  return response.data;
};

export const resolveReport = async (id: number, data: ReportResolveRequest): Promise<Report> => {
  const response = await api.post<Report>(`/reports/${id}/resolve`, data);
  return response.data;
};

export const startReview = async (id: number): Promise<Report> => {
  const response = await api.post<Report>(`/reports/${id}/review`);
  return response.data;
};

export const createReport = async (data: ReportCreateRequest): Promise<Report> => {
  const response = await api.post<Report>('/reports', data);
  return response.data;
};
