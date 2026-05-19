import api from './axios';
import type { Notification, NotificationCount } from '../types/notification';

export const getNotifications = async (params?: { limit?: number; offset?: number; unread_only?: boolean }): Promise<Notification[]> => {
  const response = await api.get<Notification[]>('/notifications', { params });
  return response.data;
};

export const getUnreadCount = async (): Promise<NotificationCount> => {
  const response = await api.get<NotificationCount>('/notifications/unread/count');
  return response.data;
};

export const markAllAsRead = async (): Promise<void> => {
  await api.post('/notifications/read-all');
};

export const markAsRead = async (notificationId: number): Promise<void> => {
  await api.post(`/notifications/${notificationId}/read`);
};

export const deleteNotification = async (notificationId: number): Promise<void> => {
  await api.delete(`/notifications/${notificationId}`);
};

export const getNotificationSettings = async () => {
  const response = await api.get('/profile/me/notifications');
  return response.data;
};

export const updateNotificationSettings = async (settings: Record<string, boolean> | object) => {
  const response = await api.put('/profile/me/notifications', settings);
  return response.data;
};
