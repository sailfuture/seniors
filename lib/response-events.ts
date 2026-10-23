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
  advisors_id?: number | null
  [key: string]: unknown
}

/** Who is acting on a review, as logged on events and comments. */
export interface ReviewActor {
  /** Display name; advisors carry an "(advisor)" tag so the log reads right
   *  even where only the name is shown. */
  actorName: string
  teachersId: string | null
  advisorsId: number | null
}

export function reviewActor(user: Record<string, unknown> | null | undefined): ReviewActor {
  const name = (user?.name as string | undefined)?.trim() || (user?.role === "advisor" ? "Advisor" : "Teacher")
  const isAdvisor = user?.role === "advisor"
  return {
    actorName: isAdvisor && name !== "Advisor" ? `${name} (advisor)` : name,
    teachersId: (user?.teachers_id as string | undefined) ?? null,
    advisorsId: isAdvisor ? ((user?.advisors_id as number | undefined) ?? null) : null,
  }
}

/** The most recent event of a type for one question, or null. */
export function latestEvent(
  events: ResponseEvent[],
  type: ResponseEventType,
  fieldName: string,
  questionId: number | null | undefined,
  templateIdKey: string
): ResponseEvent | null {
  let best: ResponseEvent | null = null
  let bestTs = -1
  for (const e of events) {
    if (e.event_type !== type || !eventMatchesQuestion(e, fieldName, questionId, templateIdKey)) continue
    const raw = e.created_at
    const ts = typeof raw === "number" ? raw : raw ? Date.parse(raw) : 0
    if (ts >= bestTs) {
      best = e
      bestTs = ts
    }
  }
  return best
}

/**
 * True when an event belongs to this question. Events record the template id
 * alongside field_name, and the id wins when both sides have one — field
 * names are teacher-editable, can repeat across questions, and can be renamed
 * after events were logged. Events missing the id fall back to field_name.
 */
export function eventMatchesQuestion(
  e: ResponseEvent,
  fieldName: string,
  questionId: number | null | undefined,
  templateIdKey: string
): boolean {
  const eventTemplateId = Number(e[templateIdKey] ?? 0)
  if (eventTemplateId && questionId) return eventTemplateId === Number(questionId)
  return e.field_name === fieldName
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
    /** Set when a thesis advisor acted (needs an advisors_id column on the
     *  events table to be stored; the "(advisor)" name tag covers it until then). */
    advisorsId?: number | null
  }
): void {
  if (!cfg.responseEventsEndpoint || !ev.studentId) return
  const payload: Record<string, unknown> = {
    students_id: ev.studentId,
    field_name: ev.fieldName,
    event_type: ev.eventType,
    actor_name: ev.actorName,
    teachers_id: ev.teachersId ?? null,
    ...(ev.advisorsId != null ? { advisors_id: ev.advisorsId } : {}),
    [cfg.fields.templateId]: ev.templateId,
    [cfg.fields.sectionId]: ev.sectionId,
  }
  fetch(cfg.responseEventsEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => {})
}

/** All of one student's events (Xano filters on students_id; re-filtered as a guard). */
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
