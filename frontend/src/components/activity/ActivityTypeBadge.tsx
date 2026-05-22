import React from 'react';
import type { RecruitmentType } from '../../types/activity';
import { TYPE_BADGE_STYLES, TYPE_LABELS } from './activityUi';

interface ActivityTypeBadgeProps {
  type: RecruitmentType;
  size?: 'sm' | 'md';
}

const ActivityTypeBadge: React.FC<ActivityTypeBadgeProps> = ({ type, size = 'sm' }) => {
  const style = TYPE_BADGE_STYLES[type];
  const sizeClass =
    size === 'sm'
      ? 'text-xs font-medium px-2.5 py-0.5'
      : 'text-xs font-bold uppercase tracking-wider px-2.5 py-1';

  return (
    <span
      className={`inline-flex items-center rounded-full ${style.bg} ${style.text} ${sizeClass}`}
    >
      {TYPE_LABELS[type]}
    </span>
  );
};

export default ActivityTypeBadge;
