import api from './axios';
import type {
  Comment,
  CommentListResponse,
  CommentCreatePayload,
  CommentUpdatePayload,
} from '../types/comment';

export type {
  Comment,
  CommentListResponse,
  CommentCreatePayload,
  CommentUpdatePayload,
} from '../types/comment';

export const getPostComments = async (
  postId: number,
  params?: { page?: number; page_size?: number }
): Promise<CommentListResponse> => {
  const response = await api.get<CommentListResponse>(`/posts/${postId}/comments`, { params });
  return response.data;
};

export const createPostComment = async (
  postId: number,
  data: CommentCreatePayload
): Promise<Comment> => {
  const response = await api.post<Comment>(`/posts/${postId}/comments`, data);
  return response.data;
};

export const updateComment = async (
  commentId: number,
  data: CommentUpdatePayload
): Promise<Comment> => {
  const response = await api.put<Comment>(`/comments/${commentId}`, data);
  return response.data;
};

export const deleteComment = async (commentId: number): Promise<void> => {
  await api.delete(`/comments/${commentId}`);
};
