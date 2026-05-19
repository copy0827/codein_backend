import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  MessageSquare, 
  Calendar as CalendarIcon, 
  Image as ImageIcon, 
  QrCode, 
  User 
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const location = useLocation();
  const { user } = useAuth();

  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Boards', href: '/boards', icon: MessageSquare },
    { name: 'Gallery', href: '/gallery', icon: ImageIcon },
    { name: 'Calendar', href: '/events', icon: CalendarIcon },
    { name: 'Check-in', href: '/check-in', icon: QrCode },
    { name: 'Profile', href: '/profile', icon: User },
  ];

  const isActive = (path: string) => {
    if (path === '/' && location.pathname !== '/') return false;
    return location.pathname.startsWith(path);
  };

  return (
    <>
      {/* Mobile Backdrop */}
      <div 
        className={`fixed inset-0 bg-gray-900/50 backdrop-blur-sm transition-opacity lg:hidden z-40 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Sidebar */}
      <aside 
        className={`fixed top-16 left-0 z-40 w-64 h-[calc(100vh-4rem)] pt-6 transition-transform duration-300 bg-dark-bg/80 backdrop-blur-md border-r border-dark-line lg:hidden ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-full px-3 pb-4 overflow-y-auto custom-scrollbar">
          {/* User Info (Mobile Only) */}
          <div className="lg:hidden px-3 mb-6">
            <div className="flex items-center gap-3 p-3 bg-dark-cardSoft rounded-xl border border-dark-line">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand to-brand-light flex items-center justify-center text-white">
                {user?.profile_image ? (
                  <img src={user.profile_image} alt={user.name} className="w-full h-full rounded-full object-cover" />
                ) : (
                  <User className="w-5 h-5" />
                )}
              </div>
              <div className="overflow-hidden">
                <p className="text-sm font-semibold text-dark-text truncate">{user?.name}</p>
                <p className="text-xs text-dark-muted truncate">{user?.email}</p>
              </div>
            </div>
          </div>

          <ul className="space-y-1">
            {navigation.map((item) => {
              const active = isActive(item.href);
              return (
                <li key={item.name}>
                  <NavLink
                    to={item.href}
                    onClick={() => {
                      if (window.innerWidth < 1024) onClose();
                    }}
                    className={`flex items-center p-3 text-base font-medium rounded-xl group transition-all duration-200 ${
                      active 
                        ? 'bg-gradient-to-br from-brand-deep to-brand text-white shadow-lg shadow-brand/20 border border-white/10' 
                        : 'text-dark-muted hover:bg-dark-nav hover:text-white'
                    }`}
                  >
                    <item.icon className={`w-5 h-5 transition-colors duration-200 ${
                      active ? 'text-white' : 'text-dark-muted group-hover:text-white'
                    }`} />
                    <span className="ml-3">{item.name}</span>
                  </NavLink>
                </li>
              );
            })}
          </ul>

          {/* Bottom Section */}
          <div className="absolute bottom-0 left-0 w-full p-4">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-brand-deep to-brand text-white shadow-lg border border-white/10">
              <h4 className="font-semibold text-sm mb-1">Need Help?</h4>
              <p className="text-xs text-indigo-100 mb-3">Check our documentation or contact support.</p>
              <button className="w-full py-2 px-3 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-medium transition-colors backdrop-blur-sm border border-white/10">
                Contact Support
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
