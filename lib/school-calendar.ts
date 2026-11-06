/**
 * The school calendar, from the Xano tables the apply portal keeps for the
 * front office (API group `2GcBXyoA`, the same instance as the rest of the
 * app): one `school_calendar` row per date of the school year (a school day,
 * a weekend, a break or a holiday, tagged with its school year and term),
 * the named events pinned to those days (`school_calendar_events`: testing,
 * socials, trips, ceremonies, with times and a category), the academic terms
 * and the school years. The class schedule lists a term's Thursday/Friday
 * thesis sessions and marks the ones an event or closure collides with.
 * Read through `/api/school-calendar`, which caches it.
 */

const SCHOOL_CALENDAR_API = "https://xsc3-mvx7-r86m.n7e.xano.io/api:2GcBXyoA"

export const SCHOOL_CALENDAR_ENDPOINT = `${SCHOOL_CALENDAR_API}/school_calendar`
export const SCHOOL_EVENTS_ENDPOINT = `${SCHOOL_CALENDAR_API}/school_calendar_events`
export const SCHOOL_TERMS_ENDPOINT = `${SCHOOL_CALENDAR_API}/registration_academic_terms`
export const SCHOOL_YEARS_ENDPOINT = `${SCHOOL_CALENDAR_API}/registration_school_years`

/** Calendar dates are plain YYYY-MM-DD in the school's own time zone. */
export const SCHOOL_TIME_ZONE = "America/New_York"

export interface SchoolCalendarDay {
  /** The calendar row's id; events point at it. */
  id: number
  /** YYYY-MM-DD */
  date: string
  /** The school year and academic term the day belongs to (0 = none). */
  yearId: number
  termId: number
  /** "School", "Break" or "Weekend", as entered by the office. */
  type: string
  holiday: boolean
  break: boolean
  /** "Externship", "Internship" or "" on a day without work placements. */
  workType: string
  firstDayOfTerm: boolean
  lastDayOfTerm: boolean
}

/** Narrows the raw table rows to what the app shows, oldest first; rows
    without a usable date are dropped. */
