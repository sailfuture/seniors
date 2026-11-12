import { getAppSession } from "@/lib/clerk-session"
import { isStaffRole } from "@/lib/roles"
import { classYearOf, currentClassYear, fetchActiveStudents } from "@/lib/students"
import { advisorScope } from "@/lib/thesis-meetings.server"
import { loadStudentAbsences } from "@/lib/student-absences.server"
import type { StudentAbsencesResponse } from "@/lib/student-absences"

/**
 * Which students the school has out, and on which days, so a thesis meeting
 * isn't booked for a day the student won't be there: dates only, never the
 * reason. Staff get the senior class; a thesis advisor only the students they
 * hold thesis meetings with.
 */
export const dynamic = "force-dynamic"

function json(body: StudentAbsencesResponse, status = 200) {
  return Response.json(body, { status })
}

export async function GET() {
  const session = await getAppSession()
  const role = session?.user.role
  const staff = isStaffRole(role)
  if (!session || !(staff || role === "advisor")) return json({ ok: false, absences: [] }, 403)

  const roster = await fetchActiveStudents()
  let students = roster
  if (staff) {
    const year = currentClassYear()
    students = roster.filter((s) => classYearOf(s) === year)
  } else {
    // Fails closed: without the assignments, an advisor is told about no one.
    const { thesisStudentIds } = await advisorScope(Number(session.user.advisors_id))
    students = roster.filter((s) => thesisStudentIds.has(String(s.id)))
  }
  if (students.length === 0) return json({ ok: true, absences: [] })

  const absences = await loadStudentAbsences(students)
  return json({ ok: absences !== null, absences: absences ?? [] })
}
