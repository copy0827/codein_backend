import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import {
  applyToActivity,
  createActivity,
  getActivities,
  getActivity,
  getActivityApplications,
  patchActivityApplication,
} from '../api/activityRecruitment';
import { activityQueryKeys } from '../lib/activityQueryKeys';
import type {
  ActivityCreatePayload,
  ActivityListParams,
  ApplicationCreatePayload,
  ApplicationUpdatePayload,
} from '../types/activity';

export const getActivityApiErrorMessage = (
  error: unknown,
  fallback: string,
): string => {
  if (isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail) && detail[0]?.msg) return String(detail[0].msg);
  }
  return fallback;
};

export const useActivityListQuery = (params: ActivityListParams, enabled = true) =>
  useQuery({
    queryKey: activityQueryKeys.list(params),
    queryFn: () => getActivities(params),
    enabled,
    staleTime: 30_000,
  });

export const useActivityDetailQuery = (activityId: number, enabled = true) =>
  useQuery({
    queryKey: activityQueryKeys.detail(activityId),
    queryFn: () => getActivity(activityId),
    enabled: enabled && activityId > 0,
    staleTime: 20_000,
  });

export const useActivityApplicationsQuery = (
  activityId: number,
  options: {
    enabled?: boolean;
    page?: number;
    size?: number;
  } = {},
) => {
  const page = options.page ?? 1;
  const size = options.size ?? 20;
  return useQuery({
    queryKey: activityQueryKeys.applications(activityId, page, size),
    queryFn: () => getActivityApplications(activityId, page, size),
    enabled: (options.enabled ?? true) && activityId > 0,
    staleTime: 15_000,
  });
};

export const useApplyActivityMutation = (activityId: number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ApplicationCreatePayload) =>
      applyToActivity(activityId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: activityQueryKeys.detail(activityId) });
      queryClient.invalidateQueries({ queryKey: activityQueryKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: [...activityQueryKeys.all, 'applications', activityId],
      });
    },
  });
};

export const useCreateActivityMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ActivityCreatePayload) => createActivity(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: activityQueryKeys.lists() });
    },
  });
};

export const usePatchApplicationMutation = (activityId: number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      applicantId,
      payload,
    }: {
      applicantId: number;
      payload: ApplicationUpdatePayload;
    }) => patchActivityApplication(activityId, applicantId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: activityQueryKeys.detail(activityId) });
      queryClient.invalidateQueries({ queryKey: activityQueryKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: [...activityQueryKeys.all, 'applications', activityId],
      });
    },
  });
};
