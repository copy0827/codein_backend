import React, { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  UserCheck,
  UserX,
  Users,
} from 'lucide-react';
import Card from '../ui/Card';
import {
  getAttendanceApiErrorMessage,
  useAdminAttendanceStatusQuery,
} from '../../hooks/useAttendance';
import type { AdminAttendanceMember } from '../../types/attendance';

const toDateInputValue = (d: Date) => format(d, 'yyyy-MM-dd');

const AdminAttendanceView: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState(() => toDateInputValue(new Date()));

  const { data, isLoading, isError, error, refetch, isFetching } =
    useAdminAttendanceStatusQuery(selectedDate);

  const sortedMembers = useMemo(() => {
    if (!data?.members) return [];
    return [...data.members].sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === 'ATTENDED' ? -1 : 1;
      }
      return a.name.localeCompare(b.name, 'ko');
    });
  }, [data?.members]);

  const statCards = [
    {
      label: '전체 활성 부원',
      value: data?.total_active_members ?? 0,
      icon: Users,
      tone: 'text-brand',
      bg: 'bg-brand/10',
    },
    {
      label: '출석 인원',
      value: data?.attended_count ?? 0,
      icon: UserCheck,
      tone: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      label: '미출석 인원',
      value: data?.absent_count ?? 0,
      icon: UserX,
      tone: 'text-gray-600',
      bg: 'bg-gray-100',
    },
    {
      label: '출석률',
      value: data ? `${data.attendance_rate}%` : '—',
      icon: ClipboardList,
      tone: 'text-amber-700',
      bg: 'bg-amber-50',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-dark-text">출석 현황</h2>
          <p className="mt-1 text-sm text-dark-muted">
            날짜별 활성 부원 출석·미출석 현황을 확인합니다.
          </p>
        </div>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-dark-muted">조회 날짜</span>
          <div className="relative">
            <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dark-muted" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="rounded-xl border border-dark-line bg-dark-cardSoft py-2.5 pl-10 pr-3 text-sm text-dark-text focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </div>
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map(({ label, value, icon: Icon, tone, bg }) => (
          <Card key={label} variant="elevated" padding="md" className="!bg-white">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${bg}`}>
                <Icon className={`h-5 w-5 ${tone}`} aria-hidden />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">{label}</p>
                <p className="text-xl font-bold text-gray-900">
                  {isLoading ? '…' : value}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {isError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {getAttendanceApiErrorMessage(error, '출석 현황을 불러오지 못했습니다.')}
          <button
            type="button"
            onClick={() => refetch()}
            className="ml-2 font-semibold underline"
          >
            다시 시도
          </button>
        </div>
      )}

      <Card variant="elevated" padding="none" className="!bg-white overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 sm:px-6">
          <h3 className="font-bold text-gray-900">
            부원 목록
            {data?.target_date && (
              <span className="ml-2 text-sm font-normal text-gray-500">
                {format(parseISO(data.target_date), 'yyyy.MM.dd (EEE)', { locale: ko })}
              </span>
            )}
          </h3>
          {isFetching && !isLoading && (
            <span className="text-xs text-gray-400">갱신 중…</span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80 text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="px-5 py-3 sm:px-6">이름</th>
                <th className="px-5 py-3 sm:px-6">학번</th>
                <th className="px-5 py-3 sm:px-6">기수</th>
                <th className="px-5 py-3 sm:px-6">전공</th>
                <th className="px-5 py-3 sm:px-6">출석 상태</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                    불러오는 중…
                  </td>
                </tr>
              ) : sortedMembers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                    표시할 부원이 없습니다.
                  </td>
                </tr>
              ) : (
                sortedMembers.map((member) => (
                  <MemberRow key={member.user_id} member={member} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

const MemberRow: React.FC<{ member: AdminAttendanceMember }> = ({ member }) => {
  const attended = member.status === 'ATTENDED';
  const attendedAt = member.attended_at ? parseISO(member.attended_at) : null;

  return (
    <tr className="border-b border-gray-50 transition-colors hover:bg-gray-50/60">
      <td className="px-5 py-3.5 font-medium text-gray-900 sm:px-6">{member.name}</td>
      <td className="px-5 py-3.5 text-gray-600 sm:px-6">{member.student_id}</td>
      <td className="px-5 py-3.5 text-gray-600 sm:px-6">{member.generation}</td>
      <td className="px-5 py-3.5 text-gray-600 sm:px-6">{member.major}</td>
      <td className="px-5 py-3.5 sm:px-6">
        {attended ? (
          <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-2">
            <span className="inline-flex w-fit items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
              출석 완료
            </span>
            {attendedAt && (
              <span className="text-xs text-gray-500">
                {format(attendedAt, 'a h:mm', { locale: ko })}
              </span>
            )}
          </div>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-600">
            <UserX className="h-3.5 w-3.5" aria-hidden />
            미출석
          </span>
        )}
      </td>
    </tr>
  );
};

export default AdminAttendanceView;
