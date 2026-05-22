import React from 'react';

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  /** BoardList / Showcase 상세와 동일한 카드 셸 */
  variant?: 'elevated' | 'flat';
  hoverable?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const paddingMap = {
  none: '',
  sm: 'p-4',
  md: 'p-5 sm:p-6',
  lg: 'p-6 sm:p-8',
};

/**
 * 사이트 공통 카드 — `bg-white shadow-xl rounded-xl border border-gray-100` 기조.
 */
const Card: React.FC<CardProps> = ({
  children,
  className = '',
  variant = 'elevated',
  hoverable = false,
  padding = 'md',
}) => {
  const shell =
    variant === 'elevated'
      ? 'bg-white shadow-xl rounded-xl border border-gray-100 overflow-hidden'
      : 'bg-white rounded-xl border border-gray-100 overflow-hidden';

  return (
    <div
      className={[
        shell,
        hoverable ? 'transition-shadow hover:shadow-2xl' : '',
        paddingMap[padding],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  );
};

export default Card;
