import type { RosterStudent } from "@/lib/students"
import { addDays, schoolNow } from "@/lib/school-calendar"
import type { StudentAbsence } from "@/lib/student-absences"

/**
 * Reads who is out of school from the Toddle group of the school's Xano
 * backend, which mirrors Toddle's attendance:
 *
 *  - `excusals_by_range` asks Toddle for excusal requests (a planned absence,
 *    often several days, entered ahead of time). They carry the family's
 *    reason, which never leaves this file.
 *  - `attendance_master` is today's day-level attendance as teachers take it,
 *    synced from Toddle every 15 minutes during the school day.
 *
 * Only dates and a whole-day/part-day flag come out. Both endpoints return far
 * more (reasons, notes, scores), so they are read on the server only.
 */

const TODDLE_API = "https://xsc3-mvx7-r86m.n7e.xano.io/api:fJsHVIeC"

/** How far ahead excusals are read when the caller doesn't say. */
const AHEAD_DAYS = 120

/** A day-level attendance mark that means the student isn't in school. */
const OUT_LABEL = /excused|absent|suspen/i
/** An excusal request that no longer stands. */
const DEAD_STATUS = /reject|declin|cancel|withdraw|delet/i

const isoDay = (value: unknown): string => {
  const day = typeof value === "string" ? value.slice(0, 10) : ""
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : ""
}

async function readList(url: string, fresh: boolean): Promise<Record<string, unknown>[] | null> {
  try {
    const res = await fetch(url, fresh ? { cache: "no-store" } : { next: { revalidate: 300 } })
    if (!res.ok) return null
    const body = (await res.json()) as unknown
    return Array.isArray(body) ? (body as Record<string, unknown>[]) : null
  } catch {
    return null
  }
}

export interface AbsenceLookup {
  /** Skip the five-minute cache: the scheduled check wants the latest marks. */
  fresh?: boolean
  /** Last date (YYYY-MM-DD) excusals are read for. */
  through?: string
}

/**
 * The absences on file for these students from today on, or null when
 * neither source could be read (callers then block nothing). A student
 * without a Toddle id has no excusals to match, only today's attendance.
 */
export async function loadStudentAbsences(
  students: RosterStudent[],
  { fresh = false, through }: AbsenceLookup = {}
): Promise<StudentAbsence[] | null> {
  const today = schoolNow().date
  const last = through && through >= today ? through : addDays(today, AHEAD_DAYS)
  const [excusals, marks] = await Promise.all([
    readList(
      `${TODDLE_API}/excusals_by_range?startDate_input=${today}&endDate_input=${last}`,
      fresh
    ),
    readList(`${TODDLE_API}/attendance_master?date=${today}`, fresh),
  ])
  if (!excusals && !marks) return null

  const byToddleId = new Map<string, string>()
  const ids = new Set<string>()
  for (const s of students) {
    ids.add(String(s.id))
    const toddleId = String(s.toddleID ?? "").trim()
    if (toddleId) byToddleId.set(toddleId, String(s.id))
  }

  const out: StudentAbsence[] = []
  for (const raw of excusals ?? []) {
    // Toddle wraps each record in an edge on some responses.
    const e = (raw.node && typeof raw.node === "object" ? raw.node : raw) as Record<string, unknown>
    const studentId = byToddleId.get(String(e.studentId ?? "").trim())
    const from = isoDay(e.startDate)
    const until = isoDay(e.endDate) || from
    if (!studentId || !from || until < today) continue
    if (DEAD_STATUS.test(String(e.status ?? ""))) continue
    out.push({
      studentId,
      from,
      through: until < from ? from : until,
      partial: String(e.durationType ?? "") === "PARTIAL_DAY",
      source: "excusal",
    })
  }
  for (const row of marks ?? []) {
    const studentId = String(row.students_id ?? "")
    if (!ids.has(studentId) || row.isMasterAttendance !== true) continue
    if (isoDay(row.date) !== today || !OUT_LABEL.test(String(row.attendanceOptionlabel ?? ""))) continue
    out.push({ studentId, from: today, through: today, partial: false, source: "attendance" })
  }
  return out
}
