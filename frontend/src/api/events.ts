import api from './axios';

export interface AttendeeInfo {
  user_id: number;
  user_name: string;
  status: 'attending' | 'waitlist' | 'cancelled' | 'tentative' | 'declined';
  registered_at: string;
  waitlist_position?: number;
  checked_in_at?: string;
}

export interface Event {
  id: number;
  title: string;
  description: string;
  start_time: string;
  end_time: string;
  owner_id: number;
  created_at: string;
  event_type?: string | null;
  team?: string | null;
  target_rank?: string | null;
  recurrence_type?: string | null;
  recurrence_interval?: number;
  recurrence_end_date?: string | null;
  recurrence_count?: number | null;
  max_attendees?: number;
  location?: string;
  is_online: boolean;
  online_link?: string;
  registration_deadline?: string;
  allow_waitlist: boolean;
  check_in_enabled: boolean;
  check_in_start?: string;
  check_in_end?: string;
  checked_in_count: number;
  attendee_count: number;
  waitlist_count: number;
  is_full: boolean;
}

export interface EventCreate {
  title: string;
  description: string;
  start_time: string;
  end_time: string;
  event_type?: string;
  team?: string;
  target_rank?: string;
  max_attendees?: number;
  location?: string;
  is_online?: boolean;
  online_link?: string;
  registration_deadline?: string;
  allow_waitlist?: boolean;
  check_in_enabled?: boolean;
  check_in_start?: string;
  check_in_end?: string;
}

export interface EventUpdate {
  title?: string;
  description?: string;
  start_time?: string;
  end_time?: string;
  event_type?: string;
  team?: string;
  target_rank?: string;
  max_attendees?: number;
  location?: string;
  is_online?: boolean;
  online_link?: string;
  registration_deadline?: string;
  allow_waitlist?: boolean;
  check_in_enabled?: boolean;
  check_in_start?: string;
  check_in_end?: string;
}

export interface RSVPResponse {
  status: 'attending' | 'waitlist' | 'already_attending' | 'event_full';
  message: string;
  waitlist_position?: number;
  attendee_count?: number;
  max_attendees?: number;
}

export interface RSVPCancelResponse {
  status: 'cancelled' | 'not_found';
  message: string;
  promoted_user_id?: number;
}

export interface EventAttendeesResponse {
  event_id: number;
  attendee_count: number;
  max_attendees?: number;
  attendees: AttendeeInfo[];
}

export interface Attendance {
  id: number;
  event_id: number;
  user_id: number;
  status: 'attending' | 'waitlist' | 'cancelled' | 'tentative' | 'declined';
  waitlist_position?: number;
  registered_at: string;
  cancelled_at?: string;
}

export const getEvents = async (upcomingOnly = false, filters?: { event_type?: string; team?: string; target_rank?: string }) => {
  const response = await api.get<Event[]>('/events', {
    params: { upcoming_only: upcomingOnly, ...filters }
  });
  return response.data;
};

export const getEventOccurrences = async (
  start: string,
  end: string,
  filters?: { event_type?: string; team?: string; target_rank?: string }
) => {
  const response = await api.get<Event[]>('/events/occurrences', {
    params: { start, end, ...filters }
  });
  return response.data;
};

export const createEvent = async (payload: EventCreate) => {
  const response = await api.post<Event>('/events', payload);
  return response.data;
};

export const updateEvent = async (id: number, payload: EventUpdate) => {
  const response = await api.put<Event>(`/events/${id}`, payload);
  return response.data;
};

export const getEvent = async (id: number) => {
  const response = await api.get<Event>(`/events/${id}`);
  return response.data;
};

export const joinEvent = async (id: number, notes?: string) => {
  const response = await api.post<RSVPResponse>(`/events/${id}/attend`, null, {
    params: { notes }
  });
  return response.data;
};

export const leaveEvent = async (id: number) => {
  const response = await api.delete<RSVPCancelResponse>(`/events/${id}/attend`);
  return response.data;
};

export const getEventAttendees = async (id: number) => {
  const response = await api.get<EventAttendeesResponse>(`/events/${id}/attendees`);
  return response.data;
};

export const getMyAttendance = async (id: number) => {
  const response = await api.get<Attendance | null>(`/events/${id}/my-attendance`);
  return response.data;
};

export const setRsvpStatus = async (id: number, status: 'tentative' | 'declined', notes?: string) => {
  const response = await api.post(`/events/${id}/rsvp`, null, {
    params: { status, notes }
  });
  return response.data;
};
