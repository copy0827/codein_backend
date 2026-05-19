import { createContext, useContext, useEffect, useState, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Toaster } from 'react-hot-toast';
import Layout from './components/layout/Layout';

// Lazy-loaded pages
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const RegisterCompletePage = lazy(() => import('./pages/RegisterCompletePage'));
const HomePage = lazy(() => import('./pages/HomePage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const ActivityPage = lazy(() => import('./pages/ActivityPage'));
const BoardListPage = lazy(() => import('./pages/board/BoardListPage'));
const PostWritePage = lazy(() => import('./pages/board/PostWritePage'));
const PostDetailPage = lazy(() => import('./pages/board/PostDetailPage'));
const GalleryListPage = lazy(() => import('./pages/gallery/GalleryListPage'));
const AlbumDetailPage = lazy(() => import('./pages/gallery/AlbumDetailPage'));
const SharedAlbumPage = lazy(() => import('./pages/gallery/SharedAlbumPage'));
const EventListPage = lazy(() => import('./pages/events/EventListPage'));
const EventDetailPage = lazy(() => import('./pages/events/EventDetailPage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const ContestListPage = lazy(() => import('./pages/codetest/ContestListPage'));
const ContestDetailPage = lazy(() => import('./pages/codetest/ContestDetailPage'));
const ProblemSolvePage = lazy(() => import('./pages/codetest/ProblemSolvePage'));
const PracticePage = lazy(() => import('./pages/codetest/PracticePage'));
const SubmissionHistoryPage = lazy(() => import('./pages/codetest/SubmissionHistoryPage'));
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage'));
const CodetestAdminPage = lazy(() => import('./pages/admin/CodetestAdminPage'));
const CodetestTestDetailPage = lazy(() => import('./pages/admin/CodetestTestDetailPage'));
const ProblemBankAdminPage = lazy(() => import('./pages/admin/ProblemBankAdminPage'));
const ReportsPage = lazy(() => import('./pages/admin/ReportsPage'));
const ReportDetailPage = lazy(() => import('./pages/admin/ReportDetailPage'));
const SearchPage = lazy(() => import('./pages/SearchPage'));
const CreatorsPage = lazy(() => import('./pages/CreatorsPage'));

type Theme = 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[50vh]">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
  </div>
);

const PublicRoute = () => (
  <Layout>
    <Suspense fallback={<PageLoader />}>
      <Outlet />
    </Suspense>
  </Layout>
);

const ProtectedRoute = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  return (
    <Layout>
      <Suspense fallback={<PageLoader />}>
        <Outlet />
      </Suspense>
    </Layout>
  );
};

const AdminRoute = () => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const adminLocation = useLocation();
  const canAccess = user && ['staff', 'admin', 'superadmin'].includes(user.role);

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace state={{ from: adminLocation.pathname + adminLocation.search }} />;
  }

  if (!canAccess) {
    return <Navigate to="/" replace />;
  }

  return (
    <Layout>
      <Suspense fallback={<PageLoader />}>
        <Outlet />
      </Suspense>
    </Layout>
  );
};

function App() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('theme') as Theme) || 'dark';
    }
    return 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.add('light');
    } else {
      root.classList.remove('light');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Suspense fallback={<PageLoader />}><LoginPage /></Suspense>} />
          <Route path="/register" element={<Suspense fallback={<PageLoader />}><RegisterPage /></Suspense>} />
          <Route path="/register/complete" element={<Suspense fallback={<PageLoader />}><RegisterCompletePage /></Suspense>} />

          <Route element={<PublicRoute />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/creators" element={<CreatorsPage />} />
            <Route path="/board" element={<BoardListPage />} />
            <Route path="/boards" element={<Navigate to="/board" replace />} />
            <Route path="/gallery/share/:token" element={<SharedAlbumPage />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/mypage" element={<Navigate to="/profile" replace />} />
            <Route path="/activity" element={<ActivityPage />} />
            
            <Route path="/board/write" element={<PostWritePage />} />
            <Route path="/board/:boardId/post/:postId" element={<PostDetailPage />} />
            <Route path="/contest" element={<ContestListPage />} />
            <Route path="/contest/:testId" element={<ContestDetailPage />} />
            <Route path="/contest/:testId/problem/:problemId" element={<ProblemSolvePage />} />
            <Route path="/contest/history" element={<SubmissionHistoryPage />} />
            <Route path="/practice" element={<PracticePage />} />
            
            <Route path="/gallery" element={<GalleryListPage />} />
            <Route path="/gallery/:albumId" element={<AlbumDetailPage />} />
            
            <Route path="/events" element={<EventListPage />} />
            <Route path="/calendar" element={<Navigate to="/events" replace />} />
            <Route path="/events/:eventId" element={<EventDetailPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/check-in" element={<div className="text-center mt-10">Check-in Page (Coming Soon)</div>} />
          </Route>

          <Route element={<AdminRoute />}>
            <Route path="/admin" element={<AdminDashboardPage />} />
            <Route path="/admin/codetest" element={<CodetestAdminPage />} />
            <Route path="/admin/codetest/tests/:testId" element={<CodetestTestDetailPage />} />
            <Route path="/admin/problem-bank" element={<ProblemBankAdminPage />} />
            <Route path="/admin/reports" element={<ReportsPage />} />
            <Route path="/admin/reports/:reportId" element={<ReportDetailPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
      <Toaster position="top-right" />
    </AuthProvider>
    </ThemeContext.Provider>
  );
}

export default App;
