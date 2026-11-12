import { getAppSession } from "@/lib/clerk-session"
import { isStaffRole } from "@/lib/roles"
import { emailsIn, parseIcs } from "@/lib/ics"
import {
  advisorAllowsProduct,
  advisorName,
  fetchAdvisorAssignments,
  fetchAdvisors,
  type Advisor,
} from "@/lib/advisors"
import { fetchActiveStudents, fetchArchivedStudents, studentName } from "@/lib/students"
import { effectiveStaffRole, fetchStaff, fetchStaffRoleOverrides, staffName } from "@/lib/staff"
import {
  CLASS_MEETING,
  SCHOOL_CALENDAR_ENDPOINT,
  SCHOOL_EVENTS_ENDPOINT,
  formatCalendarDate,
  parseSchoolCalendar,
  parseSchoolEvents,
  schoolInstant,
  schoolNow,
  sessionOn,
  weekdayOf,
} from "@/lib/school-calendar"
import {
  GoogleCalendarError,
  createThesisEvent,
  isThesisCalendarConfigured,
  listThesisEvents,
  missingCalendarSettings,
  thesisCalendarId,
} from "@/lib/google-calendar.server"
import { courseTeacherRecipients, sendBookingConfirmation } from "@/lib/thesis-meeting-email.server"
import { APP_EVENT_TAG, advisorScope, longDate, lower, toMeeting } from "@/lib/thesis-meetings.server"
import { absenceOn } from "@/lib/student-absences"
import { loadStudentAbsences } from "@/lib/student-absences.server"
import {
  MEETING_MINUTES,
  bookingStartTimes,
  formatSlot,
  type CalendarSubscription,
  type ThesisMeeting,
  type ThesisMeetingsResponse,
} from "@/lib/thesis-meetings"

/**
 * The shared Senior Thesis Meetings calendar.
 *
 * GET lists its meetings: through the Calendar API when the service account
 * is set (so a booking shows up at once), otherwise from the calendar's
 * secret iCal address (THESIS_MEETINGS_ICS_URL), read at most every five
 * minutes. Staff see every meeting; a thesis advisor sees only meetings with
 * themselves or the students assigned to them.
 *
 * POST books one: an hour inside a class session with one student. The event
 * goes on the shared calendar with the student, their advisor, the thesis
 * supervisor and whoever booked as guests, and Google emails the invitations.
 * The adults also get the app's own confirmation email. A class day the
 * school calendar closes, or puts an event on during class, can't be booked,
 * and neither can a day school attendance has the student out for.
 */
export const dynamic = "force-dynamic"

/** Older meetings than this don't change anything the tracker shows. */
const HISTORY_MS = 400 * 86_400_000
/** How far ahead the calendar is read. */
const AHEAD_MS = 400 * 86_400_000

function json(body: ThesisMeetingsResponse, status = 200) {
  return Response.json(body, { status })
}

async function meetingsFromIcs(url: string): Promise<ThesisMeeting[]> {
  const res = await fetch(url, { next: { revalidate: 300 } })
  if (!res.ok) throw new Error(`calendar returned ${res.status}`)
  const since = Date.now() - HISTORY_MS
  return parseIcs(await res.text())
    .filter((e) => e.end >= since && !e.allDay)
    .map((e) => ({
      id: e.uid,
      title: e.summary,
      start: e.start,
      end: e.end,
      canceled: e.status === "CANCELLED",
      attendees: e.attendees,
      mentions: emailsIn(e.description),
    }))
}

/**
 * Ways to add the shared calendar to your own. The Google link works for
 * anyone the calendar is shared with; the iCal address only exists while the
 * calendar is public, which is checked at most once an hour. The secret iCal
 * address is never handed out.
 */
async function subscriptionLinks(): Promise<CalendarSubscription | null> {
  const id = thesisCalendarId()
  if (!id) return null
  const google = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(id)}`
  const ical = `https://calendar.google.com/calendar/ical/${encodeURIComponent(id)}/public/basic.ics`
  try {
    const res = await fetch(ical, { next: { revalidate: 3600 } })
    return res.ok ? { google, ical } : { google }
  } catch {
    return { google }
  }
}

