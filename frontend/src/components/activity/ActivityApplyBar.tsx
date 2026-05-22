import React from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Send } from 'lucide-react';
import Card from '../ui/Card';

interface ActivityApplyBarProps {
  message: string;
  onMessageChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isPending: boolean;
  isAuthenticated: boolean;
  disabled?: boolean;
  loginReturnPath: string;
}

/**
 * 상세 페이지 하단 한 줄 신청 입력 + 버튼.
 * 비로그인 시 disabled + 안내 문구.
 */
const ActivityApplyBar: React.FC<ActivityApplyBarProps> = ({
  message,
  onMessageChange,
  onSubmit,
  isPending,
  isAuthenticated,
  disabled = false,
  loginReturnPath,
}) => {
  const formDisabled = !isAuthenticated || disabled || isPending;

  return (
    <Card padding="md" className="mb-8">
      <h3 className="text-lg font-bold text-gray-900 mb-2">활동 신청</h3>
      {!isAuthenticated && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
          로그인 후 신청 가능합니다.{' '}
          <Link
            to="/login"
            state={{ from: loginReturnPath }}
            className="font-semibold text-blue-600 hover:underline"
          >
            로그인하기
          </Link>
        </p>
      )}
      <form onSubmit={onSubmit} className="flex flex-col sm:flex-row gap-2 sm:items-stretch">
        <input
          type="text"
          value={message}
          onChange={(e) => onMessageChange(e.target.value)}
          disabled={formDisabled}
          placeholder={
            isAuthenticated
              ? '한 줄 신청 메시지 (참여 동기, 가능 시간 등)'
              : '로그인 후 신청 가능합니다'
          }
          className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
          aria-disabled={formDisabled}
        />
        <button
          type="submit"
          disabled={formDisabled}
          className="inline-flex items-center justify-center gap-2 shrink-0 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-6 rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-600"
        >
          {isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          신청하기
        </button>
      </form>
    </Card>
  );
};

export default ActivityApplyBar;
