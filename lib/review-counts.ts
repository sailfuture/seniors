import type { FormApiConfig } from "@/lib/form-api-config"

export interface ReviewCounts {
  /** Responses marked ready for review and not yet acted on. */
  pending: number
  /** Responses sent back for revision that the student hasn't resubmitted. */
  revisions: number
}

/** The slice of a review-queue row the counts read. */
interface QueueRow {
  students_id?: string | number | null
  isArchived?: boolean
  isComplete?: boolean
  readyReview?: boolean
  revisionNeeded?: boolean
  [key: string]: unknown
}

interface TemplateRow {
  id: number
  isArchived?: boolean
  isPublished?: boolean
  [key: string]: unknown
}

interface SectionRow {
  id: number
  isLocked?: boolean
}

/** Key for a student's counts within one section. */
export const sectionCountsKey = (studentId: string, sectionId: number) => `${studentId}:${sectionId}`

/**
 * Per-student, per-section counts of responses waiting on a reviewer, with
 * the same rules as reviewCountsByStudent. Keys come from sectionCountsKey.
 */
export function reviewCountsBySection(
  rows: unknown,
  template: unknown,
  sections: unknown,
  fields: FormApiConfig["fields"]
): Map<string, ReviewCounts> {
  const counts = new Map<string, ReviewCounts>()
  if (!Array.isArray(rows)) return counts

  const liveQuestions = new Map<number, TemplateRow>()
  for (const q of Array.isArray(template) ? (template as TemplateRow[]) : []) {
    if (q && !q.isArchived && q.isPublished) liveQuestions.set(Number(q.id), q)
  }
  const lockedSections = new Set<number>()
  for (const s of Array.isArray(sections) ? (sections as SectionRow[]) : []) {
    if (s?.isLocked) lockedSections.add(Number(s.id))
  }

  for (const r of rows as QueueRow[]) {
    if (!r || r.isArchived || r.isComplete) continue
    if (!r.readyReview && !r.revisionNeeded) continue
    const question = liveQuestions.get(Number(r[fields.templateId]))
    if (!question) continue
    const sectionId = Number(question[fields.sectionId])
    if (lockedSections.has(sectionId)) continue
    const studentId = String(r.students_id ?? "")
    if (!studentId) continue
    const key = sectionCountsKey(studentId, sectionId)
    const entry = counts.get(key) ?? { pending: 0, revisions: 0 }
    if (r.revisionNeeded) entry.revisions++
    else entry.pending++
    counts.set(key, entry)
  }
  return counts
}

/**
 * Per-student counts of responses waiting on a reviewer, counted the way the
 * review queue lists them: only live (published, unarchived) questions in
 * unlocked sections. Keys are student ids as strings.
 */
export function reviewCountsByStudent(
  rows: unknown,
  template: unknown,
  sections: unknown,
  fields: FormApiConfig["fields"]
): Map<string, ReviewCounts> {
  const counts = new Map<string, ReviewCounts>()
  if (!Array.isArray(rows)) return counts

  const liveQuestions = new Map<number, TemplateRow>()
  for (const q of Array.isArray(template) ? (template as TemplateRow[]) : []) {
    if (q && !q.isArchived && q.isPublished) liveQuestions.set(Number(q.id), q)
  }
  const lockedSections = new Set<number>()
  for (const s of Array.isArray(sections) ? (sections as SectionRow[]) : []) {
    if (s?.isLocked) lockedSections.add(Number(s.id))
  }

  for (const r of rows as QueueRow[]) {
    if (!r || r.isArchived || r.isComplete) continue
    if (!r.readyReview && !r.revisionNeeded) continue
    const question = liveQuestions.get(Number(r[fields.templateId]))
    if (!question) continue
    if (lockedSections.has(Number(question[fields.sectionId]))) continue
    const studentId = String(r.students_id ?? "")
    if (!studentId) continue
    const entry = counts.get(studentId) ?? { pending: 0, revisions: 0 }
    if (r.revisionNeeded) entry.revisions++
    else entry.pending++
    counts.set(studentId, entry)
  }
  return counts
}

/** The slice of a comment row the open-comment count reads. */
interface CommentRow {
  field_name?: string
  isComplete?: boolean
  thread_id?: string | null
  [key: string]: unknown
}

/**
 * Open comments per section for one student: comments not yet resolved,
 * with an inline thread counted once however many replies it has. A
 * comment finds its section from its section column, its question, or its
 * field name, in that order. Locked sections and retired questions are
 * left out, as in the review counts.
 */
export function openCommentsBySection(
  comments: unknown,
  template: unknown,
  sections: unknown,
  fields: FormApiConfig["fields"]
): Map<number, number> {
  const counts = new Map<number, number>()
  if (!Array.isArray(comments)) return counts

  const sectionByQuestion = new Map<number, number>()
  const sectionByField = new Map<string, number>()
  for (const q of Array.isArray(template) ? (template as TemplateRow[]) : []) {
    if (!q || q.isArchived || !q.isPublished) continue
    const sectionId = Number(q[fields.sectionId])
    sectionByQuestion.set(Number(q.id), sectionId)
    if (typeof q.field_name === "string") sectionByField.set(q.field_name, sectionId)
  }
  const lockedSections = new Set<number>()
  for (const s of Array.isArray(sections) ? (sections as SectionRow[]) : []) {
    if (s?.isLocked) lockedSections.add(Number(s.id))
  }

  const seenThreads = new Set<string>()
  for (const c of comments as CommentRow[]) {
    if (!c || c.isComplete) continue
    if (c.thread_id) {
      if (seenThreads.has(c.thread_id)) continue
      seenThreads.add(c.thread_id)
    }
    const sectionId =
      Number(c[fields.sectionId]) ||
      sectionByQuestion.get(Number(c[fields.templateId])) ||
      (c.field_name ? sectionByField.get(c.field_name) : undefined)
    if (!sectionId || lockedSections.has(sectionId)) continue
    counts.set(sectionId, (counts.get(sectionId) ?? 0) + 1)
  }
  return counts
}
