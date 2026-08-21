"use client"

import type { FormApiConfig } from "@/lib/form-api-config"
import { classYearOf, currentClassYear, fetchActiveStudents } from "@/lib/students"

/**
 * Backfills the student_response rows a question needs to be answerable.
 *
 * Rows are otherwise only written by Xano's publish_questions, which runs when
 * a teacher publishes drafts and covers the roster as it stood at that moment.
 * A student who joins afterwards — most of a new senior class — ends up with
 * no row, and the app only ever PATCHes existing rows, so their answers have
 * nowhere to go. This creates the missing ones for the current graduating
 * class, and only the missing ones, so it is safe to run repeatedly.
 */

interface TemplateRow {
  id: number
  isPublished?: boolean
  isArchived?: boolean
  [key: string]: unknown
}

interface ResponseRow {
  id: number
  students_id: string | number
  [key: string]: unknown
}

export interface SyncResult {
  /** Students in the current graduating class. */
  students: number
  /** Live published questions they each need a row for. */
  questions: number
  created: number
  failed: number
}

/** Runs `worker` over `items` with at most `limit` in flight at once. */
async function pool<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<boolean>,
  onTick: (done: number) => void
): Promise<number> {
  let next = 0
  let done = 0
  let failed = 0
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++]
      if (!(await worker(item))) failed++
      onTick(++done)
    }
  })
  await Promise.all(runners)
  return failed
}

export async function syncCurrentClassResponses(
  cfg: FormApiConfig,
  onProgress?: (done: number, total: number) => void
): Promise<SyncResult> {
  const F = cfg.fields

  const [templateRes, existingRes, students] = await Promise.all([
    fetch(cfg.templateEndpoint),
    fetch(cfg.allResponsesEndpoint),
    fetchActiveStudents(),
  ])
  if (!templateRes.ok) throw new Error("Couldn't load the question template")
  if (!existingRes.ok) throw new Error("Couldn't load existing responses")

  const template = (await templateRes.json()) as TemplateRow[]
  const existing = (await existingRes.json()) as ResponseRow[]
  if (!Array.isArray(template) || !Array.isArray(existing)) {
    throw new Error("Unexpected response from Xano")
  }

  // Only questions students can actually see need a row.
  const questions = template.filter((q) => q.isPublished && !q.isArchived)

  const year = currentClassYear()
  const seniors = students.filter((s) => classYearOf(s) === year)

  // Every (student, question) pair that already has a row, so we add only gaps.
  const have = new Set(
    existing.map((r) => `${String(r.students_id)}:${Number(r[F.templateId])}`)
  )

  const missing: { studentId: string; question: TemplateRow }[] = []
  for (const s of seniors) {
    for (const q of questions) {
      if (!have.has(`${String(s.id)}:${Number(q.id)}`)) {
        missing.push({ studentId: String(s.id), question: q })
      }
    }
  }

  onProgress?.(0, missing.length)

  const failed = await pool(
    missing,
    8,
    async ({ studentId, question }) => {
      try {
        const res = await fetch(cfg.responsePatchBase, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            students_id: studentId,
            [F.templateId]: question.id,
            // Matches what publish_questions writes, so these rows group and
            // render identically to normally provisioned ones.
            [F.customGroupId]: question[F.customGroupId] ?? null,
            student_response: "",
            wordCount: 0,
            readyReview: false,
            revisionNeeded: false,
            isComplete: false,
          }),
        })
        return res.ok
      } catch {
        return false
      }
    },
    (done) => onProgress?.(done, missing.length)
  )

  return {
    students: seniors.length,
    questions: questions.length,
    created: missing.length - failed,
    failed,
  }
}
