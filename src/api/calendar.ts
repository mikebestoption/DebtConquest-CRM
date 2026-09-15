import { apiRequest } from "./client";

// Only "Subscriber Admin" (see routes/crm/calendar.route.ts's own ADMIN_ROLE)
// gets the combined "everyone's calendar" view, the staff filter, and
// staff-name search - mirrors the server's own check so the UI can hide
// those controls, though the server is the actual enforcement point.
export const CALENDAR_ADMIN_ROLE = "Subscriber Admin";

export interface CalendarEventStaff {
  id: string;
  name: string;
}

export interface CalendarEvent {
  id: string;
  staffId: string;
  staff: CalendarEventStaff;
  title: string;
  description: string | null;
  location: string | null;
  startAt: string;
  endAt: string;
  allDay: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CalendarEventsQuery {
  from?: string;
  to?: string;
  staffId?: string;
  search?: string;
}

export interface CalendarEventInput {
  staffId?: string;
  title: string;
  description?: string | null;
  location?: string | null;
  startAt: string;
  endAt: string;
  allDay?: boolean;
}

export type CalendarEventPatch = Partial<CalendarEventInput>;

function toSearchParams(q: CalendarEventsQuery): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(q)) {
    if (value) params.set(key, value);
  }
  return params.toString();
}

export function fetchCalendarEvents(query: CalendarEventsQuery): Promise<{ status: string; events: CalendarEvent[]; isAdmin: boolean }> {
  return apiRequest(`/calendar/events?${toSearchParams(query)}`);
}

export function createCalendarEvent(input: CalendarEventInput): Promise<{ status: string; event: CalendarEvent }> {
  return apiRequest("/calendar/events", { method: "POST", body: JSON.stringify(input) });
}

export function updateCalendarEvent(id: string, patch: CalendarEventPatch): Promise<{ status: string; event: CalendarEvent }> {
  return apiRequest(`/calendar/events/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
}

export function deleteCalendarEvent(id: string): Promise<{ status: string }> {
  return apiRequest(`/calendar/events/${id}`, { method: "DELETE" });
}
