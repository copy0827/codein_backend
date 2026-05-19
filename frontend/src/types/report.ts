export type ReportTargetType = 'post' | 'comment' | 'user';
export type ReportStatus = 'pending' | 'reviewing' | 'resolved' | 'rejected';
export type ReportReason = 'spam' | 'harassment' | 'inappropriate' | 'copyright' | 'other';
export type ActionTaken = 'no_action' | 'content_blinded' | 'user_warned' | 'user_suspended';

export interface ReportCreateRequest {
  target_type: ReportTargetType;
  target_id: number;
  reason: ReportReason;
  description?: string;
}

export interface Report {
  id: number;
  reporter_id: number;
  reporter_name: string;
  target_type: ReportTargetType;
  target_id: number;
  reason: ReportReason;
  description: string | null;
  status: ReportStatus;
  review_started_by_id: number | null;
  review_started_by_name: string | null;
  review_started_at: string | null;
  resolved_by_id: number | null;
  resolved_by_name: string | null;
  resolution_note: string | null;
  resolved_at: string | null;
  action_taken: ActionTaken | null;
  created_at: string;
}

export interface ReportListResponse {
  items: Report[];
  total: number;
  pending_count: number;
}

export interface ReportStats {
  total: number;
  pending: number;
  reviewing: number;
  resolved: number;
  rejected: number;
}

export interface ReportResolveRequest {
  status: 'resolved' | 'rejected';
  resolution_note?: string;
  action_taken?: ActionTaken;
}

export interface ReportFilters {
  status?: ReportStatus;
  target_type?: ReportTargetType;
  reason?: ReportReason;
  skip?: number;
  limit?: number;
}
