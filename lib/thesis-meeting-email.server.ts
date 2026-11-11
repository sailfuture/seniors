import { Resend } from "resend"
import { APP_URL, escapeHtml, renderBrandedEmail } from "@/lib/email-template"
import { fetchStaff } from "@/lib/staff"

/**
 * The confirmation that goes out once a thesis meeting is booked: who, when
 * and where, with a link to the event in Google Calendar. It goes to the
 * adults around the meeting (the thesis advisor, the thesis supervisor, the
 * course teacher and whoever booked). The student isn't on it; Google's own
 * invitation already reaches them.
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
