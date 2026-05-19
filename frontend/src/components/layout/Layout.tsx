import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import MobileMenu from './MobileMenu';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const isHome = location.pathname === '/';
  const year = new Date().getFullYear();

  return (
    <div className="min-h-screen text-dark-text flex flex-col">
      <Navbar onMenuClick={() => setMobileMenuOpen(true)} />
      <MobileMenu isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />

      <div className={`flex-1 transition-all duration-300 ${isHome ? '' : 'px-3 py-4 sm:p-4 lg:p-8'}`}>
        <div className={isHome ? 'animate-in fade-in slide-in-from-bottom-4 duration-500' : 'max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500'}>
          {children}
        </div>
      </div>
      <footer className="border-t border-dark-line bg-dark-nav/60 backdrop-blur-md">
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <div className="text-dark-text font-semibold">CodeIn</div>
            <div className="text-xs text-dark-muted">동아리 웹사이트</div>
          </div>
          <div className="text-xs text-dark-muted">{year} · Made by 윤재훈, 이동준, 김지민, 송영빈, 황재모</div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
