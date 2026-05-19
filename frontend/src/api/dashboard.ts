import api from './axios';

export interface PopularPost {
  id: number;
  title: string;
  view_count: number;
  board_id: number;
  board_name?: string;
  author_id: number;
  author_name?: string;
  created_at: string;
  comment_count: number;
}

export interface PopularPostsResponse {
  posts: PopularPost[];
  period: string;
}

export const getPopularPosts = async (period: 'day' | 'week' | 'month' = 'week', limit: number = 5): Promise<PopularPostsResponse> => {
  const response = await api.get<PopularPostsResponse>('/dashboard/popular-posts', {
    params: { period, limit }
  });
  return response.data;
};
