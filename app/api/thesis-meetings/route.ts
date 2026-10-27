import { getAppSession } from "@/lib/clerk-session"
import { isStaffRole } from "@/lib/roles"
import { emailsIn, parseIcs } from "@/lib/ics"
import { fetchAdvisorAssignments, fetchAdvisors } from "@/lib/advisors"
import { fetchActiveStudents, fetchArchivedStudents } from "@/lib/students"
import type { ThesisMeeting, ThesisMeetingsResponse } from "@/lib/thesis-meetings"

/**
 * Bookings on the shared Senior Thesis Meetings calendar, read from its
 * secret iCal address (THESIS_MEETINGS_ICS_URL) at most every five minutes.
 * Staff see every meeting; a thesis advisor sees only meetings with
 * themselves or the students assigned to them. Descriptions never leave the
 * server: only the email addresses written in them do, for matching.
 */
export const dynamic = "force-dynamic"

/** Older meetings than this don't change anything the tracker shows. */
const HISTORY_MS = 400 * 86_400_000

function json(body: ThesisMeetingsResponse, status = 200) {
  return Response.json(body, { status })
}

export async function GET() {
  const session = await getAppSession()
  const role = session?.user.role
  if (!session || !(isStaffRole(role) || role === "advisor")) {
    return json({ configured: false, ok: false, meetings: [], error: "Staff and advisors only" }, 403)
  }

  const url = process.env.THESIS_MEETINGS_ICS_URL
  if (!url) return json({ configured: false, ok: true, meetings: [] })

  let meetings: ThesisMeeting[]
  try {
    const res = await fetch(url, { next: { revalidate: 300 } })
    if (!res.ok) {
      return json({ configured: true, ok: false, meetings: [], error: `calendar returned ${res.status}` }, 502)
    }
    const since = Date.now() - HISTORY_MS
    meetings = parseIcs(await res.text())
      .filter((e) => e.end >= since && !e.allDay)
      .map((e) => ({
        id: e.uid,
        title: e.summary,
        start: e.start,
        end: e.end,
        canceled: e.status === "CANCELLED",
        attendees: e.attendees,
        mentions: emailsIn(e.description),
      }))
  } catch {
    return json({ configured: true, ok: false, meetings: [], error: "calendar unavailable" }, 502)
  }

  if (role === "advisor") {
    // Fails closed: without the tables, an advisor sees no one's meetings.
    const advisorId = Number(session.user.advisors_id)
    const [advisors, assignments, active, archived] = await Promise.all([
      fetchAdvisors(),
      fetchAdvisorAssignments(),
      fetchActiveStudents(),
      fetchArchivedStudents(),
    ])
    const me = advisors.find((a) => Number(a.id) === advisorId)
    const studentIds = new Set(
      assignments.filter((a) => Number(a.advisors_id) === advisorId).map((a) => String(a.students_id))
    )
    const allowed = new Set(
      [...active, ...archived]
        .filter((s) => studentIds.has(String(s.id)))
        .map((s) => (s.studentEmail ?? "").trim().toLowerCase())
        .filter(Boolean)
    )
    if (me?.email) allowed.add(me.email.trim().toLowerCase())
    meetings = meetings.filter(
      (m) => m.attendees.some((a) => allowed.has(a.email)) || m.mentions.some((e) => allowed.has(e))
    )
  }

  meetings.sort((a, b) => a.start - b.start)
  return json({ configured: true, ok: true, meetings })
}
