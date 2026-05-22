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

// ——— Case 1: 프로젝트 전시 / 기술 블로그 ———

export type ShowcaseBoardType = 'PROJECT' | 'BLOG';

export type ShowcaseSearchType = 'title' | 'author';

/** Case 1 게시글 공통 필드 (목록·상세) */
export interface ShowcasePostFields {
  board_type: ShowcaseBoardType | null;
  tech_stack: string[];
  github_url?: string | null;
  period?: string | null;
  team_info?: string | Record<string, unknown> | unknown[] | null;
  category?: string | null;
  is_published: boolean;
  has_github: boolean;
  views: number;
  comment_count: number;
}

export interface ShowcaseCommentAuthor {
  id: number;
  name: string;
  profile_image?: string | null;
  rank: string;
}

export interface ShowcaseCommentItem {
  id: number;
  post_id: number;
  author_id: number;
  parent_id?: number | null;
  content: string;
  is_blinded: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at?: string | null;
  author?: ShowcaseCommentAuthor | null;
  replies: ShowcaseCommentItem[];
}

export interface ShowcaseListItem extends ShowcasePostFields {
  id: number;
  title: string;
  board_id: number;
  author_id: number;
  is_pinned: boolean;
  created_at: string;
  updated_at?: string | null;
  author?: User | null;
}

export interface ShowcaseListResponse {
  total: number;
  page: number;
  size: number;
  total_pages: number;
  items: ShowcaseListItem[];
}

export interface ShowcaseDetail extends ShowcaseListItem {
  content: string;
  is_hidden: boolean;
  is_blinded: boolean;
  comments: ShowcaseCommentItem[];
}

export interface ShowcaseCreatePayload {
  title: string;
  content: string;
  board_type: ShowcaseBoardType;
  board_id: number;
  tech_stack?: string[];
  period?: string;
  github_url?: string;
  team_info?: string | Record<string, unknown> | unknown[];
  category?: string;
  is_published?: boolean;
}

export type ShowcaseUpdatePayload = Partial<ShowcaseCreatePayload>;

export interface ShowcaseListParams {
  board_type: ShowcaseBoardType;
  page?: number;
  size?: number;
  search_keyword?: string;
  search_type?: ShowcaseSearchType;
}

// ——— GitHub 연동 API 응답 ———

export interface GitHubCommitItem {
  sha: string;
  message: string;
  author_name?: string | null;
  committed_at: string;
}

export interface GitHubAuthorCommitStats {
  author: string;
  commit_count: number;
}

export interface GitHubRepoResponse {
  repository_name: string;
  description?: string | null;
  last_updated?: string | null;
  total_commits: number;
  recent_commits: GitHubCommitItem[];
  author_commit_counts: GitHubAuthorCommitStats[];
}

/** @deprecated GitHubRepoResponse 사용 */
export type ShowcaseGitHubResponse = GitHubRepoResponse;
