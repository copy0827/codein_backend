import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import {
  addProblemBankTestCase,
  createProblemBank,
  deleteProblemBank,
  deleteProblemBankTestCase,
  getProblemBankDetail,
  getProblemBankList,
  updateProblemBank,
  updateProblemBankTestCase,
  type ProblemBankCreatePayload,
  type ProblemBankTestCaseCreatePayload,
  type ProblemBankUpdatePayload
} from '../../api/codetest';
import type { ProblemBank, ProblemBankDetail } from '../../types/codetest';

const defaultFormState: ProblemBankCreatePayload = {
  title: '',
  description: '',
  level: 1,
  language: 'python',
  time_limit: 5,
  memory_limit: 256,
  difficulty: 'easy',
  points: 100,
  is_public: false
};

const createEmptyTestcase = (): ProblemBankTestCaseCreatePayload => ({
  input_data: '',
  expected_output: '',
  is_sample: false,
  order: 0
});

const ProblemBankAdminPage: React.FC = () => {
  const [problems, setProblems] = useState<ProblemBank[]>([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState<ProblemBankCreatePayload>(defaultFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [testcaseForms, setTestcaseForms] = useState<Record<number, ProblemBankTestCaseCreatePayload>>({});
  const [detailOpen, setDetailOpen] = useState<Record<number, boolean>>({});
  const [details, setDetails] = useState<Record<number, ProblemBankDetail>>({});
  const [editForms, setEditForms] = useState<Record<number, ProblemBankUpdatePayload>>({});
  const [testcaseEditForms, setTestcaseEditForms] = useState<Record<number, ProblemBankTestCaseCreatePayload>>({});
  const [activeLanguageTab, setActiveLanguageTab] = useState<string>('python');

  const hydrateProblemDetails = useCallback(async (problems: ProblemBank[]) => {
    try {
      const details = await Promise.all(
        problems.map(async (problem) => getProblemBankDetail(problem.id))
      );
      const nextDetails: Record<number, ProblemBankDetail> = {};
      const nextForms: Record<number, ProblemBankTestCaseCreatePayload> = {};
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
      setDetails(nextDetails);
      setTestcaseEditForms(nextForms);
    } catch (error) {
      console.error('Failed to hydrate problem details', error);
    }
  }, []);

  const fetchProblems = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getProblemBankList();
      setProblems(data);
      if (data.length) {
        await hydrateProblemDetails(data);
      }
    } catch (error) {
      console.error('Failed to fetch problem bank', error);
      toast.error('문제은행을 불러오는데 실패했습니다');
    } finally {
      setLoading(false);
    }
  }, [hydrateProblemDetails]);

  useEffect(() => {
    fetchProblems();
  }, [fetchProblems]);

  const refreshDetail = useCallback(async (problemId: number) => {
    try {
      const data = await getProblemBankDetail(problemId);
      setDetails((prev) => ({ ...prev, [problemId]: data }));
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

  const handleFormChange = (key: keyof ProblemBankCreatePayload, value: string | number | boolean) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formData.title || !formData.description) {
      toast.error('필수 항목을 입력해주세요');
      return;
    }

    setIsSubmitting(true);
    try {
      await createProblemBank(formData);
      toast.success('문제가 등록되었습니다');
      setFormData(defaultFormState);
      await fetchProblems();
    } catch (error) {
      console.error('Failed to create problem bank', error);
      toast.error('문제 등록에 실패했습니다');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVisibilityChange = async (problemId: number, nextValue: boolean) => {
    try {
      const updated = await updateProblemBank(problemId, { is_public: nextValue });
      setProblems((prev) => prev.map((problem) => (problem.id === problemId ? updated : problem)));
      setDetails((prev) => (prev[problemId] ? { ...prev, [problemId]: updated } : prev));
      toast.success(nextValue ? '공개로 변경되었습니다' : '비공개로 변경되었습니다');
    } catch (error) {
      console.error('Failed to update visibility', error);
      toast.error('공개 설정 변경에 실패했습니다');
    }
  };

  const handleEditStart = (problem: ProblemBank) => {
    setEditForms((prev) => ({
      ...prev,
      [problem.id]: {
        title: problem.title,
        description: problem.description,
        level: problem.level,
        language: problem.language,
        time_limit: problem.time_limit,
        memory_limit: problem.memory_limit,
        difficulty: problem.difficulty,
        points: problem.points,
        is_public: problem.is_public
      }
    }));
    setDetailOpen((prev) => ({ ...prev, [problem.id]: true }));
    void refreshDetail(problem.id);
  };

  const handleEditChange = (
    problemId: number,
    key: keyof ProblemBankUpdatePayload,
    value: string | number | boolean
  ) => {
    setEditForms((prev) => ({
      ...prev,
      [problemId]: {
        ...prev[problemId],
        [key]: value
      }
    }));
  };

  const handleEditSave = async (problemId: number) => {
    const payload = editForms[problemId];
    if (!payload?.title || !payload?.description) {
      toast.error('필수 항목을 입력해주세요');
      return;
    }

    try {
      const updated = await updateProblemBank(problemId, payload);
      setProblems((prev) => prev.map((problem) => (problem.id === problemId ? updated : problem)));
      setDetails((prev) => ({ ...prev, [problemId]: updated }));
      toast.success('문제가 수정되었습니다');
    } catch (error) {
      console.error('Failed to update problem', error);
      toast.error('문제 수정에 실패했습니다');
    }
  };

  const handleDeleteProblem = async (problemId: number) => {
    if (!window.confirm('문제를 삭제할까요?')) return;
    try {
      await deleteProblemBank(problemId);
      setProblems((prev) => prev.filter((problem) => problem.id !== problemId));
      setDetails((prev) => {
        const next = { ...prev };
        delete next[problemId];
        return next;
      });
      toast.success('문제가 삭제되었습니다');
    } catch (error) {
      console.error('Failed to delete problem', error);
      toast.error('문제 삭제에 실패했습니다');
    }
  };

  const handleDetailToggle = async (problemId: number) => {
    const nextValue = !detailOpen[problemId];
    setDetailOpen((prev) => ({ ...prev, [problemId]: nextValue }));
    if (nextValue) {
      await refreshDetail(problemId);
    }
  };

  const handleTestcaseChange = (
    problemId: number,
    key: keyof ProblemBankTestCaseCreatePayload,
    value: string | number | boolean
  ) => {
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
      await addProblemBankTestCase(problemId, payload);
      toast.success('테스트케이스가 추가되었습니다');
      setTestcaseForms((prev) => ({ ...prev, [problemId]: createEmptyTestcase() }));
      await refreshDetail(problemId);
      await fetchProblems();
    } catch (error) {
      console.error('Failed to add testcase', error);
      toast.error('테스트케이스 추가에 실패했습니다');
    }
  };

  const handleTestcaseEditChange = (
    testcaseId: number,
    key: keyof ProblemBankTestCaseCreatePayload,
    value: string | number | boolean
  ) => {
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
      await updateProblemBankTestCase(testcaseId, payload);
      toast.success('테스트케이스가 수정되었습니다');
      await refreshDetail(problemId);
    } catch (error) {
      console.error('Failed to update testcase', error);
      toast.error('테스트케이스 수정에 실패했습니다');
    }
  };

  const handleTestcaseDelete = async (problemId: number, testcaseId: number) => {
    if (!window.confirm('테스트케이스를 삭제할까요?')) return;
    try {
      await deleteProblemBankTestCase(testcaseId);
      toast.success('테스트케이스가 삭제되었습니다');
      await refreshDetail(problemId);
    } catch (error) {
      console.error('Failed to delete testcase', error);
      toast.error('테스트케이스 삭제에 실패했습니다');
    }
  };

  const filteredProblems = problems.filter((p) => p.language === activeLanguageTab);

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-dark-text tracking-tight">문제은행 관리</h1>
        <p className="text-dark-muted">연습문제 공개 여부를 관리하고 문제를 등록합니다.</p>
      </div>

      <div className="rounded-2xl border border-dark-line bg-dark-card p-6">
        <h2 className="text-lg font-semibold text-dark-text mb-4">문제 등록</h2>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="bank-title" className="block text-sm text-dark-muted mb-1">제목</label>
            <input
              id="bank-title"
              type="text"
              value={formData.title}
              onChange={(event) => handleFormChange('title', event.target.value)}
              className="w-full rounded-xl border border-dark-line bg-dark-cardSoft px-3 py-2 text-sm text-dark-text"
            />
          </div>
          <div>
            <label htmlFor="bank-desc" className="block text-sm text-dark-muted mb-1">설명</label>
            <textarea
              id="bank-desc"
              value={formData.description}
              onChange={(event) => handleFormChange('description', event.target.value)}
              className="w-full rounded-xl border border-dark-line bg-dark-cardSoft px-3 py-2 text-sm text-dark-text"
              rows={4}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="bank-level" className="block text-sm text-dark-muted mb-1">레벨</label>
              <input
                id="bank-level"
                type="number"
                min={1}
                max={5}
                value={formData.level}
                onChange={(event) => handleFormChange('level', Number(event.target.value))}
                className="w-full rounded-xl border border-dark-line bg-dark-cardSoft px-3 py-2 text-sm text-dark-text"
              />
            </div>
            <div>
              <label htmlFor="bank-language" className="block text-sm text-dark-muted mb-1">언어</label>
              <select
                id="bank-language"
                value={formData.language}
                onChange={(event) => handleFormChange('language', event.target.value)}
                className="w-full rounded-xl border border-dark-line bg-dark-bg px-3 py-2 text-sm text-dark-text"
              >
                                <option value="python">python</option>
                <option value="javascript">javascript</option>
                <option value="java">java</option>
                <option value="cpp">cpp</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label htmlFor="bank-time" className="block text-sm text-dark-muted mb-1">시간 제한</label>
              <input
                id="bank-time"
                type="number"
                min={1}
                value={formData.time_limit}
                onChange={(event) => handleFormChange('time_limit', Number(event.target.value))}
                className="w-full rounded-xl border border-dark-line bg-dark-cardSoft px-3 py-2 text-sm text-dark-text"
              />
            </div>
            <div>
              <label htmlFor="bank-memory" className="block text-sm text-dark-muted mb-1">메모리 제한</label>
              <input
                id="bank-memory"
                type="number"
                min={1}
                value={formData.memory_limit}
                onChange={(event) => handleFormChange('memory_limit', Number(event.target.value))}
                className="w-full rounded-xl border border-dark-line bg-dark-cardSoft px-3 py-2 text-sm text-dark-text"
              />
            </div>
            <div>
              <label htmlFor="bank-points" className="block text-sm text-dark-muted mb-1">포인트</label>
              <input
                id="bank-points"
                type="number"
                min={0}
                value={formData.points}
                onChange={(event) => handleFormChange('points', Number(event.target.value))}
                className="w-full rounded-xl border border-dark-line bg-dark-cardSoft px-3 py-2 text-sm text-dark-text"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="bank-difficulty" className="block text-sm text-dark-muted mb-1">난이도</label>
              <select
                id="bank-difficulty"
                value={formData.difficulty}
                onChange={(event) => handleFormChange('difficulty', event.target.value)}
                className="w-full rounded-xl border border-dark-line bg-dark-bg px-3 py-2 text-sm text-dark-text"
              >
                <option value="easy">easy</option>
                <option value="medium">medium</option>
                <option value="hard">hard</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="bank-public"
                type="checkbox"
                checked={formData.is_public}
                onChange={(event) => handleFormChange('is_public', event.target.checked)}
                className="h-4 w-4 rounded border-dark-line bg-dark-cardSoft text-brand"
              />
              <label htmlFor="bank-public" className="text-sm text-dark-muted">공개 문제</label>
            </div>
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-light transition-colors disabled:opacity-60"
          >
            {isSubmitting ? '등록 중...' : '문제 등록'}
          </button>
        </form>
      </div>

      <div className="rounded-2xl border border-dark-line bg-dark-card p-6">
        <h2 className="text-lg font-semibold text-dark-text mb-4">문제 목록</h2>
        <div className="mb-4 flex flex-wrap gap-2">
          {['python', 'javascript', 'java', 'cpp'].map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => setActiveLanguageTab(lang)}
              className={`rounded-lg border px-3 py-1.5 text-xs ${activeLanguageTab === lang ? 'border-brand bg-brand/20 text-brand' : 'border-dark-line text-dark-text'}`}
            >
              {lang}
            </button>
          ))}
        </div>
        {loading ? (
          <div className="text-sm text-dark-muted">불러오는 중...</div>
        ) : (
          <div className="space-y-4">
            {filteredProblems.length === 0 ? (
              <div className="text-sm text-dark-muted">등록된 문제가 없습니다.</div>
            ) : (
              filteredProblems.map((problem) => (
                <div key={problem.id} className="rounded-xl border border-dark-line bg-dark-cardSoft p-4 space-y-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="text-sm text-dark-muted">레벨 {problem.level}</div>
                      <div className="text-base font-semibold text-dark-text">{problem.title}</div>
                      <div className="text-xs text-dark-muted mt-1">
                        예제 {problem.sample_test_cases.length}개 · 전체 {(details[problem.id]?.test_cases.length ?? problem.sample_test_cases.length)}개
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-xs px-2 py-1 rounded-full border ${problem.is_public ? 'border-emerald-500/40 text-emerald-400' : 'border-orange-500/40 text-orange-400'}`}>
                        {problem.is_public ? '공개' : '비공개'}
                      </span>
                      <label className="flex items-center gap-2 text-xs text-dark-muted">
                        <input
                          type="checkbox"
                          checked={problem.is_public}
                          onChange={(event) => handleVisibilityChange(problem.id, event.target.checked)}
                          className="h-4 w-4 rounded border-dark-line bg-dark-cardSoft text-brand"
                        />
                        공개
                      </label>
                      <button
                        type="button"
                        onClick={() => handleDetailToggle(problem.id)}
                        className="rounded-xl border border-dark-line px-2.5 py-1 text-xs font-semibold text-dark-text hover:border-brand transition-colors"
                      >
                        {detailOpen[problem.id] ? '접기' : '테스트케이스'}
                      </button>
                      <button
                        type="button"
                        onClick={() => (editForms[problem.id] ? handleEditSave(problem.id) : handleEditStart(problem))}
                        className="rounded-xl border border-dark-line px-2.5 py-1 text-xs font-semibold text-dark-text hover:border-brand transition-colors"
                      >
                        {editForms[problem.id] ? '저장' : '수정'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteProblem(problem.id)}
                        className="rounded-xl border border-dark-line px-2.5 py-1 text-xs font-semibold text-red-400 hover:border-red-400 transition-colors"
                      >
                        삭제
                      </button>
                    </div>
                  </div>

                  {editForms[problem.id] && (
                    <div className="grid gap-3 rounded-xl border border-dark-line bg-dark-card p-4">
                      <div>
                        <label htmlFor={`edit-title-${problem.id}`} className="block text-xs text-dark-muted mb-1">제목</label>
                        <input
                          id={`edit-title-${problem.id}`}
                          type="text"
                          value={editForms[problem.id]?.title || ''}
                          onChange={(event) => handleEditChange(problem.id, 'title', event.target.value)}
                          className="w-full rounded-xl border border-dark-line bg-dark-cardSoft px-3 py-2 text-xs text-dark-text"
                        />
                      </div>
                      <div>
                        <label htmlFor={`edit-desc-${problem.id}`} className="block text-xs text-dark-muted mb-1">설명</label>
                        <textarea
                          id={`edit-desc-${problem.id}`}
                          value={editForms[problem.id]?.description || ''}
                          onChange={(event) => handleEditChange(problem.id, 'description', event.target.value)}
                          className="w-full rounded-xl border border-dark-line bg-dark-cardSoft px-3 py-2 text-xs text-dark-text"
                          rows={3}
                        />
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div>
                          <label htmlFor={`edit-level-${problem.id}`} className="block text-xs text-dark-muted mb-1">레벨</label>
                          <input
                            id={`edit-level-${problem.id}`}
                            type="number"
                            min={1}
                            max={5}
                            value={editForms[problem.id]?.level ?? 1}
                            onChange={(event) => handleEditChange(problem.id, 'level', Number(event.target.value))}
                            className="w-full rounded-xl border border-dark-line bg-dark-cardSoft px-3 py-2 text-xs text-dark-text"
                          />
                        </div>
                        <div>
                          <label htmlFor={`edit-language-${problem.id}`} className="block text-xs text-dark-muted mb-1">언어</label>
                          <select
                            id={`edit-language-${problem.id}`}
                            value={editForms[problem.id]?.language || 'python'}
                            onChange={(event) => handleEditChange(problem.id, 'language', event.target.value)}
                            className="w-full rounded-xl border border-dark-line bg-dark-bg px-3 py-2 text-xs text-dark-text"
                          >
                                                        <option value="python">python</option>
                            <option value="javascript">javascript</option>
                            <option value="java">java</option>
                            <option value="cpp">cpp</option>
                          </select>
                        </div>
                      </div>
                      <div className="grid gap-3 md:grid-cols-3">
                        <div>
                          <label htmlFor={`edit-time-${problem.id}`} className="block text-xs text-dark-muted mb-1">시간 제한</label>
                          <input
                            id={`edit-time-${problem.id}`}
                            type="number"
                            min={1}
                            value={editForms[problem.id]?.time_limit ?? 1}
                            onChange={(event) => handleEditChange(problem.id, 'time_limit', Number(event.target.value))}
                            className="w-full rounded-xl border border-dark-line bg-dark-cardSoft px-3 py-2 text-xs text-dark-text"
                          />
                        </div>
                        <div>
                          <label htmlFor={`edit-memory-${problem.id}`} className="block text-xs text-dark-muted mb-1">메모리 제한</label>
                          <input
                            id={`edit-memory-${problem.id}`}
                            type="number"
                            min={1}
                            value={editForms[problem.id]?.memory_limit ?? 1}
                            onChange={(event) => handleEditChange(problem.id, 'memory_limit', Number(event.target.value))}
                            className="w-full rounded-xl border border-dark-line bg-dark-cardSoft px-3 py-2 text-xs text-dark-text"
                          />
                        </div>
                        <div>
                          <label htmlFor={`edit-points-${problem.id}`} className="block text-xs text-dark-muted mb-1">포인트</label>
                          <input
                            id={`edit-points-${problem.id}`}
                            type="number"
                            min={0}
                            value={editForms[problem.id]?.points ?? 0}
                            onChange={(event) => handleEditChange(problem.id, 'points', Number(event.target.value))}
                            className="w-full rounded-xl border border-dark-line bg-dark-cardSoft px-3 py-2 text-xs text-dark-text"
                          />
                        </div>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div>
                          <label htmlFor={`edit-difficulty-${problem.id}`} className="block text-xs text-dark-muted mb-1">난이도</label>
                          <select
                            id={`edit-difficulty-${problem.id}`}
                            value={editForms[problem.id]?.difficulty || 'easy'}
                            onChange={(event) => handleEditChange(problem.id, 'difficulty', event.target.value)}
                            className="w-full rounded-xl border border-dark-line bg-dark-bg px-3 py-2 text-xs text-dark-text"
                          >
                            <option value="easy">easy</option>
                            <option value="medium">medium</option>
                            <option value="hard">hard</option>
                          </select>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            id={`edit-public-${problem.id}`}
                            type="checkbox"
                            checked={editForms[problem.id]?.is_public ?? false}
                            onChange={(event) => handleEditChange(problem.id, 'is_public', event.target.checked)}
                            className="h-4 w-4 rounded border-dark-line bg-dark-cardSoft text-brand"
                          />
                          <label htmlFor={`edit-public-${problem.id}`} className="text-xs text-dark-muted">공개 문제</label>
                        </div>
                      </div>
                    </div>
                  )}

                  <form className="grid gap-3" onSubmit={(event) => handleTestcaseSubmit(problem.id, event)}>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <label htmlFor={`bank-input-${problem.id}`} className="block text-xs text-dark-muted mb-1">입력</label>
                        <textarea
                          id={`bank-input-${problem.id}`}
                          value={testcaseForms[problem.id]?.input_data || ''}
                          onChange={(event) => handleTestcaseChange(problem.id, 'input_data', event.target.value)}
                          className="w-full rounded-xl border border-dark-line bg-dark-cardSoft px-3 py-2 text-xs text-dark-text"
                          rows={2}
                        />
                      </div>
                      <div>
                        <label htmlFor={`bank-output-${problem.id}`} className="block text-xs text-dark-muted mb-1">출력</label>
                        <textarea
                          id={`bank-output-${problem.id}`}
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
                          id={`bank-sample-${problem.id}`}
                          type="checkbox"
                          checked={testcaseForms[problem.id]?.is_sample || false}
                          onChange={(event) => handleTestcaseChange(problem.id, 'is_sample', event.target.checked)}
                          className="h-4 w-4 rounded border-dark-line bg-dark-cardSoft text-brand"
                        />
                        <label htmlFor={`bank-sample-${problem.id}`} className="text-xs text-dark-muted">예제 여부</label>
                      </div>
                      <div className="flex items-center gap-2">
                        <label htmlFor={`bank-order-${problem.id}`} className="text-xs text-dark-muted">순서</label>
                        <input
                          id={`bank-order-${problem.id}`}
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

                  {detailOpen[problem.id] && details[problem.id] && (
                    <div className="space-y-3 rounded-xl border border-dark-line bg-dark-card p-4">
                      <div className="text-sm text-dark-muted">등록된 테스트케이스</div>
                      {details[problem.id]?.test_cases.length ? (
                        <div className="space-y-3">
                          {details[problem.id]?.test_cases.map((testcase) => {
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
                                    <label htmlFor={`edit-input-${testcase.id}`} className="block text-xs text-dark-muted mb-1">입력</label>
                                    <textarea
                                      id={`edit-input-${testcase.id}`}
                                      value={editForm.input_data}
                                      onChange={(event) => handleTestcaseEditChange(testcase.id, 'input_data', event.target.value)}
                                      className="w-full rounded-xl border border-dark-line bg-dark-cardSoft px-3 py-2 text-xs text-dark-text"
                                      rows={2}
                                    />
                                  </div>
                                  <div>
                                    <label htmlFor={`edit-output-${testcase.id}`} className="block text-xs text-dark-muted mb-1">출력</label>
                                    <textarea
                                      id={`edit-output-${testcase.id}`}
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
                                      id={`edit-sample-${testcase.id}`}
                                      type="checkbox"
                                      checked={editForm.is_sample}
                                      onChange={(event) => handleTestcaseEditChange(testcase.id, 'is_sample', event.target.checked)}
                                      className="h-4 w-4 rounded border-dark-line bg-dark-cardSoft text-brand"
                                    />
                                    <label htmlFor={`edit-sample-${testcase.id}`} className="text-xs text-dark-muted">예제</label>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <label htmlFor={`edit-order-${testcase.id}`} className="text-xs text-dark-muted">순서</label>
                                    <input
                                      id={`edit-order-${testcase.id}`}
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
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProblemBankAdminPage;
