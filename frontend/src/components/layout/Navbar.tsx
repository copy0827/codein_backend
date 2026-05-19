import { useEffect, useRef, useState } from 'react';
import { Menu, User as UserIcon, LogOut, ChevronDown, Search, Sun, Moon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../App';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import NotificationDropdown from '../notifications/NotificationDropdown';

interface NavbarProps {
  onMenuClick: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ onMenuClick }) => {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const userRef = useRef<HTMLDivElement>(null);

  const canAccessAdmin = isAuthenticated && user && ['staff', 'admin', 'superadmin'].includes(user.role);

  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const targetNode = event.target as Node;
      if (userRef.current && !userRef.current.contains(targetNode)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  return (
    <nav className="bg-dark-nav backdrop-blur-md border-b border-dark-line sticky w-full top-0 z-40 transition-all duration-300">
      <div className="navbar-shell max-w-7xl mx-auto w-full flex items-center justify-between gap-3 px-3 sm:px-5 lg:px-6 py-3">
        
        <div className="flex items-center gap-2.5">
          <Link to="/" className="flex items-center gap-2.5 text-dark-text">
            <div className="legacy-brand-mark">
              <span className="legacy-brand-symbol">⌘</span>
            </div>
            <span className="legacy-brand-name hidden xs:inline">CodeIn</span>
          </Link>
        </div>

        {/* Center: Desktop Navigation */}
        <div className="nav-desktop hidden lg:flex items-center gap-7">
          <NavLink to="/board?board=notice" className="nav-item text-sm font-medium text-dark-muted hover:text-dark-text transition-colors px-2.5 py-2 rounded-xl hover:bg-dark-nav">공지</NavLink>
          <NavLink to="/board?board=board" className="nav-item text-sm font-medium text-dark-muted hover:text-dark-text transition-colors px-2.5 py-2 rounded-xl hover:bg-dark-nav">게시판</NavLink>
          <NavLink to="/events" className="nav-item text-sm font-medium text-dark-muted hover:text-dark-text transition-colors px-2.5 py-2 rounded-xl hover:bg-dark-nav">캘린더</NavLink>
          <NavLink to="/gallery" className="nav-item text-sm font-medium text-dark-muted hover:text-dark-text transition-colors px-2.5 py-2 rounded-xl hover:bg-dark-nav">갤러리</NavLink>
          <NavLink to="/contest" className="nav-item text-sm font-medium text-dark-muted hover:text-dark-text transition-colors px-2.5 py-2 rounded-xl hover:bg-dark-nav">
            코딩테스트
          </NavLink>
          <NavLink to="/contest/history" className="nav-item text-sm font-medium text-dark-muted hover:text-dark-text transition-colors px-2.5 py-2 rounded-xl hover:bg-dark-nav">제출내역</NavLink>
          <NavLink to="/creators" className="nav-item text-sm font-medium text-dark-muted hover:text-dark-text transition-colors px-2.5 py-2 rounded-xl hover:bg-dark-nav">만든사람들</NavLink>
          <NavLink to="/profile" className="nav-item text-sm font-medium text-dark-muted hover:text-dark-text transition-colors px-2.5 py-2 rounded-xl hover:bg-dark-nav">마이페이지</NavLink>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <form onSubmit={handleSearch} className="nav-search hidden md:flex relative group">
             <input 
               type="text" 
               placeholder="검색..." 
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
               className="bg-dark-cardSoft border border-dark-line rounded-xl pl-9 pr-3 py-1.5 text-sm text-dark-text w-40 focus:w-60 transition-all duration-300 focus:outline-none focus:border-brand placeholder-dark-muted"
             />
             <Search className="w-4 h-4 text-dark-muted absolute left-3 top-1/2 -translate-y-1/2 group-focus-within:text-brand transition-colors" />
          </form>

          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 text-dark-muted rounded-lg hover:bg-dark-line focus:outline-none focus:ring-2 focus:ring-dark-line transition-colors"
            aria-label="Toggle theme"
          >
            {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          </button>

          <button
            type="button"
            onClick={onMenuClick}
            className="p-2 text-dark-muted rounded-lg lg:hidden hover:bg-dark-line focus:outline-none focus:ring-2 focus:ring-dark-line"
            aria-label="Toggle menu"
          >
            <Menu className="w-6 h-6" />
          </button>

          {isAuthenticated ? (
            <>
              <NotificationDropdown />

              <div className="relative" ref={userRef}>
                <button 
                  type="button"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex items-center gap-2 p-1.5 rounded-full hover:bg-dark-pill transition-colors border border-transparent hover:border-dark-line focus:outline-none"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand to-brand-light flex items-center justify-center text-white overflow-hidden shadow-lg">
                    {user?.profile_image ? (
                      <img src={user.profile_image} alt={user.name} className="w-full h-full object-cover" />
                    ) : (
                      <UserIcon className="w-4 h-4" />
                    )}
                  </div>
                  <span className="hidden xl:block max-w-[120px] truncate whitespace-nowrap text-sm font-medium text-dark-text">
                    {user?.name || '사용자'}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-dark-muted transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu */}
                {isDropdownOpen && (
                  <div
                    className="absolute right-0 mt-2 w-56 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.35)] border border-dark-line py-1 overflow-hidden origin-top-right transform transition-all duration-200 animate-in fade-in zoom-in-95 z-50 bg-dark-bg"
                    style={{ backgroundColor: 'var(--color-dark-bg)' }}
                  >
                    <div
                      className="px-4 py-3 border-b border-dark-line bg-dark-bg2"
                      style={{ backgroundColor: 'var(--color-dark-bg2)' }}
                    >
                      <p className="text-sm font-medium text-dark-text truncate whitespace-nowrap">{user?.name}</p>
                      <p className="text-xs text-dark-muted truncate">{user?.email}</p>
                    </div>
                    
                    <div className="py-1">
                      <Link 
                        to="/profile" 
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-dark-muted hover:bg-dark-nav hover:text-dark-text transition-colors"
                        onClick={() => setIsDropdownOpen(false)}
                      >
                        <UserIcon className="w-4 h-4" />
                        프로필
                      </Link>
                      {canAccessAdmin && (
                        <>
                          <Link
                            to="/admin"
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-dark-muted hover:bg-dark-nav hover:text-dark-text transition-colors"
                            onClick={() => setIsDropdownOpen(false)}
                          >
                            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-brand/20 text-[10px] font-semibold text-brand">A</span>
                            관리자 대시보드
                          </Link>
                          <Link
                            to="/admin/codetest"
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-dark-muted hover:bg-dark-nav hover:text-dark-text transition-colors"
                            onClick={() => setIsDropdownOpen(false)}
                          >
                            <span className="inline-flex h-4 w-4 items-center justify-center text-[10px] font-semibold text-brand">C</span>
                            코딩테스트 관리
                          </Link>
                          <Link
                            to="/admin/problem-bank"
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-dark-muted hover:bg-dark-nav hover:text-dark-text transition-colors"
                            onClick={() => setIsDropdownOpen(false)}
                          >
                            <span className="inline-flex h-4 w-4 items-center justify-center text-[10px] font-semibold text-brand">P</span>
                            문제은행 관리
                          </Link>
                          <Link
                            to="/admin/reports"
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-dark-muted hover:bg-dark-nav hover:text-dark-text transition-colors"
                            onClick={() => setIsDropdownOpen(false)}
                          >
                            <span className="inline-flex h-4 w-4 items-center justify-center text-[10px] font-semibold text-brand">!</span>
                            신고 관리
                          </Link>
                        </>
                      )}
                    </div>

                    <div className="py-1 border-t border-dark-line">
                      <button
                        type="button"
                        onClick={() => {
                          logout();
                          setIsDropdownOpen(false);
                        }}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-dark-nav transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        로그아웃
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <Link
              to="/login"
              className={`hidden lg:inline-flex px-4 py-2 rounded-xl bg-brand font-semibold hover:bg-brand-light transition-colors ${
                theme === 'light' ? 'text-dark-text' : 'text-white'
              }`}
            >
              로그인
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;

