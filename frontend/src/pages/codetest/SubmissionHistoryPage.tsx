import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getSubmissions, getTests, getTest, submitCode } from '../../api/codetest';
import type { Submission } from '../../types/codetest';
import toast from 'react-hot-toast';

const PAGE_SIZE = 15;

const SubmissionHistoryPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [problemTitleMap, setProblemTitleMap] = useState<Record<number, string>>({});

  const [query, setQuery] = useState('');
  const [language, setLanguage] = useState('all');
  const [result, setResult] = useState<'all' | 'correct' | 'wrong'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [expandedErrorId, setExpandedErrorId] = useState<number | null>(null);
  const [rejudgingId, setRejudgingId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getSubmissions();
      setSubmissions(data);

      const tests = await getTests();
      const details = await Promise.all(tests.map((t) => getTest(t.id)));
      const map: Record<number, string> = {};
      details.forEach((d) => {
        d.problems.forEach((p) => {
          map[p.id] = p.title;
        });
      });
      setProblemTitleMap(map);
    } catch (e) {
      console.error(e);
      toast.error('제출 내역을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const languages = useMemo(() => {
    const set = new Set(submissions.map((s) => s.language).filter(Boolean));
    return ['all', ...Array.from(set)];
  }, [submissions]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const fromTs = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
    const toTs = dateTo ? new Date(`${dateTo}T23:59:59`).getTime() : null;

    return submissions.filter((s) => {
      if (language !== 'all' && s.language !== language) return false;
      if (result !== 'all' && s.result !== result) return false;

      const ts = new Date(s.submitted_at).getTime();
      if (fromTs && ts < fromTs) return false;
      if (toTs && ts > toTs) return false;

      if (q) {
        const title = (problemTitleMap[s.problem_id] || '').toLowerCase();
        const pid = String(s.problem_id);
        if (!title.includes(q) && !pid.includes(q)) return false;
      }
      return true;
    });
  }, [submissions, language, result, dateFrom, dateTo, query, problemTitleMap]);

  useEffect(() => {
    setPage(1);
  }, [query, language, result, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const handleRejudge = async (s: Submission) => {
    setRejudgingId(s.id);
    const loadingToast = toast.loading('재제출 중입니다.. 잠시만 기다려주세요');
    try {
      await submitCode(s.problem_id, s.code, s.language);
      toast.success('재채점 요청 완료');
      await load();
    } catch (e) {
      console.error(e);
      toast.error('재채점 실패');
    } finally {
      toast.dismiss(loadingToast);
      setRejudgingId(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-dark-text">내 제출 히스토리</h1>
        <button onClick={load} className="rounded-lg border border-dark-line px-3 py-2 text-sm text-dark-text">새로고침</button>
      </div>

      <div className="rounded-2xl border border-dark-line bg-dark-card p-4 grid gap-3 md:grid-cols-5">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="문제명/문제ID 검색" className="md:col-span-2 rounded-lg border border-dark-line bg-dark-bg px-3 py-2 text-sm text-dark-text" />
        <select value={language} onChange={(e) => setLanguage(e.target.value)} className="rounded-lg border border-dark-line bg-dark-bg px-3 py-2 text-sm text-dark-text">
          {languages.map((l) => (<option key={l} value={l}>{l === 'all' ? '전체 언어' : l}</option>))}
        </select>
        <select value={result} onChange={(e) => setResult(e.target.value as any)} className="rounded-lg border border-dark-line bg-dark-bg px-3 py-2 text-sm text-dark-text">
          <option value="all">전체 결과</option>
          <option value="correct">정답</option>
          <option value="wrong">오답</option>
        </select>
        <div className="flex gap-2">
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full rounded-lg border border-dark-line bg-dark-bg px-2 py-2 text-sm text-dark-text" />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full rounded-lg border border-dark-line bg-dark-bg px-2 py-2 text-sm text-dark-text" />
        </div>
      </div>

      <div className="responsive-table-wrap rounded-2xl border border-dark-line bg-dark-card overflow-hidden">
        {loading ? (
          <div className="p-6 text-sm text-dark-muted">로딩 중...</div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-sm text-dark-muted">조건에 맞는 제출 내역이 없습니다.</div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-dark-bg2 text-dark-muted">
                <tr>
                  <th className="px-4 py-3 text-left">문제</th>
                  <th className="px-4 py-3 text-left">언어</th>
                  <th className="px-4 py-3 text-left">결과</th>
                  <th className="px-4 py-3 text-left">통과</th>
                  <th className="px-4 py-3 text-left">시간</th>
                  <th className="px-4 py-3 text-left">동작</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((s) => (
                  <React.Fragment key={s.id}>
                    <tr className="border-t border-dark-line">
                      <td className="px-4 py-3">
                        <div className="text-dark-text font-medium">{problemTitleMap[s.problem_id] || `문제 #${s.problem_id}`}</div>
                        <div className="text-xs text-dark-muted">ID: {s.problem_id}</div>
                      </td>
                      <td className="px-4 py-3 text-dark-text">
                        <span className="rounded bg-blue-500/15 px-2 py-1 text-xs text-blue-300">{s.language}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs ${s.result === 'correct' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                          {s.result}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-dark-text">{s.test_cases_passed}/{s.test_cases_total}</td>
                      <td className="px-4 py-3 text-dark-muted">{new Date(s.submitted_at).toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Link to="/contest" className="rounded border border-dark-line px-2 py-1 text-xs text-dark-text">테스트 목록</Link>
                          <button disabled={rejudgingId === s.id} onClick={() => handleRejudge(s)} className="rounded border border-brand/40 px-2 py-1 text-xs text-brand disabled:opacity-50">{rejudgingId === s.id ? "재제출 중..." : "재채점"}</button>
                          {s.error_message && (
                            <button
                              onClick={() => setExpandedErrorId(expandedErrorId === s.id ? null : s.id)}
                              className="rounded border border-red-400/40 px-2 py-1 text-xs text-red-300"
                            >
                              에러 보기
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expandedErrorId === s.id && s.error_message && (
                      <tr className="border-t border-dark-line bg-dark-bg/40">
                        <td colSpan={6} className="px-4 py-3">
                          <pre className="whitespace-pre-wrap break-words text-xs text-red-300">{s.error_message}</pre>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && filtered.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-dark-muted">총 {filtered.length}건 · {page}/{totalPages} 페이지</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-dark-line px-3 py-1.5 text-sm text-dark-text disabled:opacity-40"
            >
              이전
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-lg border border-dark-line px-3 py-1.5 text-sm text-dark-text disabled:opacity-40"
            >
              다음
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubmissionHistoryPage;