export function parseSchoolCalendar(rows: unknown): SchoolCalendarDay[] {
  if (!Array.isArray(rows)) return []
  const days: SchoolCalendarDay[] = []
  for (const row of rows) {
    if (!row || typeof row !== "object") continue
    const r = row as Record<string, unknown>
    const date = typeof r.date === "string" ? r.date.slice(0, 10) : ""
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue
    days.push({
      id: Number(r.id) || 0,
      date,
      yearId: Number(r.schoolyears_id) || 0,
      termId: Number(r.terms_id) || 0,
      type: typeof r.type === "string" ? r.type : "",
      holiday: r.holiday === true,
      break: r.break === true,
      workType: typeof r.work_type === "string" ? r.work_type.trim() : "",
      firstDayOfTerm: r.first_day_term === true,
      lastDayOfTerm: r.last_day_term === true,
    })
  }
  return days.sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Event categories as the office files them (the `color` slug on the row):
 * testing, SailFuture Serves, student events, parent events. Anything else is
 * uncategorized.
 */
export const EVENT_CATEGORIES: Record<string, { label: string; dot: string; chip: string }> = {
  sky: { label: "Testing", dot: "bg-sky-500", chip: "bg-sky-100 text-sky-900 dark:bg-sky-500/20 dark:text-sky-100" },
  emerald: {
    label: "SailFuture Serves",
    dot: "bg-emerald-500",
    chip: "bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-100",
  },
  violet: {
    label: "Student event",
    dot: "bg-violet-500",
    chip: "bg-violet-100 text-violet-900 dark:bg-violet-500/20 dark:text-violet-100",
  },
  amber: {
    label: "Parent event",
    dot: "bg-amber-500",
    chip: "bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-100",
  },
}

export const UNCATEGORIZED = {
  label: "Other",
  dot: "bg-slate-400",
  chip: "bg-slate-100 text-slate-800 dark:bg-slate-500/20 dark:text-slate-100",
}

export function eventCategory(event: Pick<SchoolEvent, "category">) {
  return EVENT_CATEGORIES[event.category] ?? UNCATEGORIZED
}

export interface SchoolEvent {
  id: number
  /** The calendar day the event is pinned to. */
  dayId: number
  /** YYYY-MM-DD of that day. */
  date: string
  title: string
  description: string
  location: string
  /** ms epoch, or null for an all-day event. */
  start: number | null
  end: number | null
  mandatory: boolean
  /** The category slug ("sky", "emerald", "violet", "amber") or "". */
  category: string
}

/** Events joined to their day's date, in date and time order. Events whose
    day row no longer exists have nowhere to go and are dropped. */
export function parseSchoolEvents(rows: unknown, days: SchoolCalendarDay[]): SchoolEvent[] {
  if (!Array.isArray(rows)) return []
  const dateOf = new Map(days.map((d) => [d.id, d.date]))
  const events: SchoolEvent[] = []
  for (const row of rows) {
    if (!row || typeof row !== "object") continue
    const r = row as Record<string, unknown>
    const dayId = Number(r.school_calendar_id) || 0
    const date = dateOf.get(dayId)
    const title = typeof r.title === "string" ? r.title.trim() : ""
    if (!date || !title) continue
    const start = Number(r.start_time) || 0
    const end = Number(r.end_time) || 0
    events.push({
      id: Number(r.id) || 0,
      dayId,
      date,
      title,
      description: typeof r.description === "string" ? r.description.trim() : "",
      location: typeof r.location === "string" ? r.location.trim() : "",
      start: start > 0 ? start : null,
      end: end > 0 ? end : null,
      mandatory: r.mandatory === true,
      category: typeof r.color === "string" ? r.color.trim() : "",
    })
  }
  return events.sort((a, b) => a.date.localeCompare(b.date) || (a.start ?? 0) - (b.start ?? 0))
}

export interface SchoolTerm {
  id: number
  /** "Term 1" … "Term 5" */
  name: string
  yearId: number
  /** YYYY-MM-DD, or null on a term whose dates haven't been entered. */
  start: string | null
  end: string | null
}

export function parseSchoolTerms(rows: unknown): SchoolTerm[] {
  const list = Array.isArray(rows)
    ? rows
    : rows && typeof rows === "object" && Array.isArray((rows as { value?: unknown }).value)
      ? ((rows as { value: unknown[] }).value as unknown[])
      : []
  const terms: SchoolTerm[] = []
  for (const row of list) {
    if (!row || typeof row !== "object") continue
    const r = row as Record<string, unknown>
    const id = Number(r.id) || 0
    const name = typeof r.term_name === "string" ? r.term_name.trim() : ""
    if (!id || !name) continue
    terms.push({
      id,
      name,
      yearId: Number(r.registration_school_years_id) || 0,
      start: isoDateOrNull(r.start_date),
      end: isoDateOrNull(r.end_date),
    })
  }
  return terms.sort((a, b) => (a.start ?? "9999").localeCompare(b.start ?? "9999") || a.name.localeCompare(b.name))
}

export interface SchoolYear {
  id: number
  /** "2026-2027" */
  name: string
  start: string | null
  end: string | null
  isActive: boolean
}

export function parseSchoolYears(rows: unknown): SchoolYear[] {
  if (!Array.isArray(rows)) return []
  const years: SchoolYear[] = []
  for (const row of rows) {
    if (!row || typeof row !== "object") continue
    const r = row as Record<string, unknown>
    const id = Number(r.id) || 0
    const name = typeof r.year_name === "string" ? r.year_name.trim() : ""
    if (!id || !name) continue
    years.push({
      id,
      name,
      start: isoDateOrNull(r.start_date),
      end: isoDateOrNull(r.end_date),
      isActive: r.isActive === true,
    })
  }
  return years.sort((a, b) => a.name.localeCompare(b.name))
}

function isoDateOrNull(v: unknown): string | null {
  const s = typeof v === "string" ? v.slice(0, 10) : ""
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null
}

/** Everything `/api/school-calendar` returns. */
export interface SchoolCalendar {
  days: SchoolCalendarDay[]
  events: SchoolEvent[]
  terms: SchoolTerm[]
  years: SchoolYear[]
}

/** When the senior class meets: the window thesis advisors join. */
export const CLASS_MEETING = {
  /** JS weekday numbers (0 = Sunday): Thursday and Friday. */
  weekdays: [4, 5] as number[],
  startLabel: "12:00 pm",
  endLabel: "1:55 pm",
  /** Minutes after midnight, school time. */
  startMinutes: 12 * 60,
  endMinutes: 13 * 60 + 55,
}

const WEEKDAY_NAME = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

function utcDate(isoDate: string): Date {
  const [y, m, d] = isoDate.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

/** 0 = Sunday … 6 = Saturday, independent of the browser's time zone. */
export function weekdayOf(isoDate: string): number {
  return utcDate(isoDate).getUTCDay()
}

export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

/** The current date and time of day as the school sees them. */
export function schoolNow(now = new Date()): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SCHOOL_TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(now)
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "00"
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
  }
}

