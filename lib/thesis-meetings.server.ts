import { fetchAdvisorAssignments, fetchAdvisors, type Advisor, type AdvisorAssignment } from "@/lib/advisors"
import { emailsIn } from "@/lib/ics"
import type { CalendarEvent } from "@/lib/google-calendar.server"
import type { ThesisMeeting } from "@/lib/thesis-meetings"

/** Marks an event the app booked (`extendedProperties.private.seniorDashboard`). */
export const APP_EVENT_TAG = "thesis-meeting"

const RESPONSE: Record<string, string> = {
  accepted: "ACCEPTED",
  declined: "DECLINED",
  tentative: "TENTATIVE",
  needsAction: "NEEDS-ACTION",
}

/** A Calendar API event in the shape the tracker reads. Descriptions stay on
    the server: only the email addresses written in them go out. */
export function toMeeting(e: CalendarEvent): ThesisMeeting {
  return {
    id: e.id,
    title: e.summary,
    start: e.start,
    end: e.end,
    canceled: e.status === "cancelled",
    attendees: e.attendees.map((a) => ({
      email: a.email,
      ...(a.name ? { name: a.name } : {}),
      response: RESPONSE[a.responseStatus] ?? "NEEDS-ACTION",
    })),
    mentions: emailsIn(e.description),
  }
}

export const lower = (email: string | null | undefined) => (email ?? "").trim().toLowerCase()

/** "Thursday, November 12, 2026" */
export function longDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  })
}

/** An advisor's own row and the students assigned to them. */
export async function advisorScope(advisorId: number): Promise<{
  advisors: Advisor[]
  assignments: AdvisorAssignment[]
  me: Advisor | undefined
  /** Students assigned to this advisor, for either product. */
  studentIds: Set<string>
  /** Only the Business Thesis ones: the students they hold thesis meetings with. */
  thesisStudentIds: Set<string>
}> {
  const [advisors, assignments] = await Promise.all([fetchAdvisors(), fetchAdvisorAssignments()])
  const mine = assignments.filter((a) => Number(a.advisors_id) === advisorId)
  return {
    advisors,
    assignments,
    me: advisors.find((a) => Number(a.id) === advisorId),
    studentIds: new Set(mine.map((a) => String(a.students_id))),
    thesisStudentIds: new Set(
      mine.filter((a) => a.type === "business-thesis").map((a) => String(a.students_id))
    ),
  }
}
