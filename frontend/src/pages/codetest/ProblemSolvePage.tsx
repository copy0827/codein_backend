import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Play, RotateCcw, CheckCircle, XCircle, ArrowLeft, Clock, Monitor, ChevronDown, ChevronUp } from 'lucide-react';
import { getTest, submitCode, getProblemSubmissions } from '../../api/codetest';
import type { TestDetail, Problem, Submission, SubmitResult } from '../../types/codetest';

const LANGUAGE_TEMPLATES: Record<string, string> = {
  python: 'import sys\n\n# Read input from stdin\n# input = sys.stdin.readline\n\n',
  javascript: 'const fs = require("fs");\n\nconst input = fs.readFileSync(0, "utf8").trim();\n\n',
  java: 'import java.io.*;\nimport java.util.*;\n\npublic class Main {\n  public static void main(String[] args) throws Exception {\n    BufferedReader br = new BufferedReader(new InputStreamReader(System.in));\n    String input = br.readLine();\n  }\n}\n',
  cpp: '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n  ios::sync_with_stdio(false);\n  cin.tie(nullptr);\n\n  return 0;\n}\n'
};

const getTemplateForLanguage = (selectedLanguage: string) => (
  LANGUAGE_TEMPLATES[selectedLanguage] ?? ''
);

const SUBMISSION_LANGUAGE_LABELS: Record<string, string> = {
  python: 'Python',
  javascript: 'JavaScript',
  java: 'Java',
  cpp: 'C++'
};

const getSubmissionLanguageLabel = (languageKey: string) => (
  SUBMISSION_LANGUAGE_LABELS[languageKey] ?? languageKey
);

const formatSubmissionDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');

  return `${year}.${month}.${day}`;
};