export async function GET() {
  const session = await getAppSession()
  const role = session?.user.role
  if (!session || !(isStaffRole(role) || role === "advisor")) {
    return json({ configured: false, ok: false, meetings: [], error: "Staff and advisors only" }, 403)
  }

  const icsUrl = process.env.THESIS_MEETINGS_ICS_URL
  const canBook = isThesisCalendarConfigured()
  // Staff are told which settings are missing, by name only.
  const setup = !canBook && isStaffRole(role) ? { missing: missingCalendarSettings() } : {}
  if (!icsUrl && !canBook) return json({ configured: false, canBook, ...setup, ok: true, meetings: [] })

  let meetings: ThesisMeeting[] | null = null
  if (canBook) {
    try {
      const now = Date.now()
      meetings = (await listThesisEvents(now - HISTORY_MS, now + AHEAD_MS))
        .filter((e) => e.start > 0)
        .map(toMeeting)
    } catch (err) {
      // The iCal address, when there is one, still answers.
      console.error("[thesis-meetings] Calendar API read failed:", err)
    }
  }
  if (!meetings) {
    if (!icsUrl) return json({ configured: true, canBook, ...setup, ok: false, meetings: [], error: "calendar unavailable" }, 502)
    try {
      meetings = await meetingsFromIcs(icsUrl)
    } catch {
      return json({ configured: true, canBook, ...setup, ok: false, meetings: [], error: "calendar unavailable" }, 502)
    }
  }

  if (role === "advisor") {
    // Fails closed: without the tables, an advisor sees no one's meetings.
    const [{ me, studentIds }, active, archived] = await Promise.all([
      advisorScope(Number(session.user.advisors_id)),
      fetchActiveStudents(),
      fetchArchivedStudents(),
    ])
    const allowed = new Set(
      [...active, ...archived]
        .filter((s) => studentIds.has(String(s.id)))
        .map((s) => lower(s.studentEmail))
        .filter(Boolean)
    )
    if (me?.email) allowed.add(lower(me.email))
    meetings = meetings.filter(
      (m) => m.attendees.some((a) => allowed.has(a.email)) || m.mentions.some((e) => allowed.has(e))
    )
  }

  meetings.sort((a, b) => a.start - b.start)
  // An outside advisor can only use the calendar when it is public.
  const links = await subscriptionLinks()
  const subscribe = links && (isStaffRole(role) || links.ical) ? { subscribe: links } : {}
  return json({ configured: true, canBook, ...setup, ...subscribe, ok: true, meetings })
}

function refuse(error: string, status: number) {
  return Response.json({ error }, { status })
}

/** Why the school calendar rules the day out: school is closed, or an event
    runs during class. A day it doesn't list yet, or a calendar that can't be
    read, never blocks a booking. */
async function blockedOn(date: string): Promise<string | null> {
  try {
    const [daysRes, eventsRes] = await Promise.all([
      fetch(SCHOOL_CALENDAR_ENDPOINT, { next: { revalidate: 300 } }),
      fetch(SCHOOL_EVENTS_ENDPOINT, { next: { revalidate: 300 } }).catch(() => null),
    ])
    if (!daysRes.ok) return null
    const days = parseSchoolCalendar(await daysRes.json())
    const events = eventsRes?.ok ? parseSchoolEvents(await eventsRes.json(), days) : []
    const session = sessionOn(
      date,
      days.find((d) => d.date === date),
      events.filter((e) => e.date === date),
      schoolNow().date
    )
    if (!session) return null
    if (session.status === "off") return `There’s no class on ${formatCalendarDate(date)}: ${session.title}.`
    if (session.conflict) {
      return `${formatCalendarDate(date)} can’t be booked: ${session.events[0].title} is during class.`
    }
    return null
  } catch {
    return null
  }
}

