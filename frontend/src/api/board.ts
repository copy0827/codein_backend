import api from './axios';
import type { Board, Post, CreatePostPayload, UpdatePostPayload, PostFilter, PostAttachment, PostReadStatusResponse, BoardCreatePayload, BoardUpdatePayload } from '../types/board';

export const getBoards = async (): Promise<Board[]> => {
  const response = await api.get<Board[]>('/boards');
  return response.data;
};

export const createBoard = async (data: BoardCreatePayload): Promise<Board> => {
  const response = await api.post<Board>('/boards', data);
  return response.data;
};

export const updateBoard = async (boardId: number, data: BoardUpdatePayload): Promise<Board> => {
  const response = await api.patch<Board>(`/boards/${boardId}`, data);
  return response.data;
};

export const deleteBoard = async (boardId: number): Promise<void> => {
  await api.delete(`/boards/${boardId}`);
};

export const reorderBoards = async (boardIds: number[]): Promise<void> => {
  await api.put('/boards/reorder', boardIds);
};

export const getNotices = async (params?: { limit?: number }): Promise<Post[]> => {
  const response = await api.get<Post[]>('/boards/notice', { params });
  return response.data;
};

export const getBoardPosts = async (boardId: number, params?: PostFilter): Promise<Post[]> => {
  const response = await api.get<Post[]>(`/boards/${boardId}`, { params });
  return response.data;
};

export const createPost = async (boardId: number, data: CreatePostPayload): Promise<Post> => {
  const response = await api.post<Post>(`/boards/${boardId}`, data);
  return response.data;
};

export const getPost = async (boardId: number, postId: number): Promise<Post> => {
  const response = await api.get<Post>(`/boards/${boardId}/posts/${postId}`);
  return response.data;
};

export const markPostAsRead = async (boardId: number, postId: number): Promise<void> => {
  await api.post(`/boards/${boardId}/posts/${postId}/read`);
};

export const getPostReadStatus = async (boardId: number, postId: number, params?: { skip?: number; limit?: number }): Promise<PostReadStatusResponse> => {
  const response = await api.get<PostReadStatusResponse>(`/boards/${boardId}/posts/${postId}/read-status`, { params });
  return response.data;
};

export const uploadPostAttachment = async (boardId: number, postId: number, file: File): Promise<PostAttachment> => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post<PostAttachment>(`/boards/${boardId}/posts/${postId}/attachments`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return response.data;
};

export const getPostAttachments = async (boardId: number, postId: number): Promise<PostAttachment[]> => {
  const response = await api.get<PostAttachment[]>(`/boards/${boardId}/posts/${postId}/attachments`);
  return response.data;
};

export const deletePostAttachment = async (boardId: number, postId: number, attachmentId: number): Promise<void> => {
  await api.delete(`/boards/${boardId}/posts/${postId}/attachments/${attachmentId}`);
};

export const updatePost = async (boardId: number, postId: number, data: UpdatePostPayload): Promise<Post> => {
  const response = await api.put<Post>(`/boards/${boardId}/posts/${postId}`, data);
  return response.data;
};

export const deletePost = async (boardId: number, postId: number): Promise<void> => {
  await api.delete(`/boards/${boardId}/posts/${postId}`);
};
