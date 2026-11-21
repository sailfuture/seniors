import { getAppSession } from "@/lib/clerk-session"
import { isStaffRole } from "@/lib/roles"
import { fetchActiveStudents } from "@/lib/students"
import {
  GoogleCalendarError,
  deleteThesisEvent,
  getThesisEvent,
  isThesisCalendarConfigured,
} from "@/lib/google-calendar.server"
import { LOGGED_TAG, advisorScope, lower } from "@/lib/thesis-meetings.server"

/**
 * Takes a thesis meeting off the shared calendar. One still to come is
 * canceled, and Google emails the guests. One that has already started is
 * deleted quietly (it never happened, or was booked by mistake): nobody is
 * emailed about a meeting in the past, and only staff may do it, since those
 * are the record of who met. One logged in the app after the fact can be
 * taken back off by whoever could have logged it, also without email.
 * An advisor acts only on a meeting of their own (they booked it or are a
 * guest) with a student they advise.
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
    const logged = event.tags.logged === LOGGED_TAG
    const started = event.start <= Date.now()
    if (started && !logged && !staff) {
      return refuse("That meeting has already happened. SailFuture staff can delete it.", 409)
    }

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

    await deleteThesisEvent(id, { notify: !logged && !started })
    return Response.json({ ok: true })
  } catch (err) {
    console.error("[thesis-meetings] cancel failed:", err)
    const detail = err instanceof GoogleCalendarError && staff ? ` (${err.message})` : ""
    return refuse(`The meeting couldn’t be canceled${detail}.`, 502)
  }
}
