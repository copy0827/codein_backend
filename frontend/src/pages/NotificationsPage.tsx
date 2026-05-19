import React, { useEffect, useState } from 'react';
import { Check, Bell } from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';
import NotificationItem from '../components/notifications/NotificationItem';
import { getNotifications } from '../api/notifications';
import type { Notification } from '../types/notification';

const NotificationsPage: React.FC = () => {
  const { 
    notifications: liveNotifications, // Use live notifications for initial state or sync?
    unreadCount, 
    markAsRead, 
    markAllAsRead, 
    deleteNotification 
  } = useNotifications();

  // Local state for full list management
  const [allNotifications, setAllNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const LIMIT = 20;

  // Sync live notifications with local state
  useEffect(() => {
    // When live notifications change (e.g. new SSE event), 
    // we might want to prepend them to our list if they aren't already there.
    // However, simplest is to just fetch initially and let user reload for history,
    // BUT we should respect the "Real-time" aspect.
    // Let's just merge live ones that are newer than our list.
    if (liveNotifications.length > 0) {
        setAllNotifications(prev => {
            const newNotifs = liveNotifications.filter(ln => !prev.some(p => p.id === ln.id));
            if (newNotifs.length > 0) {
                return [...newNotifs, ...prev];
            }
            return prev;
        });
    }
  }, [liveNotifications]);

  // Fetch full list
  useEffect(() => {
    const fetchAll = async () => {
      try {
        setIsLoading(true);
        const data = await getNotifications({ 
          limit: LIMIT, 
          offset: (page - 1) * LIMIT,
          unread_only: filter === 'unread'
        });
        
        if (page === 1) {
          setAllNotifications(data);
        } else {
          setAllNotifications(prev => [...prev, ...data]);
        }
        
        setHasMore(data.length === LIMIT);
      } catch (error) {
        console.error('Failed to fetch notifications page', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAll();
  }, [page, filter]);

  // Handle local delete to update UI immediately
  const handleDelete = async (id: number) => {
    await deleteNotification(id);
    setAllNotifications(prev => prev.filter(n => n.id !== id));
  };

  // Handle local mark as read
  const handleMarkRead = async (id: number) => {
    await markAsRead(id);
    setAllNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  // Handle mark all read
  const handleMarkAllRead = async () => {
    await markAllAsRead();
    setAllNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  return (
    <div className="min-h-screen bg-[#0B1221] text-white pt-24 pb-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold mb-1">알림</h1>
            <p className="text-dark-muted text-sm">
              읽지 않은 알림이 {unreadCount}개 있습니다
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex bg-dark-cardSoft p-1 rounded-xl border border-dark-line">
              <button
                onClick={() => { setFilter('all'); setPage(1); }}
                className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${
                  filter === 'all' 
                    ? 'bg-dark-nav text-white shadow-sm' 
                    : 'text-dark-muted hover:text-white'
                }`}
              >
                전체
              </button>
              <button
                onClick={() => { setFilter('unread'); setPage(1); }}
                className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${
                  filter === 'unread' 
                    ? 'bg-dark-nav text-white shadow-sm' 
                    : 'text-dark-muted hover:text-white'
                }`}
              >
                읽지 않음
              </button>
            </div>
            
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-2 px-4 py-2 bg-brand-deep/10 text-brand hover:bg-brand-deep/20 rounded-xl transition-colors text-sm font-medium border border-brand-deep/20"
              >
                <Check className="w-4 h-4" />
                <span className="hidden sm:inline">모두 읽음</span>
              </button>
            )}
          </div>
        </div>

        {/* List */}
        <div className="bg-dark-cardSoft border border-dark-line rounded-2xl overflow-hidden shadow-xl">
          {isLoading && page === 1 ? (
            <div className="p-12 text-center">
              <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-dark-muted">알림을 불러오는 중...</p>
            </div>
          ) : allNotifications.length === 0 ? (
            <div className="p-16 text-center flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-dark-nav flex items-center justify-center text-dark-muted">
                <Bell className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-white mb-1">알림이 없습니다</h3>
                <p className="text-dark-muted">새로운 알림이 오면 여기에 표시됩니다.</p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-dark-line">
              {allNotifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkAsRead={handleMarkRead}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
          
          {hasMore && allNotifications.length > 0 && (
            <div className="p-4 bg-dark-nav/50 border-t border-dark-line text-center">
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={isLoading}
                className="text-sm text-dark-muted hover:text-white transition-colors disabled:opacity-50"
              >
                {isLoading ? '로딩중...' : '더 보기'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationsPage;