/** Minutes after midnight on the school's clock for an instant. */
export function schoolMinutesOf(ms: number): number {
  return schoolNow(new Date(ms)).minutes
}

/** "Thu, Nov 26", with the year when it isn't the current one. */
export function formatCalendarDate(isoDate: string, today = schoolNow().date): string {
  const sameYear = isoDate.slice(0, 4) === today.slice(0, 4)
  return utcDate(isoDate).toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  })
}

/** "Oct 26" or, with the year, "Oct 26, 2026". */
export function formatShortDate(isoDate: string, withYear = false): string {
  return utcDate(isoDate).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    ...(withYear ? { year: "numeric" } : {}),
  })
}

/** "Aug 24 – Oct 9, 2026", spelling both years when they differ. */
export function formatDateRange(start: string, end: string): string {
  const sameYear = start.slice(0, 4) === end.slice(0, 4)
  return `${formatShortDate(start, !sameYear)} – ${formatShortDate(end, true)}`
}

/** A clock time on the school's clock: "12:00 pm". */
export function formatSchoolClock(ms: number): string {
  return new Date(ms)
    .toLocaleTimeString("en-US", { timeZone: SCHOOL_TIME_ZONE, hour: "numeric", minute: "2-digit" })
    .toLowerCase()
}

/** "12:00 – 1:55 pm", "9:00 am", or "All day". */
export function formatEventTime(event: Pick<SchoolEvent, "start" | "end">): string {
  if (!event.start) return "All day"
  const start = formatSchoolClock(event.start)
  if (!event.end || event.end <= event.start) return start
  const end = formatSchoolClock(event.end)
  const [s, sPeriod] = start.split(" ")
  const [e, ePeriod] = end.split(" ")
  return sPeriod === ePeriod ? `${s} – ${e} ${ePeriod}` : `${start} – ${end}`
}

export type ClosureKind = "holiday" | "break" | "closed"

export interface MeetingConflict {
  date: string
  /** "Thursday session" or "Friday session". */
  session: string
  /** What the calendar says about the day, e.g. "Holiday — school closed". */
  title: string
  kind: ClosureKind
}

/** Why a day has no class, or null for a regular school day. */
export function closureOf(day: SchoolCalendarDay): { kind: ClosureKind; title: string } | null {
  if (day.holiday) return { kind: "holiday", title: "Holiday — school closed" }
  if (day.break || day.type === "Break") return { kind: "break", title: "School break — no classes" }
  if (day.type && day.type !== "School") return { kind: "closed", title: `${day.type} — no classes` }
  return null
}

/**
 * When an event falls relative to the class window: during it, all day, or
 * on the same day but before or after class. An event with a start and no
 * end is taken to run an hour.
 */
