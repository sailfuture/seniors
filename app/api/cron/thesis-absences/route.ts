import { timingSafeEqual } from "crypto"
import { advisorAllowsProduct, advisorName, fetchAdvisorAssignments, fetchAdvisors, type Advisor } from "@/lib/advisors"
import { fetchActiveStudents, studentName, type RosterStudent } from "@/lib/students"
import { effectiveStaffRole, fetchStaff, fetchStaffRoleOverrides, staffName } from "@/lib/staff"
import { formatSchoolClock, schoolNow } from "@/lib/school-calendar"
import {
  isThesisCalendarConfigured,
  listThesisEvents,
  tagThesisEvent,
  type CalendarEvent,
} from "@/lib/google-calendar.server"
import {
  courseTeacherRecipients,
  sendAbsenceNotice,
  type Recipient,
} from "@/lib/thesis-meeting-email.server"
import { longDate, lower } from "@/lib/thesis-meetings.server"
import { absenceDays, absenceOn } from "@/lib/student-absences"
import { loadStudentAbsences } from "@/lib/student-absences.server"

/**
 * The scheduled check that keeps an advisor from coming in for a student who
 * isn't there. Vercel calls it on weekday mornings (vercel.json), early and
 * again once first-period attendance is in.
 *
 * It reads every upcoming meeting on the shared calendar and, for each one,
 * whether school attendance has the student out that day: an excusal on file
 * (known days ahead) or, for today's meetings, today's attendance. The adults
 * around the meeting get one email per meeting; the meeting itself is left
 * alone, since attendance can change and canceling is one click. That the
 * notice went is noted on the calendar event (`absenceNotice`), unseen by
 * guests, so the next run doesn't send it again.
 *
 * Vercel sends CRON_SECRET as a bearer token; without that setting the route
 * refuses everyone. `?dry=1` reports what would be sent and sends nothing.
 */
export const dynamic = "force-dynamic"
export const maxDuration = 60

/** How far ahead meetings are checked. */
const AHEAD_MS = 120 * 86_400_000

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const given = Buffer.from(req.headers.get("authorization") ?? "")
  const wanted = Buffer.from(`Bearer ${secret}`)
  return given.length === wanted.length && timingSafeEqual(given, wanted)
}

interface Outcome {
  eventId: string
  date: string
  partial: boolean
  recipients: number
  /** Why the notice didn't go, when it didn't. */
  error?: string
}

