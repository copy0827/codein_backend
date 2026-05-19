import api from './axios';
import type { ActivityHistoryResponse, PointsSummary } from '../types/activity';

export const getMyHistory = async (page: number, pageSize: number, activityType?: string): Promise<ActivityHistoryResponse> => {
  const params: Record<string, any> = { page, page_size: pageSize };
  if (activityType) {
    params.activity_type = activityType;
  }
  const response = await api.get('/activity/me/history', { params });
  return response.data;
};

export const getMyPointsSummary = async (): Promise<PointsSummary> => {
  const response = await api.get('/activity/me/summary');
  return response.data;
};

export const getUserHistory = async (userId: number, page: number, pageSize: number): Promise<ActivityHistoryResponse> => {
  const response = await api.get(`/activity/${userId}/history`, {
    params: { page, page_size: pageSize },
  });
  return response.data;
};
