import { createSign } from "crypto"

/**
 * Google Calendar access for thesis meetings: the same service account with
 * domain-wide delegation the apply portal uses for campus tours, called over
 * plain REST (no `googleapis` package).
 *
 * The service account signs a JWT saying "act as GOOGLE_CALENDAR_IMPERSONATE"
 * (a real sailfuture.org user), trades it for an access token, and calls the
 * Calendar API as that user. Nobody signs in with Google for this and the
 * app's OAuth consent screen is not involved. Because guests are on the event
 * and it is saved with `sendUpdates=all`, Google emails the invitations and
 * tracks the replies.
 *
 * Env, the same three values as the apply portal:
 *  - GOOGLE_CALENDAR_CLIENT_EMAIL: the service account's client_email
 *  - GOOGLE_CALENDAR_PRIVATE_KEY: its private_key (literal \n is fine)
 *  - GOOGLE_CALENDAR_IMPERSONATE: the workspace user to act as, who must be
 *    able to make changes to the Senior Thesis Meetings calendar
 * The calendar itself is THESIS_MEETINGS_CALENDAR_ID, or else the id inside
 * THESIS_MEETINGS_ICS_URL (the secret iCal address already carries it).
 */

const SCOPE = "https://www.googleapis.com/auth/calendar.events"
const TOKEN_URL = "https://oauth2.googleapis.com/token"
const API_BASE = "https://www.googleapis.com/calendar/v3"
const TIME_ZONE = "America/New_York"

/** A pasted env value without the quotes a .env line wraps it in. */
function unquoted(v: string | undefined): string {
  const s = (v ?? "").trim()
  const wrapped = s.length >= 2 && (s[0] === '"' || s[0] === "'") && s[s.length - 1] === s[0]
  return wrapped ? s.slice(1, -1).trim() : s
}

/** A pasted env value's first token: an email never contains whitespace. */
function firstToken(v: string | undefined): string {
  return unquoted(v).split(/\s+/)[0] ?? ""
}

/** The calendar id written into a secret iCal address, or "". */
export function calendarIdFromIcsUrl(url: string | undefined): string {
  const encoded = (url ?? "").match(/\/calendar\/ical\/([^/]+)\//)?.[1]
  if (!encoded) return ""
  try {
    return decodeURIComponent(encoded)
  } catch {
    return ""
  }
}

interface CalendarConfig {
  clientEmail: string
  privateKey: string
  impersonate: string
  calendarId: string
}

function readConfig(): CalendarConfig {
  return {
    clientEmail: firstToken(process.env.GOOGLE_CALENDAR_CLIENT_EMAIL),
    // Vercel and .env files carry the PEM's newlines as literal "\n".
    privateKey: unquoted(process.env.GOOGLE_CALENDAR_PRIVATE_KEY).replace(/\\n/g, "\n"),
    impersonate: firstToken(process.env.GOOGLE_CALENDAR_IMPERSONATE),
    calendarId:
      firstToken(process.env.THESIS_MEETINGS_CALENDAR_ID) ||
      calendarIdFromIcsUrl(process.env.THESIS_MEETINGS_ICS_URL),
  }
}

function getConfig(): CalendarConfig | null {
  const c = readConfig()
  return c.clientEmail && c.privateKey && c.impersonate && c.calendarId ? c : null
}

/**
 * The settings this deployment still lacks before it can book, by name and
 * never by value. Empty when booking is connected.
 */
export function missingCalendarSettings(): string[] {
  const c = readConfig()
  const missing: string[] = []
  if (!c.clientEmail) missing.push("GOOGLE_CALENDAR_CLIENT_EMAIL")
  if (!c.privateKey) missing.push("GOOGLE_CALENDAR_PRIVATE_KEY")
  if (!c.impersonate) missing.push("GOOGLE_CALENDAR_IMPERSONATE")
  if (!c.calendarId) {
    missing.push(
      unquoted(process.env.THESIS_MEETINGS_ICS_URL)
        ? "THESIS_MEETINGS_CALENDAR_ID (the calendar ID couldn’t be read from THESIS_MEETINGS_ICS_URL)"
        : "THESIS_MEETINGS_CALENDAR_ID (or THESIS_MEETINGS_ICS_URL)"
    )
  }
  return missing
}

/** Whether the app can write to the thesis meetings calendar. */
export function isThesisCalendarConfigured(): boolean {
  return getConfig() !== null
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

// One token per server instance, reused until shortly before it expires.
let cachedToken: { value: string; expiresAt: number } | null = null

async function getAccessToken(config: CalendarConfig): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) return cachedToken.value

  const iat = Math.floor(Date.now() / 1000)
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))
  const claims = b64url(
    JSON.stringify({
      iss: config.clientEmail,
      sub: config.impersonate,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat,
      exp: iat + 3600,
    })
  )
  const signature = createSign("RSA-SHA256").update(`${header}.${claims}`).sign(config.privateKey)
  const assertion = `${header}.${claims}.${b64url(signature)}`

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`Google token exchange failed (${res.status}): ${errorMessage(await res.text())}`)
  const data = (await res.json()) as { access_token?: string; expires_in?: number }
  if (!data.access_token) throw new Error("Google token exchange returned no access_token")
  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000,
  }
  return cachedToken.value
}

/** The readable message inside a Google error body. */
function errorMessage(body: string): string {
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } | string; error_description?: string }
    const msg =
      (typeof parsed.error === "object" ? parsed.error?.message : undefined) ?? parsed.error_description
    if (typeof msg === "string" && msg) return msg
  } catch {
    // Not JSON: fall through to the raw text.
  }
  return body.replace(/\s+/g, " ").trim().slice(0, 300)
}

