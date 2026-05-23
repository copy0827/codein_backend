import React from 'react';
import { PartyPopper, Sparkles, Trophy, X } from 'lucide-react';

interface StampBoardCompleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  bonusPoints: number;
}

/**
 * 스탬프판 완성 보상 — ReportModal과 동일한 fixed 오버레이 + rounded-2xl shadow-xl 기조.
 */
const StampBoardCompleteModal: React.FC<StampBoardCompleteModalProps> = ({
  isOpen,
  onClose,
  bonusPoints,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="stamp-board-complete-title"
    >
      <div
        className="absolute inset-0 bg-black/55 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50 via-white to-brand/10 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-amber-200/40 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-8 -left-6 h-32 w-32 rounded-full bg-brand/15 blur-2xl" />

        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-white/80 hover:text-gray-600"
          aria-label="닫기"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="relative px-6 pb-6 pt-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-amber-500 text-white shadow-lg shadow-amber-500/30">
            <Trophy className="h-9 w-9" strokeWidth={2} aria-hidden />
          </div>

          <div className="mb-2 flex items-center justify-center gap-1.5 text-amber-600">
            <PartyPopper className="h-4 w-4" aria-hidden />
            <Sparkles className="h-4 w-4" aria-hidden />
            <PartyPopper className="h-4 w-4 scale-x-[-1]" aria-hidden />
          </div>

          <h2
            id="stamp-board-complete-title"
            className="text-xl font-bold text-gray-900 sm:text-2xl"
          >
            축하합니다!
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-gray-600 sm:text-base">
            스탬프판을 완성하여 보너스{' '}
            <span className="font-bold text-brand">{bonusPoints}</span>
            포인트를 획득했습니다!
          </p>

          <button
            type="button"
            onClick={onClose}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-brand/25 transition-all duration-200 hover:bg-brand-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <Sparkles className="h-4 w-4" aria-hidden />
            확인
          </button>
        </div>
      </div>
    </div>
  );
};

export default StampBoardCompleteModal;
