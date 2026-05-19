import { useEffect, useState, type FC } from 'react';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import {
  getReports,
  getReportStats,
  type Report,
  type ReportStats,
  type ReportFilters,
  type ReportStatus,
  type ReportTargetType,
  type ReportReason
} from '../../api/reports';

const REPORT_STATUSES: ReportStatus[] = ['pending', 'reviewing', 'resolved', 'rejected'];
const REPORT_TARGETS: ReportTargetType[] = ['post', 'comment', 'user'];
const REPORT_REASONS: ReportReason[] = [
  'spam',
  'harassment',
  'inappropriate',
  'copyright',
  'other'
];

const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  pending: '대기중',
  reviewing: '검토중',
  resolved: '처리완료',
  rejected: '반려'
};

const REPORT_TARGET_LABELS: Record<string, string> = {
  post: '게시글',
  comment: '댓글',
  album: '앨범',
  photo: '사진',
  user: '사용자'
};

const REPORT_REASON_LABELS: Record<string, string> = {
  spam: '스팸',
  harassment: '괴롭힘',
  inappropriate: '부적절',
  copyright: '저작권',
  misinformation: '허위정보',
  other: '기타'
};

const ReportsPage: FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<ReportFilters>({
    status: undefined,
    target_type: undefined,
    reason: undefined,
    skip: 0,
    limit: 20
  });
  const [total, setTotal] = useState(0);

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    fetchReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const fetchStats = async () => {
    try {
      const data = await getReportStats();
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch stats', error);
      toast.error('통계를 불러오는데 실패했습니다');
    }
  };

  const fetchReports = async () => {
    setLoading(true);
    try {
      const data = await getReports(filters);
      setReports(data.items);
      setTotal(data.total);
    } catch (error) {
      console.error('Failed to fetch reports', error);
      toast.error('신고 목록을 불러오는데 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key: keyof ReportFilters, value: string | undefined) => {
    setFilters((prev: ReportFilters) => ({
      ...prev,
      [key]: value === '' ? undefined : value,
      skip: 0
    }));
  };

  const getStatusColor = (status: ReportStatus) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30';
      case 'reviewing': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'resolved': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'rejected': return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-dark-text tracking-tight">신고 관리</h1>
        <p className="text-dark-muted">사용자 신고를 효율적으로 관리하고 처리합니다.</p>
      </div>

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-6 rounded-2xl bg-dark-card border border-dark-line relative overflow-hidden group hover:border-yellow-500/30 transition-colors">
            <div className="relative z-10">
              <p className="text-sm font-medium text-dark-muted">대기중</p>
              <p className="text-3xl font-bold text-dark-text mt-2">{stats.pending}</p>
            </div>
            <div className="absolute right-0 top-0 h-full w-1 bg-yellow-500/50" />
            <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="p-6 rounded-2xl bg-dark-card border border-dark-line relative overflow-hidden group hover:border-blue-500/30 transition-colors">
            <div className="relative z-10">
              <p className="text-sm font-medium text-dark-muted">검토중</p>
              <p className="text-3xl font-bold text-dark-text mt-2">{stats.reviewing}</p>
            </div>
            <div className="absolute right-0 top-0 h-full w-1 bg-blue-500/50" />
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="p-6 rounded-2xl bg-dark-card border border-dark-line relative overflow-hidden group hover:border-green-500/30 transition-colors">
            <div className="relative z-10">
              <p className="text-sm font-medium text-dark-muted">처리완료</p>
              <p className="text-3xl font-bold text-dark-text mt-2">{stats.resolved}</p>
            </div>
            <div className="absolute right-0 top-0 h-full w-1 bg-green-500/50" />
            <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="p-6 rounded-2xl bg-dark-card border border-dark-line relative overflow-hidden group hover:border-gray-500/30 transition-colors">
            <div className="relative z-10">
              <p className="text-sm font-medium text-dark-muted">반려됨</p>
              <p className="text-3xl font-bold text-dark-text mt-2">{stats.rejected}</p>
            </div>
            <div className="absolute right-0 top-0 h-full w-1 bg-gray-500/50" />
            <div className="absolute inset-0 bg-gradient-to-r from-gray-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div className="flex flex-wrap gap-4 items-center justify-between p-4 bg-dark-card border border-dark-line rounded-2xl">
          <div className="flex flex-wrap gap-3">
            <select
              className="px-3 py-2 bg-dark-bg border border-dark-line rounded-xl text-sm text-dark-text focus:outline-none focus:border-brand transition-colors"
              value={filters.status || ''}
              onChange={(e) => handleFilterChange('status', e.target.value)}
            >
              <option value="">전체 상태</option>
              {REPORT_STATUSES.map(s => <option key={s} value={s}>{REPORT_STATUS_LABELS[s]}</option>)}
            </select>
            <select
              className="px-3 py-2 bg-dark-bg border border-dark-line rounded-xl text-sm text-dark-text focus:outline-none focus:border-brand transition-colors"
              value={filters.target_type || ''}
              onChange={(e) => handleFilterChange('target_type', e.target.value)}
            >
              <option value="">전체 대상</option>
              {REPORT_TARGETS.map(t => <option key={t} value={t}>{REPORT_TARGET_LABELS[t]}</option>)}
            </select>
            <select
              className="px-3 py-2 bg-dark-bg border border-dark-line rounded-xl text-sm text-dark-text focus:outline-none focus:border-brand transition-colors"
              value={filters.reason || ''}
              onChange={(e) => handleFilterChange('reason', e.target.value)}
            >
              <option value="">전체 사유</option>
              {REPORT_REASONS.map(r => <option key={r} value={r}>{REPORT_REASON_LABELS[r]}</option>)}
            </select>
          </div>
          <div className="text-sm text-dark-muted">
            총: <span className="text-dark-text font-medium">{total}</span> 건
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20 text-dark-muted">신고 목록을 불러오는 중...</div>
        ) : reports.length === 0 ? (
          <div className="text-center py-20 bg-dark-card rounded-2xl border border-dark-line">
            <p className="text-dark-muted">필터 조건에 맞는 신고가 없습니다.</p>
          </div>
        ) : (
          <div className="bg-dark-card border border-dark-line rounded-2xl overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-dark-bg border-b border-dark-line text-dark-muted font-medium">
                <tr>
                  <th className="px-6 py-4">ID</th>
                  <th className="px-6 py-4">상태</th>
                  <th className="px-6 py-4">유형</th>
                  <th className="px-6 py-4">사유</th>
                  <th className="px-6 py-4">신고자</th>
                  <th className="px-6 py-4">날짜</th>
                  <th className="px-6 py-4 text-right">액션</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-line">
                {reports.map((report) => (
                  <tr 
                    key={report.id} 
                    className="hover:bg-dark-bg/50 transition-colors cursor-pointer group"
                    onClick={() => navigate(`/admin/reports/${report.id}`)}
                  >
                    <td className="px-6 py-4 text-dark-muted font-mono">#{report.id}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(report.status)}`}>
                        {REPORT_STATUS_LABELS[report.status]}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-dark-text capitalize">{REPORT_TARGET_LABELS[report.target_type] || report.target_type}</td>
                    <td className="px-6 py-4 text-dark-text capitalize">{REPORT_REASON_LABELS[report.reason] || report.reason}</td>
                    <td className="px-6 py-4 text-dark-muted">{report.reporter_name}</td>
                    <td className="px-6 py-4 text-dark-muted">{format(new Date(report.created_at), 'yyyy.MM.dd')}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        type="button"
                        className="text-brand hover:text-brand-light font-medium opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        상세 보기 →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {total > (filters.limit || 20) && (
          <div className="flex justify-center gap-2 mt-4">
            <button
              type="button"
              disabled={(filters.skip || 0) === 0}
              onClick={() => setFilters((prev: ReportFilters) => ({ ...prev, skip: Math.max(0, (prev.skip || 0) - (prev.limit || 20)) }))}
              className="px-4 py-2 rounded-xl bg-dark-card border border-dark-line text-dark-text disabled:opacity-50 hover:bg-dark-bg"
            >
              이전
            </button>
            <button
              type="button"
              disabled={(filters.skip || 0) + (filters.limit || 20) >= total}
              onClick={() => setFilters((prev: ReportFilters) => ({ ...prev, skip: (prev.skip || 0) + (prev.limit || 20) }))}
              className="px-4 py-2 rounded-xl bg-dark-card border border-dark-line text-dark-text disabled:opacity-50 hover:bg-dark-bg"
            >
              다음
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportsPage;
