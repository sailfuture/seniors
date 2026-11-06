import {
  parseSchoolCalendar,
  parseSchoolEvents,
  parseSchoolTerms,
  parseSchoolYears,
  SCHOOL_CALENDAR_ENDPOINT,
  SCHOOL_EVENTS_ENDPOINT,
  SCHOOL_TERMS_ENDPOINT,
  SCHOOL_YEARS_ENDPOINT,
  type SchoolCalendar,
} from "@/lib/school-calendar"

/**
 * The school calendar as the front office keeps it for the apply portal: the
 * day-by-day calendar (school days, breaks, holidays), the events pinned to
 * those days, the academic terms and the school years, trimmed to the fields
 * the app shows. Xano's copy is read at most every 15 minutes; the route
 * itself stays dynamic so a Xano hiccup never fails a build.
 *
 * The days are what everything else hangs off, so they alone are required:
 * when the events, terms or years can't be read the response carries them
 * empty rather than failing the whole calendar.
 */
export const dynamic = "force-dynamic"

const REVALIDATE_SECONDS = 15 * 60

async function readJson(url: string): Promise<unknown> {
  const res = await fetch(url, { next: { revalidate: REVALIDATE_SECONDS } })
  if (!res.ok) throw new Error(`${url} returned ${res.status}`)
  return res.json()
}

export async function GET() {
  const [daysResult, eventsResult, termsResult, yearsResult] = await Promise.allSettled([
    readJson(SCHOOL_CALENDAR_ENDPOINT),
    readJson(SCHOOL_EVENTS_ENDPOINT),
    readJson(SCHOOL_TERMS_ENDPOINT),
    readJson(SCHOOL_YEARS_ENDPOINT),
  ])
  if (daysResult.status === "rejected") {
    console.error("[school-calendar] days unavailable:", daysResult.reason)
    const empty: SchoolCalendar = { days: [], events: [], terms: [], years: [] }
    return Response.json({ ...empty, error: "calendar unavailable" }, { status: 502 })
  }
  for (const [label, r] of [
    ["events", eventsResult],
    ["terms", termsResult],
    ["years", yearsResult],
  ] as const) {
    if (r.status === "rejected") console.error(`[school-calendar] ${label} unavailable:`, r.reason)
  }
  const days = parseSchoolCalendar(daysResult.value)
  const body: SchoolCalendar = {
    days,
    events: parseSchoolEvents(eventsResult.status === "fulfilled" ? eventsResult.value : [], days),
    terms: parseSchoolTerms(termsResult.status === "fulfilled" ? termsResult.value : []),
    years: parseSchoolYears(yearsResult.status === "fulfilled" ? yearsResult.value : []),
  }
  return Response.json(body)
}
