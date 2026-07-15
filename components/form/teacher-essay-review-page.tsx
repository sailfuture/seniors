"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowLeft02Icon,
  ArrowTurnBackwardIcon,
  CheckmarkCircle02Icon,
  SentIcon,
} from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { TeacherEssayAnnotator } from "./teacher-essay-annotator"
import { RichTextDisplay } from "./rich-text-display"
import { FieldActivityStream } from "./field-activity-stream"
import { isRichTextQuestion, looksLikeRichTextDoc, richTextWordCount } from "@/lib/rich-text"
import type { FormApiConfig } from "@/lib/form-api-config"
import type { Comment } from "@/lib/form-types"
import {
  eventTypeForAction,
  fetchResponseEvents,
  postResponseEvent,
  type ResponseEvent,
} from "@/lib/response-events"
import { fetchResponseVersions, postResponseVersion, type ResponseVersion } from "@/lib/response-versions"

const STUDENTS_ENDPOINT =
  "https://xsc3-mvx7-r86m.n7e.xano.io/api:fJsHVIeC/get_active_students_email"

interface TemplateQuestion {
  id: number
  field_name: string
  field_label: string
  detailed_instructions?: string
  min_words?: number
  isPublished: boolean
  isArchived: boolean
  question_types_id?: number | null
  _question_types?: { id: number; type: string; noInput?: boolean }
  [key: string]: unknown
}

interface StudentResponse {
  id: number
  student_response: string
  students_id?: string | number | null
  isArchived?: boolean
  readyReview?: boolean
  revisionNeeded?: boolean
  isComplete?: boolean
  [key: string]: unknown
}

/**
 * Full-page, document-style review of one student's rich-text essay. The
 * teacher edits the essay directly, highlights text to leave inline anchored
 * comments (every open thread — student replies included — is listed under
 * the document), leaves overall feedback, and marks the submission complete
 * or requests a revision without returning to the queue.
 *
 * Editing writes to the same student_response the student edits, so it is
 * only enabled once the essay is locked for review (submitted or approved);
 * while the student can still edit, the essay is shown read-only to avoid
 * clobbering a live draft, and only overall feedback is available.
 */
