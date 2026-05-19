import { useEffect, useState, useCallback, type FC } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import {
  getReport,
  resolveReport,
  startReview,
  type Report,
  type ReportStatus,
  type ActionTaken
} from '../../api/reports';
import api from '../../api/axios';

const STATUS_LABELS: Record<ReportStatus, string> = {
  pending: '대기중',
  reviewing: '검토중',
  resolved: '처리완료',
  rejected: '반려'
};

const ReportDetailPage: FC = () => {
  const { reportId } = useParams<{ reportId: string }>();
  const navigate = useNavigate();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState<any>(null);
  const [contentLoading, setContentLoading] = useState(false);
  
  const [resolutionNote, setResolutionNote] = useState('');
  const [actionTaken, setActionTaken] = useState<ActionTaken>('no_action');
  const [status, setStatus] = useState<ReportStatus>('resolved');
  const [showConfirm, setShowConfirm] = useState(false);

  const fetchReport = useCallback(async (id: number) => {
    setLoading(true);
    try {
      const data = await getReport(id);
      setReport(data);
    } catch (error) {
      console.error('Failed to fetch report', error);
      toast.error('신고 상세 정보를 불러오는데 실패했습니다');
      navigate('/admin/reports');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    if (reportId) {
      fetchReport(parseInt(reportId));
    }
  }, [reportId, fetchReport]);

  const fetchTargetContent = useCallback(async () => {
    if (!report) return;
    
    setContentLoading(true);
    try {
      let data = null;
      if (report.target_type === 'user') {
        const response = await api.get(`/profile/${report.target_id}`);
        data = response.data;
      } else if (report.target_type === 'comment') {
        const response = await api.get(`/comments/${report.target_id}`);
        data = response.data;
      } else if (report.target_type === 'post') {
        for (const boardId of [1, 2, 3]) {
          try {
            const response = await api.get(`/boards/${boardId}/posts/${report.target_id}`);
            if (response.data) {
              data = response.data;
              break;
            }
          } catch (e) {
             // 
          }
        }
      }
      setContent(data);
    } catch (error) {
      console.error('Failed to fetch content', error);
    } finally {
      setContentLoading(false);
    }
  }, [report]);

  useEffect(() => {
    if (report) {
      fetchTargetContent();
      if (report.status === 'pending' || report.status === 'reviewing') {
        setStatus('resolved');
      } else {
        setStatus(report.status);
      }
    }
  }, [report, fetchTargetContent]);

  const handleResolve = async () => {
    if (!report) return;

    try {
      await resolveReport(report.id, {
        status: status === 'pending' || status === 'reviewing' ? 'resolved' : status as 'resolved' | 'rejected',
        action_taken: actionTaken,
        resolution_note: resolutionNote
      });
      toast.success('신고가 처리되었습니다');
      setShowConfirm(false);
      fetchReport(report.id);
    } catch (error) {
      console.error('Failed to resolve report', error);
      toast.error('신고 업데이트에 실패했습니다');
    }
  };

  const handleStartReview = async () => {
    if (!report) return;
    try {
      await startReview(report.id);
      toast.success('검토를 시작했습니다');
      fetchReport(report.id);
    } catch (error) {
      console.error('Failed to start review', error);
      toast.error('검토 시작 처리에 실패했습니다');
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-dark-muted">신고 상세 정보를 불러오는 중...</div>;
  }

  if (!report) {
    return <div className="p-8 text-center text-dark-muted">신고를 찾을 수 없습니다</div>;
  }

  const isResolved = report.status === 'resolved' || report.status === 'rejected';

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-20">
      <div className="flex items-center gap-4 mb-8">
        <button 
          type="button"
          onClick={() => navigate('/admin/reports')}
          className="p-2 rounded-xl hover:bg-dark-card text-dark-muted hover:text-dark-text transition-colors"
        >
          ← 뒤로
        </button>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-dark-text">신고 #{report.id}</h1>
            <span className={`px-3 py-1 rounded-full text-xs font-medium border ${
              report.status === 'pending' ? 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30' :
              report.status === 'reviewing' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
              report.status === 'resolved' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
              'bg-gray-500/20 text-gray-400 border-gray-500/30'
            }`}>
              {STATUS_LABELS[report.status]}
            </span>
            {report.status === 'pending' && (
              <button
                type="button"
                onClick={handleStartReview}
                className="ml-2 px-3 py-1 bg-brand/10 text-brand-light border border-brand/30 rounded-full text-xs font-medium hover:bg-brand/20 transition-colors"
              >
                검토 시작
              </button>
            )}
          </div>
          <p className="text-dark-muted text-sm mt-1">
            {report.reporter_name}님이 {format(new Date(report.created_at), 'yyyy.MM.dd HH:mm')}에 신고함
          </p>
          {report.review_started_by_name && report.review_started_at && (
            <p className="text-xs text-dark-muted mt-1">
              검토 시작: {report.review_started_by_name} · {format(new Date(report.review_started_at), 'yyyy.MM.dd HH:mm')}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-dark-card border border-dark-line rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-dark-text mb-4">신고 상세</h2>
            <div className="space-y-4">
              <div>
                <span className="text-xs font-medium text-dark-muted uppercase tracking-wider">신고 사유</span>
                <p className="text-dark-text mt-1 capitalize">{report.reason}</p>
              </div>
              <div>
                <span className="text-xs font-medium text-dark-muted uppercase tracking-wider">상세 설명</span>
                <p className="text-dark-text mt-1 whitespace-pre-wrap">{report.description || '설명이 없습니다.'}</p>
              </div>
            </div>
          </div>

          <div className="bg-dark-card border border-dark-line rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-dark-text mb-4">신고된 콘텐츠 ({report.target_type})</h2>
            {contentLoading ? (
              <div className="text-dark-muted animate-pulse">콘텐츠 불러오는 중...</div>
            ) : content ? (
              <div className="bg-dark-bg/50 rounded-xl p-4 border border-dark-line">
                {report.target_type === 'user' && (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-dark-line flex items-center justify-center text-dark-text">
                      {content.name?.[0]}
                    </div>
                    <div>
                      <p className="text-dark-text font-medium">{content.name}</p>
                      <p className="text-dark-muted text-sm">{content.email || '비공개'}</p>
                    </div>
                  </div>
                )}
                {(report.target_type === 'post' || report.target_type === 'comment') && (
                  <div className="space-y-2">
                    <p className="text-dark-muted text-xs">ID: {report.target_id}</p>
                    {content.title && <h3 className="text-dark-text font-medium">{content.title}</h3>}
                    <p className="text-dark-muted text-sm whitespace-pre-wrap">{content.content}</p>
                    {content.is_blinded && (
                      <div className="mt-2 inline-block px-2 py-1 rounded bg-red-500/20 text-red-400 text-xs">
                        블라인드 처리됨
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-dark-muted bg-dark-bg/30 p-4 rounded-xl border border-dark-line border-dashed">
                콘텐츠를 불러올 수 없습니다 (ID: {report.target_id})
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-dark-card border border-dark-line rounded-2xl p-6 sticky top-6">
            <h2 className="text-lg font-semibold text-dark-text mb-4">처리</h2>
            
            {isResolved ? (
                <div className="space-y-4">
                <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                  <p className="text-green-400 text-sm font-medium">{report.resolved_by_name}님이 처리함</p>
                  <p className="text-green-500/60 text-xs mt-1">
                    {report.resolved_at && format(new Date(report.resolved_at), 'yyyy.MM.dd HH:mm')}
                  </p>
                </div>
                <div>
                  <span className="text-xs font-medium text-dark-muted uppercase tracking-wider">취한 조치</span>
                  <div className="mt-2">
                    <span className={`px-3 py-1 rounded-lg text-sm font-medium border ${
                      report.action_taken === 'user_suspended' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                      report.action_taken === 'content_blinded' ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' :
                      report.action_taken === 'user_warned' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                      'bg-gray-500/20 text-gray-400 border-gray-500/30'
                    }`}>
                      {report.action_taken?.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                </div>
                {report.resolution_note && (
                  <div>
                    <span className="text-xs font-medium text-dark-muted uppercase tracking-wider">메모</span>
                    <p className="text-dark-text mt-1 text-sm bg-dark-bg p-3 rounded-xl border border-dark-line">
                      {report.resolution_note}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  setShowConfirm(true);
                }}
                className="space-y-4"
              >
                <div>
                  <label htmlFor="status-select" className="block text-sm font-medium text-dark-muted mb-1">상태</label>
                  <select
                    id="status-select"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ReportStatus)}
                    className="w-full px-3 py-2 bg-dark-bg border border-dark-line rounded-xl text-dark-text focus:outline-none focus:border-brand"
                  >
                    <option value="resolved">처리완료</option>
                    <option value="rejected">반려</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="action-select" className="block text-sm font-medium text-dark-muted mb-1">조치</label>
                  <select
                    id="action-select"
                    value={actionTaken}
                    onChange={(e) => setActionTaken(e.target.value as ActionTaken)}
                    className="w-full px-3 py-2 bg-dark-bg border border-dark-line rounded-xl text-dark-text focus:outline-none focus:border-brand"
                  >
                    <option value="no_action">조치 없음</option>
                    <option value="content_blinded">콘텐츠 블라인드</option>
                    <option value="user_warned">사용자 경고</option>
                    <option value="user_suspended">사용자 정지 (7일)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="resolution-note" className="block text-sm font-medium text-dark-muted mb-1">처리 메모</label>
                  <textarea
                    id="resolution-note"
                    value={resolutionNote}
                    onChange={(e) => setResolutionNote(e.target.value)}
                    className="w-full h-32 px-3 py-2 bg-dark-bg border border-dark-line rounded-xl text-dark-text focus:outline-none focus:border-brand resize-none"
                    placeholder="처리 내용을 설명해주세요..."
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-brand text-white font-semibold hover:bg-brand-light transition-colors shadow-lg shadow-brand/20"
                >
                  처리 완료
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-dark-card border border-dark-line rounded-2xl p-6 space-y-4 animate-in fade-in zoom-in duration-200">
            <h3 className="text-xl font-bold text-dark-text">처리 확인</h3>
            <p className="text-dark-muted">
              이 신고를 <span className="text-dark-text font-medium">{status}</span> 상태로, <span className="text-dark-text font-medium">{actionTaken}</span> 조치로 처리하시겠습니까?
            </p>
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-2 rounded-xl border border-dark-line text-dark-muted hover:text-dark-text hover:bg-dark-bg transition-colors"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleResolve}
                className="flex-1 py-2 rounded-xl bg-brand text-white font-semibold hover:bg-brand-light transition-colors"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportDetailPage;
