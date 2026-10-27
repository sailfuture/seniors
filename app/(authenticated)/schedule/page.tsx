import { redirect } from "next/navigation"
import { getAppSession } from "@/lib/clerk-session"
import { isStaffRole } from "@/lib/roles"
import { ThesisSchedule } from "@/components/thesis-schedule"

/**
 * Thesis meetings: the class schedule (each class day opens its bookings and
 * the booking page), what's booked next, and whether each student is meeting.
 * Staff see every senior; a thesis advisor sees only their own students.
 * Students never book, so they're sent home.
 */
export default async function SchedulePage() {
  const session = await getAppSession()
  const role = session?.user.role
  const advisorId = role === "advisor" ? Number(session?.user.advisors_id) : null
  if (!isStaffRole(role) && !(advisorId && Number.isFinite(advisorId))) {
    redirect("/dashboard")
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">Schedule</h1>
        <p className="text-muted-foreground mt-1">
          {advisorId
            ? "When the class meets and your thesis meetings with each of your students. Select a class day to book a time."
            : "When the class meets, the thesis meetings booked, and whether every senior is meeting with their advisor. Select a class day to book a time."}
        </p>
      </div>
      <ThesisSchedule advisorId={advisorId} />
    </div>
  )
}