export async function POST(req: Request) {
  const session = await getAppSession()
  const role = session?.user.role
  const staff = isStaffRole(role)
  if (!session || !(staff || role === "advisor")) return refuse("Staff and advisors only.", 403)
  if (!isThesisCalendarConfigured()) {
    return refuse("Booking isn’t connected to the meetings calendar yet.", 503)
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  const studentId = typeof body?.studentId === "string" ? body.studentId : ""
  const date = typeof body?.date === "string" ? body.date : ""
  const startMinutes = Number(body?.startMinutes)
  if (!studentId || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !bookingStartTimes().includes(startMinutes)) {
    return refuse("Choose a student, a class day and a time.", 400)
  }
  if (!CLASS_MEETING.weekdays.includes(weekdayOf(date))) {
    return refuse("Thesis meetings happen during class, on Thursdays and Fridays.", 400)
  }
  const start = schoolInstant(date, startMinutes)
  const end = start + MEETING_MINUTES * 60_000
  if (!(start > Date.now())) return refuse("That time has already passed.", 400)

  const advisorId = Number(session.user.advisors_id)
  const [students, scope, blocked] = await Promise.all([
    fetchActiveStudents(),
    staff
      ? Promise.all([fetchAdvisors(), fetchAdvisorAssignments()]).then(([advisors, assignments]) => ({
          advisors,
          assignments,
          me: undefined as Advisor | undefined,
          thesisStudentIds: null as Set<string> | null,
        }))
      : advisorScope(advisorId),
    blockedOn(date),
  ])
  const student = students.find((s) => String(s.id) === studentId)
  if (!student) return refuse("That student isn’t on the roster.", 404)
  if (scope.thesisStudentIds && !scope.thesisStudentIds.has(studentId)) {
    return refuse("You can only book meetings with the students you advise.", 403)
  }
  const studentEmail = lower(student.studentEmail)
  if (!studentEmail) return refuse("That student has no school email to invite.", 422)
  if (blocked) return refuse(blocked, 409)
  // A day the school already knows the student is out for. Part of a day
  // doesn't rule it out, and attendance that can't be read blocks nothing.
  const away = absenceOn(await loadStudentAbsences([student], { through: date }), studentId, date)
  if (away && !away.partial) {
    return refuse(
      `${studentName(student)} is out of school on ${longDate(date)}, according to school attendance. Pick another day.`,
      409
    )
  }

  // Who is invited: the student, their advisor, the thesis supervisor, and
  // whoever booked. An advisor books for themselves; staff book on behalf of
  // the student's own Business Thesis advisors.
  const guests = new Map<string, { email: string; name?: string }>()
  const invite = (email: string | null | undefined, name?: string | null) => {
    const e = lower(email)
    if (e.includes("@") && !guests.has(e)) guests.set(e, { email: e, ...(name ? { name } : {}) })
  }
  invite(studentEmail, studentName(student))
  // The app's own confirmation goes to the adults; the student has Google's.
  const notify = new Map<string, { email: string; name?: string }>()
  const tell = (email: string | null | undefined, name?: string | null) => {
    const e = lower(email)
    if (e.includes("@") && e !== studentEmail && !notify.has(e)) notify.set(e, { email: e, ...(name ? { name } : {}) })
  }
  let withNames: string[]
  if (staff) {
    const theirs = scope.assignments
      .filter((a) => a.type === "business-thesis" && String(a.students_id) === studentId)
      .map((a) => scope.advisors.find((x) => Number(x.id) === Number(a.advisors_id)))
      .filter((a): a is Advisor => Boolean(a && a.isActive !== false && advisorAllowsProduct(a, "business-thesis")))
    for (const a of theirs) {
      invite(a.email, advisorName(a))
      tell(a.email, advisorName(a))
    }
    withNames = theirs.map(advisorName)
  } else {
    const myEmail = scope.me?.email ?? session.user.email
    const myName = scope.me ? advisorName(scope.me) : session.user.name
    invite(myEmail, myName)
    tell(myEmail, myName)
    withNames = [scope.me ? advisorName(scope.me) : session.user.name ?? "their advisor"]
  }
  const [staffList, overrides, courseTeachers] = await Promise.all([
    fetchStaff(),
    fetchStaffRoleOverrides(),
    courseTeacherRecipients(),
  ])
  for (const t of staffList) {
    if (effectiveStaffRole(t, overrides) === "supervisor") {
      invite(t.email, staffName(t))
      tell(t.email, staffName(t))
    }
  }
  for (const t of courseTeachers) tell(t.email, t.name)
  if (staff) invite(session.user.email, session.user.name)
  tell(session.user.email, session.user.name)

  const bookedBy = session.user.name || session.user.email || "SailFuture Academy staff"
  try {
    // Meetings may share a time, but one student can't be in two at once.
    const clash = (await listThesisEvents(start, end)).find(
      (e) =>
        e.status !== "cancelled" &&
        e.start < end &&
        e.end > start &&
        e.attendees.some((a) => a.email === studentEmail && a.responseStatus !== "declined")
    )
    if (clash) {
      return refuse(`${studentName(student)} already has a meeting at that time. Pick another time.`, 409)
    }

    const event = await createThesisEvent({
      summary: `Thesis meeting: ${studentName(student)}`,
      description: [
        `Business Thesis meeting with ${studentName(student)}${withNames.length ? ` and ${withNames.join(", ")}` : ""}.`,
        `During the senior class, ${formatSlot(startMinutes)} Eastern.`,
        `Booked by ${bookedBy} in the SailFuture Academy Senior Dashboard.`,
      ].join("\n"),
      location: "SailFuture Academy",
      start,
      end,
      guests: [...guests.values()],
      tags: {
        seniorDashboard: APP_EVENT_TAG,
        studentId,
        bookedBy: lower(session.user.email),
      },
    })

    // The booking stands whether or not the confirmation goes out.
    const emailError = await sendBookingConfirmation({
      to: [...notify.values()],
      studentName: studentName(student),
      advisorNames: withNames,
      dateLabel: longDate(date),
      timeLabel: formatSlot(startMinutes),
      location: "SailFuture Academy",
      bookedBy,
      replyTo: lower(session.user.email) || undefined,
      eventUrl: event.htmlLink || undefined,
    })
    if (emailError) console.error("[thesis-meetings] confirmation email failed:", emailError)
    return Response.json({ meeting: toMeeting(event), emailed: !emailError })
  } catch (err) {
    console.error("[thesis-meetings] booking failed:", err)
    const detail = err instanceof GoogleCalendarError && staff ? ` (${err.message})` : ""
    return refuse(`The meeting couldn’t be added to the calendar${detail}. Nothing was booked.`, 502)
  }
}
