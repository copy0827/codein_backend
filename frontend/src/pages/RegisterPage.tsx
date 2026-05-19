import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { User, Mail, Lock, GraduationCap, BookOpen, Users, Eye, EyeOff, Check, X } from 'lucide-react';
import Navbar from '../components/layout/Navbar';
import toast from 'react-hot-toast';

interface PasswordStrength {
  score: number;
  label: string;
  color: string;
}

const RegisterPage: React.FC = () => {
  const { register, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, authLoading, navigate]);
  const year = new Date().getFullYear();
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    student_id: '',
    major: '',
    generation: '',
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    

    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const getPasswordStrength = (password: string): PasswordStrength => {
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;

    if (score <= 1) return { score, label: '약함', color: 'bg-red-500' };
    if (score <= 2) return { score, label: '보통', color: 'bg-yellow-500' };
    if (score <= 3) return { score, label: '강함', color: 'bg-blue-500' };
    return { score, label: '매우 강함', color: 'bg-green-500' };
  };

  const passwordStrength = getPasswordStrength(formData.password);
  const passwordsMatch = formData.password === formData.confirmPassword && formData.confirmPassword !== '';

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.email) {
      newErrors.email = '이메일을 입력해주세요';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = '올바른 이메일 형식이 아닙니다';
    }

    if (!formData.password) {
      newErrors.password = '비밀번호를 입력해주세요';
    } else if (formData.password.length < 8) {
      newErrors.password = '비밀번호는 8자 이상이어야 합니다';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = '비밀번호 확인을 입력해주세요';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = '비밀번호가 일치하지 않습니다';
    }

    if (!formData.name) {
      newErrors.name = '이름을 입력해주세요';
    }

    if (!formData.student_id) {
      newErrors.student_id = '학번을 입력해주세요';
    }

    if (!formData.major) {
      newErrors.major = '전공을 입력해주세요';
    }

    if (!formData.generation) {
      newErrors.generation = '기수를 입력해주세요';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      await register({
        email: formData.email,
        password: formData.password,
        name: formData.name,
        student_id: formData.student_id,
        major: formData.major,
        generation: formData.generation,
      });
      toast.success('가입 신청이 완료되었습니다!');
      navigate('/register/complete');
    } catch (error) {
      const errorMessage = '회원가입에 실패했습니다. 다시 시도해주세요.';
      if (error && typeof error === 'object' && 'response' in error) {
        const response = (error as { response?: { status?: number; data?: { detail?: unknown } } }).response;
        const details = response?.data?.detail;
        if (response?.status === 422 && Array.isArray(details)) {
          const fieldErrors: Record<string, string> = {};
          details.forEach(detail => {
            if (detail && typeof detail === 'object' && 'loc' in detail && 'msg' in detail) {
              const location = (detail as { loc?: unknown; msg?: string }).loc;
              if (Array.isArray(location)) {
                const field = location[location.length - 1];
                if (typeof field === 'string') {
                  const rawMessage = (detail as { msg?: string }).msg || '';
                  if (field === 'email') {
                    fieldErrors[field] = '유효하지 않은 이메일입니다.';
                  } else if (rawMessage.includes('field required')) {
                    fieldErrors[field] = '필수 입력값입니다.';
                  } else {
                    fieldErrors[field] = '유효하지 않은 값입니다.';
                  }
                }
              }
            }
          });
          if (Object.keys(fieldErrors).length > 0) {
            setErrors(fieldErrors);
            toast.error('입력 값을 확인해주세요.');
            return;
          }
        }
      }
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="min-h-screen text-dark-text flex flex-col">
      <Navbar onMenuClick={() => {}} />
      <main className="flex-1 flex items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-md space-y-6">

          <div className="text-center">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-deep to-brand-light flex items-center justify-center mb-4 shadow-lg shadow-brand/30">
              <Users className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-dark-text">
              회원가입
            </h2>
            <p className="mt-2 text-sm text-dark-muted">
              CodeIn에 가입하여 동아리 활동을 시작하세요
            </p>
          </div>


          <form className="space-y-5" onSubmit={handleSubmit}>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-dark-muted mb-1.5">
                이메일
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-dark-muted" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className={`block w-full rounded-xl border ${errors.email ? 'border-red-500' : 'border-dark-line'} bg-dark-cardSoft py-3 pl-10 pr-4 text-dark-text placeholder:text-dark-muted focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand sm:text-sm transition-colors`}
                  placeholder="example@email.com"
                  value={formData.email}
                  onChange={handleChange}
                />
              </div>
              {errors.email && (
                <p className="mt-1.5 text-xs text-red-400">{errors.email}</p>
              )}
            </div>


            <div>
              <label htmlFor="password" className="block text-sm font-medium text-dark-muted mb-1.5">
                비밀번호
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-dark-muted" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  className={`block w-full rounded-xl border ${errors.password ? 'border-red-500' : 'border-dark-line'} bg-dark-cardSoft py-3 pl-10 pr-12 text-dark-text placeholder:text-dark-muted focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand sm:text-sm transition-colors`}
                  placeholder="8자 이상 입력"
                  value={formData.password}
                  onChange={handleChange}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-dark-muted hover:text-dark-text transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {formData.password && (
                <div className="mt-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-dark-line rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${passwordStrength.color} transition-all duration-300`}
                        style={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-dark-muted">{passwordStrength.label}</span>
                  </div>
                </div>
              )}
              {errors.password && (
                <p className="mt-1.5 text-xs text-red-400">{errors.password}</p>
              )}
            </div>


            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-dark-muted mb-1.5">
                비밀번호 확인
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-dark-muted" />
                </div>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  className={`block w-full rounded-xl border ${errors.confirmPassword ? 'border-red-500' : formData.confirmPassword ? (passwordsMatch ? 'border-green-500' : 'border-red-500') : 'border-dark-line'} bg-dark-cardSoft py-3 pl-10 pr-12 text-dark-text placeholder:text-dark-muted focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand sm:text-sm transition-colors`}
                  placeholder="비밀번호를 다시 입력"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center gap-2">
                  {formData.confirmPassword && (
                    passwordsMatch ? (
                      <Check className="h-5 w-5 text-green-500" />
                    ) : (
                      <X className="h-5 w-5 text-red-500" />
                    )
                  )}
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="text-dark-muted hover:text-dark-text transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
              {errors.confirmPassword && (
                <p className="mt-1.5 text-xs text-red-400">{errors.confirmPassword}</p>
              )}
              {!errors.confirmPassword && formData.confirmPassword && !passwordsMatch && (
                <p className="mt-1.5 text-xs text-red-400">비밀번호가 일치하지 않습니다.</p>
              )}
            </div>


            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-dark-line"></div>
              </div>
              <div className="relative z-10 flex justify-center text-xs uppercase">
                <span className="px-4 text-dark-muted bg-dark-bg">개인 정보</span>
              </div>
            </div>


            <div>
              <label htmlFor="name" className="block text-sm font-medium text-dark-muted mb-1.5">
                이름
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-dark-muted" />
                </div>
                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  required
                  className={`block w-full rounded-xl border ${errors.name ? 'border-red-500' : 'border-dark-line'} bg-dark-cardSoft py-3 pl-10 pr-4 text-dark-text placeholder:text-dark-muted focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand sm:text-sm transition-colors`}
                  placeholder="홍길동"
                  value={formData.name}
                  onChange={handleChange}
                />
              </div>
              {errors.name && (
                <p className="mt-1.5 text-xs text-red-400">{errors.name}</p>
              )}
            </div>


            <div className="grid grid-cols-2 gap-4">

              <div>
                <label htmlFor="student_id" className="block text-sm font-medium text-dark-muted mb-1.5">
                  학번
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <GraduationCap className="h-5 w-5 text-dark-muted" />
                  </div>
                  <input
                    id="student_id"
                    name="student_id"
                    type="text"
                    required
                    className={`block w-full rounded-xl border ${errors.student_id ? 'border-red-500' : 'border-dark-line'} bg-dark-cardSoft py-3 pl-10 pr-4 text-dark-text placeholder:text-dark-muted focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand sm:text-sm transition-colors`}
                    placeholder="20231234"
                    value={formData.student_id}
                    onChange={handleChange}
                  />
                </div>
                {errors.student_id && (
                  <p className="mt-1.5 text-xs text-red-400">{errors.student_id}</p>
                )}
              </div>


              <div>
                <label htmlFor="generation" className="block text-sm font-medium text-dark-muted mb-1.5">
                  기수
                </label>
                <input
                  id="generation"
                  name="generation"
                  type="number"
                  min="1"
                  required
                  className={`block w-full rounded-xl border ${errors.generation ? 'border-red-500' : 'border-dark-line'} bg-dark-cardSoft py-3 px-4 text-dark-text focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand sm:text-sm transition-colors`}
                  placeholder="1"
                  value={formData.generation}
                  onChange={handleChange}
                />
                {errors.generation && (
                  <p className="mt-1.5 text-xs text-red-400">{errors.generation}</p>
                )}
              </div>
            </div>


            <div>
              <label htmlFor="major" className="block text-sm font-medium text-dark-muted mb-1.5">
                전공
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <BookOpen className="h-5 w-5 text-dark-muted" />
                </div>
                <input
                  id="major"
                  name="major"
                  type="text"
                  required
                  className={`block w-full rounded-xl border ${errors.major ? 'border-red-500' : 'border-dark-line'} bg-dark-cardSoft py-3 pl-10 pr-4 text-dark-text placeholder:text-dark-muted focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand sm:text-sm transition-colors`}
                  placeholder="컴퓨터공학과"
                  value={formData.major}
                  onChange={handleChange}
                />
              </div>
              {errors.major && (
                <p className="mt-1.5 text-xs text-red-400">{errors.major}</p>
              )}
            </div>


            <button
              type="submit"
              disabled={isLoading}
              className="group relative flex w-full justify-center rounded-xl bg-gradient-to-r from-brand-deep to-brand px-3 py-3.5 text-sm font-semibold text-white hover:from-brand hover:to-brand-light transition-all duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand shadow-lg shadow-brand/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>가입 중...</span>
                </div>
              ) : (
                '회원가입'
              )}
            </button>
          </form>


          <div className="text-center text-sm text-dark-muted">
            이미 계정이 있나요?{' '}
            <Link to="/login" className="font-semibold text-brand-light hover:text-brand transition-colors">
              로그인
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

export default RegisterPage;
