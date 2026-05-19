import type { User } from './auth';

export interface Board {
  id: number;
  name: string;
  board_type?: string | null;
  is_public: boolean;
  order: number;
}

export interface PostAttachment {
  id: number;
  post_id: number;
  uploader_id: number;
  original_filename: string;
  file_url: string;
  file_size: number;
  content_type?: string | null;
  uploaded_at: string;
}

export interface Post {
  id: number;
  title: string;
  content: string;
  board_id: number;
  author_id: number;
  template_id?: number | null;
  is_pinned: boolean;
  is_hidden: boolean;
  is_blinded: boolean;
  view_count: number;
  created_at: string;
  updated_at?: string;
  
  notice_type?: 'normal' | 'important' | 'urgent' | null;
  target_audience?: 'all' | 'members' | 'admins' | 'specific_ranks' | null;
  target_ranks?: string | null;
  scheduled_at?: string | null;
  expires_at?: string | null;
  attachments?: PostAttachment[];

  author?: User;
  board?: Board;
  
  read_count?: number;
  is_read?: boolean;
}

export interface CreatePostPayload {
  title: string;
  content?: string;
  template_id?: number;
  board_id?: number;
  notice_type?: string;
  target_audience?: string;
  target_ranks?: string[];
  scheduled_at?: string;
  expires_at?: string;
  is_pinned?: boolean;
}

export type UpdatePostPayload = Partial<CreatePostPayload>;

export interface BoardCreatePayload {
  name: string;
  board_type?: string;
  is_public: boolean;
  order?: number;
}

export interface BoardUpdatePayload {
  name?: string;
  board_type?: string;
  is_public?: boolean;
  order?: number;
}

export interface PostReadLog {
  user_id: number;
  user_name: string;
  read_at: string;
}

export interface PostReadStatusResponse {
  post_id: number;
  total_readers: number;
  read_logs: PostReadLog[];
}

export interface PostFilter {
  board_id?: number;
  page?: number;
  size?: number;
  query?: string;
  notice_only?: boolean;
}

export interface NoticeListResponse {
  total: number;
  notices: Post[];
}
