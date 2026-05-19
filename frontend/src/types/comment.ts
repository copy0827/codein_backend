export interface CommentAuthor {
  id: number;
  name: string;
  profile_image?: string | null;
  rank: string;
}

export interface Comment {
  id: number;
  post_id: number;
  author_id: number;
  parent_id?: number | null;
  content: string;
  is_blinded: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at?: string | null;
  author?: CommentAuthor | null;
  replies?: Comment[] | null;
  reply_count?: number;
}

export interface CommentListResponse {
  comments: Comment[];
  total: number;
  has_more: boolean;
}

export interface CommentCreatePayload {
  content: string;
  parent_id?: number | null;
}

export interface CommentUpdatePayload {
  content: string;
}
