import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { Calendar, MapPin, Users, Clock, Globe, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { getEvent, joinEvent, leaveEvent, getMyAttendance, getEventAttendees, setRsvpStatus, updateEvent } from '../../api/events';
import type { Event, Attendance, AttendeeInfo } from '../../api/events';
import { useAuth } from '../../context/AuthContext';

const EVENT_TYPE_LABELS: Record<string, string> = {
  session: '정기 세션',
  study: '스터디',
  deadline: '프로젝트 마감',
  contest: '대회',
  party: '회식',
  mt: 'MT',
  codetest: '코딩테스트 일정',
};

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

const EventDetailPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [event, setEvent] = useState<Event | null>(null);
  const [myAttendance, setMyAttendance] = useState<Attendance | null>(null);
  const [attendees, setAttendees] = useState<AttendeeInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editForm, setEditForm] = useState({
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

  const fetchEventData = useCallback(async (id: number) => {
    setLoading(true);
    try {
      const [eventData, attendanceData, attendeesData] = await Promise.all([
        getEvent(id),
        getMyAttendance(id),
        getEventAttendees(id)
      ]);
      setEvent(eventData);
      setMyAttendance(attendanceData);
      setAttendees(attendeesData.attendees);
    } catch (error) {
      console.error('Failed to fetch event data', error);
      toast.error('Failed to load event details');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (eventId) {
      fetchEventData(parseInt(eventId));
    }
  }, [eventId, fetchEventData]);

  const handleJoin = async () => {
    if (!event) return;
    setProcessing(true);
    try {
      await joinEvent(event.id);
      toast.success('Successfully joined event!');
      fetchEventData(event.id);
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to join event');
    } finally {
      setProcessing(false);
    }
  };

  const handleLeave = async () => {
    if (!event) return;
    if (!confirm('참석을 취소하시겠습니까?')) return;
    
    setProcessing(true);
    try {
      await leaveEvent(event.id);
      toast.success('Successfully cancelled registration');
      fetchEventData(event.id);
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to leave event');
    } finally {
      setProcessing(false);
    }
  };

  const handleTentative = async () => {
    if (!event) return;
    setProcessing(true);
    try {
      await setRsvpStatus(event.id, 'tentative');
      toast.success('보류로 변경되었습니다');
      fetchEventData(event.id);
    } catch (error: any) {
      toast.error(error.response?.data?.detail || '보류 처리에 실패했습니다');
    } finally {
      setProcessing(false);
    }
  };

  const handleDecline = async () => {
    if (!event) return;
    setProcessing(true);
    try {
      await setRsvpStatus(event.id, 'declined');
      toast.success('불참으로 변경되었습니다');
      fetchEventData(event.id);
    } catch (error: any) {
      toast.error(error.response?.data?.detail || '불참 처리에 실패했습니다');
    } finally {
      setProcessing(false);
    }
  };

  const formatDateTimeLocal = (value: string) => format(parseISO(value), "yyyy-MM-dd'T'HH:mm");
  const inputClass = 'w-full rounded-lg border border-dark-line bg-dark-cardSoft px-3 py-2 text-sm text-dark-text placeholder:text-dark-muted focus:outline-none focus:border-brand';
  const selectClass = 'w-full rounded-lg border border-dark-line bg-dark-cardSoft px-3 py-2 text-sm text-dark-text focus:outline-none focus:border-brand';
  const textareaClass = 'w-full rounded-lg border border-dark-line bg-dark-cardSoft px-3 py-2 text-sm text-dark-text placeholder:text-dark-muted focus:outline-none focus:border-brand';

  const openEditModal = () => {
    if (!event) return;
    setEditForm({
      title: event.title ?? '',
      description: event.description ?? '',
      startTime: formatDateTimeLocal(event.start_time),
      endTime: formatDateTimeLocal(event.end_time),
      eventType: event.event_type ?? '',
      team: event.team ?? '',
      targetRank: event.target_rank ?? '',
      location: event.location ?? '',
      isOnline: event.is_online ?? false,
      onlineLink: event.online_link ?? '',
      maxAttendees: event.max_attendees ? String(event.max_attendees) : '',
    });
    setIsEditOpen(true);
  };

  const handleEditSubmit = async (formEvent: React.FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault();
    if (!event) return;

    if (!editForm.title.trim() || !editForm.description.trim()) {
      toast.error('제목과 설명을 입력해주세요.');
      return;
    }

    if (!editForm.startTime || !editForm.endTime) {
      toast.error('시작/종료 시간을 입력해주세요.');
      return;
    }

    setEditLoading(true);
    try {
      await updateEvent(event.id, {
        title: editForm.title.trim(),
        description: editForm.description.trim(),
        start_time: new Date(editForm.startTime).toISOString(),
        end_time: new Date(editForm.endTime).toISOString(),
        event_type: editForm.eventType || undefined,
        team: editForm.team || undefined,
        target_rank: editForm.targetRank || undefined,
        location: editForm.location || undefined,
        is_online: editForm.isOnline,
        online_link: editForm.isOnline ? editForm.onlineLink || undefined : undefined,
        max_attendees: editForm.maxAttendees ? Number(editForm.maxAttendees) : undefined,
      });
      toast.success('일정이 수정되었습니다.');
      setIsEditOpen(false);
      await fetchEventData(event.id);
    } catch (error: any) {
      console.error('Failed to update event', error);
      toast.error(error.response?.data?.detail || '일정 수정에 실패했습니다.');
    } finally {
      setEditLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <div className="text-gray-500">일정 정보를 불러오는 중...</div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">일정을 찾을 수 없습니다</h2>
        <button
          type="button"
          onClick={() => navigate('/events')}
          className="px-3 py-1 rounded-lg border border-dark-line text-dark-text hover:bg-dark-cardSoft transition-colors"
        >
          일정 목록으로
        </button>
      </div>
    );
  }

  const isFull = event.max_attendees && event.attendee_count >= event.max_attendees;
  const isAttending = myAttendance?.status === 'attending';
  const isWaitlisted = myAttendance?.status === 'waitlist';
  const isTentative = myAttendance?.status === 'tentative';
  const isDeclined = myAttendance?.status === 'declined';
  const canJoin = !isAttending && !isWaitlisted && (!isFull || event.allow_waitlist);
  const isOwner = user?.id === event.owner_id;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
        <button 
          type="button"
          onClick={() => navigate('/events')}
          className="flex items-center text-dark-text hover:text-white mb-6 transition-colors"
        >

        <ArrowLeft className="w-4 h-4 mr-2" />
        일정 목록으로
      </button>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-8">
          <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{event.title}</h1>
              <div className="flex flex-wrap gap-2 text-sm text-gray-500">
                {event.event_type && (
                  <span className="rounded-full bg-indigo-100 px-3 py-1 text-indigo-700">
                    {EVENT_TYPE_LABELS[event.event_type] || event.event_type}
                  </span>
                )}
                {event.team && (
                  <span className="rounded-full bg-gray-100 px-3 py-1">팀: {event.team}</span>
                )}
                {event.target_rank && (
                  <span className="rounded-full bg-gray-100 px-3 py-1">랭크: {event.target_rank}</span>
                )}
              </div>
              <div className="flex flex-wrap gap-4 text-gray-600 mt-2">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-indigo-500" />
                  <span>{format(parseISO(event.start_time), 'yyyy.MM.dd')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-indigo-500" />
                  <span>{format(parseISO(event.start_time), 'p')} - {format(parseISO(event.end_time), 'p')}</span>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col items-end gap-2">
              {isOwner && (
                <button
                  type="button"
                  onClick={openEditModal}
                  className="px-3 py-1.5 rounded-lg border border-brand text-brand text-sm font-semibold hover:bg-brand/10 transition-colors"
                >
                  일정 수정
                </button>
              )}
              {isAttending && (
                <span className="flex items-center gap-1 bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-medium">
                  <CheckCircle className="w-4 h-4" /> 참석
                </span>
              )}
              {isTentative && (
                <span className="flex items-center gap-1 bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">
                  <Clock className="w-4 h-4" /> 보류
                </span>
              )}
              {isDeclined && (
                <span className="flex items-center gap-1 bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm font-medium">
                  <AlertCircle className="w-4 h-4" /> 불참
                </span>
              )}
              {isWaitlisted && (
                <span className="flex items-center gap-1 bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-sm font-medium">
                  <Clock className="w-4 h-4" /> 대기 {myAttendance?.waitlist_position}
                </span>
              )}
              {event.is_online && (
                <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full font-medium">
                  온라인 이벤트
                </span>
              )}
            </div>
          </div>

          <div className="prose max-w-none text-gray-600 mb-8">
            <p className="whitespace-pre-line">{event.description}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-gray-500" /> 장소
              </h3>
              {event.is_online ? (
                <div>
                  {event.location && (
                    <p className="text-gray-700">{event.location}</p>
                  )}
                  <p className="text-gray-700 mt-1">온라인 참가</p>
                  {isAttending && event.online_link && (
                    <a href={event.online_link} target="_blank" rel="noopener noreferrer" className="mt-2 text-indigo-600 hover:underline flex items-center gap-1">
                      <Globe className="w-4 h-4" /> 참가 링크
                    </a>
                  )}
                </div>
              ) : (
                <p className="text-gray-700">{event.location || '장소 미정'}</p>
              )}
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Users className="w-5 h-5 text-gray-500" /> 참석 현황
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-800">참석자:</span>
                  <span className="font-semibold text-gray-900">{event.attendee_count} / {event.max_attendees || '∞'}</span>
                </div>
                {event.waitlist_count > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-800">대기자:</span>
                    <span className="font-semibold text-yellow-700">{event.waitlist_count}명</span>
                  </div>
                )}
                {isFull && !isAttending && (
                  <div className="flex items-center gap-2 text-xs text-amber-600 mt-2">
                    <AlertCircle className="w-4 h-4" />
                    {event.allow_waitlist ? '정원이 가득 찼습니다. 대기자 명단에 등록할 수 있습니다.' : '정원이 가득 찼습니다.'}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-8 mb-8">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900">참석자 ({attendees.length})</h3>
            </div>
            
            {attendees.length > 0 ? (
              <div className="flex flex-wrap gap-3">
                {attendees.map((attendee) => (
                  <div key={attendee.user_id} className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-full border border-gray-100">
                    <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold">
                      {attendee.user_name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm text-gray-700">{attendee.user_name}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 italic">첫 번째 참석자가 되어보세요!</p>
            )}
          </div>

          <div className="flex flex-wrap justify-end gap-3 border-t border-gray-100 pt-6">
            {(isAttending || isWaitlisted) ? (
              <button
                type="button"
                onClick={handleLeave}
                disabled={processing}
                className="px-6 py-2.5 bg-red-50 text-red-600 font-medium rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
              >
                {processing ? '처리중...' : '참석 취소'}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleJoin}
                  disabled={processing || (!canJoin && !event.allow_waitlist)}
                  className={`px-8 py-2.5 font-medium rounded-lg transition-colors shadow-sm ${
                    canJoin 
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700' 
                      : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {processing ? '처리중...' : isFull ? '대기자 등록' : '참석하기'}
                </button>
                <button
                  type="button"
                  onClick={handleTentative}
                  disabled={processing}
                  className="px-6 py-2.5 bg-blue-50 text-blue-700 font-medium rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
                >
                  보류
                </button>
                <button
                  type="button"
                  onClick={handleDecline}
                  disabled={processing}
                  className="px-6 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                >
                  불참
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {isEditOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4">
          <div className="bg-dark-card border border-dark-line rounded-2xl shadow-xl max-w-2xl w-full p-6 animate-in fade-in zoom-in-95 duration-200 text-dark-text">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">일정 수정</h2>
              <button
                type="button"
                onClick={() => setIsEditOpen(false)}
                className="text-sm text-dark-muted hover:text-dark-text"
              >
                닫기
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <label htmlFor="edit-event-title" className="text-sm font-medium text-dark-muted">제목</label>
                  <input
                    id="edit-event-title"
                    value={editForm.title}
                    onChange={(eventForm) => setEditForm((prev) => ({ ...prev, title: eventForm.target.value }))}
                    className={inputClass}
                    placeholder="일정 제목"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="edit-event-team" className="text-sm font-medium text-dark-muted">팀</label>
                  <input
                    id="edit-event-team"
                    value={editForm.team}
                    onChange={(eventForm) => setEditForm((prev) => ({ ...prev, team: eventForm.target.value }))}
                    className={inputClass}
                    placeholder="선택"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="edit-event-description" className="text-sm font-medium text-dark-muted">설명</label>
                <textarea
                  id="edit-event-description"
                  rows={3}
                  value={editForm.description}
                  onChange={(eventForm) => setEditForm((prev) => ({ ...prev, description: eventForm.target.value }))}
                  className={textareaClass}
                  placeholder="일정 설명"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <label htmlFor="edit-event-start" className="text-sm font-medium text-dark-muted">시작 시간</label>
                  <input
                    id="edit-event-start"
                    type="datetime-local"
                    value={editForm.startTime}
                    onChange={(eventForm) => setEditForm((prev) => ({ ...prev, startTime: eventForm.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="edit-event-end" className="text-sm font-medium text-dark-muted">종료 시간</label>
                  <input
                    id="edit-event-end"
                    type="datetime-local"
                    value={editForm.endTime}
                    onChange={(eventForm) => setEditForm((prev) => ({ ...prev, endTime: eventForm.target.value }))}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <label htmlFor="edit-event-type" className="text-sm font-medium text-dark-muted">유형</label>
                  <select
                    id="edit-event-type"
                    value={editForm.eventType}
                    onChange={(eventForm) => setEditForm((prev) => ({ ...prev, eventType: eventForm.target.value }))}
                    className={selectClass}
                  >
                    <option value="">선택 안 함</option>
                    {EVENT_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label htmlFor="edit-event-target" className="text-sm font-medium text-dark-muted">대상 랭크</label>
                  <select
                    id="edit-event-target"
                    value={editForm.targetRank}
                    onChange={(eventForm) => setEditForm((prev) => ({ ...prev, targetRank: eventForm.target.value }))}
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
                  <label htmlFor="edit-event-location" className="text-sm font-medium text-dark-muted">장소</label>
                  <input
                    id="edit-event-location"
                    value={editForm.location}
                    onChange={(eventForm) => setEditForm((prev) => ({ ...prev, location: eventForm.target.value }))}
                    className={inputClass}
                    placeholder="오프라인 장소"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="edit-event-max" className="text-sm font-medium text-dark-muted">최대 인원</label>
                  <input
                    id="edit-event-max"
                    type="number"
                    min={1}
                    value={editForm.maxAttendees}
                    onChange={(eventForm) => setEditForm((prev) => ({ ...prev, maxAttendees: eventForm.target.value }))}
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
                    checked={editForm.isOnline}
                    onChange={(eventForm) => setEditForm((prev) => ({ ...prev, isOnline: eventForm.target.checked }))}
                    className="h-4 w-4 rounded border-dark-line bg-dark-bg text-brand focus:ring-brand"
                  />
                  사용
                </label>
              </div>

              {editForm.isOnline && (
                <div className="space-y-1">
                  <label htmlFor="edit-event-online" className="text-sm font-medium text-dark-muted">온라인 링크</label>
                  <input
                    id="edit-event-online"
                    value={editForm.onlineLink}
                    onChange={(eventForm) => setEditForm((prev) => ({ ...prev, onlineLink: eventForm.target.value }))}
                    className={inputClass}
                    placeholder="https://"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="px-4 py-2 rounded-lg border border-dark-line text-sm text-dark-text hover:bg-dark-cardSoft"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-semibold hover:bg-brand-light transition-colors disabled:opacity-50"
                >
                  {editLoading ? '저장 중...' : '저장'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventDetailPage;