/** A failed Calendar API call, with Google's HTTP status. */
export class GoogleCalendarError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
  }
}

async function calendarFetch(
  path: string,
  init: RequestInit & { query?: Record<string, string> } = {}
): Promise<Response> {
  const config = getConfig()
  if (!config) throw new GoogleCalendarError("The thesis meetings calendar is not connected", 503)
  const token = await getAccessToken(config)
  const { query, ...rest } = init
  const qs = new URLSearchParams(query ?? {}).toString()
  const url = `${API_BASE}/calendars/${encodeURIComponent(config.calendarId)}${path}${qs ? `?${qs}` : ""}`
  return fetch(url, {
    ...rest,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(rest.headers ?? {}),
    },
  })
}

async function failure(what: string, res: Response): Promise<GoogleCalendarError> {
  return new GoogleCalendarError(
    `Google Calendar ${what} failed (${res.status}): ${errorMessage(await res.text().catch(() => ""))}`,
    res.status
  )
}

export interface CalendarAttendee {
  email: string
  name: string
  /** accepted, declined, tentative or needsAction. */
  responseStatus: string
}

/** One event on the thesis meetings calendar. */
export interface CalendarEvent {
  id: string
  /** confirmed, tentative or cancelled. */
  status: string
  summary: string
  description: string
  /** ms epoch; 0 on an all-day event. */
  start: number
  end: number
  attendees: CalendarAttendee[]
  /** The app's own notes on an event it created (`extendedProperties.private`). */
  tags: Record<string, string>
}

function toEvent(item: Record<string, unknown>): CalendarEvent {
  const start = item.start as { dateTime?: string } | undefined
  const end = item.end as { dateTime?: string } | undefined
  const ext = item.extendedProperties as { private?: Record<string, unknown> } | undefined
  const tags: Record<string, string> = {}
  for (const [k, v] of Object.entries(ext?.private ?? {})) tags[k] = String(v)
  return {
    id: String(item.id ?? ""),
    status: String(item.status ?? ""),
    summary: String(item.summary ?? ""),
    description: String(item.description ?? ""),
    start: start?.dateTime ? Date.parse(start.dateTime) || 0 : 0,
    end: end?.dateTime ? Date.parse(end.dateTime) || 0 : 0,
    attendees: Array.isArray(item.attendees)
      ? (item.attendees as Record<string, unknown>[])
          .map((a) => ({
            email: String(a.email ?? "").trim().toLowerCase(),
            name: String(a.displayName ?? ""),
            responseStatus: String(a.responseStatus ?? ""),
          }))
          .filter((a) => a.email.includes("@"))
      : [],
    tags,
  }
}

/** Events between two instants, recurring ones expanded, deleted ones left out. */
export async function listThesisEvents(timeMinMs: number, timeMaxMs: number): Promise<CalendarEvent[]> {
  const out: CalendarEvent[] = []
  let pageToken: string | undefined
  for (let page = 0; page < 10; page++) {
    const res = await calendarFetch("/events", {
      query: {
        timeMin: new Date(timeMinMs).toISOString(),
        timeMax: new Date(timeMaxMs).toISOString(),
        singleEvents: "true",
        maxResults: "250",
        ...(pageToken ? { pageToken } : {}),
      },
    })
    if (!res.ok) throw await failure("list", res)
    const data = (await res.json()) as { items?: Record<string, unknown>[]; nextPageToken?: string }
    for (const item of data.items ?? []) out.push(toEvent(item))
    pageToken = data.nextPageToken
    if (!pageToken) break
  }
  return out
}

/** One event, or null when it doesn't exist (or was deleted). */
export async function getThesisEvent(eventId: string): Promise<CalendarEvent | null> {
  const res = await calendarFetch(`/events/${encodeURIComponent(eventId)}`)
  if (res.status === 404 || res.status === 410) return null
  if (!res.ok) throw await failure("read", res)
  const event = toEvent((await res.json()) as Record<string, unknown>)
  return event.status === "cancelled" ? null : event
}

export interface NewThesisEvent {
  summary: string
  description: string
  location: string
  /** ms epoch */
  start: number
  end: number
  guests: { email: string; name?: string }[]
  /** Kept on the event for the app only; guests never see these. */
  tags: Record<string, string>
}

/** Adds the event to the shared calendar; Google emails every guest. */
export async function createThesisEvent(input: NewThesisEvent): Promise<CalendarEvent> {
  const res = await calendarFetch("/events", {
    method: "POST",
    query: { sendUpdates: "all" },
    body: JSON.stringify({
      summary: input.summary,
      description: input.description,
      location: input.location,
      start: { dateTime: new Date(input.start).toISOString(), timeZone: TIME_ZONE },
      end: { dateTime: new Date(input.end).toISOString(), timeZone: TIME_ZONE },
      attendees: input.guests.map((g) => ({ email: g.email, ...(g.name ? { displayName: g.name } : {}) })),
      guestsCanInviteOthers: false,
      guestsCanModify: false,
      extendedProperties: { private: input.tags },
    }),
  })
  if (!res.ok) throw await failure("create", res)
  const event = toEvent((await res.json()) as Record<string, unknown>)
  if (!event.id) throw new GoogleCalendarError("Google Calendar create returned no event", 502)
  return event
}

/** Removes the event; Google emails the guests. Already gone counts as done. */
export async function deleteThesisEvent(eventId: string): Promise<void> {
  const res = await calendarFetch(`/events/${encodeURIComponent(eventId)}`, {
    method: "DELETE",
    query: { sendUpdates: "all" },
  })
  if (!res.ok && res.status !== 404 && res.status !== 410) throw await failure("delete", res)
}
