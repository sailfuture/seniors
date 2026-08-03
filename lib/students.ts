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
