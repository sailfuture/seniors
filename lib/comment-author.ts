/**
 * Who wrote a reviewer's comment.
 *
 * The comment tables keep no author name. A staff comment carries
 * `teachers_id`, and Xano returns the matching staff row beside it as
 * `_teachers`; a thesis advisor's comment carries `advisors_id` instead
 * (Business Thesis, since 2026-11-10). A comment with neither can still be
 * placed when the review log recorded an action on the same question at the
 * same moment, which is what a revision note is.
 */

import type { ResponseEvent } from "@/lib/response-events"

interface StaffRef {
  firstName?: string | null
  lastName?: string | null
  name?: string | null
}

/** The parts of a comment row that say who wrote it. */
export interface AuthoredComment {
  field_name?: string | null
  created_at?: string | number | null
  teacher_name?: string | null
  advisors_id?: number | string | null
  [key: string]: unknown
}

/** A name that says nothing: what a reviewer without a session name was logged as. */
const isGeneric = (name: string) => /^(teacher|advisor)$/i.test(name)

const toMs = (ts: string | number | null | undefined): number => {
  if (!ts) return 0
  if (typeof ts === "number") return ts
  return /^\d+$/.test(ts) ? Number(ts) : new Date(ts).getTime()
}

/** The staff member who wrote a comment, when the row names one. */
export function commentStaffName(c: AuthoredComment): string | undefined {
  const joined = c._teachers as StaffRef[] | StaffRef | null | undefined
  const staff = (Array.isArray(joined) ? joined[0] : joined) ?? (c._teacher as StaffRef | null | undefined)
  const name = staff ? `${staff.firstName ?? ""} ${staff.lastName ?? ""}`.trim() || (staff.name ?? "").trim() : ""
  if (name) return name
  const written = (c.teacher_name ?? "").trim()
  return written && !isGeneric(written) ? written : undefined
}

/** A review event's actor, or nothing when the log only says "Teacher". */
export function eventActorName(e: ResponseEvent | null | undefined, keepAdvisorTag = false): string | undefined {
  const raw = (e?.actor_name ?? "").trim()
  const bare = raw.replace(/\s*\(advisor\)\s*$/i, "").trim()
  if (!bare || isGeneric(bare)) return undefined
  return keepAdvisorTag ? raw : bare
}

/** A revision note is saved moments after the request it goes with. */
export const SAME_ACTION_MS = 2 * 60_000

/**
 * The reviewer the log names for an action taken on this comment's question
 * as the comment was written. `sameQuestion` narrows the events when they
 * cover more than one question; by default the field name decides.
 */
export function loggedCommentAuthor(
  c: AuthoredComment,
  events: ResponseEvent[],
  { keepAdvisorTag = false, sameQuestion }: { keepAdvisorTag?: boolean; sameQuestion?: (e: ResponseEvent) => boolean } = {}
): string | undefined {
  const at = toMs(c.created_at)
  if (!at) return undefined
  const match = events.find(
    (e) =>
      e.event_type !== "submitted" &&
      eventActorName(e) !== undefined &&
      (sameQuestion ? sameQuestion(e) : e.field_name === c.field_name) &&
      Math.abs(toMs(e.created_at) - at) <= SAME_ACTION_MS
  )
  return eventActorName(match, keepAdvisorTag)
}
