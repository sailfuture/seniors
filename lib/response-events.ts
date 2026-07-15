import type { FormApiConfig } from "@/lib/form-api-config"

export type ResponseEventType = "submitted" | "revision_requested" | "completed" | "reopened"

export interface ResponseEvent {
  id?: number
  created_at?: number | string
  students_id: string
  field_name: string
  event_type: ResponseEventType | string
  actor_name?: string
  teachers_id?: string | null
  [key: string]: unknown
}

/** Map a review PATCH action to its event type. */
export function eventTypeForAction(action: "complete" | "revision" | "ready" | "clear"): ResponseEventType {
  if (action === "complete") return "completed"
  if (action === "revision") return "revision_requested"
  return "reopened"
}

/**
 * Append one review-state transition to the product's event log. Fire and
 * forget: the log powers the activity timeline, so a lost row must never
 * block or fail the transition itself.
 */
export function postResponseEvent(
  cfg: FormApiConfig,
  ev: {
    studentId: string
    templateId: number
    fieldName: string
    sectionId: number
    eventType: ResponseEventType
    actorName: string
    teachersId?: string | null
  }
): void {
  if (!cfg.responseEventsEndpoint || !ev.studentId) return
  const payload: Record<string, unknown> = {
    students_id: ev.studentId,
    field_name: ev.fieldName,
    event_type: ev.eventType,
    actor_name: ev.actorName,
    teachers_id: ev.teachersId ?? null,
    [cfg.fields.templateId]: ev.templateId,
    [cfg.fields.sectionId]: ev.sectionId,
  }
  fetch(cfg.responseEventsEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => {})
}

/** All of one student's events (Xano ignores the query param — re-filter). */
export async function fetchResponseEvents(cfg: FormApiConfig, studentId: string): Promise<ResponseEvent[]> {
  if (!cfg.responseEventsEndpoint || !studentId) return []
  try {
    const res = await fetch(`${cfg.responseEventsEndpoint}?students_id=${studentId}`)
    if (!res.ok) return []
    const data = (await res.json()) as ResponseEvent[]
    return data.filter((e) => String(e.students_id ?? "") === String(studentId))
  } catch {
    return []
  }
}
