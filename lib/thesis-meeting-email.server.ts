import { Resend } from "resend"
import { APP_URL, escapeHtml, renderBrandedEmail } from "@/lib/email-template"
import { fetchStaff } from "@/lib/staff"

/**
 * The app's own emails about thesis meetings, to the adults around one (the
 * thesis advisor, the thesis supervisor, the course teachers and whoever
 * booked). The student isn't on them; Google's own invitation reaches them.
 *
 *  - The confirmation once a meeting is booked: who, when and where, with a
 *    link to the event in Google Calendar.
 *  - The notice that school attendance has the student out on the day of a
 *    booked meeting, so an advisor doesn't come in for nothing. It says which
 *    days, never why.
 */

const FROM =
  process.env.THESIS_EMAIL_FROM ??
  process.env.ADVISOR_EMAIL_FROM ??
  "SailFuture Academy <noreply@sailfutureacademy.org>"

/**
 * Who teaches the senior class, as staff ids from the teachers table. They
 * get every booking confirmation. THESIS_COURSE_TEACHER_EMAILS (comma
 * separated) adds addresses without a code change.
 */
const COURSE_TEACHER_STAFF_IDS: string[] = [
  "330335f0-f338-4d10-b5f2-91d38abf6114", // Ms. Witeck
  "6dec2a22-d5db-494e-b1a3-0bce11f35c6b", // Mr. Thompson
]

export interface Recipient {
  email: string
  name?: string
}

/** The course teachers' addresses: the listed staff plus the env setting. */
export async function courseTeacherRecipients(): Promise<Recipient[]> {
  const out: Recipient[] = []
  if (COURSE_TEACHER_STAFF_IDS.length) {
    const staff = await fetchStaff()
    for (const t of staff) {
      if (COURSE_TEACHER_STAFF_IDS.includes(String(t.id)) && t.email) {
        out.push({ email: t.email, name: `${t.firstName} ${t.lastName}`.trim() || undefined })
      }
    }
  }
  for (const raw of (process.env.THESIS_COURSE_TEACHER_EMAILS ?? "").split(/[,;\s]+/)) {
    const email = raw.trim().toLowerCase()
    if (email.includes("@")) out.push({ email })
  }
  return out
}

export interface BookingConfirmation {
  to: Recipient[]
  studentName: string
  /** The student's thesis advisors, by name; empty when they have none. */
  advisorNames: string[]
  /** "Thursday, November 12, 2026" */
  dateLabel: string
  /** "12:00 – 1:00 pm" */
  timeLabel: string
  location: string
  bookedBy: string
  /** Replies go to whoever booked. */
  replyTo?: string
  /** The event in Google Calendar; falls back to the Schedule page. */
  eventUrl?: string
}

export function bookingConfirmationHtml(c: BookingConfirmation): string {
  const student = escapeHtml(c.studentName)
  return renderBrandedEmail({
    title: "Thesis meeting booked",
    subtitle: `${c.studentName} · ${c.dateLabel}`,
    preheader: `${c.studentName}, ${c.dateLabel}, ${c.timeLabel} Eastern`,
    paragraphs: [
      `<strong>${escapeHtml(c.bookedBy)}</strong> booked a Business Thesis meeting with <strong>${student}</strong> during the senior class.`,
      `It is on the shared Senior Thesis Meetings calendar, and Google Calendar has sent an invitation to ${student} and everyone attending.`,
    ],
    tiles: [
      { label: "Student", body: c.studentName },
      { label: "When", body: `${c.dateLabel}, ${c.timeLabel} Eastern` },
      {
        label: c.advisorNames.length > 1 ? "Thesis advisors" : "Thesis advisor",
        body: c.advisorNames.length ? c.advisorNames.join(", ") : "None assigned yet",
      },
      { label: "Where", body: c.location },
    ],
    cta: { label: "Open the calendar invite", url: c.eventUrl || `${APP_URL}/schedule` },
    footnote: `To cancel this meeting, open the <a href="${APP_URL}/schedule" style="color:#0d2345;">Schedule page</a> in the SailFuture Academy Senior Dashboard. Replies to this email go to ${escapeHtml(c.bookedBy)}.`,
  })
}

