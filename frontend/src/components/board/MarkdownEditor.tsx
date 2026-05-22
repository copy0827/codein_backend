import React, { useState } from 'react';
import { Eye, PenLine } from 'lucide-react';
import MarkdownViewer from './MarkdownViewer';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeightClass?: string;
}

const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  value,
  onChange,
  placeholder = '마크다운으로 내용을 작성하세요...',
  minHeightClass = 'min-h-[280px]',
}) => {
  const [tab, setTab] = useState<'write' | 'preview'>('write');

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
      <div className="flex border-b border-gray-100 bg-gray-50">
        <button
          type="button"
          onClick={() => setTab('write')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold transition-colors ${
            tab === 'write'
              ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <PenLine className="w-4 h-4" />
          작성
        </button>
        <button
          type="button"
          onClick={() => setTab('preview')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold transition-colors ${
            tab === 'preview'
              ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Eye className="w-4 h-4" />
          미리보기
        </button>
      </div>

      {tab === 'write' ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full p-4 text-sm text-gray-800 leading-relaxed focus:outline-none resize-y ${minHeightClass}`}
          placeholder={placeholder}
        />
      ) : (
        <div className={`p-4 sm:p-6 ${minHeightClass}`}>
          {value.trim() ? (
            <MarkdownViewer content={value} />
          ) : (
            <p className="text-sm text-gray-400">미리볼 내용이 없습니다.</p>
          )}
        </div>
      )}

      <p className="px-4 py-2 text-xs text-gray-400 border-t border-gray-100 bg-gray-50">
        마크다운 문법을 지원합니다. 코드 블록은 ``` 로 감싸세요.
      </p>
    </div>
  );
};

export default MarkdownEditor;
