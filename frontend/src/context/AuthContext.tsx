import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import api from '../api/axios';
import type { User, LoginPayload, RegisterPayload, AuthResponse } from '../types/auth';
import toast from 'react-hot-toast';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (data: LoginPayload) => Promise<void>;
  register: (data: RegisterPayload) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const translateAuthError = (detail: unknown, fallback: string) => {
  if (typeof detail === 'string') {
    if (detail === 'Email exists') return '이미 가입된 이메일입니다.';
    if (detail === 'Invalid credentials') return '이메일 또는 비밀번호가 올바르지 않습니다.';
    if (detail === 'Account pending approval') return '계정 승인이 완료되지 않았습니다.';
    return detail;
  }

  if (Array.isArray(detail)) {
    const firstMessage = detail.find((item: { msg?: string }) => typeof item?.msg === 'string')?.msg;
    if (firstMessage) {
      if (firstMessage.includes('valid email address')) return '유효하지 않은 이메일입니다.';
      if (firstMessage.includes('field required')) return '필수 입력값을 확인해주세요.';
      return '입력 값을 확인해주세요.';
    }
  }

  return fallback;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch (_) {}
    localStorage.removeItem('access_token');
    setUser(null);
    toast.success('Logged out');
  }, []);

  const fetchUser = useCallback(async () => {
    const response = await api.get<User>('/profile/me');
    setUser(response.data);
  }, []);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const token = localStorage.getItem('access_token');
        if (!token) {
          const refresh = await api.post<AuthResponse>('/auth/refresh');
          if (refresh.data?.access_token) {
            localStorage.setItem('access_token', refresh.data.access_token);
          }
        }
        await fetchUser();
      } catch (_) {
        localStorage.removeItem('access_token');
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };
    bootstrap();
  }, [fetchUser]);

  const login = async (data: LoginPayload) => {
    try {
      const response = await api.post<AuthResponse>('/auth/login', data);
      const { access_token } = response.data;
      localStorage.setItem('access_token', access_token);
      toast.success('Login successful!');
      await fetchUser();
    } catch (error: any) {
      const message = translateAuthError(error.response?.data?.detail, '로그인에 실패했습니다.');
      toast.error(message);
      throw error;
    }
  };

  const register = async (data: RegisterPayload) => {
    try {
      await api.post<User>('/auth/register', data);
      toast.success('가입 신청이 완료되었습니다. 승인 후 로그인 가능합니다.');
    } catch (error: any) {
      const message = translateAuthError(error.response?.data?.detail, '회원가입에 실패했습니다.');
      toast.error(message);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
