import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchCalendarEvents, CALENDAR_ADMIN_ROLE, type CalendarEvent } from "../../api/calendar";
import { fetchStaff, type StaffOption } from "../../api/staff";
import { useAuthStore } from "../../state/authStore";
import { CalendarEventModal } from "./CalendarEventModal";
import { Select } from "../../components/controls";
import { IconChevronLeft, IconPlus, IconSearch } from "../layout/icons";
import { useMediaQuery } from "../layout/useMediaQuery";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
// The grid always shows full weeks, so it starts on the Sunday on/before
// the 1st and runs 6 weeks (42 days) - enough to cover every month
// regardless of how it falls across week boundaries.
function startOfGrid(d: Date): Date {
  const first = startOfMonth(d);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return start;
}
function addDays(d: Date, n: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
}
function ymd(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}
function isToday(d: Date): boolean {
  return ymd(d) === ymd(new Date());
}
function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

// Deterministic pale/dark color pair per staff id, so the admin's combined
// "everyone's calendar" view can tell whose event is whose at a glance
// without a legend - no design tokens for this exist yet, so this is
// computed rather than picked from a fixed palette.
function staffHue(staffId: string): number {
  let hash = 0;
  for (let i = 0; i < staffId.length; i++) hash = (hash * 31 + staffId.charCodeAt(i)) >>> 0;
  return hash % 360;
}

const MAX_VISIBLE_PER_DAY = 4;

