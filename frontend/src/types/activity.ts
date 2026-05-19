export interface ActivityLog {
  id: number;
  user_id: number;
  activity_type: string;
  points: number;
  description: string | null;
  reference_type: string | null;
  reference_id: number | null;
  balance_after: number;
  created_at: string;
}

export interface ActivityHistoryResponse {
  items: ActivityLog[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface PointsSummary {
  current_points: number;
  total_earned: number;
  total_spent: number;
  this_month_earned: number;
  rank: string;
  next_rank: string | null;
  points_to_next_rank: number | null;
}
