import type { FormApiConfig } from "@/lib/form-api-config"
import { extractPlainText, looksLikeRichTextDoc } from "@/lib/rich-text"

export type VersionReason = "submitted" | "before_teacher_edit" | "restored"

export interface ResponseVersion {
  id?: number
  created_at?: number | string
  students_id: string
  field_name: string
  student_response: string
  wordCount?: number
  reason: VersionReason | string
  actor_name?: string
  [key: string]: unknown
}

function wordCountOf(raw: string): number {
  const text = looksLikeRichTextDoc(raw) ? extractPlainText(raw) : raw
  return text.trim().split(/\s+/).filter(Boolean).length
}

/**
 * Append one content snapshot to the product's version log. Fire and forget:
 * a lost snapshot must never block the save/submit it accompanies. Empty
 * content is skipped — there is nothing to preserve.
 */
export function postResponseVersion(
  cfg: FormApiConfig,
  v: {
    studentId: string
    templateId: number
    fieldName: string
    sectionId: number
    studentResponse: string
    reason: VersionReason
    actorName: string
  }
): void {
  if (!cfg.responseVersionsEndpoint || !v.studentId || !v.studentResponse.trim()) return
  const payload: Record<string, unknown> = {
    students_id: v.studentId,
    field_name: v.fieldName,
    student_response: v.studentResponse,
    wordCount: wordCountOf(v.studentResponse),
    reason: v.reason,
    actor_name: v.actorName,
    [cfg.fields.templateId]: v.templateId,
    [cfg.fields.sectionId]: v.sectionId,
  }
  fetch(cfg.responseVersionsEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => {})
}

/** One student's version snapshots (Xano ignores the query param — re-filter). */
export async function fetchResponseVersions(cfg: FormApiConfig, studentId: string): Promise<ResponseVersion[]> {
  if (!cfg.responseVersionsEndpoint || !studentId) return []
  try {
    const res = await fetch(`${cfg.responseVersionsEndpoint}?students_id=${studentId}`)
    if (!res.ok) return []
    const data = (await res.json()) as ResponseVersion[]
    return data.filter((v) => String(v.students_id ?? "") === String(studentId))
  } catch {
    return []
  }
}
