export interface Notification {
  id: number;
  user_id: number;
  notification_type: string;
  title: string;
  message: string;
  link: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  // Optional fields
  related_type?: string | null;
  related_id?: number | null;
}

export interface NotificationCount {
  count: number;
}

export interface NotificationSettings {
  email_enabled: boolean;
  web_push_enabled: boolean;
  reminder_24h: boolean;
  reminder_1h: boolean;
  notify_new_post: boolean;
  notify_comment_reply: boolean;
  notify_event_reminder: boolean;
  notify_event_update: boolean;
  notify_mention: boolean;
  notify_system: boolean;
}
