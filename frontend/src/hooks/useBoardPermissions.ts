import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import type { ShowcaseDetail, ShowcaseListItem } from '../types/board';

const ADMIN_ROLES = ['admin', 'superadmin'] as const;

export const useBoardPermissions = () => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  const isAdmin = useMemo(
    () => !!user && ADMIN_ROLES.includes(user.role as (typeof ADMIN_ROLES)[number]),
    [user],
  );

  const canWrite = useMemo(() => isAuthenticated && !!user, [isAuthenticated, user]);

  const canManagePost = useCallback(
    (post: ShowcaseListItem | ShowcaseDetail | { author_id: number }) => {
      if (!user) return false;
      return post.author_id === user.id || isAdmin;
    },
    [user, isAdmin],
  );

  /** 비로그인: 읽기만. 쓰기 시도 시 로그인 유도 */
  const requireAuthForWrite = useCallback(
    (message = '글쓰기는 로그인 후 이용할 수 있습니다.') => {
      if (isLoading) return false;
      if (!isAuthenticated) {
        toast.error(message);
        navigate('/login');
        return false;
      }
      return true;
    },
    [isAuthenticated, isLoading, navigate],
  );

  return {
    user,
    isAuthenticated,
    isLoading,
    isAdmin,
    canWrite,
    canManagePost,
    requireAuthForWrite,
  };
};
