import { useCallback, useEffect, useState, type FC, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  format,
  isSameDay,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  isToday,
  parseISO,
  addDays,
  subDays,
  startOfWeek,
  endOfWeek
} from 'date-fns';
import { Calendar, MapPin, Users, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { createEvent, getEventOccurrences } from '../../api/events';
import type { Event } from '../../api/events';

const UPCOMING_RANGE_DAYS = 90;
const PAST_RANGE_DAYS = 365;

const EVENT_TYPES = [
  { value: 'session', label: '정기 세션' },
  { value: 'study', label: '스터디' },
  { value: 'deadline', label: '프로젝트 마감' },
  { value: 'contest', label: '대회' },
  { value: 'party', label: '회식' },
  { value: 'mt', label: 'MT' },
  { value: 'codetest', label: '코딩테스트 일정' },
];

const RANK_OPTIONS = ['unranked', 'bronze', 'silver', 'gold', 'platinum', 'diamond'];

type ActiveTab = 'agenda' | 'past' | 'month' | 'week' | 'upcoming';

const EventListPage: FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>('agenda');
  const [events, setEvents] = useState<Event[]>([]);

  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [eventType, setEventType] = useState('');
  const [team, setTeam] = useState('');
  const [targetRank, setTargetRank] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    startTime: '',
    endTime: '',
    eventType: '',
    team: '',
    targetRank: '',
    location: '',
    isOnline: false,
    onlineLink: '',
    maxAttendees: '',
  });
  const isAgendaView = activeTab === 'agenda';

  useEffect(() => {
    if (!isCreateOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsCreateOpen(false);
        resetForm();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isCreateOpen]);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      let rangeStart = now;
      let rangeEnd = now;

      if (activeTab === 'month') {
        rangeStart = startOfMonth(currentDate);
        rangeEnd = endOfMonth(currentDate);
      } else if (activeTab === 'week') {
        rangeStart = startOfWeek(currentDate, { weekStartsOn: 1 });
        rangeEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
      } else if (activeTab === 'past') {
        rangeStart = subDays(now, PAST_RANGE_DAYS);
        rangeEnd = now;
      } else {
        rangeStart = now;
        rangeEnd = addDays(now, UPCOMING_RANGE_DAYS);
      }

      const allEvents = await getEventOccurrences(
        rangeStart.toISOString(),
        rangeEnd.toISOString(),
        {
          event_type: eventType || undefined,
          team: team || undefined,
          target_rank: targetRank || undefined,
        }
      );
      setEvents(allEvents);
    } catch (error) {
      console.error('Failed to fetch events', error);
      toast.error('일정을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [activeTab, currentDate, eventType, team, targetRank]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const agendaEvents = events.filter(e => new Date(e.end_time) >= new Date());
  const pastEvents = events.filter(e => new Date(e.end_time) < new Date()).sort((a, b) => new Date(b.end_time).getTime() - new Date(a.end_time).getTime());

  const getEventTypeLabel = (value?: string | null) => {
    const match = EVENT_TYPES.find((type) => type.value === value);
    return match?.label || value;
  };

  const inputClass = 'w-full rounded-lg border border-dark-line bg-dark-cardSoft px-3 py-2 text-sm text-dark-text placeholder:text-dark-muted focus:outline-none focus:border-brand';
  const selectClass =
    'w-full rounded-md border border-dark-line bg-dark-bg text-dark-text px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent';
  const textareaClass = 'w-full rounded-lg border border-dark-line bg-dark-cardSoft px-3 py-2 text-sm text-dark-text placeholder:text-dark-muted focus:outline-none focus:border-brand';

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      startTime: '',
      endTime: '',
      eventType: '',
      team: '',
      targetRank: '',
      location: '',
      isOnline: false,
      onlineLink: '',
      maxAttendees: '',
    });
  };

  const handleCreateSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!formData.title.trim() || !formData.description.trim()) {
      toast.error('제목과 설명을 입력해주세요.');
      return;
    }

    if (!formData.startTime || !formData.endTime) {
      toast.error('시작/종료 시간을 입력해주세요.');
      return;
    }

    setCreateLoading(true);
    try {
      await createEvent({
        title: formData.title.trim(),
        description: formData.description.trim(),
        start_time: new Date(formData.startTime).toISOString(),
        end_time: new Date(formData.endTime).toISOString(),
        event_type: formData.eventType || undefined,
        team: formData.team || undefined,
        target_rank: formData.targetRank || undefined,
        location: formData.location || undefined,
        is_online: formData.isOnline,
        online_link: formData.isOnline ? formData.onlineLink || undefined : undefined,
        max_attendees: formData.maxAttendees ? Number(formData.maxAttendees) : undefined,
      });
      toast.success('일정이 생성되었습니다.');
      setIsCreateOpen(false);
      resetForm();
      await fetchEvents();
    } catch (error) {
      console.error('Failed to create event', error);
      toast.error('일정 생성에 실패했습니다.');
    } finally {
      setCreateLoading(false);
    }
  };

  const renderEventCard = (event: Event) => (
    <Link to={`/events/${event.id}`} key={event.id} className="block bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow p-5 border border-gray-100">
      <div className="flex justify-between items-start mb-3 gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-xl font-bold text-gray-800 line-clamp-1">{event.title}</h3>
          {event.event_type && (
            <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-1 rounded-full font-medium">
              {getEventTypeLabel(event.event_type)}
            </span>
          )}
        </div>
        {event.is_online && (
          <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full font-medium">온라인</span>
        )}
      </div>

      <p className="text-gray-600 mb-4 line-clamp-2 text-sm">{event.description}</p>

      <div className="flex flex-col gap-2 text-sm text-gray-500">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-indigo-500" />
          <span>{format(parseISO(event.start_time), 'yyyy.MM.dd HH:mm')}</span>
        </div>

        {event.location && (
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-indigo-500" />
            <span>{event.location}</span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-indigo-500" />
          <span>
            {event.max_attendees
              ? `${event.max_attendees - event.attendee_count}자리 남음`
              : `${event.attendee_count}명 참석`}
          </span>
        </div>
      </div>
    </Link>
  );

  const renderCalendar = () => {
    const startDate = activeTab === 'week'
      ? startOfWeek(currentDate, { weekStartsOn: 1 })
      : startOfMonth(currentDate);
    const endDate = activeTab === 'week'
      ? endOfWeek(currentDate, { weekStartsOn: 1 })
      : endOfMonth(currentDate);

    const daysInRange = eachDayOfInterval({ start: startDate, end: endDate });
    const startDay = activeTab === 'week' ? 0 : getDay(startDate);

    const emptySlots = Array(startDay).fill(null);

    const prevPeriod = () => {
      if (activeTab === 'week') {
        setCurrentDate(subDays(startDate, 7));
      } else {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
      }
    };

    const nextPeriod = () => {
      if (activeTab === 'week') {
        setCurrentDate(addDays(startDate, 7));
      } else {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
      }
    };

    const headerLabel = activeTab === 'week'
      ? `${format(startDate, 'yyyy.MM.dd')} - ${format(endDate, 'yyyy.MM.dd')}`
      : format(currentDate, 'yyyy년 M월');

    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">{headerLabel}</h2>
          <div className="flex gap-2">
            <button type="button" onClick={prevPeriod} className="p-2 hover:bg-gray-100 rounded-full">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button type="button" onClick={nextPeriod} className="p-2 hover:bg-gray-100 rounded-full">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-4 mb-2 text-center text-sm font-medium text-gray-500">
          {['일', '월', '화', '수', '목', '금', '토'].map(d => (
            <div key={d}>{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {emptySlots.map((_, i) => (
            <div key={`empty-${format(startDate, 'yyyy-MM')}-${i}`} className="h-24 bg-gray-50 rounded-lg"></div>
          ))}

          {daysInRange.map(day => {
            const dayEvents = events.filter(e => isSameDay(parseISO(e.start_time), day));
            return (
              <div
                key={day.toISOString()}
                className={`h-24 border rounded-lg p-2 overflow-y-auto ${isToday(day) ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-gray-100'}`}
              >
                <div className={`text-sm font-semibold mb-1 ${isToday(day) ? 'text-indigo-600' : 'text-gray-700'}`}>
                  {format(day, 'd')}
                </div>
                <div className="flex flex-col gap-1">
                  {dayEvents.map(e => (
                    <Link to={`/events/${e.id}`} key={e.id} className="text-xs bg-indigo-100 text-indigo-700 px-1 py-0.5 rounded truncate block hover:bg-indigo-200">
                      {format(parseISO(e.start_time), 'p')} {e.title}
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex flex-col gap-4 mb-8 lg:flex-row lg:items-center lg:justify-between">
        <h1 className="text-3xl font-bold text-dark-text">일정</h1>
        <div className="flex flex-wrap gap-2 md:flex-nowrap">
          <select
            value={eventType}
            onChange={(event) => setEventType(event.target.value)}
            className={`${selectClass} min-w-[150px] flex-1`}
          >
            <option value="">전체 유형</option>
            {EVENT_TYPES.map((type) => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
          <input
            type="text"
            value={team}
            onChange={(event) => setTeam(event.target.value)}
            placeholder="팀"
            className={`${inputClass} min-w-[150px] flex-1`}
          />
          <select
            value={targetRank}
            onChange={(event) => setTargetRank(event.target.value)}
            className={`${selectClass} min-w-[150px] flex-1`}
          >
            <option value="">전체 랭크</option>
            {RANK_OPTIONS.map((rank) => (
              <option key={rank} value={rank}>{rank}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {user && ['staff', 'admin', 'superadmin'].includes(user.role) && (
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-semibold hover:bg-brand-light transition-colors"
            >
              일정 추가
            </button>
          )}
          <div className="flex bg-gray-100 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => setActiveTab('agenda')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'agenda' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              예정
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('week')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'week' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              주간
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('month')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'month' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              월간
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('past')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'past' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              지난 일정
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-500">일정을 불러오는 중...</div>
      ) : (
        <>
          {isAgendaView && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {agendaEvents.length > 0 ? (
                agendaEvents.map(renderEventCard)
              ) : (
                <div className="col-span-full text-center py-20 text-gray-500 bg-gray-50 rounded-lg">
                  예정된 일정이 없습니다.
                </div>
              )}
            </div>
          )}

          {activeTab === 'past' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pastEvents.length > 0 ? (
                pastEvents.map(renderEventCard)
              ) : (
                <div className="col-span-full text-center py-20 text-gray-500 bg-gray-50 rounded-lg">
                  지난 일정이 없습니다.
                </div>
              )}
            </div>
          )}

          {(activeTab === 'month' || activeTab === 'week') && renderCalendar()}
        </>
      )}

      {isCreateOpen && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-3 sm:p-4"
          onClick={() => {
            setIsCreateOpen(false);
            resetForm();
          }}
        >
          <div
            className="bg-dark-card rounded-2xl shadow-xl max-w-2xl w-full max-h-[92vh] overflow-y-auto p-6 animate-in fade-in zoom-in-95 duration-200 border border-dark-line text-dark-text"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">일정 추가</h2>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="text-sm text-dark-muted hover:text-dark-text"
              >
                닫기
              </button>
            </div>
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <label htmlFor="event-title" className="text-sm font-medium text-dark-muted">제목</label>
                  <input
                    id="event-title"
                    value={formData.title}
                    onChange={(event) => setFormData((prev) => ({ ...prev, title: event.target.value }))}
                    className={inputClass}
                    placeholder="일정 제목"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="event-team" className="text-sm font-medium text-dark-muted">팀</label>
                  <input
                    id="event-team"
                    value={formData.team}
                    onChange={(event) => setFormData((prev) => ({ ...prev, team: event.target.value }))}
                    className={inputClass}
                    placeholder="선택"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="event-description" className="text-sm font-medium text-dark-muted">설명</label>
                <textarea
                  id="event-description"
                  rows={3}
                  value={formData.description}
                  onChange={(event) => setFormData((prev) => ({ ...prev, description: event.target.value }))}
                  className={textareaClass}
                  placeholder="일정 설명"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <label htmlFor="event-start" className="text-sm font-medium text-dark-muted">시작 시간</label>
                  <input
                    id="event-start"
                    type="datetime-local"
                    value={formData.startTime}
                    onChange={(event) => setFormData((prev) => ({ ...prev, startTime: event.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="event-end" className="text-sm font-medium text-dark-muted">종료 시간</label>
                  <input
                    id="event-end"
                    type="datetime-local"
                    value={formData.endTime}
                    onChange={(event) => setFormData((prev) => ({ ...prev, endTime: event.target.value }))}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <label htmlFor="event-type" className="text-sm font-medium text-dark-muted">유형</label>
                  <select
                    id="event-type"
                    value={formData.eventType}
                    onChange={(event) => setFormData((prev) => ({ ...prev, eventType: event.target.value }))}
                    className={selectClass}
                  >
                    <option value="">선택 안 함</option>
                    {EVENT_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label htmlFor="event-target-rank" className="text-sm font-medium text-dark-muted">대상 랭크</label>
                  <select
                    id="event-target-rank"
                    value={formData.targetRank}
                    onChange={(event) => setFormData((prev) => ({ ...prev, targetRank: event.target.value }))}
                    className={selectClass}
                  >
                    <option value="">선택 안 함</option>
                    {RANK_OPTIONS.map((rank) => (
                      <option key={rank} value={rank}>{rank}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <label htmlFor="event-location" className="text-sm font-medium text-dark-muted">장소</label>
                  <input
                    id="event-location"
                    value={formData.location}
                    onChange={(event) => setFormData((prev) => ({ ...prev, location: event.target.value }))}
                    className={inputClass}
                    placeholder="오프라인 장소"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="event-max-attendees" className="text-sm font-medium text-dark-muted">최대 인원</label>
                  <input
                    id="event-max-attendees"
                    type="number"
                    min={1}
                    value={formData.maxAttendees}
                    onChange={(event) => setFormData((prev) => ({ ...prev, maxAttendees: event.target.value }))}
                    className={inputClass}
                    placeholder="제한 없음"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 rounded-lg border border-dark-line bg-dark-cardSoft px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-dark-text">온라인 일정</p>
                  <p className="text-xs text-dark-muted">온라인 링크를 입력할 수 있습니다.</p>
                </div>
                <label className="inline-flex items-center gap-2 text-sm text-dark-text">
                  <input
                    type="checkbox"
                    checked={formData.isOnline}
                    onChange={(event) => setFormData((prev) => ({ ...prev, isOnline: event.target.checked }))}
                    className="h-4 w-4 rounded border-dark-line bg-dark-bg text-brand focus:ring-brand"
                  />
                  사용
                </label>
              </div>

              {formData.isOnline && (
                <div className="space-y-1">
                  <label htmlFor="event-online-link" className="text-sm font-medium text-dark-muted">온라인 링크</label>
                  <input
                    id="event-online-link"
                    value={formData.onlineLink}
                    onChange={(event) => setFormData((prev) => ({ ...prev, onlineLink: event.target.value }))}
                    className={inputClass}
                    placeholder="https://"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateOpen(false);
                    resetForm();
                  }}
                  className="px-4 py-2 rounded-lg border border-dark-line text-sm text-dark-text hover:bg-dark-cardSoft"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-semibold hover:bg-brand-light transition-colors disabled:opacity-50"
                >
                  {createLoading ? '저장 중...' : '저장'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventListPage;
