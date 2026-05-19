import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import { Bell, LogOut, Search, Sun, Moon } from 'lucide-react';
import { useTheme } from '../../App';
import { useAuth } from '../../context/AuthContext';

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

const MobileMenu: React.FC<MobileMenuProps> = ({ isOpen, onClose }) => {
  const { user, logout, isAuthenticated } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const canAccessAdmin = isAuthenticated && user && ['staff', 'admin', 'superadmin'].includes(user.role);

  return (
    <>
        <button
          type="button"
          aria-label="Close menu"
          className={`lg:hidden fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
            isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`} 
          onClick={onClose}
        />
        <div 

        className={`lg:hidden fixed inset-y-0 right-0 z-[9999] h-full w-[280px] bg-dark-bg border-l border-dark-line shadow-2xl flex flex-col px-5 pt-20 pb-6 transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex flex-col gap-1">
          <NavLink to="/search" onClick={onClose} className="px-3 py-3 rounded-xl text-base font-medium text-dark-muted hover:text-dark-text hover:bg-dark-nav transition-colors flex items-center gap-2">
            <Search className="w-5 h-5" />
            검색
          </NavLink>
          <NavLink to="/board?board=notice" onClick={onClose} className="px-3 py-3 rounded-xl text-base font-medium text-dark-muted hover:text-dark-text hover:bg-dark-nav transition-colors">공지</NavLink>
          <NavLink to="/board?board=board" onClick={onClose} className="px-3 py-3 rounded-xl text-base font-medium text-dark-muted hover:text-dark-text hover:bg-dark-nav transition-colors">게시판</NavLink>
          <NavLink to="/events" onClick={onClose} className="px-3 py-3 rounded-xl text-base font-medium text-dark-muted hover:text-dark-text hover:bg-dark-nav transition-colors">캘린더</NavLink>
          <NavLink to="/gallery" onClick={onClose} className="px-3 py-3 rounded-xl text-base font-medium text-dark-muted hover:text-dark-text hover:bg-dark-nav transition-colors">갤러리</NavLink>
          <NavLink to="/contest" onClick={onClose} className="px-3 py-3 rounded-xl text-base font-medium text-dark-muted hover:text-dark-text hover:bg-dark-nav transition-colors">
            코딩테스트
          </NavLink>
          <NavLink to="/contest/history" onClick={onClose} className="px-3 py-3 rounded-xl text-base font-medium text-dark-muted hover:text-dark-text hover:bg-dark-nav transition-colors">제출내역</NavLink>
          <NavLink to="/creators" onClick={onClose} className="px-3 py-3 rounded-xl text-base font-medium text-dark-muted hover:text-dark-text hover:bg-dark-nav transition-colors">만든사람들</NavLink>
          {canAccessAdmin && (
            <NavLink to="/admin" onClick={onClose} className="px-3 py-3 rounded-xl text-base font-medium text-dark-muted hover:text-dark-text hover:bg-dark-nav transition-colors">관리자</NavLink>
          )}
          <NavLink to="/profile" onClick={onClose} className="px-3 py-3 rounded-xl text-base font-medium text-dark-muted hover:text-dark-text hover:bg-dark-nav transition-colors">마이페이지</NavLink>
        </div>

        <div className="mt-auto pt-6 border-t border-dark-line">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleTheme}
              className="flex items-center justify-center w-12 h-12 rounded-xl bg-dark-nav text-dark-muted hover:text-dark-text border border-dark-line transition-colors"
              aria-label="테마 전환"
            >
              {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>
            <button type="button" className="flex items-center justify-center w-12 h-12 rounded-xl bg-dark-nav text-dark-muted hover:text-dark-text border border-dark-line transition-colors" aria-label="알림">
              <Bell className="w-5 h-5" />
            </button>
            {isAuthenticated ? (
              <button
                type="button"
                onClick={() => {
                  logout();
                  onClose();
                }}
                className="flex-1 h-12 flex items-center justify-center gap-2 rounded-xl bg-dark-nav text-base font-medium text-red-400 hover:text-red-300 border border-dark-line transition-colors"
              >
                <LogOut className="w-5 h-5" />
                로그아웃
              </button>
            ) : (
              <Link
                to="/login"
                onClick={onClose}
                className="flex-1 h-12 flex items-center justify-center rounded-xl bg-brand text-white text-base font-semibold hover:bg-brand-light transition-colors"
              >
                로그인
              </Link>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default MobileMenu;
