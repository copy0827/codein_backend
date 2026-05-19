import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
  addProblemFromBank,
  addProblemToTest,
  addTestCase,
  deleteTestCase,
  getProblemBankList,
  getProblemDetail,
  getTest,
  updateProblem,
  updateTestCase,
  deleteProblem,
  type ProblemCreatePayload,
  type ProblemUpdatePayload,
  type ProblemFromBankPayload,
  type TestCaseCreatePayload
} from '../../api/codetest';
import type { ProblemBank, ProblemDetail, TestDetail } from '../../types/codetest';

const createEmptyTestcase = (): TestCaseCreatePayload => ({
  input_data: '',
  expected_output: '',
  is_sample: false,
  order: 0
});

const CodetestTestDetailPage: React.FC = () => {
  const { testId } = useParams<{ testId: string }>();
  const numericTestId = useMemo(() => Number(testId), [testId]);
  const [test, setTest] = useState<TestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [problemBank, setProblemBank] = useState<ProblemBank[]>([]);
  const [problemDetails, setProblemDetails] = useState<Record<number, ProblemDetail>>({});
  const [detailOpen, setDetailOpen] = useState<Record<number, boolean>>({});
  const [testcaseEditForms, setTestcaseEditForms] = useState<Record<number, TestCaseCreatePayload>>({});
  const [problemForm, setProblemForm] = useState<ProblemCreatePayload>({
    title: '',
    description: '',
    language: 'python',
    time_limit: 5,
    memory_limit: 256,
    difficulty: 'easy',
    points: 100
  });
  const [bankForm, setBankForm] = useState<{ problem_bank_id: string }>({ problem_bank_id: '' });
  const [testcaseForms, setTestcaseForms] = useState<Record<number, TestCaseCreatePayload>>({});
  const [editingProblemId, setEditingProblemId] = useState<number | null>(null);
  const [problemEditForms, setProblemEditForms] = useState<Record<number, ProblemUpdatePayload>>({});

  const hydrateProblemDetails = useCallback(async (problems: { id: number }[]) => {
    try {
      const details = await Promise.all(
        problems.map(async (problem) => getProblemDetail(problem.id))
      );
      const nextDetails: Record<number, ProblemDetail> = {};
      const nextForms: Record<number, TestCaseCreatePayload> = {};
      details.forEach((detail) => {
        nextDetails[detail.id] = detail;
        detail.test_cases.forEach((testcase) => {
          nextForms[testcase.id] = {
            input_data: testcase.input_data,
            expected_output: testcase.expected_output,
            is_sample: testcase.is_sample,
            order: testcase.order
          };
        });
      });
      setProblemDetails(nextDetails);
      setTestcaseEditForms(nextForms);
    } catch (error) {
      console.error('Failed to hydrate problem details', error);
    }
  }, []);

  const fetchTest = useCallback(async () => {
    if (!numericTestId) return;
    setLoading(true);
    try {
      const data = await getTest(numericTestId);
      setTest(data);
      if (data.problems.length) {
        await hydrateProblemDetails(data.problems);
      }
    } catch (error) {
      console.error('Failed to fetch test', error);
      toast.error('테스트 정보를 불러오지 못했습니다');
    } finally {
      setLoading(false);
    }
  }, [hydrateProblemDetails, numericTestId]);

  const fetchProblemBank = useCallback(async () => {
    try {
      const data = await getProblemBankList();
      setProblemBank(data);
    } catch (error) {
      console.error('Failed to fetch problem bank', error);
      toast.error('문제은행을 불러오지 못했습니다');
    }
  }, []);

  const refreshProblemDetail = useCallback(async (problemId: number) => {
    try {
      const data = await getProblemDetail(problemId);
      setProblemDetails((prev) => ({ ...prev, [problemId]: data }));
      setTestcaseEditForms((prev) => {
        const next = { ...prev };
        data.test_cases.forEach((testcase) => {
          next[testcase.id] = {
            input_data: testcase.input_data,
            expected_output: testcase.expected_output,
            is_sample: testcase.is_sample,
            order: testcase.order
          };
        });
        return next;
      });
    } catch (error) {
      console.error('Failed to fetch problem detail', error);
      toast.error('문제 상세를 불러오지 못했습니다');
    }
  }, []);

  useEffect(() => {
    fetchTest();
    fetchProblemBank();
  }, [fetchTest, fetchProblemBank]);

  const handleProblemChange = (key: keyof ProblemCreatePayload, value: string | number) => {
    setProblemForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleProblemSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!numericTestId) return;
    if (!problemForm.title || !problemForm.description) {
      toast.error('필수 항목을 입력해주세요');
      return;
    }

    try {
      await addProblemToTest(numericTestId, problemForm);
      toast.success('문제가 추가되었습니다');
      setProblemForm({
        title: '',
        description: '',
        language: 'python',
        time_limit: 5,
        memory_limit: 256,
        difficulty: 'easy',
        points: 100
      });
      await fetchTest();
    } catch (error) {
      console.error('Failed to add problem', error);
      toast.error('문제 추가에 실패했습니다');
    }
  };

  const handleProblemFromBank = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!numericTestId || !bankForm.problem_bank_id) {
      toast.error('문제은행을 선택해주세요');
      return;
    }

    const payload: ProblemFromBankPayload = {
      problem_bank_id: Number(bankForm.problem_bank_id)
    };

    try {
      await addProblemFromBank(numericTestId, payload);
      toast.success('문제은행에서 문제가 추가되었습니다');
      setBankForm({ problem_bank_id: '' });
      await fetchTest();
    } catch (error) {
      console.error('Failed to add problem from bank', error);
      toast.error('문제은행 문제 추가에 실패했습니다');
    }
  };

  const handleProblemDelete = async (problemId: number) => {
    if (!window.confirm('정말로 이 문제를 삭제하시겠습니까? 관련 된 모든 테스트케이스와 제출 이력이 삭제됩니다.')) return;
    try {
      await deleteProblem(problemId);
      toast.success('문제가 삭제되었습니다');
      await fetchTest();
    } catch (error) {
      console.error('Failed to delete problem', error);
      toast.error('문제 삭제에 실패했습니다');
    }
  };

  const startEditingProblem = (problem: ProblemDetail | ProblemBank | any) => {
    setEditingProblemId(problem.id);
    setProblemEditForms((prev) => ({
      ...prev,
      [problem.id]: {
        title: problem.title,
        description: problem.description,
        language: problem.language,
        time_limit: problem.time_limit,
        memory_limit: problem.memory_limit,
        difficulty: problem.difficulty,
        points: problem.points
      }
    }));
  };

  const handleProblemEditChange = (problemId: number, key: keyof ProblemUpdatePayload, value: string | number) => {
    setProblemEditForms((prev) => ({
      ...prev,
      [problemId]: {
        ...prev[problemId],
        [key]: value
      }
    }));
  };

  const handleProblemUpdate = async (problemId: number) => {
    const payload = problemEditForms[problemId];
    if (!payload?.title || !payload?.description) {
      toast.error('필수 항목을 입력해주세요');
      return;
    }

    try {
      await updateProblem(problemId, payload);
      toast.success('문제가 수정되었습니다');
      setEditingProblemId(null);
      await fetchTest();
    } catch (error) {
      console.error('Failed to update problem', error);
      toast.error('문제 수정에 실패했습니다');
    }
  };

  const handleTestcaseChange = (problemId: number, key: keyof TestCaseCreatePayload, value: string | number | boolean) => {
    setTestcaseForms((prev) => {
      const current = prev[problemId] || createEmptyTestcase();
      return {
        ...prev,
        [problemId]: {
          ...current,
          [key]: value
        }
      };
    });
  };

  const handleTestcaseSubmit = async (problemId: number, event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = testcaseForms[problemId];
    if (!payload?.input_data || !payload?.expected_output) {
      toast.error('입력/출력 데이터를 입력해주세요');
      return;
    }

    try {
      await addTestCase(problemId, payload);
      toast.success('테스트케이스가 추가되었습니다');
      setTestcaseForms((prev) => ({ ...prev, [problemId]: createEmptyTestcase() }));
      await refreshProblemDetail(problemId);
      await fetchTest();
    } catch (error) {
      console.error('Failed to add testcase', error);
      toast.error('테스트케이스 추가에 실패했습니다');
    }
  };

  const handleDetailToggle = async (problemId: number) => {
    const nextValue = !detailOpen[problemId];
    setDetailOpen((prev) => ({ ...prev, [problemId]: nextValue }));
    if (nextValue) {
      await refreshProblemDetail(problemId);
    }
  };

  const handleTestcaseEditChange = (testcaseId: number, key: keyof TestCaseCreatePayload, value: string | number | boolean) => {
    setTestcaseEditForms((prev) => ({
      ...prev,
      [testcaseId]: {
        ...prev[testcaseId],
        [key]: value
      }
    }));
  };

  const handleTestcaseUpdate = async (problemId: number, testcaseId: number) => {
    const payload = testcaseEditForms[testcaseId];
    if (!payload?.input_data || !payload?.expected_output) {
      toast.error('입력/출력 데이터를 입력해주세요');
      return;
    }

    try {
      await updateTestCase(testcaseId, payload);
      toast.success('테스트케이스가 수정되었습니다');
      await refreshProblemDetail(problemId);
    } catch (error) {
      console.error('Failed to update testcase', error);
      toast.error('테스트케이스 수정에 실패했습니다');
    }
  };

  const handleTestcaseDelete = async (problemId: number, testcaseId: number) => {
    if (!window.confirm('테스트케이스를 삭제할까요?')) return;
    try {
      await deleteTestCase(testcaseId);
      toast.success('테스트케이스가 삭제되었습니다');
      await refreshProblemDetail(problemId);
    } catch (error) {
      console.error('Failed to delete testcase', error);
      toast.error('테스트케이스 삭제에 실패했습니다');
    }
  };

  if (!numericTestId) {
    return <div className="text-dark-muted">잘못된 테스트 ID입니다.</div>;
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <Link
            to="/admin/codetest"
            className="text-xs text-dark-muted hover:text-dark-text transition-colors"
          >
            ← 목록으로
          </Link>
        </div>
        <h1 className="text-3xl font-bold text-dark-text tracking-tight">테스트 상세</h1>
        {test && <p className="text-dark-muted">{test.title}</p>}
      </div>

      <div className="rounded-2xl border border-dark-line bg-dark-card p-6">
        <h2 className="text-lg font-semibold text-dark-text mb-4">문제 추가</h2>
        <form className="grid gap-4" onSubmit={handleProblemSubmit}>
          <div>
            <label htmlFor="problem-title" className="block text-sm text-dark-muted mb-1">문제 제목</label>
            <input
              id="problem-title"
              type="text"
              value={problemForm.title}
              onChange={(event) => handleProblemChange('title', event.target.value)}
              className="w-full rounded-xl border border-dark-line bg-dark-cardSoft px-3 py-2 text-sm text-dark-text"
            />
          </div>
          <div>
            <label htmlFor="problem-desc" className="block text-sm text-dark-muted mb-1">설명</label>
            <textarea
              id="problem-desc"
              value={problemForm.description}
              onChange={(event) => handleProblemChange('description', event.target.value)}
              className="w-full rounded-xl border border-dark-line bg-dark-cardSoft px-3 py-2 text-sm text-dark-text"
              rows={4}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="problem-language" className="block text-sm text-dark-muted mb-1">언어</label>
              <select
                id="problem-language"
                value={problemForm.language}
                onChange={(event) => handleProblemChange('language', event.target.value)}
                className="w-full rounded-xl border border-dark-line bg-dark-cardSoft px-3 py-2 text-sm text-dark-text"
              >
                <option value="all">all</option>
                <option value="python">python</option>
                <option value="javascript">javascript</option>
                <option value="java">java</option>
                <option value="cpp">cpp</option>
              </select>
            </div>
            <div>
              <label htmlFor="problem-difficulty" className="block text-sm text-dark-muted mb-1">난이도</label>
              <select
                id="problem-difficulty"
                value={problemForm.difficulty}
                onChange={(event) => handleProblemChange('difficulty', event.target.value)}
                className="w-full rounded-xl border border-dark-line bg-dark-cardSoft px-3 py-2 text-sm text-dark-text"
              >
                <option value="easy">easy</option>
                <option value="medium">medium</option>
                <option value="hard">hard</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label htmlFor="problem-time" className="block text-sm text-dark-muted mb-1">시간 제한</label>
              <input
                id="problem-time"
                type="number"
                min={1}
                value={problemForm.time_limit}
                onChange={(event) => handleProblemChange('time_limit', Number(event.target.value))}
                className="w-full rounded-xl border border-dark-line bg-dark-cardSoft px-3 py-2 text-sm text-dark-text"
              />
            </div>
            <div>
              <label htmlFor="problem-memory" className="block text-sm text-dark-muted mb-1">메모리 제한</label>
              <input
                id="problem-memory"
                type="number"
                min={1}
                value={problemForm.memory_limit}
                onChange={(event) => handleProblemChange('memory_limit', Number(event.target.value))}
                className="w-full rounded-xl border border-dark-line bg-dark-cardSoft px-3 py-2 text-sm text-dark-text"
              />
            </div>
            <div>
              <label htmlFor="problem-points" className="block text-sm text-dark-muted mb-1">포인트</label>
              <input
                id="problem-points"
                type="number"
                min={0}
                value={problemForm.points}
                onChange={(event) => handleProblemChange('points', Number(event.target.value))}
                className="w-full rounded-xl border border-dark-line bg-dark-cardSoft px-3 py-2 text-sm text-dark-text"
              />
            </div>
          </div>
          <button
            type="submit"
            className="w-full rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-light transition-colors"
          >
            문제 추가
          </button>
        </form>
      </div>

      <div className="rounded-2xl border border-dark-line bg-dark-card p-6">
        <h2 className="text-lg font-semibold text-dark-text mb-4">문제은행에서 추가</h2>
        <form className="flex flex-col gap-4 md:flex-row md:items-end" onSubmit={handleProblemFromBank}>
          <div className="flex-1">
            <label htmlFor="bank-select" className="block text-sm text-dark-muted mb-1">문제은행 선택</label>
            <select
              id="bank-select"
              value={bankForm.problem_bank_id}
              onChange={(event) => setBankForm({ problem_bank_id: event.target.value })}
              className="w-full rounded-xl border border-dark-line bg-dark-cardSoft px-3 py-2 text-sm text-dark-text"
            >
              <option value="">선택하세요</option>
              {problemBank.map((problem) => (
                <option key={problem.id} value={problem.id}>
                  {problem.title} ({problem.is_public ? '공개' : '비공개'})
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="rounded-xl border border-dark-line px-4 py-2 text-sm font-semibold text-dark-text hover:border-brand transition-colors"
          >
            문제 추가
          </button>
        </form>
      </div>

      <div className="rounded-2xl border border-dark-line bg-dark-card p-6">
        <h2 className="text-lg font-semibold text-dark-text mb-4">등록된 문제</h2>
        {loading ? (
          <div className="text-sm text-dark-muted">불러오는 중...</div>
        ) : (
          <div className="space-y-4">
            {test?.problems.length ? (
              test.problems.map((problem) => (
                <div key={problem.id} className="rounded-xl border border-dark-line bg-dark-cardSoft p-4 space-y-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="text-sm text-dark-muted">{problem.difficulty}</div>
                      <div className="text-base font-semibold text-dark-text">{problem.title}</div>
                      <div className="text-xs text-dark-muted mt-1">
                        예제 {problem.sample_test_cases.length}개 · 전체 {(problemDetails[problem.id]?.test_cases.length ?? problem.sample_test_cases.length)}개
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleDetailToggle(problem.id)}
                        className="rounded-xl border border-dark-line px-3 py-2 text-xs font-semibold text-dark-text hover:border-brand transition-colors"
                      >
                        {detailOpen[problem.id] ? '테스트케이스 숨기기' : '테스트케이스 보기'}
                      </button>
                      <button
                        type="button"
                        onClick={() => startEditingProblem(problem)}
                        className="rounded-xl border border-dark-line px-3 py-2 text-xs font-semibold text-dark-text hover:border-brand transition-colors"
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        onClick={() => handleProblemDelete(problem.id)}
                        className="rounded-xl border border-dark-line px-3 py-2 text-xs font-semibold text-red-400 hover:border-red-400 transition-colors"
                      >
                        삭제
                      </button>
                    </div>
                  </div>

                  {editingProblemId === problem.id && (
                    <div className="grid gap-4 p-4 rounded-xl border border-dark-line bg-dark-card mt-2 animate-fade-in">
                      <h3 className="text-sm font-semibold text-dark-text">문제 수정</h3>
                      <div>
                        <label className="block text-xs text-dark-muted mb-1">문제 제목</label>
                        <input
                          type="text"
                          value={problemEditForms[problem.id]?.title || ''}
                          onChange={(e) => handleProblemEditChange(problem.id, 'title', e.target.value)}
                          className="w-full rounded-xl border border-dark-line bg-dark-cardSoft px-3 py-2 text-sm text-dark-text"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-dark-muted mb-1">설명</label>
                        <textarea
                          value={problemEditForms[problem.id]?.description || ''}
                          onChange={(e) => handleProblemEditChange(problem.id, 'description', e.target.value)}
                          className="w-full rounded-xl border border-dark-line bg-dark-cardSoft px-3 py-2 text-sm text-dark-text"
                          rows={4}
                        />
                      </div>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div>
                          <label className="block text-xs text-dark-muted mb-1">언어</label>
                          <select
                            value={problemEditForms[problem.id]?.language || 'python'}
                            onChange={(e) => handleProblemEditChange(problem.id, 'language', e.target.value)}
                            className="w-full rounded-xl border border-dark-line bg-dark-cardSoft px-3 py-2 text-sm text-dark-text"
                          >
                            <option value="all">all</option>
                            <option value="python">python</option>
                            <option value="javascript">javascript</option>
                            <option value="java">java</option>
                            <option value="cpp">cpp</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-dark-muted mb-1">난이도</label>
                          <select
                            value={problemEditForms[problem.id]?.difficulty || 'easy'}
                            onChange={(e) => handleProblemEditChange(problem.id, 'difficulty', e.target.value)}
                            className="w-full rounded-xl border border-dark-line bg-dark-cardSoft px-3 py-2 text-sm text-dark-text"
                          >
                            <option value="easy">easy</option>
                            <option value="medium">medium</option>
                            <option value="hard">hard</option>
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <div>
                          <label className="block text-xs text-dark-muted mb-1">시간 제한</label>
                          <input
                            type="number"
                            min={1}
                            value={problemEditForms[problem.id]?.time_limit || 5}
                            onChange={(e) => handleProblemEditChange(problem.id, 'time_limit', Number(e.target.value))}
                            className="w-full rounded-xl border border-dark-line bg-dark-cardSoft px-3 py-2 text-sm text-dark-text"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-dark-muted mb-1">메모리 제한</label>
                          <input
                            type="number"
                            min={1}
                            value={problemEditForms[problem.id]?.memory_limit || 256}
                            onChange={(e) => handleProblemEditChange(problem.id, 'memory_limit', Number(e.target.value))}
                            className="w-full rounded-xl border border-dark-line bg-dark-cardSoft px-3 py-2 text-sm text-dark-text"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-dark-muted mb-1">포인트</label>
                          <input
                            type="number"
                            min={0}
                            value={problemEditForms[problem.id]?.points || 100}
                            onChange={(e) => handleProblemEditChange(problem.id, 'points', Number(e.target.value))}
                            className="w-full rounded-xl border border-dark-line bg-dark-cardSoft px-3 py-2 text-sm text-dark-text"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleProblemUpdate(problem.id)}
                          className="flex-1 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-light transition-colors"
                        >
                          저장
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingProblemId(null)}
                          className="flex-1 rounded-xl border border-dark-line px-4 py-2 text-sm font-semibold text-dark-text hover:border-brand transition-colors"
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  )}
                  <form className="grid gap-3" onSubmit={(event) => handleTestcaseSubmit(problem.id, event)}>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <label htmlFor={`test-input-${problem.id}`} className="block text-xs text-dark-muted mb-1">입력</label>
                        <textarea
                          id={`test-input-${problem.id}`}
                          value={testcaseForms[problem.id]?.input_data || ''}
                          onChange={(event) => handleTestcaseChange(problem.id, 'input_data', event.target.value)}
                          className="w-full rounded-xl border border-dark-line bg-dark-cardSoft px-3 py-2 text-xs text-dark-text"
                          rows={2}
                        />
                      </div>
                      <div>
                        <label htmlFor={`test-output-${problem.id}`} className="block text-xs text-dark-muted mb-1">출력</label>
                        <textarea
                          id={`test-output-${problem.id}`}
                          value={testcaseForms[problem.id]?.expected_output || ''}
                          onChange={(event) => handleTestcaseChange(problem.id, 'expected_output', event.target.value)}
                          className="w-full rounded-xl border border-dark-line bg-dark-cardSoft px-3 py-2 text-xs text-dark-text"
                          rows={2}
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-2">
                        <input
                          id={`test-sample-${problem.id}`}
                          type="checkbox"
                          checked={testcaseForms[problem.id]?.is_sample || false}
                          onChange={(event) => handleTestcaseChange(problem.id, 'is_sample', event.target.checked)}
                          className="h-4 w-4 rounded border-dark-line bg-dark-cardSoft text-brand"
                        />
                        <label htmlFor={`test-sample-${problem.id}`} className="text-xs text-dark-muted">예제 여부</label>
                      </div>
                      <div className="flex items-center gap-2">
                        <label htmlFor={`test-order-${problem.id}`} className="text-xs text-dark-muted">순서</label>
                        <input
                          id={`test-order-${problem.id}`}
                          type="number"
                          min={0}
                          value={testcaseForms[problem.id]?.order ?? 0}
                          onChange={(event) => handleTestcaseChange(problem.id, 'order', Number(event.target.value))}
                          className="w-20 rounded-xl border border-dark-line bg-dark-cardSoft px-3 py-2 text-xs text-dark-text"
                        />
                      </div>
                      <button
                        type="submit"
                        className="rounded-xl border border-dark-line px-3 py-2 text-xs font-semibold text-dark-text hover:border-brand transition-colors"
                      >
                        테스트케이스 추가
                      </button>
                    </div>
                  </form>

                  {detailOpen[problem.id] && problemDetails[problem.id] && (
                    <div className="space-y-3 rounded-xl border border-dark-line bg-dark-card p-4">
                      <div className="text-sm text-dark-muted">등록된 테스트케이스</div>
                      {problemDetails[problem.id]?.test_cases.length ? (
                        <div className="space-y-3">
                          {problemDetails[problem.id]?.test_cases.map((testcase) => {
                            const editForm = testcaseEditForms[testcase.id] || {
                              input_data: testcase.input_data,
                              expected_output: testcase.expected_output,
                              is_sample: testcase.is_sample,
                              order: testcase.order
                            };
                            return (
                              <div key={testcase.id} className="rounded-xl border border-dark-line bg-dark-cardSoft p-3 space-y-2">
                                <div className="grid gap-2 md:grid-cols-2">
                                  <div>
                                    <label htmlFor={`detail-input-${testcase.id}`} className="block text-xs text-dark-muted mb-1">입력</label>
                                    <textarea
                                      id={`detail-input-${testcase.id}`}
                                      value={editForm.input_data}
                                      onChange={(event) => handleTestcaseEditChange(testcase.id, 'input_data', event.target.value)}
                                      className="w-full rounded-xl border border-dark-line bg-dark-cardSoft px-3 py-2 text-xs text-dark-text"
                                      rows={2}
                                    />
                                  </div>
                                  <div>
                                    <label htmlFor={`detail-output-${testcase.id}`} className="block text-xs text-dark-muted mb-1">출력</label>
                                    <textarea
                                      id={`detail-output-${testcase.id}`}
                                      value={editForm.expected_output}
                                      onChange={(event) => handleTestcaseEditChange(testcase.id, 'expected_output', event.target.value)}
                                      className="w-full rounded-xl border border-dark-line bg-dark-cardSoft px-3 py-2 text-xs text-dark-text"
                                      rows={2}
                                    />
                                  </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-3">
                                  <div className="flex items-center gap-2">
                                    <input
                                      id={`detail-sample-${testcase.id}`}
                                      type="checkbox"
                                      checked={editForm.is_sample}
                                      onChange={(event) => handleTestcaseEditChange(testcase.id, 'is_sample', event.target.checked)}
                                      className="h-4 w-4 rounded border-dark-line bg-dark-cardSoft text-brand"
                                    />
                                    <label htmlFor={`detail-sample-${testcase.id}`} className="text-xs text-dark-muted">예제</label>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <label htmlFor={`detail-order-${testcase.id}`} className="text-xs text-dark-muted">순서</label>
                                    <input
                                      id={`detail-order-${testcase.id}`}
                                      type="number"
                                      min={0}
                                      value={editForm.order}
                                      onChange={(event) => handleTestcaseEditChange(testcase.id, 'order', Number(event.target.value))}
                                      className="w-20 rounded-xl border border-dark-line bg-dark-cardSoft px-3 py-2 text-xs text-dark-text"
                                    />
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleTestcaseUpdate(problem.id, testcase.id)}
                                    className="rounded-xl border border-dark-line px-3 py-2 text-xs font-semibold text-dark-text hover:border-brand transition-colors"
                                  >
                                    저장
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleTestcaseDelete(problem.id, testcase.id)}
                                    className="rounded-xl border border-dark-line px-3 py-2 text-xs font-semibold text-red-400 hover:border-red-400 transition-colors"
                                  >
                                    삭제
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-xs text-dark-muted">등록된 테스트케이스가 없습니다.</div>
                      )}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-sm text-dark-muted">등록된 문제가 없습니다.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CodetestTestDetailPage;
