const STUDENTS_ENDPOINT =
  "https://xsc3-mvx7-r86m.n7e.xano.io/api:fJsHVIeC/get_active_students_email"

export interface RosterStudent {
  id: string
  firstName: string
  lastName: string
  studentEmail: string
  profileImage: string
  yearGroup?: string
  crewName?: string
}

export function studentName(s: RosterStudent): string {
  return `${s.firstName ?? ""} ${s.lastName ?? ""}`.trim() || s.studentEmail
}

/**
 * The graduating class of the current school year. School years roll over in
 * July: August 2026 sits in the 2026–27 year, whose graduating class is 2027.
 */
export function currentClassYear(now = new Date()): number {
  return now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear()
}

/**
 * The exact `yearGroup` string the current graduating class is stored under,
 * read off the roster rather than assembled from a prefix. Xano matches this
 * value literally, so a guessed format ("Batch of 2027") that ever drifts from
 * what Toddle syncs would silently match no students at all.
 */
export function currentYearGroupValue(students: RosterStudent[] | undefined): string | null {
  const year = currentClassYear()
  const match = (students ?? []).find((s) => classYearOf(s) === year)
  return match?.yearGroup?.trim() || null
}

/** The 4-digit class year in a student's yearGroup ("Batch of 2027" → 2027). */
export function classYearOf(s: RosterStudent): number | null {
  const year = Number((s.yearGroup ?? "").match(/\d{4}/)?.[0] ?? NaN)
  return Number.isNaN(year) ? null : year
}

export async function fetchActiveStudents(): Promise<RosterStudent[]> {
  try {
    const res = await fetch(STUDENTS_ENDPOINT)
    if (!res.ok) return []
    const rows = await res.json()
    return Array.isArray(rows) ? (rows as RosterStudent[]) : []
  } catch {
    return []
  }
}
