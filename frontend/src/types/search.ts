export type SearchType = 'all' | 'posts' | 'albums' | 'events';

export interface SearchParams {
  q: string;
  type?: SearchType;
  date_from?: string;
  date_to?: string;
  author_id?: number;
  author_name?: string;
  board_id?: number;
  limit?: number;
}

export interface SearchPostResult {
  id: number;
  title: string;
  content: string;
  board_id: number;
  board_name?: string | null;
  author_id: number;
  author_name?: string | null;
  view_count: number;
  created_at: string;
  rank?: number | null;
}

export interface SearchAlbumResult {
  id: number;
  name: string;
  visibility: string;
  owner_id: number;
  owner_name?: string | null;
  created_at: string;
}

export interface SearchEventResult {
  id: number;
  title: string;
  description: string;
  start_time: string;
  end_time: string;
  owner_id: number;
  owner_name?: string | null;
  created_at: string;
}

export interface SearchResponse {
  posts: SearchPostResult[];
  albums: SearchAlbumResult[];
  events: SearchEventResult[];
  total_count: number;
  query: string;
  filters: Record<string, unknown>;
  used_fulltext: boolean;
}
