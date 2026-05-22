import React from 'react';
import type { RecruitmentStatus } from '../../types/activity';
import { STATUS_BADGE_STYLES, STATUS_LABELS } from './activityUi';

interface ActivityStatusBadgeProps {
  status: RecruitmentStatus;
}

const ActivityStatusBadge: React.FC<ActivityStatusBadgeProps> = ({ status }) => (
  <span
    className={`inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full border ${STATUS_BADGE_STYLES[status]}`}
  >
    {STATUS_LABELS[status]}
  </span>
);

export default ActivityStatusBadge;
