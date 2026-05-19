import React, { useRef, useEffect, useState } from 'react';
import { Bell, Check, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useNotifications } from '../../hooks/useNotifications';
import NotificationItem from './NotificationItem';

const NotificationDropdown: React.FC = () => {
  const { 
    notifications, 
    unreadCount, 
    markAsRead, 
    markAllAsRead, 
    deleteNotification 
  } = useNotifications();
  
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleDropdown = () => setIsOpen(!isOpen);

  // Show only recent 5 notifications in dropdown
  const recentNotifications = notifications.slice(0, 5);

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        type="button" 
        onClick={toggleDropdown}
        className="hidden lg:flex items-center justify-center p-2 text-dark-muted rounded-full hover:bg-dark-nav hover:text-white transition-colors relative focus:outline-none"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full animate-pulse ring-2 ring-dark-nav"></span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.35)] border border-dark-line overflow-hidden origin-top-right z-50 bg-[#0B1220] animate-in fade-in zoom-in-95 duration-200">
          <div className="px-4 py-3 border-b border-dark-line flex justify-between items-center bg-[#101D33]">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white">Notifications</h3>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] font-bold bg-brand-deep/20 text-brand rounded-full">
                  {unreadCount}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button 
                type="button"
                onClick={() => markAllAsRead()}
                className="text-xs text-brand hover:text-brand-light flex items-center gap-1 transition-colors"
              >
                <Check className="w-3 h-3" /> Mark all read
              </button>
            )}
          </div>
          
          <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
            {notifications.length === 0 ? (
              <div className="p-8 text-center flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-dark-nav flex items-center justify-center text-dark-muted">
                  <Bell className="w-6 h-6" />
                </div>
                <p className="text-dark-muted text-sm">No notifications yet</p>
              </div>
            ) : (
              <>
                {recentNotifications.map((notif) => (
                  <NotificationItem
                    key={notif.id}
                    notification={notif}
                    onMarkAsRead={markAsRead}
                    onDelete={deleteNotification}
                    compact={true}
                  />
                ))}
              </>
            )}
          </div>
          
          <div className="p-2 border-t border-dark-line bg-dark-cardSoft/50 backdrop-blur-sm">
            <Link 
              to="/notifications" 
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-center gap-2 w-full py-2 text-sm text-dark-muted hover:text-white hover:bg-dark-nav rounded-xl transition-all"
            >
              View all notifications
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationDropdown;
