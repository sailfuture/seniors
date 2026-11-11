/**
 * What one thesis advisor has done: the comments they wrote, the review
 * decisions they made (revision requests above all), and the thesis meetings
 * they were on, merged into one stream and a few totals.
 *
 * A row belongs to an advisor when it carries their `advisors_id`. The
 * Business Thesis comments and events tables have stored that since
 * 2026-11-10; before then an advisor's comment was saved with no author at
 * all, so older comments can't be credited to anyone. Older events at least
 * carry the advisor's name tagged "(advisor)", which is matched as a fallback.
 */

import { advisorName, type Advisor } from "@/lib/advisors"
import { btTitleToSlug } from "@/lib/businessthesis-sections"
import type { Comment } from "@/lib/form-types"
import type { FormApiConfig } from "@/lib/form-api-config"
import { toMillis } from "@/lib/format-time"
import type { ResponseEvent } from "@/lib/response-events"
import type { RosterStudent } from "@/lib/students"
import { meetingIncludes, type ThesisMeeting } from "@/lib/thesis-meetings"

export type ActivityKind = "comment" | "revision" | "meeting"

export interface ActivityItem {
  id: string
  kind: ActivityKind
  /** ms epoch */
  at: number
  /** The student it concerns; "" for a meeting with no student on it. */
  studentId: string
  /** "Requested a revision on Market size". */
  title: string
  /** The comment's text, a revision's feedback note, or a meeting's time. */
  detail?: string
  /** The passage an inline comment was anchored to. */
  quote?: string
  /** Where in the student's thesis this happened. */
  href?: string
  /** Revision requests stand out from the other review decisions. */
  emphasis?: boolean
}

export interface AdvisorActivity {
  /** Newest first. */
  items: ActivityItem[]
  comments: number
  /** Comments sent along with a revision request. */
  revisionNotes: number
  revisionsRequested: number
  /** Thesis meetings that have happened with this advisor on the invitation. */
  meetingsHeld: ThesisMeeting[]
  /** Booked and still to come, soonest first. */
  meetingsUpcoming: ThesisMeeting[]
  /** The advisor's most recent comment, review decision or meeting. */
  lastActiveAt: number | null
}

interface TemplateRow {
  id: number
  field_name?: string
  field_label?: string
  [key: string]: unknown
}

interface SectionRow {
  id: number
  section_title?: string
}

/** A revision's feedback note is saved moments after the request itself. */
const SAME_ACTION_MS = 2 * 60_000

const sameAdvisor = (value: unknown, advisorId: number) => value != null && value !== "" && Number(value) === advisorId

