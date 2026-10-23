import { parseSchoolCalendar, SCHOOL_CALENDAR_ENDPOINT } from "@/lib/school-calendar"

/**
 * The school's day-by-day calendar (school days, breaks, holidays), trimmed
 * to the fields the app shows. Xano's copy is read at most once an hour; the
 * route itself stays dynamic so a Xano hiccup never fails a build.
 */
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const res = await fetch(SCHOOL_CALENDAR_ENDPOINT, { next: { revalidate: 3600 } })
    if (!res.ok) {
      return Response.json({ days: [], error: `calendar returned ${res.status}` }, { status: 502 })
    }
    return Response.json({ days: parseSchoolCalendar(await res.json()) })
  } catch {
    return Response.json({ days: [], error: "calendar unavailable" }, { status: 502 })
  }
}
