/**
 * Thesis meetings: the events on the shared "Senior Thesis Meetings" Google
 * Calendar. Supervisors and advisors book them here, in the app: an hour
 * inside a class session, saved straight to that calendar with the student,
 * their advisor and the thesis supervisor as guests, so Google sends the
 * invitations. Students never book.
 *
 * Everything goes through `/api/thesis-meetings` (see
 * lib/google-calendar.server.ts for the Google side and its env vars). Until
 * the service account is set, the route can still read the calendar from its
 * secret iCal address (THESIS_MEETINGS_ICS_URL), but nothing can be booked.
 */

import type { RosterStudent } from "@/lib/students"
import { CLASS_MEETING, formatMinutes } from "@/lib/school-calendar"

/** Every thesis meeting runs an hour. */
export const MEETING_MINUTES = 60

/**
 * When a meeting may start (minutes after midnight, school time): every
 * quarter hour that still ends inside the class session, plus the last start
 * that does. Any number of meetings can share a time; only the same student
 * can't be in two at once.
 */
export function bookingStartTimes(): number[] {
  const last = CLASS_MEETING.endMinutes - MEETING_MINUTES
  const times: number[] = []
  for (let t = CLASS_MEETING.startMinutes; t <= last; t += 15) times.push(t)
  if (last >= CLASS_MEETING.startMinutes && times[times.length - 1] !== last) times.push(last)
  return times
}

/** "12:00 – 1:00 pm" for a meeting starting at `startMinutes`. */
export function formatSlot(startMinutes: number): string {
  const start = formatMinutes(startMinutes)
  const end = formatMinutes(startMinutes + MEETING_MINUTES)
  const [s, sPeriod] = start.split(" ")
  return sPeriod === end.split(" ")[1] ? `${s} – ${end}` : `${start} – ${end}`
}

export interface MeetingAttendee {
  email: string
  name?: string
  /** ACCEPTED, DECLINED, TENTATIVE or NEEDS-ACTION. */
  response?: string
}

export interface ThesisMeeting {
  id: string
  title: string
  /** ms epoch */
  start: number
  end: number
  canceled: boolean
  attendees: MeetingAttendee[]
  /** Emails written in the event's description (a booking form's answers),
   *  so a student who booked with a different address can still match. */
  mentions: string[]
}

export interface ThesisMeetingsResponse {
  /** False until the calendar is connected at all. */
  configured: boolean
  /** Whether meetings can be booked (and canceled) from the app. */
  canBook?: boolean
  /** Staff only: the settings this deployment still lacks before it can book. */
  missing?: string[]
  /** False when the calendar couldn't be read. */
  ok: boolean
  meetings: ThesisMeeting[]
  error?: string
}

export async function fetchThesisMeetings(): Promise<ThesisMeetingsResponse> {
  try {
    const res = await fetch("/api/thesis-meetings")
    const body = (await res.json().catch(() => null)) as ThesisMeetingsResponse | null
    if (body && Array.isArray(body.meetings)) return body
    return { configured: true, ok: false, meetings: [], error: `meetings returned ${res.status}` }
  } catch {
    return { configured: true, ok: false, meetings: [], error: "meetings unavailable" }
  }
}

export interface BookingRequest {
  studentId: string
  /** YYYY-MM-DD, a class day. */
  date: string
  /** One of `bookingStartTimes()`. */
  startMinutes: number
}

export type BookingResult = { ok: true; meeting: ThesisMeeting } | { ok: false; error: string }

/** Books an hour with a student; Google emails the invitations. */
export async function bookThesisMeeting(request: BookingRequest): Promise<BookingResult> {
  try {
    const res = await fetch("/api/thesis-meetings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    })
    const body = (await res.json().catch(() => null)) as { meeting?: ThesisMeeting; error?: string } | null
    if (res.ok && body?.meeting) return { ok: true, meeting: body.meeting }
    return { ok: false, error: body?.error ?? "The meeting couldn’t be booked. Please try again." }
  } catch {
    return { ok: false, error: "The meeting couldn’t be booked. Please try again." }
  }
}

/** Cancels an upcoming meeting. Returns an error message, or null when done. */
export async function cancelThesisMeeting(id: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/thesis-meetings/${encodeURIComponent(id)}`, { method: "DELETE" })
    if (res.ok) return null
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    return body?.error ?? "The meeting couldn’t be canceled. Please try again."
  } catch {
    return "The meeting couldn’t be canceled. Please try again."
  }
}

/** Whether a meeting involves this person, by invitation or by mention. */
export function meetingIncludes(m: ThesisMeeting, email: string | null | undefined): boolean {
  const e = (email ?? "").trim().toLowerCase()
  if (!e) return false
  return m.attendees.some((a) => a.email === e && a.response !== "DECLINED") || m.mentions.includes(e)
}

/** A student declined or the event was canceled: it didn't happen. */
function counts(m: ThesisMeeting, studentEmail: string): boolean {
  if (m.canceled) return false
  const a = m.attendees.find((x) => x.email === studentEmail)
  return !(a && a.response === "DECLINED")
}

export interface StudentMeetings {
  /** Past meetings that weren't canceled or declined. */
  held: ThesisMeeting[]
  upcoming: ThesisMeeting[]
  canceled: number
  /** How many of the held meetings had one of the student's advisors on
   *  the invitation. */
  withAdvisor: number
  last: ThesisMeeting | null
  next: ThesisMeeting | null
}

export function meetingsForStudent(
  meetings: ThesisMeeting[],
  student: Pick<RosterStudent, "studentEmail">,
  advisorEmails: string[],
  now: number
): StudentMeetings {
  const email = (student.studentEmail ?? "").trim().toLowerCase()
  const advisors = advisorEmails.map((e) => e.trim().toLowerCase()).filter(Boolean)
  const mine = meetings.filter((m) => meetingIncludes(m, email) || (m.canceled && m.mentions.includes(email)))
  const held: ThesisMeeting[] = []
  const upcoming: ThesisMeeting[] = []
  let canceled = 0
  for (const m of mine) {
    if (!counts(m, email)) {
      canceled++
      continue
    }
    if (m.start <= now) held.push(m)
    else upcoming.push(m)
  }
  held.sort((a, b) => b.start - a.start)
  upcoming.sort((a, b) => a.start - b.start)
  const withAdvisor = held.filter((m) => advisors.some((a) => meetingIncludes(m, a))).length
  return {
    held,
    upcoming,
    canceled,
    withAdvisor,
    last: held[0] ?? null,
    next: upcoming[0] ?? null,
  }
}

/** Meetings and times read in the school's own zone. */
export function formatMeetingTime(ms: number): string {
  return new Date(ms).toLocaleString("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}
