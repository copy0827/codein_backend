import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Play, RotateCcw, ArrowLeft, RefreshCw, Layers, ChevronDown, ChevronUp, Menu } from 'lucide-react';
import { getPracticeProblems, submitPractice } from '../../api/codetest';
import type { PracticeProblem, SubmitResult } from '../../types/codetest';

const LANGUAGE_TEMPLATES: Record<string, string> = {
  python: 'import sys\n\n# Read input from stdin\n# input = sys.stdin.readline\n\n',
  javascript: 'const fs = require("fs");\n\nconst input = fs.readFileSync(0, "utf8").trim();\n\n',
  java: 'import java.io.*;\nimport java.util.*;\n\npublic class Main {\n  public static void main(String[] args) throws Exception {\n    BufferedReader br = new BufferedReader(new InputStreamReader(System.in));\n    String input = br.readLine();\n  }\n}\n',
  cpp: '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n  ios::sync_with_stdio(false);\n  cin.tie(nullptr);\n\n  return 0;\n}\n'
};

const getTemplateForLanguage = (selectedLanguage: string) => (
  LANGUAGE_TEMPLATES[selectedLanguage] ?? ''
);

const PracticePage: React.FC = () => {
  const navigate = useNavigate();
  
  const [level, setLevel] = useState(1);
  const [selectedLanguage, setSelectedLanguage] = useState('python');
  const [problems, setProblems] = useState<PracticeProblem[]>([]);
  const [currentProblemIndex, setCurrentProblemIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showProblem, setShowProblem] = useState(true);
  
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('python');
  const [output, setOutput] = useState<SubmitResult | null>(null);
  const lineNumbersRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const fetchProblems = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getPracticeProblems(level, 5, selectedLanguage);
      setProblems(data);
      setCurrentProblemIndex(0);
      setOutput(null);
      
      if (data.length > 0) {
        setLanguage(data[0].language);
        setCode(getTemplateForLanguage(data[0].language));
      }
    } catch (error) {
      console.error('Failed to fetch practice problems', error);
      toast.error('Failed to load practice problems');
    } finally {
      setLoading(false);
    }
  }, [level, selectedLanguage]);

  useEffect(() => {
    fetchProblems();
  }, [fetchProblems]);

  const currentProblem = problems[currentProblemIndex];
  const lineNumbers = Array.from(
    { length: Math.max(1, code.split('\n').length) },
    (_, index) => index + 1
  );

  const handleProblemChange = (index: number) => {
    const selectedProblem = problems[index];
    setCurrentProblemIndex(index);
    setOutput(null);
    setLanguage(selectedProblem.language);
    setCode(getTemplateForLanguage(selectedProblem.language));
    setShowSidebar(false);
  };

  const isLanguageLocked = Boolean(currentProblem?.language);
  const availableLanguages = isLanguageLocked ? [currentProblem?.language ?? 'python'] : ['python', 'javascript', 'java', 'cpp'];

  const handleLanguageChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    if (isLanguageLocked) return;
    const nextLanguage = event.target.value;
    setLanguage(nextLanguage);
    setCode(getTemplateForLanguage(nextLanguage));
    setOutput(null);
  };

  const handleEditorScroll = () => {
    if (lineNumbersRef.current && textareaRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  const handleSubmit = async () => {
    if (!currentProblem || !code.trim()) return;
    
    setSubmitting(true);
    setOutput(null);
    try {
      const result = await submitPractice(currentProblem.id, code, language);
      setOutput(result);
      
      if (result.result === 'correct') {
        toast.success('Correct Answer!');
      } else {
        toast.error(`Submission failed: ${result.result}`);
      }
    } catch (error: any) {
      console.error('Submission error', error);
      toast.error(error.response?.data?.detail || 'Failed to submit code');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] md:h-[calc(100vh-64px)] flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-3 sm:px-6 py-3 flex flex-col gap-3 shadow-sm z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              type="button"
              onClick={() => navigate('/contest')}
              className="text-gray-500 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-bold text-gray-900">연습 모드</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowSidebar(!showSidebar)}
              className="md:hidden p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors"
              title="문제 목록"
            >
              <Menu className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={fetchProblems}
              className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors"
              title="문제 새로고침"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">언어:</span>
            <div className="flex gap-1">
              {['python', 'javascript', 'java', 'cpp'].map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setSelectedLanguage(lang)}
                  className={`px-2 py-1 rounded text-xs font-medium transition-colors ${selectedLanguage === lang ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                >
                  {lang}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">레벨:</span>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLevel(l)}
                  className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold transition-colors ${
                    level === l 
                      ? 'bg-indigo-600 text-white' 
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* Sidebar - Problem List */}
        <div className={`${showSidebar ? 'block absolute inset-0 z-20' : 'hidden'} md:block md:relative md:z-auto`}>
          <div className={`${showSidebar ? 'w-full h-full' : ''} md:w-64 bg-gray-50 border-r border-gray-200 flex flex-col md:h-full`}>
            <div className="p-4 border-b border-gray-200 font-semibold text-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4" />
                문제 목록
              </div>
              <button
                type="button"
                onClick={() => setShowSidebar(false)}
                className="md:hidden text-gray-400 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="p-4 text-center text-gray-400 text-sm">로딩중...</div>
              ) : problems.length > 0 ? (
                <div className="divide-y divide-gray-100">
                  {problems.map((p, idx) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleProblemChange(idx)}
                      className={`w-full text-left px-4 py-3 text-sm hover:bg-gray-100 transition-colors ${
                        currentProblemIndex === idx ? 'bg-white border-l-4 border-indigo-600 shadow-sm' : 'border-l-4 border-transparent'
                      }`}
                    >
                      <div className={`font-medium mb-1 ${currentProblemIndex === idx ? 'text-indigo-600' : 'text-gray-900'}`}>
                        {p.title}
                      </div>
                      <div className="flex justify-between items-center text-xs text-gray-500">
                        <span className="capitalize">{p.difficulty}</span>
                        <span className="text-indigo-600">{p.language}</span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center text-gray-400 text-sm">이 레벨에 해당하는 문제가 없습니다.</div>
              )}
            </div>
          </div>
        </div>

        {currentProblem ? (
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            {/* Problem description - collapsible on mobile */}
            <div className="md:hidden border-b border-gray-200 bg-white">
              <button
                type="button"
                onClick={() => setShowProblem(!showProblem)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700"
              >
                <span>문제 설명: {currentProblem.title}</span>
                {showProblem ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>
            
            <div className={`${showProblem ? 'block' : 'hidden'} md:block w-full md:w-1/2 overflow-y-auto border-r border-gray-200 bg-white p-3 sm:p-6 max-h-[40vh] md:max-h-none`}>
              <div className="prose max-w-none">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">{currentProblem.title}</h3>
                <div className="whitespace-pre-line text-gray-700 mb-8">{currentProblem.description}</div>

                <h3 className="text-lg font-semibold text-gray-900 mb-4">예제 테스트 케이스</h3>
                <div className="space-y-4 mb-8">
                  {currentProblem.sample_test_cases.map((tc, idx) => (
                    <div key={tc.id} className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
                      <div className="bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 border-b border-gray-200">
                        예제 {idx + 1}
                      </div>
                      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <div className="text-xs font-semibold text-gray-700 uppercase mb-1">입력</div>
                          <pre className="bg-white p-3 rounded border border-gray-300 text-sm font-mono text-gray-900 overflow-x-auto">
                            {tc.input_data}
                          </pre>
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-gray-700 uppercase mb-1">출력</div>
                          <pre className="bg-white p-3 rounded border border-gray-300 text-sm font-mono text-gray-900 overflow-x-auto">
                            {tc.expected_output}
                          </pre>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Code Editor */}
            <div className="flex-1 flex flex-col bg-gray-900 text-white min-h-[50vh] md:min-h-0 md:w-1/2">
              <div className="px-3 sm:px-4 py-2 bg-gray-800 border-b border-gray-700 flex justify-between items-center">
                <div className="flex items-center gap-2 sm:gap-3">
                  <span className="text-sm text-gray-400 hidden sm:inline">언어:</span>
                  <select
                    value={language}
                    onChange={handleLanguageChange}
                    disabled={isLanguageLocked}
                    className="bg-gray-700 text-white text-sm rounded px-2 py-1 border border-gray-600 focus:outline-none focus:border-indigo-500 disabled:opacity-60"
                  >
                    {availableLanguages.map((lang) => (
                      <option key={lang} value={lang}>
                        {lang === 'cpp' ? 'C++' : lang === 'java' ? 'Java' : lang === 'javascript' ? 'JavaScript' : 'Python'}
                      </option>
                    ))}
                  </select>
                </div>
                
                <button
                  type="button"
                  onClick={() => setCode('')}
                  className="text-gray-400 hover:text-white transition-colors"
                  title="코드 초기화"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 relative">
                <div className="absolute inset-0 flex">
                  <div
                    ref={lineNumbersRef}
                    className="w-10 sm:w-12 bg-gray-900 text-gray-500 text-xs font-mono leading-6 py-4 pl-1 sm:pl-2 pr-1 sm:pr-2 border-r border-gray-700 overflow-hidden"
                  >
                    {lineNumbers.map((lineNumber) => (
                      <div key={lineNumber} className="h-6">
                        {lineNumber}
                      </div>
                    ))}
                  </div>
                  <textarea
                    ref={textareaRef}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    onScroll={handleEditorScroll}
                    className="flex-1 bg-gray-900 text-gray-300 font-mono py-4 pr-3 sm:pr-4 pl-2 sm:pl-3 resize-none focus:outline-none leading-6 text-sm"
                    spellCheck="false"
                    placeholder="// 여기에 코드를 작성하세요..."
                  />
                </div>
              </div>

              {output && (
                <div className="h-40 sm:h-48 border-t border-gray-700 bg-gray-800 flex flex-col">
                  <div className="px-4 py-2 bg-gray-750 border-b border-gray-700 text-xs font-semibold text-gray-400 uppercase">
                    실행 결과
                  </div>
                  <div className="flex-1 p-3 sm:p-4 font-mono text-sm overflow-auto">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className={`font-bold ${output.result === 'correct' ? 'text-green-400' : 'text-red-400'}`}>
                        {output.result.toUpperCase()}
                      </span>
                      <span className="text-gray-500">
                        ({output.test_cases_passed}/{output.test_cases_total}개 통과)
                      </span>
                    </div>
                    
                    {output.error_message && (
                      <div className="text-red-300 bg-red-900/20 p-2 rounded border border-red-800/50 mt-2 whitespace-pre-wrap text-xs sm:text-sm">
                        {output.error_message}
                      </div>
                    )}
                    
                    <div className="mt-2 text-gray-400 text-xs">
                      시간: {output.execution_time.toFixed(3)}초 | 메모리: {output.memory_used.toFixed(1)}MB
                    </div>
                  </div>
                </div>
              )}

              <div className="p-3 sm:p-4 bg-gray-800 border-t border-gray-700 flex justify-end">
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className={`flex items-center gap-2 px-4 sm:px-6 py-2.5 rounded-lg font-medium transition-all ${
                    submitting 
                      ? 'bg-indigo-700 cursor-wait opacity-70' 
                      : 'bg-indigo-600 hover:bg-indigo-500 hover:shadow-lg hover:shadow-indigo-500/20'
                  }`}
                >
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      실행중...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current" />
                      제출하기
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50 text-gray-400">
            문제를 선택하여 연습을 시작하세요
          </div>
        )}
      </div>
    </div>
  );
};

export default PracticePage;
