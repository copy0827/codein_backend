import { Link } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import Navbar from '../components/layout/Navbar';

const RegisterCompletePage: React.FC = () => {
  const year = new Date().getFullYear();

  return (
    <div className="min-h-screen text-dark-text flex flex-col">
      <Navbar onMenuClick={() => {}} />
      <main className="flex-1 flex items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-deep to-brand-light flex items-center justify-center shadow-lg shadow-brand/30">
            <CheckCircle className="w-8 h-8 text-white" />
          </div>
          <div className="space-y-2">
            <h2 className="text-3xl font-bold tracking-tight text-dark-text">가입 신청 완료</h2>
            <p className="text-sm text-dark-muted">
              관리자 승인 후 로그인할 수 있습니다.
            </p>
            <p className="text-xs text-dark-muted">
              승인이 완료되면 로그인 페이지에서 바로 접속해주세요.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <Link
              to="/login"
              className="flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-brand-deep to-brand px-3 py-3.5 text-sm font-semibold text-white hover:from-brand hover:to-brand-light transition-all duration-300 shadow-lg shadow-brand/30"
            >
              로그인 페이지로 이동
            </Link>
            <Link
              to="/"
              className="flex w-full items-center justify-center rounded-xl border border-dark-line bg-dark-cardSoft px-3 py-3.5 text-sm font-semibold text-dark-text hover:border-brand hover:text-brand-light transition-all duration-300"
            >
              홈으로 돌아가기
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
          <div className="text-xs text-dark-muted">{year} · Built with React</div>
        </div>
      </footer>
    </div>
  );
};

export default RegisterCompletePage;