/** Sends the confirmation. Returns an error message, or null when it went. */
export async function sendBookingConfirmation(c: BookingConfirmation): Promise<string | null> {
  const seen = new Set<string>()
  const to = c.to
    .map((r) => r.email.trim().toLowerCase())
    .filter((e) => e.includes("@") && !seen.has(e) && Boolean(seen.add(e)))
  if (to.length === 0) return "no one to email"
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return "RESEND_API_KEY is missing"
  try {
    const { error } = await new Resend(apiKey).emails.send({
      from: FROM,
      to,
      ...(c.replyTo ? { replyTo: c.replyTo } : {}),
      subject: `Thesis meeting booked: ${c.studentName}, ${c.dateLabel}`,
      html: bookingConfirmationHtml(c),
    })
    return error ? error.message : null
  } catch (err) {
    return err instanceof Error ? err.message : "email failed"
  }
}

/** The lowercased, de-duplicated addresses in a recipient list. */
function addresses(list: Recipient[]): string[] {
  const seen = new Set<string>()
  return list
    .map((r) => r.email.trim().toLowerCase())
    .filter((e) => e.includes("@") && !seen.has(e) && Boolean(seen.add(e)))
}

export interface AbsenceNotice {
  to: Recipient[]
  studentName: string
  /** The student's thesis advisors, by name; empty when they have none. */
  advisorNames: string[]
  /** The meeting's day: "Thursday, November 12, 2026" */
  dateLabel: string
  /** "12:00 pm – 1:00 pm" */
  timeLabel: string
  /** The days the student is out: "today", "Thu, Nov 12" or "Nov 9 – Nov 12". */
  outLabel: string
  /** Out for only part of the day, so class may be unaffected. */
  partial: boolean
  /** Marked out in today's attendance, rather than told ahead of time. */
  markedToday: boolean
  /** Replies go to the senior class teachers. */
  replyTo?: string[]
}

export function absenceNoticeHtml(n: AbsenceNotice): string {
  const student = escapeHtml(n.studentName)
  const date = escapeHtml(n.dateLabel)
  const lead = n.partial
    ? `School attendance has <strong>${student}</strong> out for part of <strong>${date}</strong>, the day of a booked Business Thesis meeting.`
    : `School attendance has <strong>${student}</strong> out of school on <strong>${date}</strong>, the day of a booked Business Thesis meeting.`
  const advice = n.partial
    ? `${student} may still be in class at the meeting time. If you are coming in for it, please check with the senior class teachers first.`
    : `The meeting is still on the calendar in case that changes. If you were coming in for it, please don’t make the trip without checking with the senior class teachers first.`
  return renderBrandedEmail({
    title: "Student out for a thesis meeting",
    subtitle: `${n.studentName} · ${n.dateLabel}`,
    preheader: `${n.studentName} is out ${n.partial ? "for part of" : "on"} ${n.dateLabel}`,
    paragraphs: [lead, advice],
    tiles: [
      { label: "Student", body: n.studentName },
      { label: "Meeting", body: `${n.dateLabel}, ${n.timeLabel} Eastern` },
      {
        label: n.advisorNames.length > 1 ? "Thesis advisors" : "Thesis advisor",
        body: n.advisorNames.length ? n.advisorNames.join(", ") : "None assigned yet",
      },
      {
        label: "Attendance",
        body: n.partial
          ? "Out for part of the day"
          : n.markedToday
            ? "Marked out today"
            : `Out ${n.outLabel}`,
      },
    ],
    cta: { label: "Open the Schedule page", url: `${APP_URL}/schedule` },
    footnote: `To cancel this meeting and book another class day, open the <a href="${APP_URL}/schedule" style="color:#0d2345;">Schedule page</a> in the SailFuture Academy Senior Dashboard. This notice comes from the school’s attendance records and is sent once per meeting. Replies go to the senior class teachers.`,
  })
}

/** Sends the notice. Returns an error message, or null when it went. */
export async function sendAbsenceNotice(n: AbsenceNotice): Promise<string | null> {
  const to = addresses(n.to)
  if (to.length === 0) return "no one to email"
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return "RESEND_API_KEY is missing"
  try {
    const { error } = await new Resend(apiKey).emails.send({
      from: FROM,
      to,
      ...(n.replyTo?.length ? { replyTo: n.replyTo } : {}),
      subject: `Student out: ${n.studentName}, thesis meeting ${n.dateLabel}`,
      html: absenceNoticeHtml(n),
    })
    return error ? error.message : null
  } catch (err) {
    return err instanceof Error ? err.message : "email failed"
  }
}
