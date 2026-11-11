import { getAppSession } from "@/lib/clerk-session"
import { isStaffRole } from "@/lib/roles"
import { fetchActiveStudents } from "@/lib/students"
import {
  GoogleCalendarError,
  deleteThesisEvent,
  getThesisEvent,
  isThesisCalendarConfigured,
} from "@/lib/google-calendar.server"
import { advisorScope, lower } from "@/lib/thesis-meetings.server"

/**
 * Cancels an upcoming thesis meeting: the event leaves the shared calendar
 * and Google emails the guests. Staff can cancel any upcoming meeting; an
 * advisor only one of their own (they booked it or are a guest) with a
 * student they advise. Meetings that already happened stay as the record.
 */
export const dynamic = "force-dynamic"

function refuse(error: string, status: number) {
  return Response.json({ error }, { status })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAppSession()
  const role = session?.user.role
  const staff = isStaffRole(role)
  if (!session || !(staff || role === "advisor")) return refuse("Staff and advisors only.", 403)
  if (!isThesisCalendarConfigured()) {
    return refuse("Canceling isn’t connected to the meetings calendar yet.", 503)
  }

  // The iCal feed's ids carry an "@google.com" suffix the API doesn't use.
  const id = decodeURIComponent((await params).id).replace(/@google\.com$/i, "")
  if (!/^[A-Za-z0-9_-]+$/.test(id)) return refuse("Unknown meeting.", 404)

  try {
    const event = await getThesisEvent(id)
    if (!event) return Response.json({ ok: true })
    if (event.start <= Date.now()) return refuse("That meeting has already happened.", 409)

    if (!staff) {
      const [{ me, thesisStudentIds }, students] = await Promise.all([
        advisorScope(Number(session.user.advisors_id)),
        fetchActiveStudents(),
      ])
      const myEmails = new Set([lower(me?.email), lower(session.user.email)].filter(Boolean))
      const mine =
        myEmails.has(lower(event.tags.bookedBy)) || event.attendees.some((a) => myEmails.has(a.email))
      const studentEmails = new Set(
        students.filter((s) => thesisStudentIds.has(String(s.id))).map((s) => lower(s.studentEmail))
      )
      const withMyStudent = event.attendees.some((a) => studentEmails.has(a.email))
      if (!mine || !withMyStudent) return refuse("You can only cancel your own meetings.", 403)
    }

    await deleteThesisEvent(id)
    return Response.json({ ok: true })
  } catch (err) {
    console.error("[thesis-meetings] cancel failed:", err)
    const detail = err instanceof GoogleCalendarError && staff ? ` (${err.message})` : ""
    return refuse(`The meeting couldn’t be canceled${detail}.`, 502)
  }
}
