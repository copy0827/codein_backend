import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { 
  Bell, 
  MessageSquare, 
  Heart, 
  UserPlus, 
  AlertTriangle, 
  CheckCircle, 
  Trash2,
  Trophy,
  Code
} from 'lucide-react';
import type { Notification } from '../../types/notification';

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead?: (id: number) => void;
  onDelete?: (id: number) => void;
  compact?: boolean; // For dropdown view
}

const getIcon = (type: string) => {
  switch (type) {
    case 'comment':
    case 'reply':
      return <MessageSquare className="w-4 h-4 text-blue-400" />;
    case 'like':
      return <Heart className="w-4 h-4 text-pink-500" />;
    case 'follow':
      return <UserPlus className="w-4 h-4 text-green-400" />;
    case 'warning':
      return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
    case 'error':
      return <AlertTriangle className="w-4 h-4 text-red-500" />;
    case 'success':
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    case 'contest':
    case 'grade':
      return <Trophy className="w-4 h-4 text-purple-400" />;
    case 'code':
      return <Code className="w-4 h-4 text-cyan-400" />;
    default:
      return <Bell className="w-4 h-4 text-gray-400" />;
  }
};

const NotificationItem: React.FC<NotificationItemProps> = ({ 
  notification, 
  onMarkAsRead, 
  onDelete,
  compact = false 
}) => {
  const handleClick = (e: React.MouseEvent) => {
    if (notification.link) {
      // If there is a link, let the anchor tag handle it, but also mark as read
      if (!notification.is_read && onMarkAsRead) {
        onMarkAsRead(notification.id);
      }
    } else {
      e.preventDefault();
      if (!notification.is_read && onMarkAsRead) {
        onMarkAsRead(notification.id);
      }
    }
  };

  const Container = notification.link ? 'a' : 'div';
  const containerProps = notification.link ? { href: notification.link } : {};

  return (
    <div 
      className={`relative group flex items-start gap-3 p-4 border-b border-dark-line transition-colors hover:bg-dark-nav ${
        !notification.is_read ? 'bg-brand-deep/5' : ''
      }`}
    >
      <div className="mt-1 shrink-0">
        {getIcon(notification.notification_type)}
      </div>
      
      <Container 
        {...containerProps}
        onClick={handleClick}
        className="flex-1 min-w-0 cursor-pointer"
      >
        <div className="flex justify-between items-start gap-2">
          <p className={`text-sm text-white ${!notification.is_read ? 'font-medium' : ''}`}>
            {notification.message}
          </p>
          {!compact && (
            <span className="text-xs text-dark-muted whitespace-nowrap shrink-0">
              {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: ko })}
            </span>
          )}
        </div>
        {compact && (
          <p className="text-xs text-dark-muted mt-1">
            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: ko })}
          </p>
        )}
      </Container>

      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        {!notification.is_read && onMarkAsRead && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onMarkAsRead(notification.id);
            }}
            className="p-1 text-brand hover:text-brand-light rounded-full hover:bg-dark-bg transition-colors"
            title="Mark as read"
          >
            <div className="w-2 h-2 rounded-full bg-brand" />
          </button>
        )}
        
        {onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onDelete(notification.id);
            }}
            className="p-1.5 text-dark-muted hover:text-red-400 rounded-lg hover:bg-dark-bg transition-colors"
            title="Delete notification"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
      
      {!notification.is_read && !compact && (
        <div className="absolute right-4 top-4 w-2 h-2 rounded-full bg-brand md:hidden" />
      )}
    </div>
  );
};

export default NotificationItem;
