import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { 
  createTest, 
  deleteTest, 
  getTests, 
  updateTest, 
  getTestParticipants,
  type TestCreatePayload, 
  type TestUpdatePayload,
  type TestParticipantStats 
} from '../../api/codetest';
import { getUserDetail, type UserAdminOut } from '../../api/admin';
import type { Test } from '../../types/codetest';
import UserDetailModal from '../../components/admin/UserDetailModal';

const CodetestAdminPage: React.FC = () => {
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    start_time: '',
    end_time: ''
  });
  const [editingTestId, setEditingTestId] = useState<number | null>(null);
  const [editFormData, setEditFormData] = useState<TestUpdatePayload>({});

  const [showParticipantsModal, setShowParticipantsModal] = useState(false);
  const [participants, setParticipants] = useState<TestParticipantStats[]>([]);
  const [participantsLoading, setParticipantsLoading] = useState(false);
  const [selectedTestForParticipants, setSelectedTestForParticipants] = useState<Test | null>(null);
  const [selectedUserForDetail, setSelectedUserForDetail] = useState<UserAdminOut | null>(null);
  const [userDetailLoading, setUserDetailLoading] = useState<number | null>(null);

  const fetchTests = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getTests();
      setTests(data);
    } catch (error) {
      console.error('Failed to fetch tests', error);
      toast.error('테스트 목록을 불러오는데 실패했습니다');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchParticipants = async (test: Test) => {
    setSelectedTestForParticipants(test);
    setShowParticipantsModal(true);
    setParticipantsLoading(true);
    try {
      const data = await getTestParticipants(test.id);
      setParticipants(data);
    } catch (error) {
      console.error('Failed to fetch participants', error);
      toast.error('참여자 목록을 불러오는데 실패했습니다');
    } finally {
      setParticipantsLoading(false);
    }
  };

  const handleParticipantClick = async (userId: number) => {
    setUserDetailLoading(userId as any); // Use userId as loading state indicator
    try {
      const user = await getUserDetail(userId);
      setSelectedUserForDetail(user);
    } catch (error) {
      console.error('Failed to fetch user details', error);
      toast.error('사용자 정보를 불러오는데 실패했습니다');
    } finally {
      setUserDetailLoading(null);
    }
  };

  useEffect(() => {
    fetchTests();
  }, [fetchTests]);

  const handleChange = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formData.title || !formData.start_time || !formData.end_time) {
      toast.error('필수 항목을 입력해주세요');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: TestCreatePayload = {
        title: formData.title,
        start_time: new Date(formData.start_time).toISOString(),
        end_time: new Date(formData.end_time).toISOString()
      };
      await createTest(payload);
      toast.success('테스트가 생성되었습니다');
      setFormData({ title: '', start_time: '', end_time: '' });
      await fetchTests();
    } catch (error) {
      console.error('Failed to create test', error);
      toast.error('테스트 생성에 실패했습니다');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTest = async (testId: number) => {
    if (!window.confirm('테스트를 삭제할까요? 관련 된 모든 문제와 제출 데이터가 사라집니다.')) return;
    try {
      await deleteTest(testId);
      toast.success('테스트가 삭제되었습니다');
      await fetchTests();
    } catch (error) {
      console.error('Failed to delete test', error);
      toast.error('테스트 삭제에 실패했습니다');
    }
  };

  const startEditingTest = (test: Test) => {
    setEditingTestId(test.id);
    setEditFormData({
      title: test.title,
      start_time: new Date(test.start_time).toISOString().slice(0, 16),
      end_time: new Date(test.end_time).toISOString().slice(0, 16)
    });
  };

  const handleUpdateTest = async () => {
    if (!editingTestId) return;
    try {
      const payload: TestUpdatePayload = {
        title: editFormData.title,
        start_time: editFormData.start_time ? new Date(editFormData.start_time).toISOString() : undefined,
        end_time: editFormData.end_time ? new Date(editFormData.end_time).toISOString() : undefined
      };
      await updateTest(editingTestId, payload);
      toast.success('테스트가 수정되었습니다');
      setEditingTestId(null);
      await fetchTests();
    } catch (error) {
      console.error('Failed to update test', error);
      toast.error('테스트 수정에 실패했습니다');
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-dark-text tracking-tight">코딩테스트 관리</h1>
        <p className="text-dark-muted">테스트를 생성하고 문제를 구성합니다.</p>
      </div>

      <div className="rounded-2xl border border-dark-line bg-dark-card p-6">
        <h2 className="text-lg font-semibold text-dark-text mb-4">테스트 생성</h2>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="test-title" className="block text-sm text-dark-muted mb-1">제목</label>
            <input
              id="test-title"
              type="text"
              value={formData.title}
              onChange={(event) => handleChange('title', event.target.value)}
              className="w-full rounded-xl border border-dark-line bg-dark-cardSoft px-3 py-2 text-sm text-dark-text"
              placeholder="예: 3월 코딩테스트"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="test-start" className="block text-sm text-dark-muted mb-1">시작 시간</label>
              <input
                id="test-start"
                type="datetime-local"
                value={formData.start_time}
                onChange={(event) => handleChange('start_time', event.target.value)}
                className="w-full rounded-xl border border-dark-line bg-dark-cardSoft px-3 py-2 text-sm text-dark-text"
              />
            </div>
            <div>
              <label htmlFor="test-end" className="block text-sm text-dark-muted mb-1">종료 시간</label>
              <input
                id="test-end"
                type="datetime-local"
                value={formData.end_time}
                onChange={(event) => handleChange('end_time', event.target.value)}
                className="w-full rounded-xl border border-dark-line bg-dark-cardSoft px-3 py-2 text-sm text-dark-text"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-light transition-colors disabled:opacity-60"
          >
            {isSubmitting ? '생성 중...' : '테스트 생성'}
          </button>
        </form>
      </div>

      <div className="rounded-2xl border border-dark-line bg-dark-card p-6">
        <h2 className="text-lg font-semibold text-dark-text mb-4">테스트 목록</h2>
        {loading ? (
          <div className="text-sm text-dark-muted">불러오는 중...</div>
        ) : (
          <div className="space-y-3">
            {tests.length === 0 ? (
              <div className="text-sm text-dark-muted">등록된 테스트가 없습니다.</div>
            ) : (
              tests.map((test) => (
                <div key={test.id} className="flex flex-col gap-3 rounded-xl border border-dark-line bg-dark-cardSoft p-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="text-sm text-dark-muted">테스트</div>
                    <div className="text-base font-semibold text-dark-text">{test.title}</div>
                    <div className="text-xs text-dark-muted mt-1">
                      {new Date(test.start_time).toLocaleString()} ~ {new Date(test.end_time).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-xs text-dark-muted">문제 {test.problem_count}개</span>
                    <button
                      type="button"
                      onClick={() => fetchParticipants(test)}
                      className="rounded-xl border border-dark-line px-3 py-2 text-xs font-semibold text-dark-text hover:border-brand transition-colors flex items-center gap-1.5"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                      참여자 목록
                    </button>
                    <button
                      type="button"
                      onClick={() => startEditingTest(test)}
                      className="rounded-xl border border-dark-line px-3 py-2 text-xs font-semibold text-dark-text hover:border-brand transition-colors"
                    >
                      기본 정보 수정
                    </button>
                    <Link
                      to={`/admin/codetest/tests/${test.id}`}
                      className="rounded-xl border border-dark-line px-3 py-2 text-xs font-semibold text-dark-text hover:border-brand transition-colors"
                    >
                      문제 관리
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDeleteTest(test.id)}
                      className="rounded-xl border border-dark-line px-3 py-2 text-xs font-semibold text-red-400 hover:border-red-400 transition-colors"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              )).concat(editingTestId ? [
                <div key="edit-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
                  <div className="w-full max-w-lg rounded-2xl border border-dark-line bg-dark-card p-6 shadow-2xl">
                    <h2 className="text-xl font-bold text-dark-text mb-6">테스트 정보 수정</h2>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm text-dark-muted mb-1">제목</label>
                        <input
                          type="text"
                          value={editFormData.title || ''}
                          onChange={(e) => setEditFormData(prev => ({ ...prev, title: e.target.value }))}
                          className="w-full rounded-xl border border-dark-line bg-dark-cardSoft px-3 py-2 text-sm text-dark-text"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-dark-muted mb-1">시작 시간</label>
                        <input
                          type="datetime-local"
                          value={editFormData.start_time || ''}
                          onChange={(e) => setEditFormData(prev => ({ ...prev, start_time: e.target.value }))}
                          className="w-full rounded-xl border border-dark-line bg-dark-cardSoft px-3 py-2 text-sm text-dark-text"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-dark-muted mb-1">종료 시간</label>
                        <input
                          type="datetime-local"
                          value={editFormData.end_time || ''}
                          onChange={(e) => setEditFormData(prev => ({ ...prev, end_time: e.target.value }))}
                          className="w-full rounded-xl border border-dark-line bg-dark-cardSoft px-3 py-2 text-sm text-dark-text"
                        />
                      </div>
                    </div>
                    <div className="flex gap-3 mt-8">
                      <button
                        onClick={handleUpdateTest}
                        className="flex-1 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-light transition-colors"
                      >
                        저장하기
                      </button>
                      <button
                        onClick={() => setEditingTestId(null)}
                        className="flex-1 rounded-xl border border-dark-line px-4 py-2 text-sm font-semibold text-dark-text hover:border-brand transition-colors"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                </div>
              ] : [])
            )}
          </div>
        )}
      </div>
      {/* Participants Modal */}
      {showParticipantsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8 animate-fade-in text-dark-text">
          <div className="flex h-full max-h-[85vh] w-full max-w-3xl flex-col rounded-2xl border border-dark-line bg-dark-card p-6 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-dark-line pb-4">
              <div>
                <h3 className="text-xl font-bold">참여자 현황</h3>
                <p className="text-sm text-dark-muted mt-0.5">{selectedTestForParticipants?.title}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowParticipantsModal(false)}
                className="text-dark-muted hover:text-dark-text px-2 py-1 rounded-lg hover:bg-dark-cardSoft transition-colors"
              >
                닫기
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pt-6 custom-scrollbar">
              {participantsLoading ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-dark-muted">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent"></div>
                  <p className="text-sm font-medium">데이터 불러오는 중...</p>
                </div>
              ) : participants.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-dark-muted">
                  <svg className="h-12 w-12 opacity-20 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  <p className="text-sm font-medium">아직 참여자가 없습니다.</p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-dark-line bg-dark-bg/20">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-dark-cardSoft text-xs uppercase text-dark-muted border-b border-dark-line">
                      <tr>
                        <th className="px-6 py-3 font-semibold">이름 (학번)</th>
                        <th className="px-6 py-3 font-semibold text-center">도전 문제</th>
                        <th className="px-6 py-3 font-semibold text-center">정답</th>
                        <th className="px-6 py-3 font-semibold text-center text-red-400">오답</th>
                        <th className="px-6 py-3 font-semibold text-right">상세</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-dark-line">
                      {participants.map((p) => (
                        <tr 
                          key={p.user_id} 
                          className="hover:bg-dark-cardSoft/30 transition-colors cursor-pointer"
                          onClick={() => handleParticipantClick(p.user_id)}
                        >
                          <td className="px-6 py-4">
                            <div className="font-medium text-dark-text">{p.user_name}</div>
                            <div className="text-[11px] text-dark-muted">{p.student_id}</div>
                          </td>
                          <td className="px-6 py-4 text-center font-semibold">
                            {p.total_submissions}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
                              {p.correct_count}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="inline-flex items-center rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-400">
                              {p.wrong_count}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            {userDetailLoading === p.user_id ? (
                              <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand border-t-transparent ml-auto"></div>
                            ) : (
                              <span className="text-[11px] font-bold text-brand hover:text-brand-light">기록 보기</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* User Detail Modal */}
      {selectedUserForDetail && (
        <UserDetailModal
          user={selectedUserForDetail}
          onClose={() => setSelectedUserForDetail(null)}
          onUserUpdated={() => {}}
          initialTab="submissions"
        />
      )}
    </div>
  );
};

export default CodetestAdminPage;
