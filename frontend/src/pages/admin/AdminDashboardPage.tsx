import { useCallback, useEffect, useMemo, useState, type FC } from 'react';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import {
  createNoticeTemplate,
  deleteNoticeTemplate,
  getAdminStats,
  getAdminAuditLogs,
  getNoticeTemplates,
  getUsers,
  updateNoticeTemplate,
  updateUser,
  deleteUser,
  getUnansweredQna,
  type UnansweredQnaItem,
  type AdminStats,
  type NoticeTemplate,
  type UserAdminOut,
  type AdminAuditItem,
  type UserAdminFilters
} from '../../api/admin';
import { getBoards, createBoard, updateBoard, deleteBoard, reorderBoards } from '../../api/board';
import type { Board } from '../../types/board';
import UserDetailModal from '../../components/admin/UserDetailModal';
import { getReports, type Report } from '../../api/reports';

const ROLES = ['member', 'staff', 'admin', 'superadmin'];
const RANKS = ['unranked', 'bronze', 'silver', 'gold', 'platinum', 'diamond'];
const BASE_TABS = ['overview', 'templates'] as const;
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

const AdminDashboardPage: FC = () => {
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'templates' | 'users' | 'boards' | 'audit'>('overview');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [templates, setTemplates] = useState<NoticeTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templateForm, setTemplateForm] = useState({
    name: '',
    description: '',
    content: '',
    is_active: true
  });

  const [boards, setBoards] = useState<Board[]>([]);
  const [boardsLoading, setBoardsLoading] = useState(false);
  const [boardForm, setBoardForm] = useState({
    name: '',
    board_type: 'general',
    is_public: true
  });

  const [users, setUsers] = useState<UserAdminOut[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSummary, setUserSummary] = useState({ total: 0, active: 0, pending: 0, suspended: 0 });
  const [userFilters, setUserFilters] = useState<UserAdminFilters>({
    search: '',
    role: '',
    rank: '',
    is_active: undefined,
    is_suspended: undefined,
    skip: 0,
    limit: 20
  });
  const [selectedUser, setSelectedUser] = useState<UserAdminOut | null>(null);
  const [userModalTab, setUserModalTab] = useState<'info' | 'submissions'>('info');

  const [pendingApprovalCount, setPendingApprovalCount] = useState(0);
  const [auditLogs, setAuditLogs] = useState<AdminAuditItem[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [overviewDetailType, setOverviewDetailType] = useState<'reports' | 'qna' | 'approvals' | null>(null);
  const [pendingReportItems, setPendingReportItems] = useState<Report[]>([]);
  const [unansweredQnaItems, setUnansweredQnaItems] = useState<UnansweredQnaItem[]>([]);
  const [pendingApprovalUsers, setPendingApprovalUsers] = useState<UserAdminOut[]>([]);
  const [overviewLoading, setOverviewLoading] = useState(false);

  const auditActionLabel = (action: string) => {
    if (action.includes('delete_user.force_hard')) return '사용자 완전삭제';
    if (action.includes('delete_user.hard')) return '사용자 삭제';
    if (action.includes('delete_user.soft')) return '사용자 소프트삭제';
    if (action.includes('update_user')) return '사용자 정보 수정';
    if (action.includes('blind_change')) return '게시글 블라인드 변경';
    return action;
  };

  const auditSummary = (log: AdminAuditItem) => {
    const p = log.payload || {};
    const target = (p as any).target || {};
    if (log.action.includes('delete_user')) {
      return `대상: ${target.name || '-'} (${target.email || '-'})`;
    }
    if (log.action.includes('blind_change')) {
      return `게시글 #${(p as any).post_id} / ${(p as any).from ? '블라인드' : '정상'} → ${(p as any).to ? '블라인드' : '정상'}`;
    }
    if (log.action.includes('update_user')) {
      return `대상 사용자 ID: ${(p as any).target_user_id}`;
    }
    return '';
  };


  const fetchUserSummary = useCallback(async () => {
    try {
      const [all, active, pending, suspended] = await Promise.all([
        getUsers({ skip: 0, limit: 1 }),
        getUsers({ skip: 0, limit: 1, is_active: true }),
        getUsers({ skip: 0, limit: 1, is_active: false, is_suspended: false }),
        getUsers({ skip: 0, limit: 1, is_suspended: true }),
      ]);
      setUserSummary({
        total: all.total,
        active: active.total,
        pending: pending.total,
        suspended: suspended.total,
      });
    } catch (error) {
      console.error('Failed to fetch user summary', error);
    }
  }, []);

  const fetchPendingApprovals = useCallback(async () => {
    try {
      const response = await getUsers({
        is_active: false,
        is_suspended: false,
        skip: 0,
        limit: 1
      });
      setPendingApprovalCount(response.total);
    } catch (error) {
      console.error('Failed to fetch pending approvals', error);
    }
  }, []);

  useEffect(() => {
    const fetchStats = async () => {
      setStatsLoading(true);
      try {
        const data = await getAdminStats();
        setStats(data);
      } catch (error) {
        console.error('Failed to fetch admin stats', error);
        toast.error('관리자 통계를 불러오는데 실패했습니다');
      } finally {
        setStatsLoading(false);
      }
    };

    fetchStats();
    fetchPendingApprovals();
  }, [fetchPendingApprovals]);




  useEffect(() => {
    if (activeTab !== 'overview') {
      return;
    }

    const loadSummary = async () => {
      await fetchUserSummary();
    };

    loadSummary();
  }, [activeTab, fetchUserSummary]);

  useEffect(() => {
    if (activeTab !== 'templates') {
      return;
    }

    const fetchTemplates = async () => {
      setTemplatesLoading(true);
      try {
        const response = await getNoticeTemplates(true);
        setTemplates(response);
      } catch (error) {
        console.error('Failed to fetch templates', error);
        toast.error('템플릿을 불러오는데 실패했습니다');
      } finally {
        setTemplatesLoading(false);
      }
    };

    fetchTemplates();
  }, [activeTab]);



  useEffect(() => {
    if (statsLoading === false) {
      fetchUserSummary();
    }
  }, [statsLoading, fetchUserSummary]);

  useEffect(() => {
    if (activeTab !== 'users') {
      return;
    }

    const fetchUsers = async () => {
      setUsersLoading(true);
      try {
        const response = await getUsers(userFilters);
        setUsers(response.items);
        setUsersTotal(response.total);
        await fetchPendingApprovals();
      } catch (error) {
        console.error('Failed to fetch users', error);
        toast.error('사용자 목록을 불러오는데 실패했습니다');
      } finally {
        setUsersLoading(false);
      }

    };

    fetchUsers();
    fetchUserSummary();
  }, [activeTab, fetchPendingApprovals, userFilters, fetchUserSummary]);


  const pageSize = userFilters.limit ?? 20;
  const currentPage = Math.floor((userFilters.skip ?? 0) / pageSize) + 1;
  const totalPages = Math.max(1, Math.ceil(usersTotal / pageSize));

  const visiblePages = useMemo(() => {
    const pages: number[] = [];
    const start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, currentPage + 2);
    for (let i = start; i <= end; i += 1) pages.push(i);
    return pages;
  }, [currentPage, totalPages]);


  useEffect(() => {
    if (activeTab !== 'audit') return;
    const fetchAudit = async () => {
      setAuditLoading(true);
      try {
        const items = await getAdminAuditLogs(150);
        setAuditLogs(items);
      } catch (error) {
        console.error('Failed to fetch audit logs', error);
        toast.error('감사 로그를 불러오는데 실패했습니다');
      } finally {
        setAuditLoading(false);
      }
    };
    fetchAudit();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'boards') return;

    const fetchBoards = async () => {
      setBoardsLoading(true);
      try {
        const data = await getBoards();
        setBoards(data.filter((b) => b.board_type === 'general'));
      } catch (error) {
        console.error('Failed to fetch boards', error);
        toast.error('게시판 목록을 불러오는데 실패했습니다');
      } finally {
        setBoardsLoading(false);
      }
    };
    fetchBoards();
  }, [activeTab]);

  const handleBoardReorder = async (direction: 'up' | 'down', index: number) => {
    const newBoards = [...boards];
    if (direction === 'up' && index > 0) {
      [newBoards[index - 1], newBoards[index]] = [newBoards[index], newBoards[index - 1]];
    } else if (direction === 'down' && index < boards.length - 1) {
      [newBoards[index], newBoards[index + 1]] = [newBoards[index + 1], newBoards[index]];
    } else {
      return;
    }

    setBoards(newBoards);
    try {
      await reorderBoards(newBoards.map(b => b.id));
      toast.success('순서가 변경되었습니다');
    } catch (error) {
      console.error('Failed to reorder boards', error);
      toast.error('순서 변경에 실패했습니다');
      // Revert on failure
      const data = await getBoards();
      setBoards(data);
    }
  };

  const handleTemplateSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const template = await createNoticeTemplate({
        name: templateForm.name,
        description: templateForm.description || undefined,
        content: templateForm.content,
        is_active: templateForm.is_active
      });
      setTemplates((prev) => [template, ...prev]);
      setTemplateForm({ name: '', description: '', content: '', is_active: true });
      toast.success('템플릿이 생성되었습니다');
    } catch (error) {
      console.error('Failed to create template', error);
      toast.error('템플릿 생성에 실패했습니다');
    }
  };

  const toggleTemplate = async (template: NoticeTemplate) => {
    try {
      const updated = await updateNoticeTemplate(template.id, { is_active: !template.is_active });
      setTemplates((prev) => prev.map((item) => (item.id === template.id ? updated : item)));
    } catch (error) {
      console.error('Failed to update template', error);
      toast.error('템플릿 업데이트에 실패했습니다');
    }
  };

  const removeTemplate = async (templateId: number) => {
    try {
      await deleteNoticeTemplate(templateId);
      setTemplates((prev) => prev.filter((item) => item.id !== templateId));
      toast.success('템플릿이 삭제되었습니다');
    } catch (error) {
      console.error('Failed to delete template', error);
      toast.error('템플릿 삭제에 실패했습니다');
    }
  };


  const handleDeleteUser = async (user: UserAdminOut) => {
    const confirmed = window.confirm(`정말로 ${user.name}(${user.email}) 계정을 삭제하시겠습니까?

연관 데이터가 있으면 소프트삭제로 처리됩니다.`);
    if (!confirmed) return;
    try {
      const res = await deleteUser(user.id);
      toast.success(res.mode === 'hard' ? '사용자 계정이 삭제되었습니다.' : '연관 데이터로 인해 소프트삭제 처리되었습니다.');
      setUserFilters((prev) => ({ ...prev }));
    } catch (error: any) {
      console.error('Failed to delete user', error);
      toast.error(error?.response?.data?.detail ?? '사용자 삭제에 실패했습니다.');
    }
  };

  const handleForceDeleteUser = async (user: UserAdminOut) => {
    const confirmed = window.confirm(`정말로 ${user.name} 계정을 완전삭제 하시겠습니까? 이 작업은 되돌릴 수 없습니다.`);
    if (!confirmed) return;
    try {
      const res = await deleteUser(user.id, true);
      toast.success(res.mode === "force-hard" ? "완전삭제 완료" : "삭제 처리 완료");
      setUserFilters((prev) => ({ ...prev }));
      fetchUserSummary();
    } catch (error: any) {
      console.error("Failed to force delete user", error);
      toast.error(error?.response?.data?.detail ?? "완전삭제에 실패했습니다.");
    }
  };



  const openOverviewDetail = async (type: 'reports' | 'qna' | 'approvals') => {
    setOverviewDetailType(type);
    setOverviewLoading(true);
    try {
      if (type === 'reports') {
        const data = await getReports({ status: 'pending', skip: 0, limit: 20 });
        setPendingReportItems(data.items);
      } else if (type === 'qna') {
        const data = await getUnansweredQna(20);
        setUnansweredQnaItems(data);
      } else {
        const data = await getUsers({ is_active: false, is_suspended: false, skip: 0, limit: 20 });
        setPendingApprovalUsers(data.items);
      }
    } catch (error) {
      console.error('Failed to fetch overview detail', error);
      toast.error('상세 목록을 불러오는데 실패했습니다');
    } finally {
      setOverviewLoading(false);
    }
  };

  const handleApproveUser = async (userId: number) => {
    try {
      const updatedUser = await updateUser(userId, { is_active: true });
      setUsers((prev) => prev.map((u) => (u.id === updatedUser.id ? updatedUser : u)));
      await fetchPendingApprovals();
      toast.success('사용자 승인이 완료되었습니다');
    } catch (error) {
      console.error('Failed to approve user', error);
      toast.error('사용자 승인에 실패했습니다');
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-dark-text">관리자 대시보드</h1>
          <p className="text-dark-muted">템플릿 및 플랫폼 인사이트를 관리합니다.</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-dark-nav p-1">
          {BASE_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-dark-muted hover:text-dark-text'
                }`}
            >
              {tab === 'overview' && '개요'}
              {tab === 'templates' && '공지 템플릿'}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setActiveTab('boards')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${activeTab === 'boards' ? 'bg-white text-gray-900 shadow-sm' : 'text-dark-muted hover:text-dark-text'
              }`}
          >
            게시판 관리
          </button>
          {['admin', 'superadmin'].includes(currentUser?.role || '') && (
            <button
              type="button"
              onClick={() => setActiveTab('users')}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all flex items-center gap-2 ${activeTab === 'users' ? 'bg-white text-gray-900 shadow-sm' : 'text-dark-muted hover:text-dark-text'
                }`}
            >
              사용자
              {pendingApprovalCount > 0 && (
                <span className="inline-flex min-w-[20px] items-center justify-center rounded-full bg-amber-300 px-1 text-[11px] font-semibold text-gray-900">
                  {pendingApprovalCount}
                </span>
              )}
            </button>
          )}
          {['superadmin'].includes(currentUser?.role || '') && (
            <button
              type="button"
              onClick={() => setActiveTab('audit')}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${activeTab === 'audit' ? 'bg-white text-gray-900 shadow-sm' : 'text-dark-muted hover:text-dark-text'}`}
            >
              감사로그
            </button>
          )}
        </div>
      </div>

      {activeTab === 'overview' && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {statsLoading ? (
            <div className="col-span-full text-dark-muted">통계 불러오는 중...</div>
          ) : (
            <>
              <div className="rounded-2xl border border-dark-line bg-dark-card p-6">
                <p className="text-sm text-dark-muted">총 사용자</p>
                <p className="mt-2 text-3xl font-semibold text-dark-text">{userSummary.total || stats?.users || 0}</p>
              </div>
              <div className="rounded-2xl border border-green-400/30 bg-green-400/5 p-6">
                <p className="text-sm text-green-300">활성 가입자</p>
                <p className="mt-2 text-3xl font-semibold text-green-200">{userSummary.active}</p>
              </div>
              <div className="rounded-2xl border border-red-400/30 bg-red-400/5 p-6">
                <p className="text-sm text-red-300">정지된 계정</p>
                <p className="mt-2 text-3xl font-semibold text-red-200">{userSummary.suspended}</p>
              </div>
              <div className="rounded-2xl border border-amber-400/30 bg-amber-400/5 p-6">
                <p className="text-sm text-amber-300">승인 대기 계정</p>
                <p className="mt-2 text-3xl font-semibold text-amber-200">{userSummary.pending}</p>
              </div>
              <div className="rounded-2xl border border-dark-line bg-dark-card p-6">
                <p className="text-sm text-dark-muted">총 게시글</p>
                <p className="mt-2 text-3xl font-semibold text-dark-text">{stats?.posts ?? 0}</p>
              </div>
              <div className="rounded-2xl border border-dark-line bg-dark-card p-6">
                <p className="text-sm text-dark-muted">코딩테스트 제출</p>
                <p className="mt-2 text-3xl font-semibold text-dark-text">{stats?.submissions ?? 0}</p>
              </div>
              <button type="button" onClick={() => openOverviewDetail('reports')} className="rounded-2xl border border-dark-line bg-dark-card p-6 text-left hover:border-brand/40 transition-colors">
                <p className="text-sm text-dark-muted">대기중인 신고</p>
                <p className="mt-2 text-3xl font-semibold text-dark-text">{stats?.pending_reports ?? 0}</p>
              </button>
              <button type="button" onClick={() => openOverviewDetail('approvals')} className="rounded-2xl border border-dark-line bg-dark-card p-6 text-left hover:border-brand/40 transition-colors">
                <p className="text-sm text-dark-muted">승인 대기 계정</p>
                <p className="mt-2 text-3xl font-semibold text-dark-text">{pendingApprovalCount}</p>
              </button>
              <button type="button" onClick={() => openOverviewDetail('qna')} className="rounded-2xl border border-dark-line bg-dark-card p-6 text-left hover:border-brand/40 transition-colors">
                <p className="text-sm text-dark-muted">미답변 Q&A</p>
                <p className="mt-2 text-3xl font-semibold text-dark-text">{stats?.unanswered_questions ?? 0}</p>
              </button>
              <div className="rounded-2xl border border-dark-line bg-dark-card p-6">
                <p className="text-sm text-dark-muted">행사 승인 대기</p>
                <p className="mt-2 text-3xl font-semibold text-dark-text">{stats?.pending_event_approvals ?? 0}</p>
              </div>
              <div className="rounded-2xl border border-dark-line bg-dark-card p-6">
                <p className="text-sm text-dark-muted">대기중인 리뷰</p>
                <p className="mt-2 text-3xl font-semibold text-dark-text">{stats?.pending_reviews ?? 0}</p>
              </div>
            </>
          )}
        </div>
      )}


      {activeTab === 'users' && (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-dark-line bg-dark-bg px-4 py-3"><p className="text-xs text-dark-muted">전체 사용자</p><p className="mt-1 text-xl font-bold text-dark-text">{userSummary.total}</p></div>
            <div className="rounded-xl border border-green-400/30 bg-green-400/5 px-4 py-3"><p className="text-xs text-green-300">활성</p><p className="mt-1 text-xl font-bold text-green-200">{userSummary.active}</p></div>
            <div className="rounded-xl border border-amber-400/30 bg-amber-400/5 px-4 py-3"><p className="text-xs text-amber-300">승인 대기</p><p className="mt-1 text-xl font-bold text-amber-200">{userSummary.pending}</p></div>
            <div className="rounded-xl border border-red-400/30 bg-red-400/5 px-4 py-3"><p className="text-xs text-red-300">정지됨</p><p className="mt-1 text-xl font-bold text-red-200">{userSummary.suspended}</p></div>
          </div>
          <div className="flex flex-wrap gap-4 rounded-2xl border border-dark-line bg-dark-card p-4">
            <input
              type="text"
              placeholder="이름, 이메일, 학번 검색..."
              value={userFilters.search}
              onChange={(e) => setUserFilters((prev) => ({ ...prev, search: e.target.value, skip: 0 }))}
              className="flex-1 rounded-xl border border-dark-line bg-dark-cardSoft px-3 py-2 text-sm text-dark-text placeholder-dark-muted"
            />
            <select
              value={userFilters.role || ''}
              onChange={(e) => setUserFilters((prev) => ({ ...prev, role: e.target.value || undefined, skip: 0 }))}
              className="rounded-xl border border-dark-line bg-dark-bg px-3 py-2 text-sm text-dark-text"
            >
              <option value="">전체 역할</option>
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </select>
            <select
              value={userFilters.rank || ''}
              onChange={(e) => setUserFilters((prev) => ({ ...prev, rank: e.target.value || undefined, skip: 0 }))}
              className="rounded-xl border border-dark-line bg-dark-bg px-3 py-2 text-sm text-dark-text"
            >
              <option value="">전체 랭크</option>
              {RANKS.map((rank) => (
                <option key={rank} value={rank}>
                  {RANK_LABELS[rank]}
                </option>
              ))}
            </select>
            <select
              value={
                userFilters.is_suspended
                  ? 'suspended'
                  : userFilters.is_active === undefined
                    ? 'all'
                    : userFilters.is_active
                      ? 'active'
                      : 'pending'
              }
              onChange={(e) => {
                const value = e.target.value;
                setUserFilters((prev) => ({
                  ...prev,
                  is_suspended: value === 'suspended' ? true : undefined,
                  is_active:
                    value === 'all' || value === 'suspended'
                      ? undefined
                      : value === 'active',
                  skip: 0
                }));
              }}
              className="rounded-xl border border-dark-line bg-dark-bg px-3 py-2 text-sm text-dark-text"
            >
              <option value="all">전체 상태</option>
              <option value="active">활성</option>
              <option value="pending">승인 대기</option>
              <option value="suspended">정지됨</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setUserFilters((prev) => ({ ...prev, is_active: undefined, is_suspended: undefined, skip: 0 }))} className="rounded-lg border border-dark-line px-3 py-1.5 text-xs text-dark-text">전체</button>
            <button type="button" onClick={() => setUserFilters((prev) => ({ ...prev, is_active: true, is_suspended: undefined, skip: 0 }))} className="rounded-lg border border-green-400/40 px-3 py-1.5 text-xs text-green-300">활성</button>
            <button type="button" onClick={() => setUserFilters((prev) => ({ ...prev, is_active: false, is_suspended: false, skip: 0 }))} className="rounded-lg border border-amber-300/40 px-3 py-1.5 text-xs text-amber-300">승인 대기</button>
            <button type="button" onClick={() => setUserFilters((prev) => ({ ...prev, is_active: undefined, is_suspended: true, skip: 0 }))} className="rounded-lg border border-red-400/40 px-3 py-1.5 text-xs text-red-300">정지됨</button>
          </div>

          <div className="responsive-table-wrap overflow-hidden rounded-2xl border border-dark-line bg-dark-card">
            <table className="w-full text-left text-sm text-dark-muted">
              <thead className="bg-dark-cardSoft text-xs uppercase text-dark-text">
                <tr>
                  <th className="px-6 py-3">사용자</th>
                  <th className="px-6 py-3">학번/전공</th>
                  <th className="px-6 py-3">역할/랭크</th>
                  <th className="px-6 py-3">상태</th>
                  <th className="px-6 py-3">가입일</th>
                  <th className="px-6 py-3">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-line">
                {usersLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center">
                      로딩 중...
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center">
                      사용자가 없습니다.
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr 
                      key={user.id} 
                      className="hover:bg-dark-cardSoft/50 cursor-pointer"
                      onClick={() => {
                        setSelectedUser(user);
                        setUserModalTab('info');
                      }}
                    >
                      <td className="px-6 py-4">
                        <div className="font-medium text-dark-text">{user.name}</div>
                        <div className="text-xs">{user.email}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div>{user.student_id}</div>
                        <div className="text-xs">{user.major}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <span className="inline-flex w-fit items-center rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-400">
                            {user.role}
                          </span>
                          <span className="inline-flex w-fit items-center rounded-full bg-purple-500/10 px-2 py-0.5 text-xs font-medium text-purple-400">
                            {user.rank}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {user.is_suspended ? (
                          <span className="text-red-400">정지됨</span>
                        ) : !user.is_active ? (
                          <span className="text-amber-300">승인 대기</span>
                        ) : (
                          <span className="text-green-400">활성</span>
                        )}
                      </td>
                      <td className="px-6 py-4">{format(new Date(user.created_at), 'yyyy.MM.dd')}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap items-center gap-3">
                          {!user.is_active && !user.is_suspended && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleApproveUser(user.id);
                              }}
                              className="text-amber-300 hover:text-amber-200"
                            >
                              승인
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteUser(user);
                            }}
                            className="text-red-300 hover:text-red-200"
                          >
                            삭제
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleForceDeleteUser(user);
                            }}
                            className="text-red-500 hover:text-red-400"
                          >
                            완전삭제
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-dark-muted">
              총 <span className="font-semibold text-dark-text">{usersTotal}</span>명 · {currentPage}/{totalPages} 페이지
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setUserFilters((prev) => ({ ...prev, skip: Math.max(0, (prev.skip ?? 0) - pageSize) }))}
                className="rounded-lg border border-dark-line px-3 py-1.5 text-sm text-dark-text disabled:opacity-40"
              >
                이전
              </button>
              {visiblePages.map((page) => (
                <button
                  key={page}
                  type="button"
                  onClick={() => setUserFilters((prev) => ({ ...prev, skip: (page - 1) * pageSize }))}
                  className={`rounded-lg border px-3 py-1.5 text-sm ${page === currentPage ? 'border-brand bg-brand/20 text-brand' : 'border-dark-line text-dark-text'}`}
                >
                  {page}
                </button>
              ))}
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setUserFilters((prev) => ({ ...prev, skip: (prev.skip ?? 0) + pageSize }))}
                className="rounded-lg border border-dark-line px-3 py-1.5 text-sm text-dark-text disabled:opacity-40"
              >
                다음
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedUser && (
        <UserDetailModal
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          onUserUpdated={(updatedUser) => {
            setUsers((prev) => prev.map((u) => (u.id === updatedUser.id ? updatedUser : u)));
          }}
          initialTab={userModalTab}
        />
      )}



      {overviewDetailType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8">
          <div className="w-full max-w-3xl rounded-2xl border border-dark-line bg-dark-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-dark-text">
                {overviewDetailType === 'reports' ? '대기중인 신고 상세' : overviewDetailType === 'qna' ? '미답변 Q&A 상세' : '승인 대기 계정 상세'}
              </h3>
              <button type="button" onClick={() => setOverviewDetailType(null)} className="text-dark-muted">닫기</button>
            </div>
            {overviewLoading ? (
              <p className="text-sm text-dark-muted">불러오는 중...</p>
            ) : overviewDetailType === 'reports' ? (
              <div className="space-y-2 max-h-[60vh] overflow-auto">
                {pendingReportItems.map((item) => (
                  <div key={item.id} className="rounded-lg border border-dark-line p-3 text-sm">
                    <p className="text-dark-text">#{item.id} {item.target_type} / {item.reason}</p>
                    <p className="text-xs text-dark-muted">신고자: {item.reporter_name || '-'} · {new Date(item.created_at).toLocaleString()}</p>
                    <p className="text-xs text-dark-muted">{item.description || '-'}</p>
                  </div>
                ))}
              </div>
            ) : overviewDetailType === 'qna' ? (
              <div className="space-y-2 max-h-[60vh] overflow-auto">
                {unansweredQnaItems.map((item) => (
                  <div key={item.id} className="rounded-lg border border-dark-line p-3 text-sm">
                    <p className="text-dark-text">#{item.id} {item.title}</p>
                    <p className="text-xs text-dark-muted">작성자: {item.author_name} · {new Date(item.created_at).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2 max-h-[60vh] overflow-auto">
                {pendingApprovalUsers.map((item) => (
                  <div key={item.id} className="rounded-lg border border-dark-line p-3 text-sm">
                    <p className="text-dark-text">{item.name} ({item.email})</p>
                    <p className="text-xs text-dark-muted">학번: {item.student_id} · 가입일: {format(new Date(item.created_at), 'yyyy.MM.dd HH:mm')}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}


      {activeTab === 'templates' && (
        <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
          <form onSubmit={handleTemplateSubmit} className="space-y-4 rounded-2xl border border-dark-line bg-dark-card p-6">
            <div>
              <label htmlFor="template-name" className="text-sm text-dark-muted">템플릿 이름</label>
              <input
                id="template-name"
                value={templateForm.name}
                onChange={(event) => setTemplateForm((prev) => ({ ...prev, name: event.target.value }))}
                className="mt-2 w-full rounded-xl border border-dark-line bg-dark-cardSoft px-3 py-2 text-sm text-dark-text"
                required
              />
            </div>
            <div>
              <label htmlFor="template-description" className="text-sm text-dark-muted">설명</label>
              <input
                id="template-description"
                value={templateForm.description}
                onChange={(event) => setTemplateForm((prev) => ({ ...prev, description: event.target.value }))}
                className="mt-2 w-full rounded-xl border border-dark-line bg-dark-cardSoft px-3 py-2 text-sm text-dark-text"
              />
            </div>
            <div>
              <label htmlFor="template-content" className="text-sm text-dark-muted">템플릿 내용</label>
              <textarea
                id="template-content"
                value={templateForm.content}
                onChange={(event) => setTemplateForm((prev) => ({ ...prev, content: event.target.value }))}
                className="mt-2 h-40 w-full rounded-xl border border-dark-line bg-dark-cardSoft px-3 py-2 text-sm text-dark-text"
                required
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-dark-muted">
              <input
                type="checkbox"
                checked={templateForm.is_active}
                onChange={(event) =>
                  setTemplateForm((prev) => ({ ...prev, is_active: event.target.checked }))
                }
                className="h-4 w-4 rounded border-dark-line bg-dark-cardSoft text-brand"
              />
              활성화
            </label>
            <button
              type="submit"
              className="w-full rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-light"
            >
              템플릿 저장
            </button>
          </form>

          <div className="space-y-4">
            <div className="rounded-2xl border border-dark-line bg-dark-card p-6">
              <h2 className="text-lg font-semibold text-dark-text">기존 템플릿</h2>
              {templatesLoading ? (
                <p className="mt-4 text-sm text-dark-muted">템플릿 불러오는 중...</p>
              ) : templates.length === 0 ? (
                <p className="mt-4 text-sm text-dark-muted">아직 생성된 템플릿이 없습니다.</p>
              ) : (
                <div className="mt-4 space-y-4">
                  {templates.map((template) => (
                    <div key={template.id} className="rounded-xl border border-dark-line bg-dark-cardSoft p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-dark-text">{template.name}</p>
                          <p className="text-xs text-dark-muted">{template.description || '설명 없음'}</p>
                        </div>
                        <span
                          className={`rounded-full px-2 py-1 text-xs ${template.is_active
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-yellow-500/20 text-yellow-200'
                            }`}
                        >
                          {template.is_active ? '활성' : '비활성'}
                        </span>
                      </div>
                      <p className="mt-3 text-xs text-dark-muted line-clamp-2">{template.content}</p>
                      <div className="mt-4 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleTemplate(template)}
                          className="rounded-lg border border-dark-line px-3 py-1 text-xs text-dark-text hover:bg-dark-nav"
                        >
                          {template.is_active ? '비활성화' : '활성화'}
                        </button>
                        <button
                          type="button"
                          onClick={() => removeTemplate(template.id)}
                          className="rounded-lg border border-red-500/40 px-3 py-1 text-xs text-red-300 hover:bg-red-500/10"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}


      {activeTab === 'audit' && (
        <div className="rounded-2xl border border-dark-line bg-dark-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-dark-text">관리자 감사 로그</h2>
            <button
              type="button"
              onClick={async () => {
                setAuditLoading(true);
                try {
                  setAuditLogs(await getAdminAuditLogs(150));
                } finally {
                  setAuditLoading(false);
                }
              }}
              className="rounded-lg border border-dark-line px-3 py-1.5 text-xs text-dark-text"
            >
              새로고침
            </button>
          </div>
          {auditLoading ? (
            <p className="text-sm text-dark-muted">로그 불러오는 중...</p>
          ) : auditLogs.length === 0 ? (
            <p className="text-sm text-dark-muted">로그가 없습니다.</p>
          ) : (
            <div className="space-y-2 max-h-[520px] overflow-auto pr-1">
              {auditLogs.map((log, idx) => (
                <div key={`${log.ts}-${idx}`} className="rounded-lg border border-dark-line bg-dark-bg p-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-dark-muted">{new Date(log.ts).toLocaleString()}</span>
                    <span className="rounded bg-brand/20 px-2 py-0.5 text-brand">{auditActionLabel(log.action)}</span>
                  </div>
                  <p className="mt-2 text-xs text-dark-text">{auditSummary(log)}</p>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-[11px] text-dark-muted">원본 로그 보기</summary>
                    <p className="mt-2 text-xs text-dark-text">{auditSummary(log)}</p>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-[11px] text-dark-muted">원본 로그 보기</summary>
                    <pre className="mt-2 overflow-auto text-[11px] text-dark-muted">{JSON.stringify(log.payload, null, 2)}</pre>
                  </details>
                  </details>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'boards' && (
        <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
          <form 
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                const newBoard = await createBoard(boardForm);
                setBoards((prev) => [...prev, newBoard]);
                setBoardForm({ name: '', board_type: 'general', is_public: true });
                toast.success('게시판이 생성되었습니다');
              } catch (error) {
                console.error('Failed to create board', error);
                toast.error('게시판 생성에 실패했습니다');
              }
            }} 
            className="space-y-4 rounded-2xl border border-dark-line bg-dark-card p-6 h-fit"
          >
            <h2 className="text-lg font-semibold text-dark-text">새 게시판 추가</h2>
            <div>
              <label htmlFor="board-name" className="text-sm text-dark-muted">게시판 이름</label>
              <input
                id="board-name"
                value={boardForm.name}
                onChange={(e) => setBoardForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="예: 응시자랑"
                className="mt-2 w-full rounded-xl border border-dark-line bg-dark-cardSoft px-3 py-2 text-sm text-dark-text outline-none focus:border-brand transition-colors"
                required
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-dark-muted cursor-pointer">
              <input
                type="checkbox"
                checked={boardForm.is_public}
                onChange={(e) => setBoardForm((prev) => ({ ...prev, is_public: e.target.checked }))}
                className="h-4 w-4 rounded border-dark-line bg-dark-cardSoft text-brand focus:ring-brand"
              />
              공개 게시판
            </label>
            <button
              type="submit"
              className="w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-light transition-colors shadow-lg shadow-brand/20"
            >
              게시판 생성
            </button>
          </form>

          <div className="space-y-4">
            <div className="rounded-2xl border border-dark-line bg-dark-card p-6">
              <h2 className="text-lg font-semibold text-dark-text">게시판 목록</h2>
              {boardsLoading ? (
                <p className="mt-4 text-sm text-dark-muted">로딩 중...</p>
              ) : boards.length === 0 ? (
                <p className="mt-4 text-sm text-dark-muted">게시판이 없습니다.</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {boards.map((board, index) => (
                    <div key={board.id} className="group flex items-center justify-between rounded-xl border border-dark-line bg-dark-cardSoft p-4 hover:border-dark-muted transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="flex flex-col gap-1">
                          <button
                            type="button"
                            onClick={() => handleBoardReorder('up', index)}
                            disabled={index === 0}
                            className="text-dark-muted hover:text-dark-text disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleBoardReorder('down', index)}
                            disabled={index === boards.length - 1}
                            className="text-dark-muted hover:text-dark-text disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-dark-text">{board.name}</p>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                              board.board_type === 'notice' ? 'bg-blue-500/20 text-blue-400' :
                              board.board_type === 'qna' ? 'bg-purple-500/20 text-purple-400' :
                              'bg-gray-500/20 text-gray-400'
                            }`}>
                              {board.board_type}
                            </span>
                          </div>
                          <p className="text-xs text-dark-muted mt-1">
                            {board.is_public ? '공개' : '비공개'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            const newName = prompt('새 게시판 이름을 입력하세요:', board.name);
                            if (newName && newName !== board.name) {
                              try {
                                const updated = await updateBoard(board.id, { name: newName });
                                setBoards((prev) => prev.map((b) => (b.id === board.id ? updated : b)));
                                toast.success('수정되었습니다');
                              } catch (error) {
                                toast.error('수정에 실패했습니다');
                              }
                            }
                          }}
                          className="rounded-lg bg-dark-card p-2 text-xs text-dark-text hover:bg-dark-line transition-colors"
                        >
                          수정
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (window.confirm(`'${board.name}' 게시판을 삭제하시겠습니까? 게시글이 있는 게시판은 삭제할 수 없습니다.`)) {
                              try {
                                await deleteBoard(board.id);
                                setBoards((prev) => prev.filter((b) => b.id !== board.id));
                                toast.success('삭제되었습니다');
                              } catch (error: any) {
                                const detail = error.response?.data?.detail || '삭제에 실패했습니다';
                                toast.error(detail);
                              }
                            }
                          }}
                          className="rounded-lg bg-red-500/10 p-2 text-xs text-red-400 hover:bg-red-500/20 transition-colors"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminDashboardPage;
