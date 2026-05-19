import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  getNotifications, 
  getUnreadCount, 
  markAsRead as markAsReadApi, 
  markAllAsRead as markAllAsReadApi, 
  deleteNotification as deleteNotificationApi 
} from '../api/notifications';
import type { Notification } from '../types/notification';
import toast from 'react-hot-toast';

export const useNotifications = () => {
  const { user, isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  
  // Ref to keep track of connection status to prevent double connections
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);

  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      setIsLoading(true);
      const [notifs, countData] = await Promise.all([
        getNotifications({ limit: 20 }),
        getUnreadCount()
      ]);
      setNotifications(notifs);
      setUnreadCount(countData.count);
    } catch (error) {
      console.error('Failed to fetch notifications', error);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  const markAsRead = useCallback(async (id: number) => {
    try {
      await markAsReadApi(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark as read', error);
      toast.error('Failed to mark as read');
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      await markAllAsReadApi();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
      toast.success('All notifications marked as read');
    } catch (error) {
      console.error('Failed to mark all as read', error);
      toast.error('Failed to mark all as read');
    }
  }, []);

  const deleteNotification = useCallback(async (id: number) => {
    try {
      await deleteNotificationApi(id);
      setNotifications(prev => {
        const target = prev.find(n => n.id === id);
        if (target && !target.is_read) {
          setUnreadCount(c => Math.max(0, c - 1));
        }
        return prev.filter(n => n.id !== id);
      });
      toast.success('Notification deleted');
    } catch (error) {
      console.error('Failed to delete notification', error);
      toast.error('Failed to delete notification');
    }
  }, []);

  // SSE Connection
  useEffect(() => {
    if (!isAuthenticated || !user) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      return;
    }

    // Initial fetch
    fetchNotifications();

    const connectSSE = () => {
      // Get token from localStorage directly as it might not be in user object
      const token = localStorage.getItem('access_token');
      if (!token) return;

      // Close existing connection if any
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      // Use absolute URL if needed, or relative if proxy handles it.
      // Assuming relative path works with Vite proxy, but SSE often needs full URL if on different port.
      // Based on axios config (implied), backend is on same origin or proxied.
      // Let's try relative path first.
      const url = `/api/v1/notifications/stream?token=${token}`;
      
      const eventSource = new EventSource(url);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        reconnectAttemptsRef.current = 0;
        console.log('SSE Connected');
      };

      eventSource.addEventListener('notification', (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Construct full notification object from partial SSE data
          const newNotification: Notification = {
            id: data.id,
            user_id: user.id, // We know it's for current user
            notification_type: data.notification_type,
            title: data.title,
            message: data.message,
            link: data.link || null,
            is_read: false,
            read_at: null,
            created_at: data.created_at,
            related_type: null,
            related_id: null
          };

          setNotifications(prev => [newNotification, ...prev]);
          setUnreadCount(prev => prev + 1);
          
          // Optional: Show toast for new notification
          toast(data.message, {
            icon: '🔔',
            duration: 4000,
            position: 'top-right'
          });
          
        } catch (err) {
          console.error('Error parsing notification event', err);
        }
      });

      eventSource.onerror = (err) => {
        console.error('SSE Error', err);
        eventSource.close();
        eventSourceRef.current = null;
        
        reconnectAttemptsRef.current += 1;
        if (reconnectAttemptsRef.current > 6) {
          console.warn('SSE reconnect stopped after max attempts');
          return;
        }

        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(() => {
          if (isAuthenticated && localStorage.getItem('access_token')) connectSSE();
        }, 5000);
      };
    };

    connectSSE();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [isAuthenticated, user, fetchNotifications]);

  return {
    notifications,
    unreadCount,
    isLoading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification
  };
};
