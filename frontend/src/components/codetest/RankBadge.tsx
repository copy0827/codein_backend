import React from 'react';
import { Medal, Trophy } from 'lucide-react';

interface RankBadgeProps {
  rank: number;
  className?: string;
}

const RankBadge: React.FC<RankBadgeProps> = ({ rank, className = '' }) => {
  if (rank === 1) {
    return (
      <span
        className={`inline-flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 text-white shadow-sm shadow-amber-200/60 ${className}`}
        title="1위"
      >
        <Trophy className="w-4 h-4" aria-hidden />
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span
        className={`inline-flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br from-slate-300 to-slate-400 text-white shadow-sm ${className}`}
        title="2위"
      >
        <Medal className="w-4 h-4" aria-hidden />
      </span>
    );
  }
  if (rank === 3) {
    return (
      <span
        className={`inline-flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br from-orange-300 to-amber-700 text-white shadow-sm ${className}`}
        title="3위"
      >
        <Medal className="w-4 h-4" aria-hidden />
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center justify-center min-w-[2.25rem] font-mono font-bold text-gray-700 ${className}`}>
      {rank}
    </span>
  );
};

export default RankBadge;