export function TeacherEssayReviewPage({
  studentId,
  questionId,
  apiConfig,
  backHref,
}: {
  studentId: string
  questionId: number
  apiConfig: FormApiConfig
  backHref: string
}) {
  const cfg = apiConfig
  const F = cfg.fields
  const router = useRouter()
  const { data: session } = useSession()
  const teacherName = session?.user?.name ?? "Teacher"
  const teachersId = ((session?.user as Record<string, unknown>)?.teachers_id as string) ?? null

  const [loading, setLoading] = useState(true)
  const [question, setQuestion] = useState<TemplateQuestion | null>(null)
  const [response, setResponse] = useState<StudentResponse | null>(null)
  const [studentName, setStudentName] = useState("")
  const [comments, setComments] = useState<Comment[]>([])
  const [events, setEvents] = useState<ResponseEvent[]>([])
  const [versions, setVersions] = useState<ResponseVersion[]>([])
  const [restoreNonce, setRestoreNonce] = useState(0)
  const [note, setNote] = useState("")
  const [posting, setPosting] = useState(false)
  const [acting, setActing] = useState(false)
  const [status, setStatus] = useState({ isComplete: false, readyReview: false, revisionNeeded: false })

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const [templateRes, responsesRes, commentsRes, studentsRes] = await Promise.all([
          fetch(cfg.templateEndpoint),
          fetch(`${cfg.responsesEndpoint}?students_id=${studentId}`),
          fetch(`${cfg.commentsEndpoint}?students_id=${studentId}`),
          fetch(STUDENTS_ENDPOINT),
        ])
        if (cancelled) return

        let q: TemplateQuestion | null = null
        if (templateRes.ok) {
          const all = (await templateRes.json()) as TemplateQuestion[]
          q = all.find((t) => t.id === questionId && t.isPublished && !t.isArchived) ?? null
          setQuestion(q)
        }
        if (responsesRes.ok) {
          const data = (await responsesRes.json()) as StudentResponse[]
          // The *_responses_by_student endpoint ignores the students_id query
          // param, so it returns every student's row — re-filter by studentId
          // or we could load a different student's essay.
          const r =
            data.find(
              (x) =>
                !x.isArchived &&
                Number(x[F.templateId]) === questionId &&
                String(x.students_id ?? "") === String(studentId)
            ) ?? null
          setResponse(r)
          if (r) {
            setStatus({ isComplete: !!r.isComplete, readyReview: !!r.readyReview, revisionNeeded: !!r.revisionNeeded })
          }
        }
        if (commentsRes.ok && q) {
          const data = (await commentsRes.json()) as Comment[]
          setComments(
            data.filter(
              (c) =>
                String(c.students_id ?? "") === String(studentId) &&
                c.field_name === q!.field_name &&
                // Inline essay-comment threads belong to a highlight, not the overall thread.
                !c.thread_id
            )
          )
        }
        if (studentsRes.ok) {
          const students = (await studentsRes.json()) as { id: string; firstName: string; lastName: string }[]
          const s = students.find((x) => String(x.id) === String(studentId))
          if (s) setStudentName(`${s.firstName} ${s.lastName}`.trim())
        }
        const [evts, vers] = await Promise.all([
          fetchResponseEvents(cfg, studentId),
          fetchResponseVersions(cfg, studentId),
        ])
        if (!cancelled) {
          setEvents(evts)
          setVersions(vers)
        }
      } catch {
        /* silently fail, like the section form */
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [cfg, F, studentId, questionId])

  const sectionId = Number(question?.[F.sectionId] ?? 0)
  const fieldName = question?.field_name

  const postComment = useCallback(
    async (isRevisionFeedback = false): Promise<boolean> => {
      if (!note.trim() || !response || !fieldName) return false
      const payload: Record<string, unknown> = {
        students_id: studentId,
        teachers_id: teachersId,
        field_name: fieldName,
        [F.sectionId]: sectionId,
        note: note.trim(),
        isOld: false,
        isComplete: false,
        teacher_name: teacherName,
        isRevisionFeedback,
      }
      try {
        const res = await fetch(cfg.commentsEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        if (!res.ok) return false
        const created = await res.json()
        setComments((prev) => [...prev, { ...created, teacher_name: created.teacher_name || teacherName }])
        return true
      } catch {
        return false
      }
    },
    [note, response, fieldName, studentId, teachersId, F.sectionId, sectionId, teacherName, cfg.commentsEndpoint]
  )

  const handlePost = async () => {
    setPosting(true)
    const ok = await postComment(false)
    setPosting(false)
    if (ok) setNote("")
  }

  const handleDelete = useCallback(
    async (commentId: number) => {
      const res = await fetch(`${cfg.commentsEndpoint}/${commentId}`, { method: "DELETE" })
      if (res.ok) setComments((prev) => prev.filter((c) => c.id !== commentId))
    },
    [cfg.commentsEndpoint]
  )

  const applyAction = useCallback(
    async (action: "complete" | "revision" | "ready") => {
      if (!response) return
      setActing(true)
      const patch =
        action === "complete"
          ? { isComplete: true, revisionNeeded: false, readyReview: false }
          : action === "revision"
            ? { revisionNeeded: true, isComplete: false, readyReview: false }
            : { readyReview: true, isComplete: false, revisionNeeded: false }
      try {
        // A revision request carries the composer text as feedback.
        if (action === "revision" && note.trim()) await postComment(true)
        const res = await fetch(`${cfg.responsePatchBase}/${response.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        })
        if (!res.ok) {
          setActing(false)
          return
        }
        // Log the transition so the activity timeline shows the history.
        if (question) {
          const evType = eventTypeForAction(action)
          postResponseEvent(cfg, {
            studentId,
            templateId: question.id,
            fieldName: question.field_name,
            sectionId,
            eventType: evType,
            actorName: teacherName,
            teachersId,
          })
          setEvents((prev) => [
            ...prev,
            {
              students_id: studentId,
              field_name: question.field_name,
              event_type: evType,
              actor_name: teacherName,
              created_at: Date.now(),
            },
          ])
        }
        const eventName = `${cfg.eventPrefix ?? ""}review-update`
        const wasReady = status.readyReview && !status.isComplete && !status.revisionNeeded
        const nowReady = patch.readyReview
        const wasRevision = status.revisionNeeded
        const nowRevision = patch.revisionNeeded
        if (nowReady !== wasReady) {
          window.dispatchEvent(new CustomEvent(eventName, { detail: { sectionId, delta: nowReady ? 1 : -1 } }))
        }
        if (nowRevision !== wasRevision) {
          window.dispatchEvent(new CustomEvent(eventName, { detail: { sectionId, delta: nowRevision ? 1 : -1, type: "revision" } }))
        }
        setStatus(patch)
        // Completing or requesting a revision finishes this review — return to
        // the queue, where the row has moved. Undo keeps the teacher in place.
        if (action === "ready") {
          setActing(false)
          return
        }
        router.push(backHref)
      } catch {
        setActing(false)
      }
    },
    [response, note, postComment, cfg, question, studentId, teacherName, teachersId, status, sectionId, router, backHref]
  )

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-3xl flex-1 space-y-6 p-4 md:p-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  // Accept a stored TipTap doc even if the question's type flag was later
  // changed away from rich text, matching the queue's routing predicate
  // (isRichTextQuestion || looksLikeRichTextDoc) so those rows aren't a dead end.
  if (!question || (!isRichTextQuestion(question) && !looksLikeRichTextDoc(response?.student_response ?? ""))) {
    return (
      <div className="mx-auto w-full max-w-3xl flex-1 space-y-4 p-4 md:p-6">
        <BackButton href={backHref} />
        <p className="text-muted-foreground">This essay question was not found. It may have been unpublished or removed.</p>
      </div>
    )
  }

  if (!response) {
    return (
      <div className="mx-auto w-full max-w-3xl flex-1 space-y-4 p-4 md:p-6">
        <BackButton href={backHref} />
        <h1 className="text-2xl font-bold">{question.field_label}</h1>
        <p className="text-muted-foreground">This student has not started this essay yet.</p>
      </div>
    )
  }

  const value = response.student_response ?? ""
  const hasEssay = value.trim().length > 0
  const isComplete = status.isComplete
  const isReadyForReview = status.readyReview && !isComplete && !status.revisionNeeded
  // Mirror the section-page rule: only annotate a locked essay so a mark save
  // never clobbers a draft the student can still edit.
  const canAnnotate = hasEssay && (isReadyForReview || isComplete)
  const wordCount = richTextWordCount(value)
  const minWords = question.min_words && question.min_words > 0 ? question.min_words : null

  // Preserve the student's original prose the moment the teacher first edits it.
  const snapshotBeforeEdit = (original: string) => {
    postResponseVersion(cfg, {
      studentId,
      templateId: question.id,
      fieldName: question.field_name,
      sectionId,
      studentResponse: original,
      reason: "before_teacher_edit",
      actorName: teacherName,
    })
    setVersions((prev) => [
      ...prev,
      {
        students_id: studentId,
        field_name: question.field_name,
        student_response: original,
        wordCount: richTextWordCount(original),
        reason: "before_teacher_edit",
        actor_name: teacherName,
        created_at: Date.now(),
      },
    ])
  }

  // Roll the essay back to a snapshot — recording the current text first, so a
  // restore is itself reversible — and remount the editor on the new content.
  const restoreVersion = async (v: ResponseVersion) => {
    postResponseVersion(cfg, {
      studentId,
      templateId: question.id,
      fieldName: question.field_name,
      sectionId,
      studentResponse: response.student_response ?? "",
      reason: "restored",
      actorName: teacherName,
    })
    try {
      await fetch(`${cfg.responsePatchBase}/${response.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_response: v.student_response }),
      })
    } catch {
      /* best-effort */
    }
    setResponse((prev) => (prev ? { ...prev, student_response: v.student_response } : prev))
    setRestoreNonce((n) => n + 1)
    setVersions(await fetchResponseVersions(cfg, studentId))
  }

  const fieldVersions = versions.filter((v) => v.field_name === question.field_name)

  return (
    <div className="w-full flex-1 bg-white p-4 md:p-6 dark:bg-background">
      <div className="flex items-center justify-between gap-2">
        <BackButton href={backHref} />
        {studentName && <span className="text-muted-foreground text-sm font-medium">{studentName}</span>}
      </div>

      <div className="mt-6 space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{question.field_label}</h1>
        {question.detailed_instructions && (
          <p className="text-muted-foreground whitespace-pre-wrap text-sm">{question.detailed_instructions}</p>
        )}
      </div>

      {hasEssay && !canAnnotate && (
        <div className="bg-muted/50 text-muted-foreground mt-4 flex items-center gap-2 rounded-lg border px-4 py-3 text-sm">
          <HugeiconsIcon icon={SentIcon} strokeWidth={2} className="size-4 shrink-0 text-blue-500" />
          The student is still editing this essay, so inline editing and comments are disabled. You can leave overall
          feedback below.
        </div>
      )}

      {/* The essay is a full-width white "page" with set margins; the sticky
          toolbar rides at the top so commenting is always one click away. */}
      <div className="mt-4">
        {canAnnotate ? (
          <TeacherEssayAnnotator
            key={`${response.id}-${restoreNonce}`}
            initialValue={value}
            patchUrl={`${cfg.responsePatchBase}/${response.id}`}
            bodyClassName="px-6 py-10 sm:px-12 lg:px-24"
            onFirstProseEdit={snapshotBeforeEdit}
            comments={{
              commentsEndpoint: cfg.commentsEndpoint,
              sectionIdField: F.sectionId,
              studentId,
              sectionId,
              fieldName: question.field_name,
              viewer: "teacher",
              authorName: teacherName,
              teachersId,
            }}
          />
        ) : (
          <div className="rounded-xl border bg-white px-6 py-10 sm:px-12 lg:px-24 dark:bg-card">
            {hasEssay ? (
              <RichTextDisplay raw={value} showComments />
            ) : (
              <p className="text-muted-foreground text-sm italic">This essay is empty.</p>
            )}
          </div>
        )}
      </div>

      <div className="text-muted-foreground/60 mt-1 text-xs">
        {minWords ? `${wordCount} / ${minWords} words` : `${wordCount} ${wordCount === 1 ? "word" : "words"}`}
      </div>

      {/* Overall feedback thread, separate from the anchored inline comments. */}
      <div className="mt-8">
        <h2 className="text-sm font-semibold">Overall feedback</h2>
        <div className="mt-3">
          <FieldActivityStream
            comments={comments}
            events={events.filter((e) => e.field_name === question.field_name)}
            viewer="teacher"
            onDelete={handleDelete}
          />
        </div>
        <div className="mt-3">
          <Textarea
            placeholder="Add a comment…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && note.trim() && !posting) {
                e.preventDefault()
                handlePost()
              }
            }}
            rows={2}
          />
          <div className="mt-2 flex justify-end">
            <Button size="sm" variant="outline" onClick={handlePost} disabled={!note.trim() || posting}>
              {posting ? "Posting…" : "Post comment"}
            </Button>
          </div>
        </div>
      </div>

      {fieldVersions.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold">Version history</h2>
          <div className="mt-3">
            <VersionHistory versions={fieldVersions} onRestore={restoreVersion} />
          </div>
        </div>
      )}

      {/* Review actions stay reachable while the teacher scrolls the essay. */}
      <div className="bg-background/95 supports-[backdrop-filter]:bg-background/75 sticky bottom-0 mt-6 flex items-center gap-2 border-t py-3 backdrop-blur">
        {status.isComplete || status.revisionNeeded ? (
          <Button variant="outline" className="flex-1 bg-white dark:bg-transparent" disabled={acting} onClick={() => applyAction("ready")}>
            Undo review
          </Button>
        ) : (
          <>
            <Button
              variant="outline"
              className="flex-1 gap-1.5 border-red-200 bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800"
              disabled={acting}
              onClick={() => applyAction("revision")}
            >
              <HugeiconsIcon icon={ArrowTurnBackwardIcon} strokeWidth={2} className="size-4" />
              Revision
            </Button>
            <Button
              variant="outline"
              className="flex-1 gap-1.5 border-green-200 bg-green-50 text-green-700 hover:bg-green-100 hover:text-green-800"
              disabled={acting}
              onClick={() => applyAction("complete")}
            >
              <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} className="size-4" />
              Complete
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

const REASON_LABEL: Record<string, { label: string; cls: string }> = {
  submitted: { label: "Submitted for review", cls: "text-blue-600" },
  before_teacher_edit: { label: "Before teacher edit", cls: "text-amber-600" },
  restored: { label: "Restored", cls: "text-muted-foreground" },
}

function vts(ts: number | string | undefined): number {
  if (!ts) return 0
  return typeof ts === "number" ? ts : Date.parse(String(ts)) || 0
}

function formatVersionDate(ts: number | string | undefined): string {
  const ms = vts(ts)
  if (!ms) return ""
  return new Date(ms).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

/** Snapshot list with a per-version read-only preview and a two-step Restore. */
function VersionHistory({
  versions,
  onRestore,
}: {
  versions: ResponseVersion[]
  onRestore: (v: ResponseVersion) => Promise<void>
}) {
  const sorted = [...versions].sort((a, b) => vts(b.created_at) - vts(a.created_at))
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [confirmKey, setConfirmKey] = useState<string | null>(null)
  const [restoring, setRestoring] = useState(false)

  return (
    <div className="divide-y rounded-lg border">
      {sorted.map((v, i) => {
        const key = String(v.id ?? `${v.reason}-${vts(v.created_at)}-${i}`)
        const meta = REASON_LABEL[v.reason] ?? { label: String(v.reason), cls: "text-muted-foreground" }
        const open = openKey === key
        return (
          <div key={key} className="px-3 py-2.5">
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <span className={cn("font-medium", meta.cls)}>{meta.label}</span>
                  {v.actor_name && <span className="text-muted-foreground"> &middot; {v.actor_name}</span>}
                </p>
                <p className="text-muted-foreground text-xs">
                  {formatVersionDate(v.created_at)}
                  {v.wordCount != null ? ` · ${v.wordCount} words` : ""}
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 shrink-0 text-xs"
                onClick={() => setOpenKey(open ? null : key)}
              >
                {open ? "Hide" : "Preview"}
              </Button>
              {confirmKey === key ? (
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    disabled={restoring}
                    onClick={() => setConfirmKey(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 bg-white text-xs dark:bg-transparent"
                    disabled={restoring}
                    onClick={async () => {
                      setRestoring(true)
                      await onRestore(v)
                      setRestoring(false)
                      setConfirmKey(null)
                      setOpenKey(null)
                    }}
                  >
                    {restoring ? "Restoring…" : "Confirm restore"}
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 shrink-0 bg-white text-xs dark:bg-transparent"
                  onClick={() => setConfirmKey(key)}
                >
                  Restore
                </Button>
              )}
            </div>
            {open && (
              <div className="bg-muted/30 mt-2 rounded-md border px-3 py-2">
                <RichTextDisplay raw={v.student_response} className="text-[13px] leading-relaxed" />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function BackButton({ href }: { href: string }) {
  return (
    <Button variant="outline" size="sm" asChild className="gap-2">
      <Link href={href}>
        <HugeiconsIcon icon={ArrowLeft02Icon} strokeWidth={2} className="size-4" />
        Back to review
      </Link>
    </Button>
  )
}
