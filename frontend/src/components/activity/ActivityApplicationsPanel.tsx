import React, { useState } from 'react';
import { isAxiosError } from 'axios';
import { Check, Loader2, User, X } from 'lucide-react';
import toast from 'react-hot-toast';
import Card from '../ui/Card';
import {
  useActivityApplicationsQuery,
  usePatchApplicationMutation,
  getActivityApiErrorMessage,
} from '../../hooks/useActivityRecruitment';
import type { ActivityApplicationItem } from '../../types/activity';
import {
  APPLICATION_STATUS_LABELS,
  APPLICATION_STATUS_STYLES,
  formatActivityDate,
} from './activityUi';

interface ActivityApplicationsPanelProps {
  activityId: number;
  isOwner: boolean;
  currentUserId?: number;
  enabled: boolean;
}

const ActivityApplicationsPanel: React.FC<ActivityApplicationsPanelProps> = ({
  activityId,
  isOwner,
  currentUserId,
  enabled,
}) => {
  const { data, isLoading, isError, error } = useActivityApplicationsQuery(activityId, {
    enabled: enabled && !!currentUserId,
  });

  if (isAxiosError(error) && error.response?.status === 403) {
    return null;
  }
  const patchMutation = usePatchApplicationMutation(activityId);
  const [processingId, setProcessingId] = useState<number | null>(null);

  if (!currentUserId) {
    return (
      <Card padding="md">
        <p className="text-sm text-gray-500">
          신청 현황을 보려면 로그인해 주세요.
        </p>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card padding="md" className="flex items-center justify-center gap-2 text-gray-500">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">신청 목록 불러오는 중...</span>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card padding="md">
        <p className="text-sm text-gray-500">신청 정보를 불러오지 못했습니다.</p>
      </Card>
    );
  }

  const items = data?.items ?? [];

  if (!isOwner) {
    if (items.length === 0) {
      return null;
    }
    const mine = items.find((item) => item.applicant_id === currentUserId) ?? items[0];
    return (
      <Card padding="md">
        <h3 className="text-lg font-bold text-gray-900 mb-3">내 신청 현황</h3>
        <OwnApplicationSummary application={mine} />
      </Card>
    );
  }

  return (
    <Card padding="none">
      <div className="px-5 py-4 sm:px-6 border-b border-gray-100 bg-gray-50">
        <h3 className="text-lg font-bold text-gray-900">신청자 목록</h3>
        <p className="text-sm text-gray-500 mt-0.5">
          대기 {data?.total ?? items.length}건 · 승인/거절은 작성자만 처리할 수 있습니다.
        </p>
      </div>

      {items.length === 0 ? (
        <div className="p-8 text-center text-gray-500 text-sm">아직 신청이 없습니다.</div>
      ) : (
        <ul className="divide-y divide-gray-100">
          {items.map((app) => (
            <li key={app.id} className="p-5 sm:p-6">
              <OwnerApplicationRow
                application={app}
                isProcessing={processingId === app.applicant_id && patchMutation.isPending}
                onApprove={async () => {
                  setProcessingId(app.applicant_id);
                  try {
                    await patchMutation.mutateAsync({
                      applicantId: app.applicant_id,
                      payload: { status: 'APPROVED' },
                    });
                    toast.success('신청을 승인했습니다.');
                  } catch (err) {
                    toast.error(getActivityApiErrorMessage(err, '승인에 실패했습니다.'));
                  } finally {
                    setProcessingId(null);
                  }
                }}
                onReject={async () => {
                  if (!window.confirm('이 신청을 거절할까요?')) return;
                  setProcessingId(app.applicant_id);
                  try {
                    await patchMutation.mutateAsync({
                      applicantId: app.applicant_id,
                      payload: { status: 'REJECTED' },
                    });
                    toast.success('신청을 거절했습니다.');
                  } catch (err) {
                    toast.error(getActivityApiErrorMessage(err, '거절에 실패했습니다.'));
                  } finally {
                    setProcessingId(null);
                  }
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
};

const OwnApplicationSummary: React.FC<{ application: ActivityApplicationItem }> = ({
  application,
}) => (
  <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-2">
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm font-medium text-gray-700">처리 상태</span>
      <span
        className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${APPLICATION_STATUS_STYLES[application.status]}`}
      >
        {APPLICATION_STATUS_LABELS[application.status]}
      </span>
    </div>
    <p className="text-xs text-gray-500">신청일 {formatActivityDate(application.applied_at)}</p>
    <p className="text-sm text-gray-800 whitespace-pre-wrap border-t border-gray-200 pt-3 mt-2">
      {application.message}
    </p>
  </div>
);

interface OwnerApplicationRowProps {
  application: ActivityApplicationItem;
  isProcessing: boolean;
  onApprove: () => void;
  onReject: () => void;
}

const OwnerApplicationRow: React.FC<OwnerApplicationRowProps> = ({
  application,
  isProcessing,
  onApprove,
  onReject,
}) => {
  const name = application.applicant?.name ?? `회원 #${application.applicant_id}`;
  const isPending = application.status === 'PENDING';

  return (
    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-900">
            <User className="w-4 h-4 text-indigo-500" />
            {name}
          </span>
          <span
            className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${APPLICATION_STATUS_STYLES[application.status]}`}
          >
            {APPLICATION_STATUS_LABELS[application.status]}
          </span>
          <span className="text-xs text-gray-400">
            {formatActivityDate(application.applied_at)}
          </span>
        </div>
        <p className="text-sm text-gray-700 whitespace-pre-wrap rounded-lg bg-gray-50 border border-gray-100 p-3">
          {application.message}
        </p>
      </div>

      {isPending && (
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            disabled={isProcessing}
            onClick={onApprove}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm disabled:opacity-50 transition-colors"
          >
            {isProcessing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            승인
          </button>
          <button
            type="button"
            disabled={isProcessing}
            onClick={onReject}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-sm font-semibold disabled:opacity-50 transition-colors"
          >
            <X className="w-4 h-4" />
            거절
          </button>
        </div>
      )}
    </div>
  );
};

export default ActivityApplicationsPanel;