export function buildAdvisorActivity(input: {
  advisor: Advisor
  students: RosterStudent[]
  comments: Comment[]
  events: ResponseEvent[]
  meetings: ThesisMeeting[]
  template: unknown
  sections: unknown
  cfg: Pick<FormApiConfig, "adminBasePath" | "fields">
  now: number
}): AdvisorActivity {
  const { advisor, students, comments, events, meetings, cfg, now } = input
  const advisorId = Number(advisor.id)
  const { templateId: templateKey, sectionId: sectionKey } = cfg.fields
  const studentById = new Map(students.map((s) => [String(s.id), s]))

  const questions = new Map<number, TemplateRow>()
  const questionByField = new Map<string, TemplateRow>()
  for (const q of Array.isArray(input.template) ? (input.template as TemplateRow[]) : []) {
    if (!q) continue
    questions.set(Number(q.id), q)
    if (q.field_name && !questionByField.has(q.field_name)) questionByField.set(q.field_name, q)
  }
  const sectionTitle = new Map<number, string>()
  for (const s of Array.isArray(input.sections) ? (input.sections as SectionRow[]) : []) {
    if (s?.section_title) sectionTitle.set(Number(s.id), s.section_title)
  }

  /** What a row is about and where to open it. */
  const place = (row: Record<string, unknown>, studentId: string): { label: string; href?: string } => {
    const fieldName = typeof row.field_name === "string" ? row.field_name : ""
    const question = questions.get(Number(row[templateKey])) ?? questionByField.get(fieldName)
    const sectionId = Number(row[sectionKey]) || Number(question?.[sectionKey]) || 0
    const section = sectionTitle.get(sectionId)
    const onSection = fieldName === "_section_comment" || !question
    const label = onSection
      ? section
        ? `the ${section} section`
        : "their thesis"
      : String(question?.field_label || fieldName || "a question")
    const href = section
      ? `${cfg.adminBasePath}/${studentId}/${btTitleToSlug(section)}${onSection || !fieldName ? "" : `?focus=${encodeURIComponent(fieldName)}`}`
      : studentId
        ? `${cfg.adminBasePath}/${studentId}`
        : undefined
    return { label, href }
  }

  // Review decisions the advisor made.
  const legacyName = `${advisorName(advisor)} (advisor)`
  const mineEvents = events.filter(
    (e) =>
      e.event_type !== "submitted" &&
      studentById.has(String(e.students_id)) &&
      (sameAdvisor(e.advisors_id, advisorId) || (e.advisors_id == null && e.actor_name === legacyName))
  )
  const mineComments = comments.filter((c) => sameAdvisor(c.advisors_id, advisorId))

  const items: ActivityItem[] = []
  const folded = new Set<Comment>()

  for (const e of mineEvents) {
    const at = toMillis(e.created_at) ?? 0
    const studentId = String(e.students_id)
    const { label, href } = place(e, studentId)
    const requested = e.event_type === "revision_requested"
    // The note sent with a revision request reads as part of the request.
    const note = requested
      ? mineComments.find(
          (c) =>
            !folded.has(c) &&
            c.isRevisionFeedback &&
            String(c.students_id) === studentId &&
            c.field_name === e.field_name &&
            Math.abs((toMillis(c.created_at) ?? 0) - at) <= SAME_ACTION_MS
        )
      : undefined
    if (note) folded.add(note)
    items.push({
      id: `event-${e.id ?? `${studentId}-${at}`}`,
      kind: "revision",
      at,
      studentId,
      title: requested
        ? `Requested a revision on ${label}`
        : e.event_type === "completed"
          ? `Marked ${label} complete`
          : `Reopened ${label} for review`,
      detail: note?.note,
      href,
      emphasis: requested,
    })
  }

  for (const c of mineComments) {
    if (folded.has(c)) continue
    const studentId = String(c.students_id ?? "")
    const { label, href } = place(c, studentId)
    items.push({
      id: `comment-${c.id}`,
      kind: "comment",
      at: toMillis(c.created_at) ?? 0,
      studentId,
      title: c.isRevisionFeedback
        ? `Sent revision feedback on ${label}`
        : c.thread_id
          ? `Commented on a passage in ${label}`
          : `Commented on ${label}`,
      detail: c.note,
      quote: c.thread_id && c.quote ? c.quote : undefined,
      href,
    })
  }

  // Meetings count for the advisor when they were on the invitation.
  const withAdvisor = meetings.filter((m) => !m.canceled && meetingIncludes(m, advisor.email))
  const meetingsHeld = withAdvisor.filter((m) => m.start <= now).sort((a, b) => b.start - a.start)
  const meetingsUpcoming = withAdvisor.filter((m) => m.start > now).sort((a, b) => a.start - b.start)
  for (const m of meetingsHeld) {
    const student = students.find((s) => meetingIncludes(m, s.studentEmail))
    items.push({
      id: `meeting-${m.id}`,
      kind: "meeting",
      at: m.start,
      studentId: student ? String(student.id) : "",
      title: student ? `Met with ${student.firstName || "their student"}` : m.title || "Thesis meeting",
      href: student ? `${cfg.adminBasePath}/${student.id}` : undefined,
    })
  }

  items.sort((a, b) => b.at - a.at)
  return {
    items,
    comments: mineComments.length,
    revisionNotes: mineComments.filter((c) => c.isRevisionFeedback).length,
    revisionsRequested: mineEvents.filter((e) => e.event_type === "revision_requested").length,
    meetingsHeld,
    meetingsUpcoming,
    lastActiveAt: items[0]?.at ?? null,
  }
}
