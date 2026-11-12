/**
 * Days a student is out of school, as far as the app is told: a date range
 * and whether it covers the whole day. Never the reason. The school records
 * attendance in Toddle; this app only reads it, so a thesis meeting isn't
 * booked (or left standing unnoticed) on a day the student won't be there.
 *
 * `/api/thesis-meetings/absences` serves these; the Toddle side is in
 * lib/student-absences.server.ts.
 */

import { formatCalendarDate, formatShortDate, schoolNow } from "@/lib/school-calendar"

export interface StudentAbsence {
  studentId: string
  /** YYYY-MM-DD, inclusive. */
  from: string
  /** YYYY-MM-DD, inclusive. */
  through: string
  /** Only part of the day (an appointment, say), so class may be unaffected. */
  partial: boolean
  /** "excusal": the school was told ahead of time. "attendance": marked out
      in today's attendance. */
  source: "excusal" | "attendance"
}

export interface StudentAbsencesResponse {
  /** False when attendance couldn't be read; nothing is blocked then. */
  ok: boolean
  absences: StudentAbsence[]
}

/** Whole-day absences first, and a known range ahead of a one-day mark. */
const weight = (a: StudentAbsence) => (a.partial ? 2 : 0) + (a.source === "attendance" ? 1 : 0)

/** The absence that covers this student on this date, or null. */
export function absenceOn(
  absences: StudentAbsence[] | null | undefined,
  studentId: string | number | null | undefined,
  date: string | null | undefined
): StudentAbsence | null {
  if (!absences || !studentId || !date) return null
  const id = String(studentId)
  let best: StudentAbsence | null = null
  for (const a of absences) {
    if (a.studentId !== id || a.from > date || a.through < date) continue
    if (!best || weight(a) < weight(best)) best = a
  }
  return best
}

/** "today", "Thu, Nov 12" or "Nov 9 – Nov 12": the days an absence covers. */
export function absenceDays(a: Pick<StudentAbsence, "from" | "through">, today = schoolNow().date): string {
  if (a.from === a.through) return a.from === today ? "today" : formatCalendarDate(a.from, today)
  return `${formatShortDate(a.from)} – ${formatShortDate(a.through)}`
}

/** What the school has on file, for the browser. Empty when it can't be read. */
export async function fetchStudentAbsences(): Promise<StudentAbsence[]> {
  try {
    const res = await fetch("/api/thesis-meetings/absences")
    const body = (await res.json().catch(() => null)) as StudentAbsencesResponse | null
    return body && Array.isArray(body.absences) ? body.absences : []
  } catch {
    return []
  }
}