export function CalendarPage() {
  const authStaff = useAuthStore((s) => s.staff);
  const [viewDate, setViewDate] = useState(() => new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [staffList, setStaffList] = useState<StaffOption[]>([]);
  const [staffFilter, setStaffFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<{ event: CalendarEvent | null; defaultDate?: Date } | null>(null);
  // Below `sm` a month of text chips can't fit, so cells shrink to dots and
  // tapping a day shows its events in an agenda list under the grid instead.
  const isWide = useMediaQuery("(min-width: 640px)");
  const [selectedDay, setSelectedDay] = useState(() => new Date());

  // Reflects the current session's role for a snappier first paint - the
  // server's own `isAdmin` on the events response (set below) is what
  // actually gates the staff filter/search-by-staff and reassignment, since
  // it can't go stale the way a cached login can.
  const likelyAdmin = authStaff?.roles.includes(CALENDAR_ADMIN_ROLE) ?? false;

  const gridStart = useMemo(() => startOfGrid(viewDate), [viewDate]);
  const days = useMemo(() => Array.from({ length: 42 }, (_, i) => addDays(gridStart, i)), [gridStart]);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchCalendarEvents({
      from: gridStart.toISOString(),
      to: addDays(gridStart, 42).toISOString(),
      staffId: staffFilter || undefined,
      search: search.trim() || undefined,
    })
      .then((res) => {
        setEvents(res.events);
        setIsAdmin(res.isAdmin);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load calendar"))
      .finally(() => setLoading(false));
  }, [gridStart, staffFilter, search]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!likelyAdmin) return;
    fetchStaff()
      .then((res) => setStaffList(res.staff))
      .catch(() => setStaffList([]));
  }, [likelyAdmin]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const key = ymd(new Date(e.startAt));
      const list = map.get(key);
      if (list) list.push(e);
      else map.set(key, [e]);
    }
    for (const list of map.values()) list.sort((a, b) => a.startAt.localeCompare(b.startAt));
    return map;
  }, [events]);

  const monthLabel = viewDate.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-ink">{isAdmin ? "Admin Calendar Portal" : "Calendar"}</h1>
        <button
          onClick={() => setModal({ event: null, defaultDate: new Date() })}
          className="flex items-center gap-1.5 rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-hover"
        >
          <IconPlus width={16} height={16} /> New Event
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-white px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
            className="rounded-md border border-border p-2 text-muted hover:border-teal hover:text-ink"
            aria-label="Previous month"
          >
            <IconChevronLeft width={16} height={16} />
          </button>
          <button
            onClick={() => setViewDate(new Date())}
            className="rounded-md border border-border px-3 py-2 text-xs font-semibold text-ink hover:border-teal"
          >
            Today
          </button>
          <button
            onClick={() => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
            className="rounded-md border border-border p-2 text-muted hover:border-teal hover:text-ink"
            aria-label="Next month"
          >
            <IconChevronLeft width={16} height={16} className="rotate-180" />
          </button>
          <span className="ml-2 text-base font-bold text-ink">{monthLabel}</span>
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <div className="relative w-full sm:w-auto">
            <IconSearch width={14} height={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isAdmin ? "Search events or staff…" : "Search events…"}
              className="w-full rounded-md border border-border bg-white py-2 pl-8 pr-3 sm:w-56 text-sm text-ink outline-none focus:border-teal focus:ring-2 focus:ring-ring"
            />
          </div>
          {isAdmin && (
            <Select fitContent value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)}>
              <option value="">Everyone's Calendar</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>
                  {[s.firstName, s.lastName].filter(Boolean).join(" ") || s.email}
                </option>
              ))}
            </Select>
          )}
        </div>
      </div>

      {error && <p className="rounded-card border border-dashed border-border bg-white p-4 text-sm text-error">{error}</p>}

      <div className="overflow-hidden rounded-card border border-border bg-white">
        <div className="grid grid-cols-7 border-b border-border bg-[#f7fafc] text-xs font-semibold text-muted">
          {WEEKDAY_LABELS.map((w) => (
            <div key={w} className="px-1 py-2 text-center sm:px-3">
              {w}
            </div>
          ))}
        </div>
        <div className={`grid grid-cols-7 ${loading ? "opacity-50" : ""}`}>
          {days.map((day) => {
            const key = ymd(day);
            const dayEvents = eventsByDay.get(key) ?? [];
            const visible = dayEvents.slice(0, MAX_VISIBLE_PER_DAY);
            const overflow = dayEvents.length - visible.length;
            return (
              <button
                key={key}
                type="button"
                onClick={() => (isWide ? setModal({ event: null, defaultDate: day }) : setSelectedDay(day))}
                className={`group flex min-h-[56px] flex-col items-stretch gap-1 border-b border-r border-border p-1 text-left last:border-r-0 hover:bg-bg/60 sm:min-h-[110px] sm:p-1.5 ${
                  isSameMonth(day, viewDate) ? "bg-white" : "bg-[#fafbfc]"
                } ${!isWide && key === ymd(selectedDay) ? "ring-2 ring-inset ring-teal" : ""}`}
              >
                <span
                  className={`self-start rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
                    isToday(day) ? "bg-teal text-white" : isSameMonth(day, viewDate) ? "text-ink" : "text-gray-300"
                  }`}
                >
                  {day.getDate()}
                </span>
                {/* Phone: one dot per event (max 3) - the agenda below has the details. */}
                <div className="flex flex-wrap gap-0.5 px-0.5 sm:hidden">
                  {dayEvents.slice(0, 3).map((e) => (
                    <span key={e.id} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: `hsl(${staffHue(e.staffId)}, 55%, 45%)` }} />
                  ))}
                  {dayEvents.length > 3 && <span className="text-[9px] leading-none text-muted">+</span>}
                </div>
                <div className="hidden flex-1 flex-col gap-0.5 overflow-hidden sm:flex">
                  {visible.map((e) => (
                    <span
                      key={e.id}
                      role="button"
                      tabIndex={0}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        setModal({ event: e });
                      }}
                      onKeyDown={(ev) => {
                        if (ev.key === "Enter" || ev.key === " ") {
                          ev.stopPropagation();
                          setModal({ event: e });
                        }
                      }}
                      title={`${e.title}${isAdmin ? ` — ${e.staff.name}` : ""}`}
                      className="truncate rounded px-1.5 py-0.5 text-left text-[10px] font-semibold"
                      style={{ backgroundColor: `hsl(${staffHue(e.staffId)}, 65%, 92%)`, color: `hsl(${staffHue(e.staffId)}, 55%, 30%)` }}
                    >
                      {!e.allDay && <span className="font-normal opacity-80">{formatTime(e.startAt)} </span>}
                      {e.title}
                      {isAdmin && !staffFilter && <span className="font-normal opacity-70"> · {e.staff.name}</span>}
                    </span>
                  ))}
                  {overflow > 0 && <span className="px-1.5 text-[10px] text-muted">+{overflow} more</span>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {!isWide && (
        <div className="rounded-card border border-border bg-white p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-ink">
              {selectedDay.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
            </h2>
            <button
              onClick={() => setModal({ event: null, defaultDate: selectedDay })}
              className="flex items-center gap-1 rounded-md border border-teal px-2.5 py-1.5 text-xs font-semibold text-teal hover:bg-bg"
            >
              <IconPlus width={14} height={14} /> Add
            </button>
          </div>
          {(eventsByDay.get(ymd(selectedDay)) ?? []).length === 0 ? (
            <p className="text-sm text-muted">Nothing scheduled.</p>
          ) : (
            <ul className="space-y-2">
              {(eventsByDay.get(ymd(selectedDay)) ?? []).map((e) => (
                <li key={e.id}>
                  <button
                    onClick={() => setModal({ event: e })}
                    className="flex w-full items-start gap-3 rounded-md border border-border p-2.5 text-left hover:bg-bg"
                  >
                    <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: `hsl(${staffHue(e.staffId)}, 55%, 45%)` }} />
                    <span className="min-w-0">
                      <span className="block break-words text-sm font-semibold text-ink">{e.title}</span>
                      <span className="block text-xs text-muted">
                        {e.allDay ? "All day" : `${formatTime(e.startAt)} – ${formatTime(e.endAt)}`}
                        {isAdmin && ` · ${e.staff.name}`}
                        {e.location && ` · ${e.location}`}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {modal && authStaff && (
        <CalendarEventModal
          event={modal.event}
          defaultDate={modal.defaultDate}
          isAdmin={isAdmin}
          staff={staffList}
          currentStaffId={authStaff.id}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            load();
          }}
        />
      )}
    </div>
  );
}
