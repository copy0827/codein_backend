import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { 
  FileText, MessageSquare, Calendar, Code, CheckCircle, 
  TrendingUp, Gift, MinusCircle, Filter, ChevronLeft, ChevronRight,
  History
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getMyHistory, getMyPointsSummary } from '../api/activity';
import type { ActivityLog, PointsSummary } from '../types/activity';
import ActivitySummaryCard from '../components/activity/ActivitySummaryCard';

const ACTIVITY_TYPES = {
  post_create: { icon: FileText, label: '게시글 작성', color: 'text-blue-600 bg-blue-50' },
  comment_create: { icon: MessageSquare, label: '댓글 작성', color: 'text-green-600 bg-green-50' },
  event_attend: { icon: Calendar, label: '일정 참석', color: 'text-purple-600 bg-purple-50' },
  codetest_submit: { icon: Code, label: '코드 제출', color: 'text-orange-600 bg-orange-50' },
  codetest_pass: { icon: CheckCircle, label: '문제 정답', color: 'text-emerald-600 bg-emerald-50' },
  rank_up: { icon: TrendingUp, label: '등급 승격', color: 'text-amber-600 bg-amber-50' },
  admin_grant: { icon: Gift, label: '관리자 지급', color: 'text-pink-600 bg-pink-50' },
  admin_deduct: { icon: MinusCircle, label: '관리자 차감', color: 'text-red-600 bg-red-50' },
};

const ActivityPage: React.FC = () => {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<PointsSummary | null>(null);
  const [history, setHistory] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filterType, setFilterType] = useState<string>('');
  const pageSize = 10;

  const fetchSummary = React.useCallback(async () => {
    try {
      const data = await getMyPointsSummary();
      setSummary(data);
    } catch (error) {
      console.error('Failed to fetch points summary', error);
      toast.error('포인트 정보를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchHistory = React.useCallback(async () => {
    setHistoryLoading(true);
    try {
      const data = await getMyHistory(page, pageSize, filterType || undefined);
      setHistory(data.items);
      setTotalPages(data.total_pages);
    } catch (error) {
      console.error('Failed to fetch activity history', error);
      toast.error('활동 기록을 불러오는데 실패했습니다.');
    } finally {
      setHistoryLoading(false);
    }
  }, [page, filterType]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const getActivityIcon = (type: string) => {
    const config = ACTIVITY_TYPES[type as keyof typeof ACTIVITY_TYPES];
    if (!config) return <History className="w-5 h-5 text-gray-500" />;
    const Icon = config.icon;
    return <Icon className={`w-5 h-5 ${config.color.split(' ')[0]}`} />;
  };

  const getActivityLabel = (type: string) => {
    const config = ACTIVITY_TYPES[type as keyof typeof ACTIVITY_TYPES];
    return config ? config.label : type;
  };

  const getActivityColor = (type: string) => {
    const config = ACTIVITY_TYPES[type as keyof typeof ACTIVITY_TYPES];
    return config ? config.color : 'text-gray-600 bg-gray-50';
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">활동 내역</h1>
          <p className="text-dark-muted">포인트 이력과 활동 기록을 확인하세요.</p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/profile')}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-dark-cardSoft border border-dark-line rounded-lg hover:bg-dark-nav transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          마이페이지로 돌아가기
        </button>
      </div>

      <ActivitySummaryCard summary={summary} loading={loading} />

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-50 flex flex-col sm:flex-row justify-between items-center gap-4">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-500" />
            활동 기록
          </h2>
          
          <div className="relative">
            <Filter className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <select
              value={filterType}
              onChange={(e) => {
                setFilterType(e.target.value);
                setPage(1);
              }}
              className="pl-9 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent appearance-none cursor-pointer"
            >
              <option value="">전체 활동</option>
              {Object.entries(ACTIVITY_TYPES).map(([key, config]) => (
                <option key={key} value={key}>{config.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="divide-y divide-gray-50">
          {historyLoading ? (
            <div className="p-8 text-center text-gray-500">기록을 불러오는 중...</div>
          ) : history.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <History className="w-8 h-8 text-gray-300" />
              </div>
              <p className="text-gray-500 font-medium">활동 기록이 없습니다</p>
              <p className="text-sm text-gray-400 mt-1">플랫폼을 사용하시면 활동 기록이 여기에 표시됩니다.</p>
            </div>
          ) : (
            history.map((item) => (
              <div key={item.id} className="p-4 hover:bg-gray-50/50 transition-colors">
                <div className="flex items-start gap-4">
                  <div className={`p-2.5 rounded-xl shrink-0 ${getActivityColor(item.activity_type)}`}>
                    {getActivityIcon(item.activity_type)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <p className="font-semibold text-gray-900">
                          {getActivityLabel(item.activity_type)}
                        </p>
                        <p className="text-sm text-gray-600 mt-0.5 break-words">
                          {item.description || '설명 없음'}
                        </p>
                        {item.reference_id && (
                          <div className="mt-1 flex items-center gap-1 text-xs text-indigo-600">
                          </div>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <span className={`font-bold ${item.points >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {item.points >= 0 ? '+' : ''}{item.points}
                        </span>
                        <p className="text-xs text-gray-400 mt-1">
                          잔액: {item.balance_after.toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <p className="text-xs text-gray-400">
                        {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: ko })}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {totalPages > 1 && (
          <div className="p-4 border-t border-gray-50 flex items-center justify-between">
            <button
              type="button"
              onClick={() => handlePageChange(page - 1)}
              disabled={page === 1}
              className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <span className="text-sm font-medium text-gray-600">
              {page} / {totalPages} 페이지
            </span>
            <button
              type="button"
              onClick={() => handlePageChange(page + 1)}
              disabled={page === totalPages}
              className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivityPage;
