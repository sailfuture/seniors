/**
 * The school calendar: one row per date of the school year, from the shared
 * Xano `school_calendar` table (Toddle group, kept by the front office). Each
 * day is a school day, a weekend, a break or a holiday; there are no named
 * or timed events. The advisor dashboard reads it to tell thesis advisors
 * which of their Thursday/Friday class sessions fall on a day school is
 * closed. Read through `/api/school-calendar`, which caches it for an hour.
 */

export const SCHOOL_CALENDAR_ENDPOINT =
  "https://xsc3-mvx7-r86m.n7e.xano.io/api:fJsHVIeC/school_calendar"

/** Calendar dates are plain YYYY-MM-DD in the school's own time zone. */
export const SCHOOL_TIME_ZONE = "America/New_York"

export interface SchoolCalendarDay {
  /** YYYY-MM-DD */
  date: string
  /** "School", "Break" or "Weekend", as entered by the office. */
  type: string
  holiday: boolean
  break: boolean
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
      date,
      type: typeof r.type === "string" ? r.type : "",
      holiday: r.holiday === true,
      break: r.break === true,
      firstDayOfTerm: r.first_day_term === true,
      lastDayOfTerm: r.last_day_term === true,
    })
  }
  return days.sort((a, b) => a.date.localeCompare(b.date))
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

/** One Thursday or Friday class session in the window and whether it happens. */
export interface MeetingSession {
  date: string
  /** "Thursday session" or "Friday session". */
  session: string
  isToday: boolean
  /** "on" (a school day), "off" (school is closed) or "unknown" (not on the calendar yet). */
  status: "on" | "off" | "unknown"
  /** Why there's no class, for an "off" session. */
  title?: string
  kind?: ClosureKind
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

/**
 * Which of the next `weeks` worth of Thursday/Friday sessions won't happen,
 * according to the school calendar. Days the calendar doesn't list are left
 * out rather than guessed either way; `coversWindow` says so.
 */
export function meetingOutlook(
  days: SchoolCalendarDay[],
  weeks: number,
  now = schoolNow()
): MeetingOutlook {
  const byDate = new Map(days.map((d) => [d.date, d]))
  const from = now.date
  const span = weeks * 7
  const through = addDays(from, span - 1)
  const conflicts: MeetingConflict[] = []
  const sessions: MeetingSession[] = []
  let nextSession: MeetingOutlook["nextSession"] = null
  let listed = 0

  for (let i = 0; i < span; i++) {
    const date = addDays(from, i)
    const day = byDate.get(date)
    if (day) listed++
    const weekday = weekdayOf(date)
    if (!CLASS_MEETING.weekdays.includes(weekday)) continue
    const session = `${WEEKDAY_NAME[weekday]} session`
    // Today's session drops off the list once it has ended.
    const ended = i === 0 && now.minutes >= CLASS_MEETING.endMinutes
    if (!day) {
      if (!ended) sessions.push({ date, session, isToday: i === 0, status: "unknown" })
      continue
    }
    const closure = closureOf(day)
    if (closure) {
      conflicts.push({ date, session, ...closure })
      if (!ended) sessions.push({ date, session, isToday: i === 0, status: "off", ...closure })
      continue
    }
    if (!ended) sessions.push({ date, session, isToday: i === 0, status: "on" })
    // Today's session still counts as upcoming until it has ended.
    if (!nextSession && (i > 0 || now.minutes < CLASS_MEETING.endMinutes)) {
      nextSession = { date, session, isToday: i === 0 }
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
