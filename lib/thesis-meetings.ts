/**
 * Thesis meetings: the bookings on the shared "Senior Thesis Meetings"
 * Google Calendar, read through `/api/thesis-meetings` (which fetches the
 * calendar's secret iCal address, so nothing here needs Google sign-in).
 *
 * Setup lives in Google Calendar, not in this app:
 *  - THESIS_MEETINGS_ICS_URL (server): the calendar's "Secret address in
 *    iCal format", from its Settings → Integrate calendar.
 *  - NEXT_PUBLIC_THESIS_BOOKING_URL (browser, baked at build time): the
 *    appointment schedule's embed link, from Share → Website embed → Inline.
 */

import type { RosterStudent } from "@/lib/students"

/** The booking page shown on the Schedule tab; blank until it's set up. */
export const THESIS_BOOKING_URL = process.env.NEXT_PUBLIC_THESIS_BOOKING_URL ?? ""

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
  /** False until THESIS_MEETINGS_ICS_URL is set. */
  configured: boolean
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

/**
 * The booking link as saved, cleaned up: the whole embed snippet
 * (<iframe src="…">) works too, so whatever was copied from Google is fine.
 */
export function bookingSourceUrl(raw: string): string {
  const text = raw.trim()
  const src = text.match(/src\s*=\s*["']([^"']+)["']/i)?.[1]
  return (src ?? text).replace(/&amp;/g, "&").trim()
}

/**
 * Google's inline embed needs the schedule URL with `gv=true`. A short
 * calendar.app.google link can't be framed; /api/thesis-meetings/booking
 * follows it to the full schedule URL.
 */
export function bookingEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url)
    if (!u.hostname.endsWith("calendar.google.com") || !u.pathname.includes("/appointments/")) return null
    u.searchParams.set("gv", "true")
    return u.toString()
  } catch {
    return null
  }
}