export type EventTiming = "during" | "all-day" | "before" | "after"

export function eventTiming(event: Pick<SchoolEvent, "start" | "end">): EventTiming {
  if (!event.start) return "all-day"
  const start = schoolMinutesOf(event.start)
  let end = event.end && event.end > event.start ? schoolMinutesOf(event.end) : start + 60
  if (end <= start) end = 24 * 60 // runs past midnight
  if (start < CLASS_MEETING.endMinutes && end > CLASS_MEETING.startMinutes) return "during"
  return end <= CLASS_MEETING.startMinutes ? "before" : "after"
}

/**
 * Whether an event on a class day collides with the thesis session: it runs
 * during class, or it takes the whole day and attendance is mandatory. A
 * dress-up day or an evening showcase doesn't.
 */
export function eventConflictsWithClass(event: SchoolEvent): boolean {
  const timing = eventTiming(event)
  return timing === "during" || (timing === "all-day" && event.mandatory)
}

/** Events that single out the seniors, by name. */
export function isSeniorEvent(event: Pick<SchoolEvent, "title" | "description">): boolean {
  return /\bseniors?\b/i.test(`${event.title} ${event.description}`)
}

/** One Thursday or Friday class session in the window and whether it happens. */
export interface MeetingSession {
  date: string
  /** "Thursday session" or "Friday session". */
  session: string
  isToday: boolean
  /** Before today: a session that has already happened (or not). */
  isPast: boolean
  /** "on" (a school day), "off" (school is closed) or "unknown" (not on the calendar yet). */
  status: "on" | "off" | "unknown"
  /** Why there's no class, for an "off" session. */
  title?: string
  kind?: ClosureKind
  /** School events that collide with the session (during class, or a
      mandatory all-day event). Evening and optional events are left off. */
  events: SchoolEvent[]
  /** Whether there's any such event. */
  conflict: boolean
}

export interface MeetingOutlook {
  /** First and last date looked at, inclusive. */
  from: string
  through: string
  /** Every class session in the window, in date order. Today's is left out
      once it has ended. */
  sessions: MeetingSession[]
  /** Class sessions in the window that fall on a day school is closed. */
  conflicts: MeetingConflict[]
  /** The next session that is on (today's, until it ends), or null when the
      calendar shows none in the window. */
  nextSession: { date: string; session: string; isToday: boolean } | null
  /** Last date the calendar has a row for, or null when it is empty. */
  calendarThrough: string | null
  /** Whether the calendar has rows for every day of the window. */
  coversWindow: boolean
}

/** Events keyed by date, each day's colliding events first. */
export function eventsByDate(events: SchoolEvent[]): Map<string, SchoolEvent[]> {
  const map = new Map<string, SchoolEvent[]>()
  for (const e of events) {
    const list = map.get(e.date) ?? []
    list.push(e)
    map.set(e.date, list)
  }
  for (const list of map.values()) {
    list.sort(
      (a, b) =>
        Number(eventConflictsWithClass(b)) - Number(eventConflictsWithClass(a)) ||
        (a.start ?? 0) - (b.start ?? 0)
    )
  }
  return map
}

/** The class session on a date, if it's a class weekday: on, off or unknown. */
export function sessionOn(
  date: string,
  day: SchoolCalendarDay | undefined,
  events: SchoolEvent[],
  today: string
): MeetingSession | null {
  const weekday = weekdayOf(date)
  if (!CLASS_MEETING.weekdays.includes(weekday)) return null
  const colliding = events.filter(eventConflictsWithClass)
  const base = { date, session: `${WEEKDAY_NAME[weekday]} session`, isToday: date === today, isPast: date < today, events: colliding }
  if (!day) return { ...base, status: "unknown", conflict: false }
  const closure = closureOf(day)
  if (closure) return { ...base, status: "off", ...closure, conflict: false }
  return { ...base, status: "on", conflict: colliding.length > 0 }
}

