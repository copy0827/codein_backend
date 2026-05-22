import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import {
  createShowcasePost,
  deleteShowcasePost,
  getShowcaseGitHubInfo,
  getShowcasePost,
  getShowcasePosts,
  updateShowcasePost,
} from '../api/board';
import { showcaseQueryKeys } from '../lib/showcaseQueryKeys';
import type {
  ShowcaseCreatePayload,
  ShowcaseListParams,
  ShowcaseUpdatePayload,
} from '../types/board';

export const getApiErrorMessage = (error: unknown, fallback: string): string => {
  if (isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail) && detail[0]?.msg) return String(detail[0].msg);
  }
  return fallback;
};

export const useShowcaseListQuery = (
  params: ShowcaseListParams,
  enabled = true,
) =>
  useQuery({
    queryKey: showcaseQueryKeys.list(params),
    queryFn: () => getShowcasePosts(params),
    enabled,
    staleTime: 30_000,
  });

export const useShowcaseDetailQuery = (postId: number, enabled = true) =>
  useQuery({
    queryKey: showcaseQueryKeys.detail(postId),
    queryFn: () => getShowcasePost(postId),
    enabled: enabled && !Number.isNaN(postId) && postId > 0,
    staleTime: 20_000,
  });

export const useShowcaseGitHubQuery = (
  postId: number,
  options?: { enabled?: boolean },
) =>
  useQuery({
    queryKey: showcaseQueryKeys.github(postId),
    queryFn: () => getShowcaseGitHubInfo(postId),
    enabled:
      (options?.enabled ?? true) && !Number.isNaN(postId) && postId > 0,
    retry: false,
    staleTime: 5 * 60_000,
  });

export const useInvalidateShowcaseQueries = () => {
  const queryClient = useQueryClient();

  return {
    invalidateAll: () =>
      queryClient.invalidateQueries({ queryKey: showcaseQueryKeys.all }),
    invalidateLists: () =>
      queryClient.invalidateQueries({ queryKey: showcaseQueryKeys.lists() }),
    invalidateDetail: (postId: number) =>
      queryClient.invalidateQueries({ queryKey: showcaseQueryKeys.detail(postId) }),
  };
};

export const useCreateShowcasePostMutation = () => {
  const { invalidateAll } = useInvalidateShowcaseQueries();

  return useMutation({
    mutationFn: (payload: ShowcaseCreatePayload) => createShowcasePost(payload),
    onSuccess: () => {
      invalidateAll();
    },
  });
};

export const useUpdateShowcasePostMutation = () => {
  const { invalidateAll, invalidateDetail } = useInvalidateShowcaseQueries();

  return useMutation({
    mutationFn: ({ postId, payload }: { postId: number; payload: ShowcaseUpdatePayload }) =>
      updateShowcasePost(postId, payload),
    onSuccess: (data) => {
      invalidateAll();
      invalidateDetail(data.id);
    },
  });
};

export const useDeleteShowcasePostMutation = () => {
  const { invalidateAll } = useInvalidateShowcaseQueries();

  return useMutation({
    mutationFn: (postId: number) => deleteShowcasePost(postId),
    onSuccess: () => {
      invalidateAll();
    },
  });
};
