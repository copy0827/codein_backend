import React from 'react';

interface TechStackBadgesProps {
  items: string[];
  max?: number;
  size?: 'sm' | 'md';
}

const TechStackBadges: React.FC<TechStackBadgesProps> = ({
  items,
  max = 5,
  size = 'sm',
}) => {
  if (!items.length) return null;

  const visible = items.slice(0, max);
  const rest = items.length - visible.length;
  const sizeClass =
    size === 'sm'
      ? 'text-[11px] px-2 py-0.5'
      : 'text-xs px-2.5 py-1';

  return (
    <div className="flex flex-wrap gap-1.5">
      {visible.map((tech) => (
        <span
          key={tech}
          className={`inline-flex items-center rounded-full bg-slate-100 text-slate-700 font-medium border border-slate-200 ${sizeClass}`}
        >
          {tech}
        </span>
      ))}
      {rest > 0 && (
        <span
          className={`inline-flex items-center rounded-full bg-gray-100 text-gray-500 font-medium ${sizeClass}`}
        >
          +{rest}
        </span>
      )}
    </div>
  );
};

export default TechStackBadges;