export async function GET(req: Request) {
  if (!process.env.CRON_SECRET) {
    return Response.json({ ok: false, error: "CRON_SECRET is not set" }, { status: 503 })
  }
  if (!authorized(req)) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  if (!isThesisCalendarConfigured()) {
    return Response.json({ ok: false, error: "The meetings calendar is not connected" }, { status: 503 })
  }
  const dry = new URL(req.url).searchParams.get("dry") === "1"

  let events: CalendarEvent[]
  try {
    const now = Date.now()
    events = (await listThesisEvents(now, now + AHEAD_MS)).filter(
      (e) => e.status !== "cancelled" && e.start > now
    )
  } catch (err) {
    console.error("[thesis-absences] calendar read failed:", err)
    return Response.json({ ok: false, error: "calendar unavailable" }, { status: 502 })
  }
  if (events.length === 0) return Response.json({ ok: true, dry, checked: 0, sent: [], failed: [] })

  const students = await fetchActiveStudents()
  const byId = new Map(students.map((s) => [String(s.id), s]))
  const byEmail = new Map(students.map((s) => [lower(s.studentEmail), s]))
  // The student a meeting is with: the one it was booked for, or else a
  // student among its guests. One who declined isn't expected anyway.
  const booked: { event: CalendarEvent; student: RosterStudent; date: string }[] = []
  for (const event of events) {
    const student =
      byId.get(event.tags.studentId ?? "") ??
      event.attendees.map((a) => byEmail.get(a.email)).find((s): s is RosterStudent => Boolean(s))
    if (!student) continue
    const guest = event.attendees.find((a) => a.email === lower(student.studentEmail))
    if (guest?.responseStatus === "declined") continue
    booked.push({ event, student, date: schoolNow(new Date(event.start)).date })
  }
  if (booked.length === 0) return Response.json({ ok: true, dry, checked: 0, sent: [], failed: [] })

  const absences = await loadStudentAbsences(
    [...new Map(booked.map((b) => [String(b.student.id), b.student])).values()],
    { fresh: true, through: booked.reduce((last, b) => (b.date > last ? b.date : last), "") }
  )
  if (absences === null) {
    console.error("[thesis-absences] attendance could not be read")
    return Response.json({ ok: false, error: "attendance unavailable" }, { status: 502 })
  }

  const due = booked
    .map((b) => ({ ...b, absence: absenceOn(absences, b.student.id, b.date) }))
    .filter((b) => b.absence !== null)
    .map((b) => ({ ...b, absence: b.absence!, mark: `${b.date}:${b.absence!.partial ? "part" : "day"}` }))
    // A part-day notice doesn't stop the whole-day one that may follow it.
    .filter((b) => b.event.tags.absenceNotice !== b.mark && b.event.tags.absenceNotice !== `${b.date}:day`)
  if (due.length === 0) {
    return Response.json({ ok: true, dry, checked: booked.length, sent: [], failed: [] })
  }

  const [advisors, assignments, staffList, overrides, courseTeachers] = await Promise.all([
    fetchAdvisors(),
    fetchAdvisorAssignments(),
    fetchStaff(),
    fetchStaffRoleOverrides(),
    courseTeacherRecipients(),
  ])
  const supervisors: Recipient[] = staffList
    .filter((t) => effectiveStaffRole(t, overrides) === "supervisor" && t.email)
    .map((t) => ({ email: t.email, name: staffName(t) }))
  const today = schoolNow().date

  const sent: Outcome[] = []
  const failed: Outcome[] = []
  for (const { event, student, date, absence, mark } of due) {
    const theirs = assignments
      .filter((a) => a.type === "business-thesis" && String(a.students_id) === String(student.id))
      .map((a) => advisors.find((x) => Number(x.id) === Number(a.advisors_id)))
      .filter((a): a is Advisor => Boolean(a && a.isActive !== false && advisorAllowsProduct(a, "business-thesis")))
    const studentEmail = lower(student.studentEmail)
    const to: Recipient[] = [
      ...theirs.map((a) => ({ email: a.email, name: advisorName(a) })),
      ...supervisors,
      ...courseTeachers,
      ...(event.tags.bookedBy ? [{ email: event.tags.bookedBy }] : []),
    ].filter((r) => lower(r.email) && lower(r.email) !== studentEmail)
    const outcome: Outcome = {
      eventId: event.id,
      date,
      partial: absence.partial,
      recipients: new Set(to.map((r) => lower(r.email))).size,
    }
    if (dry) {
      sent.push(outcome)
      continue
    }
    const error = await sendAbsenceNotice({
      to,
      studentName: studentName(student),
      advisorNames: theirs.map(advisorName),
      dateLabel: longDate(date),
      timeLabel: `${formatSchoolClock(event.start)} – ${formatSchoolClock(event.end)}`,
      outLabel: absenceDays(absence, today),
      partial: absence.partial,
      markedToday: absence.source === "attendance",
      replyTo: courseTeachers.map((t) => lower(t.email)).filter(Boolean),
    })
    if (error) {
      console.error("[thesis-absences] notice failed:", event.id, error)
      failed.push({ ...outcome, error })
      continue
    }
    sent.push(outcome)
    try {
      await tagThesisEvent(event.id, { ...event.tags, absenceNotice: mark })
    } catch (err) {
      // The notice went; without the note the next run sends it once more.
      console.error("[thesis-absences] could not note the notice on the event:", event.id, err)
    }
  }
  return Response.json({ ok: failed.length === 0, dry, checked: booked.length, sent, failed })
}
