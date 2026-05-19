import React, { useCallback, useEffect, useState, type FC } from 'react';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import {
  getUserSubmissions,
  updateUser,
  resetUserPassword,
  type UserAdminOut,
  type UserAdminUpdate,
  type UserAdminSubmissionOut
} from '../../api/admin';

const ROLES = ['member', 'staff', 'admin', 'superadmin'];
const RANKS = ['unranked', 'bronze', 'silver', 'gold', 'platinum', 'diamond'];
const ROLE_LABELS: Record<string, string> = {
  member: '회원',
  staff: '운영진',
  admin: '관리자',
  superadmin: '슈퍼관리자'
};
const RANK_LABELS: Record<string, string> = {
  unranked: '언랭크',
  bronze: '브론즈',
  silver: '실버',
  gold: '골드',
  platinum: '플래티넘',
  diamond: '다이아'
};

interface UserDetailModalProps {
  user: UserAdminOut;
  onClose: () => void;
  onUserUpdated?: (updatedUser: UserAdminOut) => void;
  initialTab?: 'info' | 'submissions';
}

const UserDetailModal: FC<UserDetailModalProps> = ({
  user,
  onClose,
  onUserUpdated,
  initialTab = 'info'
}) => {
  const [activeTab, setActiveTab] = useState<'info' | 'submissions'>(initialTab);
  const [submissions, setSubmissions] = useState<UserAdminSubmissionOut[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCode, setSelectedCode] = useState<{ title: string, code: string, language: string } | null>(null);
  const [updateForm, setUpdateForm] = useState<UserAdminUpdate>({
    role: user.role,
    rank: user.rank,
    is_active: user.is_active,
    is_suspended: user.is_suspended,
    suspension_reason: user.suspension_reason || ''
  });

  const [passwordForm, setPasswordForm] = useState({
    newPassword: '',
    confirmPassword: ''
  });

  const fetchSubmissions = useCallback(async () => {
    if (activeTab !== 'submissions') return;
    setLoading(true);
    try {
      const res = await getUserSubmissions(user.id, 0, 50);
      setSubmissions(res.items);
    } catch (error) {
      console.error('Failed to fetch user submissions', error);
      toast.error('제출 내역을 불러오는데 실패했습니다');
    } finally {
      setLoading(false);
    }
  }, [user.id, activeTab]);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);



  const handlePasswordReset = async () => {
    if (!passwordForm.newPassword || passwordForm.newPassword.length < 8) {
      toast.error('비밀번호는 8자 이상이어야 합니다');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('비밀번호 확인이 일치하지 않습니다');
      return;
    }

    try {
      await resetUserPassword(user.id, passwordForm.newPassword);
      setPasswordForm({ newPassword: '', confirmPassword: '' });
      toast.success('비밀번호가 변경되었습니다');
    } catch (error) {
      console.error('Failed to reset password', error);
      toast.error('비밀번호 변경에 실패했습니다');
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const updatedUser = await updateUser(user.id, updateForm);
      toast.success('사용자 정보가 수정되었습니다');
      onUserUpdated?.(updatedUser);
      onClose();
    } catch (error) {
      console.error('Failed to update user', error);
      toast.error('사용자 정보 수정에 실패했습니다');
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8 animate-fade-in">
        <div className="flex h-full max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl border border-dark-line bg-dark-card p-6 shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between border-b border-dark-line pb-4">
            <h3 className="text-lg font-semibold text-dark-text">
              사용자 상세 정보: {user.name} ({user.student_id})
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="text-dark-muted hover:text-dark-text px-2 py-1 rounded-lg hover:bg-dark-cardSoft transition-colors"
            >
              닫기
            </button>
          </div>

          <div className="flex gap-4 border-b border-dark-line pt-4">
            <button
              type="button"
              onClick={() => setActiveTab('info')}
              className={`border-b-2 pb-2 text-sm font-semibold transition-colors ${
                activeTab === 'info'
                  ? 'border-brand text-brand'
                  : 'border-transparent text-dark-muted hover:text-dark-text'
              }`}
            >
              기본 정보
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('submissions')}
              className={`border-b-2 pb-2 text-sm font-semibold transition-colors ${
                activeTab === 'submissions'
                  ? 'border-brand text-brand'
                  : 'border-transparent text-dark-muted hover:text-dark-text'
              }`}
            >
              제출 내역
            </button>
          </div>

          <div className="flex-1 overflow-y-auto pt-6 custom-scrollbar">
            {activeTab === 'info' && (
              <form onSubmit={handleUpdate} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-dark-muted ml-1">역할</label>
                    <select
                      value={updateForm.role}
                      onChange={(e) => setUpdateForm({ ...updateForm, role: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-dark-line bg-dark-bg px-4 py-2 text-sm text-dark-text outline-none focus:border-brand transition-colors"
                    >
                      {ROLES.map((role) => (
                        <option key={role} value={role}>
                          {ROLE_LABELS[role]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm text-dark-muted ml-1">랭크</label>
                    <select
                      value={updateForm.rank}
                      onChange={(e) => setUpdateForm({ ...updateForm, rank: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-dark-line bg-dark-bg px-4 py-2 text-sm text-dark-text outline-none focus:border-brand transition-colors"
                    >
                      {RANKS.map((rank) => (
                        <option key={rank} value={rank}>
                          {RANK_LABELS[rank]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap gap-6 pt-2">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={updateForm.is_active ?? false}
                        onChange={(e) => setUpdateForm({ ...updateForm, is_active: e.target.checked })}
                        className="peer sr-only"
                      />
                      <div className="h-5 w-5 rounded border border-dark-line bg-dark-cardSoft peer-checked:bg-brand peer-checked:border-brand transition-all"></div>
                      <svg className="absolute left-1 top-1 h-3 w-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-sm text-dark-text group-hover:text-dark-text transition-colors">계정 승인</span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={updateForm.is_suspended || false}
                        onChange={(e) => setUpdateForm({ ...updateForm, is_suspended: e.target.checked })}
                        className="peer sr-only"
                      />
                      <div className="h-5 w-5 rounded border border-dark-line bg-dark-cardSoft peer-checked:bg-red-500 peer-checked:border-red-500 transition-all"></div>
                      <svg className="absolute left-1 top-1 h-3 w-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-sm text-dark-text group-hover:text-dark-text transition-colors">활동 정지</span>
                  </label>
                </div>

                {updateForm.is_suspended && (
                  <div className="animate-slide-down">
                    <label className="text-sm text-dark-muted ml-1">정지 사유</label>
                    <textarea
                      value={updateForm.suspension_reason || ''}
                      onChange={(e) => setUpdateForm({ ...updateForm, suspension_reason: e.target.value })}
                      className="mt-1 h-24 w-full rounded-xl border border-dark-line bg-dark-cardSoft px-4 py-3 text-sm text-dark-text outline-none focus:border-brand transition-colors resize-none"
                      placeholder="정지 사유를 입력하세요"
                    />
                  </div>
                )}


                <div className="rounded-xl border border-dark-line bg-dark-bg p-4 space-y-2">
                  <h4 className="text-sm font-semibold text-dark-text">슈퍼관리자 상세 정보</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                    <p className="text-dark-muted">이메일: <span className="text-dark-text">{user.email}</span></p>
                    <p className="text-dark-muted">학번: <span className="text-dark-text">{user.student_id}</span></p>
                    <p className="text-dark-muted">전공: <span className="text-dark-text">{user.major}</span></p>
                    <p className="text-dark-muted">기수: <span className="text-dark-text">{user.generation}</span></p>
                    <p className="text-dark-muted">경고 횟수: <span className="text-dark-text">{user.warning_count}</span></p>
                    <p className="text-dark-muted">정지 사유: <span className="text-dark-text">{user.suspension_reason || '-'}</span></p>
                  </div>
                  {'hashed_password' in user && (user as any).hashed_password && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-dark-muted">해시 비밀번호 보기</summary>
                      <pre className="mt-2 overflow-auto text-[11px] text-dark-muted">{(user as any).hashed_password}</pre>
                    </details>
                  )}
                </div>



                <div className="rounded-xl border border-dark-line bg-dark-bg p-4 space-y-3">
                  <h4 className="text-sm font-semibold text-dark-text">비밀번호 변경</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <input
                      type="password"
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                      className="rounded-xl border border-dark-line bg-dark-cardSoft px-3 py-2 text-sm text-dark-text"
                      placeholder="새 비밀번호 (8자 이상)"
                    />
                    <input
                      type="password"
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                      className="rounded-xl border border-dark-line bg-dark-cardSoft px-3 py-2 text-sm text-dark-text"
                      placeholder="새 비밀번호 확인"
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handlePasswordReset}
                      className="rounded-lg border border-amber-400/50 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-400/10"
                    >
                      비밀번호 변경
                    </button>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <button
                    type="submit"
                    className="rounded-xl bg-brand px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-light transition-colors shadow-lg shadow-brand/20"
                  >
                    변경 내용 저장
                  </button>
                </div>
              </form>
            )}

            {activeTab === 'submissions' && (
              <div className="space-y-4">
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3 text-dark-muted">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent"></div>
                    <p className="text-sm font-medium">제출 내역 불러오는 중...</p>
                  </div>
                ) : submissions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-dark-muted">
                    <p className="text-sm font-medium">제출 내역이 없습니다.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {Object.entries(
                      submissions.reduce((acc, sub) => {
                        const testKey = sub.test_id ? `${sub.test_id}|${sub.test_title}` : 'none|기타 / 연습';
                        if (!acc[testKey]) acc[testKey] = [];
                        acc[testKey].push(sub);
                        return acc;
                      }, {} as Record<string, UserAdminSubmissionOut[]>)
                    ).map(([testKey, testSubmissions]) => {
                      const [, testTitle] = testKey.split('|');
                      return (
                        <div key={testKey} className="space-y-3">
                          <h4 className="text-sm font-bold text-brand ml-1 flex items-center gap-2">
                            <div className="h-1.5 w-1.5 rounded-full bg-brand"></div>
                            {testTitle}
                          </h4>
                          <div className="overflow-x-auto rounded-xl border border-dark-line bg-dark-bg/30">
                            <table className="w-full text-left text-sm text-dark-muted">
                              <thead className="bg-dark-cardSoft/50 text-[11px] uppercase text-dark-text border-b border-dark-line">
                                <tr>
                                  <th className="px-4 py-2.5 text-left">문제</th>
                                  <th className="px-4 py-2.5 text-left w-[80px]">결과</th>
                                  <th className="px-4 py-2.5 text-left w-[80px]">언어</th>
                                  <th className="px-4 py-2.5 hidden sm:table-cell text-center w-[120px]">시간/메모리</th>
                                  <th className="px-4 py-2.5 text-center w-[110px]">코드</th>
                                  <th className="px-4 py-2.5 hidden md:table-cell text-right w-[160px]">제출일시</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-dark-line">
                                {testSubmissions.map((sub) => (
                                  <tr key={sub.id} className="hover:bg-dark-cardSoft/30 transition-colors">
                                    <td className="px-4 py-3 font-medium text-dark-text">
                                      {sub.problem_title}
                                    </td>
                                    <td className="px-4 py-3">
                                      <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ${
                                        sub.result === 'correct' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                        sub.result === 'wrong' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                                        'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                      }`}>
                                        {sub.result === 'correct' ? '정답' : 
                                         sub.result === 'wrong' ? '오답' :
                                         sub.result === 'compile_error' ? '컴파일 에러' : sub.result}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-xs">{sub.language}</td>
                                    <td className="px-4 py-3 hidden sm:table-cell">
                                      <div className="flex flex-col text-[10px] items-center">
                                        <span>{sub.execution_time ? `${sub.execution_time.toFixed(2)}s` : '-'}</span>
                                        <span>{sub.memory_used ? `${(sub.memory_used / 1024 / 1024).toFixed(1)}MB` : '-'}</span>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                      <button
                                        type="button"
                                        onClick={() => setSelectedCode({ title: sub.problem_title, code: sub.code, language: sub.language })}
                                        className="text-brand hover:text-brand-light font-medium text-[11px] whitespace-nowrap bg-dark-cardSoft px-3 py-1 rounded border border-dark-line hover:border-brand/30 transition-colors"
                                      >
                                        코드 보기
                                      </button>
                                    </td>
                                    <td className="px-4 py-3 hidden md:table-cell whitespace-nowrap text-[10px] text-right">
                                      {format(new Date(sub.submitted_at), 'yyyy-MM-dd HH:mm')}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedCode && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 px-4 py-8 animate-fade-in">
          <div className="flex h-full max-h-[90vh] w-full max-w-5xl flex-col rounded-2xl border border-dark-line bg-[#1e1e1e] overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between border-b border-dark-line bg-dark-card px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold text-dark-text">{selectedCode.title}</h3>
                <p className="text-sm text-dark-muted">언어: {selectedCode.language}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCode(null)}
                className="rounded-lg bg-dark-cardSoft px-4 py-2 text-sm font-medium text-dark-text hover:bg-dark-line transition-colors"
              >
                닫기
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 custom-scrollbar">
              <pre className="font-mono text-sm text-[#d4d4d4] whitespace-pre p-2">
                <code>{selectedCode.code}</code>
              </pre>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default UserDetailModal;
