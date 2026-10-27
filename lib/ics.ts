/**
 * A small iCalendar (RFC 5545) reader for the shared thesis meetings
 * calendar's secret iCal address. It reads only what the meeting tracker
 * needs from each VEVENT: when it is, its title, whether it was canceled,
 * and who was invited. Recurring events contribute only their first
 * occurrence; appointment bookings are never recurring.
 */

export interface IcsAttendee {
  email: string
  name?: string
  /** PARTSTAT: ACCEPTED, DECLINED, TENTATIVE, NEEDS-ACTION. */
  response?: string
}

export interface IcsEvent {
  uid: string
  summary: string
  description: string
  status?: string
  /** ms epoch */
  start: number
  /** ms epoch; equals start when the event has no end. */
  end: number
  allDay: boolean
  organizer?: string
  attendees: IcsAttendee[]
}

interface ContentLine {
  name: string
  params: Record<string, string>
  value: string
}

function unfold(text: string): string[] {
  return text.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "").split("\n")
}

/** Splits `NAME;P1=a;P2="b:c":value` at the first colon outside quotes. */
function parseLine(line: string): ContentLine | null {
  let inQuotes = false
  let colon = -1
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') inQuotes = !inQuotes
    else if (ch === ":" && !inQuotes) {
      colon = i
      break
    }
  }
  if (colon < 0) return null
  const head = line.slice(0, colon)
  const value = line.slice(colon + 1)
  const parts: string[] = []
  let cur = ""
  inQuotes = false
  for (const ch of head) {
    if (ch === '"') inQuotes = !inQuotes
    if (ch === ";" && !inQuotes) {
      parts.push(cur)
      cur = ""
    } else cur += ch
  }
  parts.push(cur)
  const params: Record<string, string> = {}
  for (const p of parts.slice(1)) {
    const eq = p.indexOf("=")
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, "")
  }
  return { name: parts[0].toUpperCase(), params, value }
}

function unescapeText(v: string): string {
  return v.replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1")
}

/** Offset of `timeZone` from UTC at the given instant, in ms. */
function zoneOffset(utcMs: number, timeZone: string): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).formatToParts(new Date(utcMs))
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0)
    const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"))
    return asUtc - utcMs
  } catch {
    return 0
  }
}

/** DTSTART/DTEND value to ms epoch. Floating times read in `fallbackZone`. */
function parseDate(line: ContentLine, fallbackZone: string): { ms: number; allDay: boolean } | null {
  const v = line.value.trim()
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/)
  if (!m) return null
  const [, y, mo, d, h, mi, s, z] = m
  if (h === undefined) {
    // All-day: the date at noon in the school's zone, so it never slips a day.
    const naive = Date.UTC(+y, +mo - 1, +d, 12)
    return { ms: naive - zoneOffset(naive, fallbackZone), allDay: true }
  }
  const naive = Date.UTC(+y, +mo - 1, +d, +h, +mi, +s)
  if (z) return { ms: naive, allDay: false }
  const zone = line.params.TZID || fallbackZone
  // Two passes so the offset is the one in force at the local time itself.
  let ms = naive - zoneOffset(naive, zone)
  ms = naive - zoneOffset(ms, zone)
  return { ms, allDay: false }
}

function mailto(v: string): string {
  return v.replace(/^mailto:/i, "").trim().toLowerCase()
}

export function parseIcs(text: string, fallbackZone = "America/New_York"): IcsEvent[] {
  const events: IcsEvent[] = []
  let cur: Partial<IcsEvent> & { attendees: IcsAttendee[] } | null = null
  let depth = 0 // nested components inside a VEVENT (VALARM)

  for (const raw of unfold(text)) {
    if (!raw) continue
    const line = parseLine(raw)
    if (!line) continue
    if (line.name === "BEGIN") {
      if (line.value.toUpperCase() === "VEVENT" && !cur) {
        cur = { attendees: [], summary: "", description: "" }
        depth = 0
      } else if (cur) depth++
      continue
    }
    if (line.name === "END") {
      if (cur && depth > 0) {
        depth--
        continue
      }
      if (cur && line.value.toUpperCase() === "VEVENT") {
        if (cur.uid && cur.start != null) {
          events.push({
            uid: cur.uid,
            summary: cur.summary ?? "",
            description: cur.description ?? "",
            status: cur.status,
            start: cur.start,
            end: cur.end ?? cur.start,
            allDay: cur.allDay ?? false,
            organizer: cur.organizer,
            attendees: cur.attendees,
          })
        }
        cur = null
      }
      continue
    }
    if (!cur || depth > 0) continue

    switch (line.name) {
      case "UID":
        cur.uid = line.value
        break
      case "RECURRENCE-ID":
        // A changed occurrence of a recurring event: keep it as its own event.
        cur.uid = `${cur.uid ?? ""}#${line.value}`
        break
      case "SUMMARY":
        cur.summary = unescapeText(line.value)
        break
      case "DESCRIPTION":
        cur.description = unescapeText(line.value)
        break
      case "STATUS":
        cur.status = line.value.toUpperCase()
        break
      case "DTSTART": {
        const d = parseDate(line, fallbackZone)
        if (d) {
          cur.start = d.ms
          cur.allDay = d.allDay
        }
        break
      }
      case "DTEND": {
        const d = parseDate(line, fallbackZone)
        if (d) cur.end = d.ms
        break
      }
      case "ORGANIZER":
        cur.organizer = mailto(line.value)
        break
      case "ATTENDEE": {
        const email = mailto(line.value)
        if (email.includes("@")) {
          cur.attendees.push({
            email,
            name: line.params.CN,
            response: line.params.PARTSTAT?.toUpperCase(),
          })
        }
        break
      }
    }
  }
  return events
}

/** Every email address written in a block of text, lower-cased. */
export function emailsIn(text: string): string[] {
  return [...new Set((text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? []).map((e) => e.toLowerCase()))]
}