const ProblemSolvePage: React.FC = () => {
  const { testId, problemId } = useParams<{ testId: string; problemId: string }>();
  const navigate = useNavigate();
  
  const [test, setTest] = useState<TestDetail | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showProblem, setShowProblem] = useState(true);
  
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('python');
  const [output, setOutput] = useState<SubmitResult | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [submissionFilter, setSubmissionFilter] = useState<'all' | 'correct' | 'wrong'>('all');
  const [editorFontSize, setEditorFontSize] = useState<number>(() => Number(localStorage.getItem('codein_editor_font_size') || 14));
  const lineNumbersRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!testId || !problemId) return;
      setLoading(true);
      try {
        const testData = await getTest(parseInt(testId));
        setTest(testData);
        
        const foundProblem = testData.problems.find(p => p.id === parseInt(problemId));
        if (foundProblem) {
          setProblem(foundProblem);
          setLanguage(foundProblem.language);
          setCode(getTemplateForLanguage(foundProblem.language));
        }
        
        const submissionsData = await getProblemSubmissions(parseInt(problemId));
        setSubmissions(submissionsData);
      } catch (error) {
        console.error('Failed to load problem', error);
        toast.error('Failed to load problem details');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [testId, problemId]);

  const isLanguageLocked = Boolean(problem?.language && problem.language !== 'all');
  const availableLanguages = isLanguageLocked ? [problem?.language ?? 'python'] : ['python', 'javascript', 'java', 'cpp'];

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
    if (!problemId || !code.trim()) return;
    
    setSubmitting(true);
    setOutput(null);
    try {
      const result = await submitCode(parseInt(problemId), code, language);
      setOutput(result);
      const submissionsData = await getProblemSubmissions(parseInt(problemId));
      setSubmissions(submissionsData);
    } catch (error) {
      console.error('Submission error', error);
      toast.error('Failed to submit code');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLoadSubmission = (sub: Submission) => {
    setLanguage(sub.language);
    setCode(sub.code);
    toast.success('해당 제출 코드를 에디터에 불러왔습니다.');
  };

  const handleRejudge = async (sub: Submission) => {
    if (!problemId) return;
    setSubmitting(true);
    setOutput(null);
    const loadingToast = toast.loading('재제출 중입니다.. 잠시만 기다려주세요');
    try {
      const result = await submitCode(parseInt(problemId), sub.code, sub.language);
      setOutput(result);
      const submissionsData = await getProblemSubmissions(parseInt(problemId));
      setSubmissions(submissionsData);
      toast.success('재채점(재제출) 완료');
    } catch (error) {
      console.error('Rejudge error', error);
      toast.error('재채점에 실패했습니다.');
    } finally {
      toast.dismiss(loadingToast);
      setSubmitting(false);
    }
  };

  const handleAntiCheat = (e: React.ClipboardEvent<HTMLTextAreaElement> | React.MouseEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    toast.error('이 환경에서는 복사, 붙여넣기, 잘라내기 기능이 제한되어 있습니다.', {
      id: 'anti-cheat-toast',
    });
  };


  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    const isChromium = ua.includes('chrome') || ua.includes('chromium') || ua.includes('edg') || ua.includes('brave');
    if (!isChromium) return;

    const block = (e: Event) => {
      const target = e.target as Node | null;
      const el = textareaRef.current;
      if (!el || !target) return;
      const insideEditor = target === el || (target instanceof Node && el.contains(target));
      if (!insideEditor) return;

      const ie = e as InputEvent;
      const inputType = (ie as any).inputType as string | undefined;
      const isPasteLike = e.type === 'paste' || e.type === 'drop' || inputType === 'insertFromPaste' || inputType === 'insertFromDrop';

      if (isPasteLike || e.type === 'copy' || e.type === 'cut' || e.type === 'contextmenu') {
        e.preventDefault();
        e.stopPropagation();
        toast.error('이 환경에서는 복사, 붙여넣기, 잘라내기 기능이 제한되어 있습니다.', {
          id: 'anti-cheat-toast',
        });
      }
    };

    const opts: AddEventListenerOptions = { capture: true };
    document.addEventListener('paste', block, opts);
    document.addEventListener('drop', block, opts);
    document.addEventListener('beforeinput', block, opts);
    document.addEventListener('copy', block, opts);
    document.addEventListener('cut', block, opts);
    document.addEventListener('contextmenu', block, opts);

    return () => {
      document.removeEventListener('paste', block, opts);
      document.removeEventListener('drop', block, opts);
      document.removeEventListener('beforeinput', block, opts);
      document.removeEventListener('copy', block, opts);
      document.removeEventListener('cut', block, opts);
      document.removeEventListener('contextmenu', block, opts);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('codein_editor_font_size', String(editorFontSize));
  }, [editorFontSize]);

  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const isPasteShortcut = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v';
    const isShiftInsert = e.shiftKey && e.key === 'Insert';
    if (isPasteShortcut || isShiftInsert) {
      e.preventDefault();
      toast.error('이 환경에서는 복사, 붙여넣기, 잘라내기 기능이 제한되어 있습니다.', { id: 'anti-cheat-toast' });
    }
  };

  const filteredSubmissions = submissions.filter((sub) => submissionFilter === 'all' ? true : sub.result === submissionFilter);

  const lineNumbers = Array.from(
    { length: Math.max(1, code.split('\n').length) },
    (_, index) => index + 1
  );


  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!test || !problem) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <h2 className="text-xl font-bold text-gray-800 mb-2">문제를 찾을 수 없습니다</h2>
        <button 
          type="button"
          onClick={() => navigate(`/contest/${testId}`)}
          className="text-indigo-600 hover:underline"
        >
          테스트로 돌아가기
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-64px)] md:h-[calc(100vh-64px)] flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-3 sm:px-6 py-3 flex flex-col gap-3 shadow-sm z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <button 
              type="button"
              onClick={() => navigate(`/contest/${testId}`)}
              className="text-gray-500 hover:text-gray-900 transition-colors flex-shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold text-gray-900 truncate">{problem.title}</h1>
              <div className="text-xs text-gray-500 flex items-center gap-2 flex-wrap">
                <span className="truncate">{test.title}</span>
                <span className="w-1 h-1 bg-gray-300 rounded-full flex-shrink-0"></span>
                <span className="capitalize">{problem.difficulty}</span>
                <span className="w-1 h-1 bg-gray-300 rounded-full flex-shrink-0"></span>
                <span>{problem.points} pts</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600 bg-gray-100 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg">
            <span>응시 {problem.participant_count || 0}명</span>
          </div>
          <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600 bg-gray-100 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg">
            <span>정답률 {problem.success_rate || 0}%</span>
          </div>
          <div className="flex items-center gap-1 text-xs sm:text-sm text-gray-600 bg-gray-100 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg">
            <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
            <span>{problem.time_limit}s</span>
          </div>
          <div className="flex items-center gap-1 text-xs sm:text-sm text-gray-600 bg-gray-100 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg">
            <Monitor className="w-3 h-3 sm:w-4 sm:h-4" />
            <span>{problem.memory_limit}MB</span>
          </div>
        </div>
      </div>

      {/* Main Content - Split View */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left Panel - Problem Description (collapsible on mobile) */}
        <div className="md:hidden border-b border-gray-200 bg-white">
          <button
            type="button"
            onClick={() => setShowProblem(!showProblem)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700"
          >
            <span>문제 설명</span>
            {showProblem ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        <div className={`${showProblem ? 'block' : 'hidden'} md:block w-full md:w-1/2 overflow-y-auto md:border-r border-gray-200 bg-white p-3 sm:p-6 max-h-[40vh] md:max-h-none`}>
          <div className="prose max-w-none">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">문제 설명</h3>
            <div className="whitespace-pre-line text-gray-700 mb-8">{problem.description}</div>

            <h3 className="text-lg font-semibold text-gray-900 mb-4">예제 테스트 케이스</h3>
            <div className="space-y-4 mb-8">
              {problem.sample_test_cases.map((tc, idx) => (
                <div key={tc.id} className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
                  <div className="bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 border-b border-gray-200">
                    예제 {idx + 1}
                  </div>
                  <div className="p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <div className="text-xs font-semibold text-gray-700 uppercase mb-1">입력</div>
                      <pre className="bg-white p-2 sm:p-3 rounded border border-gray-300 text-xs sm:text-sm font-mono text-gray-900 overflow-x-auto">
                        {tc.input_data}
                      </pre>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-gray-700 uppercase mb-1">출력</div>
                      <pre className="bg-white p-2 sm:p-3 rounded border border-gray-300 text-xs sm:text-sm font-mono text-gray-900 overflow-x-auto">
                        {tc.expected_output}
                      </pre>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {submissions.length > 0 && (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">제출 기록</h3>
                  <select
                    value={submissionFilter}
                    onChange={(e) => setSubmissionFilter(e.target.value as 'all' | 'correct' | 'wrong')}
                    className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700"
                  >
                    <option value="all">전체</option>
                    <option value="correct">정답</option>
                    <option value="wrong">오답</option>
                  </select>
                </div>

                {/* Desktop table */}
                <div className="hidden sm:block border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-2">결과</th>
                        <th className="px-4 py-2">언어</th>
                        <th className="px-4 py-2">시간</th>
                        <th className="px-4 py-2">날짜</th>
                        <th className="px-4 py-2">동작</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {filteredSubmissions.map((sub) => (
                        <tr key={sub.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2">
                            <span className={`inline-flex items-center gap-1.5 ${
                              sub.result === 'correct' ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {sub.result === 'correct' ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                              <span className="capitalize">{sub.result === 'correct' ? '정답' : sub.result === 'wrong' ? '오답' : sub.result}</span>
                            </span>
                          </td>
                          <td className="px-4 py-2 text-gray-600">
                            {getSubmissionLanguageLabel(sub.language)}
                          </td>
                          <td className="px-4 py-2 text-gray-600">{sub.execution_time.toFixed(3)}s</td>
                          <td className="px-4 py-2 text-gray-600">
                            {formatSubmissionDate(sub.submitted_at)}
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-2">
                              <button type="button" onClick={() => handleLoadSubmission(sub)} className="rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-100">불러오기</button>
                              <button type="button" onClick={() => handleRejudge(sub)} className="rounded border border-indigo-300 px-2 py-0.5 text-xs text-indigo-700 hover:bg-indigo-50">재채점</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards */}
                <div className="sm:hidden space-y-3">
                  {filteredSubmissions.map((sub) => (
                    <div key={sub.id} className="border border-gray-200 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className={`inline-flex items-center gap-1.5 text-sm ${
                          sub.result === 'correct' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {sub.result === 'correct' ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                          <span className="capitalize font-medium">{sub.result === 'correct' ? '정답' : sub.result === 'wrong' ? '오답' : sub.result}</span>
                        </span>
                        <span className="text-xs text-gray-500">{formatSubmissionDate(sub.submitted_at)}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-600 mb-2">
                        <span>{getSubmissionLanguageLabel(sub.language)}</span>
                        <span>{sub.execution_time.toFixed(3)}s</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => handleLoadSubmission(sub)} className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-100">불러오기</button>
                        <button type="button" onClick={() => handleRejudge(sub)} className="rounded border border-indigo-300 px-2 py-1 text-xs text-indigo-700 hover:bg-indigo-50">재채점</button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right Panel - Code Editor */}
        <div className="flex-1 flex flex-col bg-gray-900 text-white min-h-[50vh] md:min-h-0 w-full md:w-1/2">
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
                    {getSubmissionLanguageLabel(lang)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1 text-xs text-gray-400">
              <span className="hidden sm:inline">글자</span>
              <button type="button" onClick={() => setEditorFontSize((v) => Math.max(12, v - 1))} className="px-1 hover:text-white">-</button>
              <span className="w-6 text-center">{editorFontSize}</span>
              <button type="button" onClick={() => setEditorFontSize((v) => Math.min(22, v + 1))} className="px-1 hover:text-white">+</button>
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
                onCopy={handleAntiCheat}
                onPaste={handleAntiCheat}
                onCut={handleAntiCheat}
                onContextMenu={handleAntiCheat}
                onKeyDown={handleEditorKeyDown}
                onDrop={handleAntiCheat}
                className="flex-1 bg-gray-900 text-gray-300 font-mono py-4 pr-3 sm:pr-4 pl-2 sm:pl-3 resize-none focus:outline-none leading-6"
                style={{ fontSize: `${editorFontSize}px` }}
                spellCheck="false"
                placeholder="// 여기에 코드를 작성하세요..."
              />
            </div>
          </div>

          {/* Output Console */}
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

          {/* Action Bar */}
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
    </div>
  );
};

export default ProblemSolvePage;
