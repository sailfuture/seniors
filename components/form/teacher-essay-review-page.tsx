"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useSession } from "@/components/session-provider"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowLeft02Icon,
  ArrowTurnBackwardIcon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  Comment01Icon,
  SentIcon,
} from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { CommentComposer } from "./comment-composer"
import { TeacherEssayAnnotator } from "./teacher-essay-annotator"
import { RichTextDisplay } from "./rich-text-display"
import {
  FieldActivityStream,
  groupResolvedThreads,
  type ResolvedThreadEntry,
} from "./field-activity-stream"
import { isRichTextQuestion, looksLikeRichTextDoc, richTextWordCount } from "@/lib/rich-text"
import type { FormApiConfig } from "@/lib/form-api-config"
import { commentMatchesQuestion } from "@/lib/form-types"
import type { Comment } from "@/lib/form-types"
import {
  eventMatchesQuestion,
  eventTypeForAction,
  fetchResponseEvents,
  postResponseEvent,
  type ResponseEvent,
} from "@/lib/response-events"
import { useBumpSidebar } from "@/lib/refresh-context"
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
  const bumpSidebar = useBumpSidebar()

  const [loading, setLoading] = useState(true)
  const [question, setQuestion] = useState<TemplateQuestion | null>(null)
  const [response, setResponse] = useState<StudentResponse | null>(null)
  const [studentName, setStudentName] = useState("")
  const [comments, setComments] = useState<Comment[]>([])
  const [resolvedThreads, setResolvedThreads] = useState<ResolvedThreadEntry[]>([])
  const [events, setEvents] = useState<ResponseEvent[]>([])
  const [versions, setVersions] = useState<ResponseVersion[]>([])
  const [restoreNonce, setRestoreNonce] = useState(0)
  const [acting, setActing] = useState(false)
  const [status, setStatus] = useState({ isComplete: false, readyReview: false, revisionNeeded: false })
  // Overall feedback lives in a sheet; a revision needs a confirmed, required note.
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [revisionOpen, setRevisionOpen] = useState(false)
  const [revisionNote, setRevisionNote] = useState("")
  // Inline-comments sheet, controlled here so the button sits in the header.
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [commentCounts, setCommentCounts] = useState({ open: 0, unread: 0 })
  const handleCommentCounts = useCallback(
    (c: { open: number; unread: number }) => setCommentCounts(c),
    []
  )
  // Version history sheet; opening a version widens the sheet to a full essay.
  const [historyOpen, setHistoryOpen] = useState(false)
  const [openVersion, setOpenVersion] = useState<ResponseVersion | null>(null)
  const [confirmRestore, setConfirmRestore] = useState(false)
  const [restoring, setRestoring] = useState(false)

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
          const mine = data.filter(
            (c) =>
              String(c.students_id ?? "") === String(studentId) &&
              commentMatchesQuestion(c, q!.field_name, questionId, F.templateId)
          )
          // Inline essay-comment threads belong to a highlight, not the overall thread.
          setComments(mine.filter((c) => !c.thread_id))

          // Resolved inline threads lose their highlight, so they surface in
          // the feedback activity feed instead — grouped by thread.
          setResolvedThreads(groupResolvedThreads(mine.filter((c) => !!c.thread_id)))
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
    async (noteText: string, isRevisionFeedback = false): Promise<boolean> => {
      if (!noteText.trim() || !response || !fieldName) return false
      const payload: Record<string, unknown> = {
        students_id: studentId,
        teachers_id: teachersId,
        field_name: fieldName,
        [F.sectionId]: sectionId,
        [F.templateId]: questionId,
        note: noteText.trim(),
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
    [response, fieldName, studentId, teachersId, F.sectionId, F.templateId, questionId, sectionId, teacherName, cfg.commentsEndpoint]
  )

  const handleDelete = useCallback(
    async (commentId: number) => {
      const res = await fetch(`${cfg.commentsEndpoint}/${commentId}`, { method: "DELETE" })
      if (res.ok) setComments((prev) => prev.filter((c) => c.id !== commentId))
    },
    [cfg.commentsEndpoint]
  )

  const applyAction = useCallback(
    async (action: "complete" | "revision" | "ready", revisionNote?: string) => {
      if (!response) return
      setActing(true)
      const patch =
        action === "complete"
          ? { isComplete: true, revisionNeeded: false, readyReview: false }
          : action === "revision"
            ? { revisionNeeded: true, isComplete: false, readyReview: false }
            : { readyReview: true, isComplete: false, revisionNeeded: false }
      try {
        // A revision request always carries the (required) note as feedback.
        if (action === "revision" && revisionNote?.trim()) await postComment(revisionNote, true)
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
        // The sidebar's green "section complete" check only recomputes on a
        // refetch — bump it so completing the last item shows immediately.
        bumpSidebar()
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
    [response, postComment, cfg, question, studentId, teacherName, teachersId, status, sectionId, bumpSidebar, router, backHref]
  )

  if (loading) {
    // Mirror the loaded layout: full-width document page.
    return (
      <div className="flex w-full flex-1 flex-col gap-6 bg-white p-4 md:p-6 dark:bg-background">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="min-h-96 w-full flex-1" />
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
  // "Unread" keeps the meaning it has everywhere else in the admin UI: the
  // student hasn't read that teacher comment yet.
  const unreadFeedback = comments.filter((c) => !c.isOld && !c.isStudentReply).length

  return (
    <div className="w-full flex-1 bg-white p-4 md:p-6 dark:bg-background">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{question.field_label}</h1>
        {question.detailed_instructions && (
          <p className="text-muted-foreground whitespace-pre-wrap text-sm">{question.detailed_instructions}</p>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <BackButton href={backHref} />
        <div className="flex items-center gap-2">
          {canAnnotate && (
            <Button
              variant="outline"
              size="sm"
              className="relative gap-1.5"
              onClick={() => setCommentsOpen(true)}
            >
              <HugeiconsIcon icon={Comment01Icon} strokeWidth={2} className="size-4" />
              Comments
              {commentCounts.open > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-gray-400 text-[9px] font-bold text-white">
                  {commentCounts.open}
                </span>
              )}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="relative gap-1.5"
            onClick={() => setFeedbackOpen(true)}
          >
            <HugeiconsIcon icon={Comment01Icon} strokeWidth={2} className="size-4" />
            Feedback
            {unreadFeedback > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-blue-500 text-[9px] font-bold text-white">
                {unreadFeedback}
              </span>
            )}
          </Button>
          {fieldVersions.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setHistoryOpen(true)}
            >
              <HugeiconsIcon icon={Clock01Icon} strokeWidth={2} className="size-4" />
              History
            </Button>
          )}
        </div>
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
            commentsSheetOpen={commentsOpen}
            onCommentsSheetOpenChange={setCommentsOpen}
            showCommentsButton={false}
            onCommentCounts={handleCommentCounts}
            comments={{
              commentsEndpoint: cfg.commentsEndpoint,
              sectionIdField: F.sectionId,
              studentId,
              sectionId,
              fieldName: question.field_name,
              templateId: question.id,
              templateIdField: F.templateId,
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
              className="flex-1 gap-1.5 bg-white dark:bg-transparent"
              disabled={acting}
              onClick={() => {
                setRevisionNote("")
                setRevisionOpen(true)
              }}
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

      {/* Overall feedback thread, separate from the anchored inline comments. */}
      <Sheet open={feedbackOpen} onOpenChange={setFeedbackOpen}>
        <SheetContent className="flex flex-col gap-0 p-0 sm:max-w-md">
          <SheetHeader className="shrink-0 border-b px-6 py-4">
            <SheetTitle className="text-base">Overall feedback</SheetTitle>
            <SheetDescription className="sr-only">
              Feedback thread for this essay
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <FieldActivityStream
              comments={comments}
              events={events.filter((e) => eventMatchesQuestion(e, question.field_name, questionId, F.templateId))}
              resolvedThreads={resolvedThreads}
              viewer="teacher"
              onDelete={handleDelete}
              scrollToLatest
            />
          </div>
          <div className="shrink-0 border-t px-4 py-3">
            <CommentComposer onSubmit={(text) => postComment(text, false)} />
          </div>
        </SheetContent>
      </Sheet>

      {/* Version history: a list of snapshots; opening one widens the sheet
          into a full read-only view of that version of the essay. */}
      <Sheet
        open={historyOpen}
        onOpenChange={(o) => {
          setHistoryOpen(o)
          if (!o) {
            setOpenVersion(null)
            setConfirmRestore(false)
          }
        }}
      >
        <SheetContent
          className={cn(
            "flex flex-col gap-0 p-0 transition-all",
            // A full essay needs real width: nearly the whole viewport. The
            // width override must carry the same data-[side] variant the base
            // sheet uses, or its w-3/4 wins on specificity.
            openVersion
              ? "data-[side=right]:w-[95vw] sm:max-w-[85vw]"
              : "sm:max-w-md"
          )}
        >
          <SheetHeader className="shrink-0 border-b px-6 py-4">
            {openVersion ? (
              // Title row only — the restore action lives with the meta line
              // below, clear of the sheet's close button.
              <div className="flex min-w-0 items-center gap-2 pr-8">
                <button
                  type="button"
                  onClick={() => {
                    setOpenVersion(null)
                    setConfirmRestore(false)
                  }}
                  className="text-muted-foreground hover:text-foreground inline-flex size-7 shrink-0 items-center justify-center rounded-md border"
                  title="Back to version list"
                >
                  ←
                </button>
                <SheetTitle className="truncate text-base">
                  {REASON_LABEL[openVersion.reason]?.label ?? openVersion.reason}
                </SheetTitle>
              </div>
            ) : (
              <SheetTitle className="text-base">Version history</SheetTitle>
            )}
            <SheetDescription className="sr-only">
              Saved snapshots of this essay
            </SheetDescription>
          </SheetHeader>

          {openVersion ? (
            <div className="flex-1 overflow-y-auto bg-white dark:bg-background">
              <div className="flex flex-wrap items-center gap-3 border-b px-6 py-2 sm:px-12 lg:px-24">
                <p className="text-muted-foreground text-xs">
                  {formatVersionDate(openVersion.created_at)}
                  {openVersion.actor_name && <> · {openVersion.actor_name}</>}
                  {openVersion.wordCount != null && <> · {openVersion.wordCount} words</>}
                </p>
                {confirmRestore ? (
                  <span className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      disabled={restoring}
                      onClick={() => setConfirmRestore(false)}
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
                        await restoreVersion(openVersion)
                        setRestoring(false)
                        setHistoryOpen(false)
                        setOpenVersion(null)
                        setConfirmRestore(false)
                      }}
                    >
                      {restoring ? "Restoring…" : "Confirm restore"}
                    </Button>
                  </span>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 bg-white text-xs dark:bg-transparent"
                    onClick={() => setConfirmRestore(true)}
                  >
                    Restore this version
                  </Button>
                )}
              </div>
              {/* Same page margins and prose size as the editor, no card
                  frame — the snapshot reads exactly like the essay itself. */}
              <div className="px-6 py-10 sm:px-12 lg:px-24">
                <RichTextDisplay raw={openVersion.student_response} fullSize />
              </div>
            </div>
          ) : (
            <div className="flex-1 divide-y overflow-y-auto">
              {[...fieldVersions]
                .sort((a, b) => vts(b.created_at) - vts(a.created_at))
                .map((v, i) => {
                  const meta = REASON_LABEL[v.reason] ?? {
                    label: String(v.reason),
                    cls: "text-muted-foreground",
                  }
                  return (
                    <button
                      key={String(v.id ?? `${v.reason}-${vts(v.created_at)}-${i}`)}
                      type="button"
                      onClick={() => setOpenVersion(v)}
                      className="hover:bg-muted/40 block w-full px-6 py-3 text-left transition-colors"
                    >
                      <p className="text-sm">
                        <span className={cn("font-medium", meta.cls)}>{meta.label}</span>
                        {v.actor_name && (
                          <span className="text-muted-foreground"> &middot; {v.actor_name}</span>
                        )}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {formatVersionDate(v.created_at)}
                        {v.wordCount != null ? ` · ${v.wordCount} words` : ""}
                        {" · click to view the full essay"}
                      </p>
                    </button>
                  )
                })}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Returning for revision requires a note — the student needs to know
          what to fix, so the confirmation can't be skipped past. */}
      <Dialog open={revisionOpen} onOpenChange={(o) => { if (!acting) setRevisionOpen(o) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Return for revision?</DialogTitle>
            <DialogDescription>
              {studentName ? `${studentName} will` : "The student will"} see this
              essay reopened with your note attached as revision feedback. A note
              is required.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={revisionNote}
            onChange={(e) => setRevisionNote(e.target.value)}
            placeholder="What needs to change before resubmitting…"
            rows={4}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" disabled={acting} onClick={() => setRevisionOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="outline"
              className="gap-1.5 bg-white dark:bg-transparent"
              disabled={acting || !revisionNote.trim()}
              onClick={async () => {
                await applyAction("revision", revisionNote)
                setRevisionOpen(false)
              }}
            >
              <HugeiconsIcon icon={ArrowTurnBackwardIcon} strokeWidth={2} className="size-4" />
              {acting ? "Returning…" : "Return for revision"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
