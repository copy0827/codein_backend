import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Users } from 'lucide-react';
import type { ActivityRecruitmentItem } from '../../types/activity';
import Card from '../ui/Card';
import TechStackBadges from '../board/TechStackBadges';
import ActivityTypeBadge from './ActivityTypeBadge';
import ActivityStatusBadge from './ActivityStatusBadge';
import { formatActivityDate } from './activityUi';

interface ActivityCardProps {
  activity: ActivityRecruitmentItem;
}

const ActivityCard: React.FC<ActivityCardProps> = ({ activity }) => {
  const hoverTitleClass: Record<ActivityRecruitmentItem['recruitment_type'], string> = {
    STUDY: 'group-hover:text-blue-700',
    PROJECT: 'group-hover:text-violet-700',
    CONTEST: 'group-hover:text-amber-700',
    MENTORING: 'group-hover:text-emerald-700',
  };
  const stacks = activity.tech_stacks ?? [];

  return (
    <Link to={`/activities/${activity.id}`} className="block h-full group">
      <Card hoverable padding="none" className="h-full flex flex-col">
        <div
          className={`h-1 shrink-0 bg-gradient-to-r ${
            activity.recruitment_type === 'STUDY'
              ? 'from-blue-500 to-indigo-500'
              : activity.recruitment_type === 'PROJECT'
                ? 'from-violet-500 to-purple-500'
                : activity.recruitment_type === 'CONTEST'
                  ? 'from-amber-500 to-orange-500'
                  : 'from-emerald-500 to-teal-500'
          }`}
        />
        <div className="p-5 flex flex-col flex-1">
          <div className="flex items-start justify-between gap-2 mb-3">
            <ActivityTypeBadge type={activity.recruitment_type} />
            <ActivityStatusBadge status={activity.recruitment_status} />
          </div>

          <h3
            className={`text-lg font-bold text-gray-900 line-clamp-2 mb-2 transition-colors ${hoverTitleClass[activity.recruitment_type]}`}
          >
            {activity.title}
          </h3>

          <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
            <Users className="w-4 h-4 text-indigo-500 shrink-0" />
            <span className="font-semibold tabular-nums">
              {activity.current_participants}
              <span className="text-gray-400 font-normal"> / </span>
              {activity.max_participants}
            </span>
            <span className="text-xs text-gray-400">명</span>
            {activity.is_full && (
              <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                마감
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
            <Calendar className="w-4 h-4 shrink-0 text-indigo-500" />
            <span>마감 {formatActivityDate(activity.deadline)}</span>
          </div>

          {stacks.length > 0 && (
            <div className="mt-auto pt-3 border-t border-gray-100">
              <TechStackBadges items={stacks} max={4} />
            </div>
          )}
        </div>
      </Card>
    </Link>
  );
};

export default ActivityCard;
