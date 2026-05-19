import React, { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { createReport } from '../../api/reports';
import type { ReportTargetType, ReportReason } from '../../types/report';
import toast from 'react-hot-toast';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetType: ReportTargetType;
  targetId: number;
  targetTitle?: string;
}

const REASONS: { value: ReportReason; label: string }[] = [
  { value: 'spam', label: '스팸 / 광고' },
  { value: 'harassment', label: '괴롭힘 / 욕설' },
  { value: 'inappropriate', label: '부적절한 콘텐츠' },
  { value: 'copyright', label: '저작권 침해' },
  { value: 'other', label: '기타' },
];

const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  onClose,
  targetType,
  targetId,
  targetTitle,
}) => {
  const [reason, setReason] = useState<ReportReason>('spam');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      await createReport({
        target_type: targetType,
        target_id: targetId,
        reason,
        description: description.trim() || undefined,
      });
      toast.success('신고가 접수되었습니다. 검토 후 조치하겠습니다.');
      onClose();
    } catch (error: any) {
      console.error('Failed to submit report', error);
      const message = error.response?.data?.detail || '신고 접수에 실패했습니다.';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm" 
        onClick={onClose}
      />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="w-5 h-5" />
            <h2 className="text-lg font-bold">신고하기</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {targetTitle && (
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
              <p className="text-xs text-gray-500 mb-1">신고 대상:</p>
              <p className="text-sm font-medium text-gray-900 truncate">
                {targetType === 'post' ? '게시글' : '댓글'}: {targetTitle}
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              신고 사유를 선택해주세요
            </label>
            <div className="space-y-2">
              {REASONS.map((r) => (
                <label 
                  key={r.value}
                  className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all cursor-pointer ${
                    reason === r.value 
                      ? 'border-red-500 bg-red-50 text-red-700' 
                      : 'border-gray-100 hover:border-gray-200 bg-white text-gray-600'
                  }`}
                >
                  <input
                    type="radio"
                    name="report-reason"
                    value={r.value}
                    checked={reason === r.value}
                    onChange={() => setReason(r.value)}
                    className="w-4 h-4 text-red-600 border-gray-300 focus:ring-red-500"
                  />
                  <span className="text-sm font-medium">{r.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              상세 내용 (선택사항)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full h-32 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm text-gray-700 placeholder:text-gray-400"
              placeholder="신고 사유에 대한 상세 설명을 입력해주세요..."
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 font-semibold rounded-xl hover:bg-gray-50 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-[2] px-4 py-2.5 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm shadow-red-200"
            >
              {submitting ? '제출 중...' : '신고 제출'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReportModal;
