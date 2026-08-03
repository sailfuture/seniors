import type { FormApiConfig } from "@/lib/form-api-config"

/**
 * The single AI gate for student submissions: anything scoring above this
 * percent AI (GPTZero `class_probability_ai`) is blocked from submitting or
 * resubmitting, on every product and every path.
 */
export const AI_BLOCK_THRESHOLD = 50

/** Below this many words the check is skipped — too short to score reliably. */
export const AI_CHECK_MIN_WORDS = 20

export interface GptZeroRecord {
  id?: number
  class_probability_ai?: number | string
  class_probability_human?: number | string
  mixed?: number | string
  [key: string]: unknown
}

export interface AiGateResult {
  /**
   * "blocked"     — over the threshold; the caller must refuse the submission.
   * "ok"          — scored at or under the threshold.
   * "skipped"     — too short to score or no endpoint configured; the
   *                 submission proceeds unchecked.
   * "unavailable" — the checker errored or returned no score. The gate fails
   *                 CLOSED: the caller must refuse the submission and tell
   *                 the student to retry, without implying AI was detected.
   */
  verdict: "ok" | "blocked" | "skipped" | "unavailable"
  /** Normalized 0–100 percent, when the checker returned one. */
  aiPercent: number | null
  record: GptZeroRecord | null
}

export function normalizeAiPercent(raw: unknown): number {
  const n = typeof raw === "string" ? parseFloat(raw) : typeof raw === "number" ? raw : 0
  if (Number.isNaN(n)) return 0
  return n <= 1 ? n * 100 : n
}

/**
 * Runs the GPTZero submission check and applies the block threshold.
 *
 * `keepRecord` controls what happens to the persisted gptzero_document:
 * - "onPass" (submissions): keep it when the essay passes so the teacher's
 *   review page can show the scores; delete it when blocked so a rejected
 *   attempt doesn't linger as if it were submitted.
 * - "never" (self-checks): always delete — a dry run must leave no trace.
 */
export async function checkSubmissionForAi(
  cfg: FormApiConfig,
  opts: {
    responseId: number
    studentId: string
    sectionId: number
    text: string
    keepRecord?: "onPass" | "never"
  }
): Promise<AiGateResult> {
  const keepRecord = opts.keepRecord ?? "onPass"
  const wordCount = opts.text.trim().split(/\s+/).filter(Boolean).length
  if (wordCount < AI_CHECK_MIN_WORDS || !cfg.plagiarismCheckEndpoint) {
    return { verdict: "skipped", aiPercent: null, record: null }
  }

  try {
    const respIdField =
      cfg.plagiarismResponseIdField ?? `${cfg.fields.sectionId.replace("_id", "")}_responses_id`
    const params = new URLSearchParams({
      text: opts.text,
      [respIdField]: String(opts.responseId),
      students_id: String(opts.studentId),
      [cfg.fields.sectionId]: String(opts.sectionId),
    })
    const res = await fetch(`${cfg.plagiarismCheckEndpoint}?${params}`)
    if (!res.ok) return { verdict: "unavailable", aiPercent: null, record: null }

    const record = (await res.json()) as GptZeroRecord | null
    if (record?.class_probability_ai == null) {
      // No score came back — treat it like an outage, not a pass.
      return { verdict: "unavailable", aiPercent: null, record: record ?? null }
    }
    const aiPercent = normalizeAiPercent(record.class_probability_ai)
    const blocked = aiPercent > AI_BLOCK_THRESHOLD

    const shouldDelete = keepRecord === "never" || blocked
    if (shouldDelete && record?.id && cfg.gptzeroDeleteBase) {
      fetch(`${cfg.gptzeroDeleteBase}/${record.id}`, { method: "DELETE" }).catch(() => {})
    }

    return { verdict: blocked ? "blocked" : "ok", aiPercent, record }
  } catch {
    return { verdict: "unavailable", aiPercent: null, record: null }
  }
}
