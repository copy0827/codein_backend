import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import Navbar from '../components/layout/Navbar';
import toast from 'react-hot-toast';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState('');
  const { login, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = (location.state as { from?: string } | null)?.from || '/';
  const year = new Date().getFullYear();

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate(redirectTo, { replace: true });
    }
  }, [isAuthenticated, authLoading, navigate, redirectTo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setFormError('');
      const emailTrimmed = email.trim();
      if (!emailTrimmed || !password.trim()) {
        setFormError('이메일과 비밀번호를 모두 입력해주세요.');
        toast.error('이메일과 비밀번호를 모두 입력해주세요.');
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
        setFormError('유효한 이메일 형식으로 입력해주세요.');
        toast.error('유효한 이메일 형식으로 입력해주세요.');
        return;
      }
      await login({ email: emailTrimmed, password });
      navigate(redirectTo, { replace: true });
    } catch (error) {
      setFormError('로그인에 실패했습니다. 이메일/비밀번호를 확인해주세요.');
      toast.error('로그인에 실패했습니다. 이메일/비밀번호를 확인해주세요.');
    }
  };

  return (
    <div className="min-h-screen text-dark-text flex flex-col">
      <Navbar onMenuClick={() => {}} />
      <main className="flex-1 flex items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-md space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-dark-text">
            계정 로그인
          </h2>
          <p className="mt-2 text-center text-sm text-dark-muted">
            아직 계정이 없나요?{' '}
            <Link to="/register" className="font-medium text-brand-light hover:text-brand">
              새 계정 만들기
            </Link>
          </p>
        </div>
                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="-space-y-px rounded-md shadow-sm">
            <div>
              <label htmlFor="email-address" className="sr-only">
                이메일
              </label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="relative block w-full rounded-t-xl border border-dark-line bg-dark-cardSoft py-3 text-dark-text placeholder:text-dark-muted focus:z-10 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand sm:text-sm sm:leading-6 pl-4"
                placeholder="이메일"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                비밀번호
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="relative block w-full rounded-b-xl border border-t-0 border-dark-line bg-dark-cardSoft py-3 text-dark-text placeholder:text-dark-muted focus:z-10 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand sm:text-sm sm:leading-6 pl-4"
                placeholder="비밀번호"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {formError && (
            <div className="rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{formError}</div>
          )}

          <div>
            <button
              type="submit"
              className="group relative flex w-full justify-center rounded-xl bg-brand px-3 py-3 text-sm font-semibold hover:bg-brand-light transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand shadow-lg shadow-brand/20 text-dark-text"
            >
              로그인
            </button>
          </div>
        </form>
        <div className="text-center text-sm text-dark-muted">
          아직 계정이 없나요?{' '}
          <Link to="/register" className="font-semibold text-brand-light hover:text-brand">
            회원가입
          </Link>
        </div>
      </div>
    </main>
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

export default LoginPage;