/** First and last date to look at, inclusive. */
export interface DateWindow {
  from: string
  through: string
}

/** Today through the end of `weeks` weeks. */
export function weeksAhead(weeks: number, today = schoolNow().date): DateWindow {
  return { from: today, through: addDays(today, weeks * 7 - 1) }
}

/**
 * The Thursday/Friday sessions in a window of dates (a term, or the coming
 * weeks): which won't happen according to the school calendar, and which
 * have a school event on the same day. Days the calendar doesn't list are
 * left out rather than guessed either way; `coversWindow` says so.
 */
export function meetingOutlook(
  days: SchoolCalendarDay[],
  window: DateWindow,
  now = schoolNow(),
  events: SchoolEvent[] = []
): MeetingOutlook {
  const byDate = new Map(days.map((d) => [d.date, d]))
  const eventMap = eventsByDate(events)
  const { from, through } = window
  const conflicts: MeetingConflict[] = []
  const sessions: MeetingSession[] = []
  let nextSession: MeetingOutlook["nextSession"] = null
  let listed = 0
  let span = 0

  for (let date = from; date <= through; date = addDays(date, 1)) {
    span++
    const day = byDate.get(date)
    if (day) listed++
    const session = sessionOn(date, day, eventMap.get(date) ?? [], now.date)
    if (!session) continue
    // Today's session drops off the upcoming list once it has ended.
    const ended = session.isToday && now.minutes >= CLASS_MEETING.endMinutes
    if (!ended) sessions.push(session)
    if (session.status === "off") {
      conflicts.push({ date, session: session.session, title: session.title!, kind: session.kind! })
    }
    // Today's session still counts as upcoming until it has ended.
    if (session.status === "on" && !nextSession && !session.isPast && !ended) {
      nextSession = { date, session: session.session, isToday: session.isToday }
    }
  }

  return {
    from,
    through,
    sessions,
    conflicts,
    nextSession,
    calendarThrough: days.length ? days[days.length - 1].date : null,
    coversWindow: listed === span,
  }
}

/* ---------- Term view ---------- */

/** School years that have calendar days published, newest first. */
export function yearsWithDays(cal: SchoolCalendar): SchoolYear[] {
  const ids = new Set(cal.days.map((d) => d.yearId))
  return cal.years.filter((y) => ids.has(y.id)).sort((a, b) => b.name.localeCompare(a.name))
}

/** The school year to open on: the one today falls in, else the active one,
    else the newest with days. */
export function defaultYear(years: SchoolYear[], today = schoolNow().date): SchoolYear | null {
  return (
    years.find((y) => y.start && y.end && y.start <= today && today <= y.end) ??
    years.find((y) => y.isActive) ??
    years[0] ??
    null
  )
}

/** A term whose dates are known. */
export type DatedTerm = Omit<SchoolTerm, "start" | "end"> & { start: string; end: string }

/** A year's terms with dates, in order. A term without dates in its own row
    takes them from the calendar's first and last day tagged with it. */
export function termsOfYear(cal: SchoolCalendar, yearId: number): DatedTerm[] {
  const out: DatedTerm[] = []
  for (const t of cal.terms) {
    if (t.yearId !== yearId) continue
    let { start, end } = t
    if (!start || !end) {
      const tagged = cal.days.filter((d) => d.termId === t.id)
      if (tagged.length === 0) continue
      start = start ?? tagged[0].date
      end = end ?? tagged[tagged.length - 1].date
    }
    out.push({ ...t, start, end })
  }
  return out.sort((a, b) => a.start.localeCompare(b.start))
}

/** The term to open on: the one today falls in, else the next to start,
    else the last one. */
export function defaultTerm<T extends { start: string; end: string }>(terms: T[], today = schoolNow().date): T | null {
  return (
    terms.find((t) => t.start <= today && today <= t.end) ??
    terms.find((t) => t.start > today) ??
    terms[terms.length - 1] ??
    null
  )
}
