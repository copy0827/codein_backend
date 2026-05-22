import api from './axios';
import type {
  ActivityCreatePayload,
  ActivityRecruitmentItem,
  ActivityListParams,
  ActivityListResponse,
  ApplicationCreatePayload,
  ApplicationListResponse,
  ApplicationUpdatePayload,
  ActivityApplicationItem,
  RecruitmentStatus,
} from '../types/activity';

export const getActivities = async (
  params: ActivityListParams = {},
): Promise<ActivityListResponse> => {
  const response = await api.get<ActivityListResponse>('/activities', { params });
  return response.data;
};

export const getActivity = async (
  activityId: number,
): Promise<ActivityRecruitmentItem> => {
  const response = await api.get<ActivityRecruitmentItem>(
    `/activities/${activityId}`,
  );
  return response.data;
};

export const createActivity = async (
  payload: ActivityCreatePayload,
): Promise<ActivityRecruitmentItem> => {
  const response = await api.post<ActivityRecruitmentItem>('/activities', payload);
  return response.data;
};

export const getActivityApplications = async (
  activityId: number,
  page = 1,
  size = 20,
): Promise<ApplicationListResponse> => {
  const response = await api.get<ApplicationListResponse>(
    `/activities/${activityId}/applications`,
    { params: { page, size } },
  );
  return response.data;
};

export const applyToActivity = async (
  activityId: number,
  payload: ApplicationCreatePayload,
): Promise<ActivityApplicationItem> => {
  const response = await api.post<ActivityApplicationItem>(
    `/activities/${activityId}/apply`,
    payload,
  );
  return response.data;
};

export const patchActivityApplication = async (
  activityId: number,
  applicantId: number,
  payload: ApplicationUpdatePayload,
): Promise<ActivityApplicationItem> => {
  const response = await api.patch<ActivityApplicationItem>(
    `/activities/${activityId}/applications/${applicantId}`,
    payload,
  );
  return response.data;
};

export const patchActivityStatus = async (
  activityId: number,
  recruitment_status: RecruitmentStatus,
): Promise<ActivityRecruitmentItem> => {
  const response = await api.patch<ActivityRecruitmentItem>(
    `/activities/${activityId}/status`,
    {
    recruitment_status,
  });
  return response.data;
};
