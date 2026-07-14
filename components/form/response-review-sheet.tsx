"use client"

import { useCallback, useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowTurnBackwardIcon, CheckmarkCircle02Icon } from "@hugeicons/core-free-icons"
import type { Comment } from "@/lib/form-types"
import type { FormApiConfig } from "@/lib/form-api-config"
import { FieldActivityStream } from "./field-activity-stream"
import { ZoomableImage } from "@/components/zoomable-image"
import { RichTextDisplay } from "./rich-text-display"
import { LineItemsTable } from "@/components/line-items-table"
import { isRichTextQuestion, looksLikeRichTextDoc } from "@/lib/rich-text"
import { isLineItemsQuestion } from "@/lib/line-items"

const IMAGE_UPLOAD = 4

export interface ReviewTarget {
  response: {
    id: number
    student_response?: string
    image_response?: Record<string, unknown> | null
    students_id: string
    isComplete?: boolean
    readyReview?: boolean
    revisionNeeded?: boolean
    last_edited?: number | string | null
  }
  question: {
    id: number
    field_name: string
    field_label: string
    question_types_id?: number | null
  }
  sectionId: number
  sectionTitle: string
  studentName: string
}

function resolveImageUrl(image: Record<string, unknown> | null | undefined): string | null {
  if (!image) return null
  const path = (image.path ?? image.url) as string | undefined
  if (!path) return null
  return path.startsWith("http") ? path : `https://xsc3-mvx7-r86m.n7e.xano.io${path}`
}

/**
 * Review one submission without leaving the queue: shows the response, its
 * comment thread, a composer, and full-width Complete / Request-revision
 * actions. `onReviewed` lets the caller drop the row once it's actioned.
 */
export function ResponseReviewSheet({
  open,
  onOpenChange,
  target,
  apiConfig,
  onReviewed,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  target: ReviewTarget | null
  apiConfig: FormApiConfig
  onReviewed?: (responseId: number, action: "complete" | "revision" | "ready") => void
}) {
  const cfg = apiConfig
  const F = cfg.fields
  const { data: session } = useSession()

  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [note, setNote] = useState("")
  const [posting, setPosting] = useState(false)
  const [acting, setActing] = useState(false)
  const [status, setStatus] = useState({ isComplete: false, readyReview: false, revisionNeeded: false })

  const studentId = target?.response.students_id
  const fieldName = target?.question.field_name

  useEffect(() => {
    if (!open || !target) return
    setStatus({
      isComplete: !!target.response.isComplete,
      readyReview: !!target.response.readyReview,
      revisionNeeded: !!target.response.revisionNeeded,
    })
    setNote("")
    setComments([]) // don't show the previous submission's thread while loading
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const res = await fetch(`${cfg.commentsEndpoint}?students_id=${studentId}`)
        const data: Comment[] = res.ok ? await res.json() : []
        if (cancelled) return
        setComments(
          data.filter(
            (c) =>
              String(c.students_id ?? "") === String(studentId) &&
              c.field_name === fieldName &&
              // Inline essay-comment threads belong to a highlight, not here.
              !c.thread_id
          )
        )
      } catch {
        /* leave empty */
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, target?.response.id])

  const teacherName = session?.user?.name ?? "Teacher"
  const teachersId = ((session?.user as Record<string, unknown>)?.teachers_id as string) ?? null

  const postComment = useCallback(
    async (isRevisionFeedback = false): Promise<boolean> => {
      if (!note.trim() || !target || !studentId) return false
      const payload: Record<string, unknown> = {
        students_id: studentId,
        teachers_id: teachersId,
        field_name: fieldName,
        [F.sectionId]: target.sectionId,
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
    [note, target, studentId, fieldName, teacherName, teachersId, cfg.commentsEndpoint, F.sectionId]
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
      if (!target) return
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
        const res = await fetch(`${cfg.responsePatchBase}/${target.response.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        })
        if (res.ok) {
          const eventName = `${cfg.eventPrefix ?? ""}review-update`
          const wasReady = status.readyReview && !status.isComplete && !status.revisionNeeded
          const nowReady = patch.readyReview
          const wasRevision = status.revisionNeeded
          const nowRevision = patch.revisionNeeded
          if (nowReady !== wasReady) {
            window.dispatchEvent(new CustomEvent(eventName, { detail: { sectionId: target.sectionId, delta: nowReady ? 1 : -1 } }))
          }
          if (nowRevision !== wasRevision) {
            window.dispatchEvent(new CustomEvent(eventName, { detail: { sectionId: target.sectionId, delta: nowRevision ? 1 : -1, type: "revision" } }))
          }
          setStatus(patch)
          onReviewed?.(target.response.id, action)
          onOpenChange(false)
        }
      } finally {
        setActing(false)
      }
    },
    [target, note, postComment, cfg.responsePatchBase, cfg.eventPrefix, status, onReviewed, onOpenChange]
  )

  const typeId = target?.question.question_types_id ?? null
  const value = target?.response.student_response ?? ""
  const imageUrl = typeId === IMAGE_UPLOAD ? resolveImageUrl(target?.response.image_response) : null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle className="text-base">{target?.question.field_label ?? "Review"}</SheetTitle>
          <SheetDescription>
            {target ? `${target.studentName} · ${target.sectionTitle}` : ""}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {/* Response */}
          <div className="border-b px-6 py-4">
            {typeId === IMAGE_UPLOAD ? (
              imageUrl ? (
                <ZoomableImage src={imageUrl} alt={target?.question.field_label ?? ""} className="rounded-lg border" caption={target?.question.field_label} />
              ) : (
                <p className="text-muted-foreground text-sm italic">No image uploaded.</p>
              )
            ) : target && isLineItemsQuestion(target.question) ? (
              <LineItemsTable raw={value} />
            ) : target && (isRichTextQuestion(target.question) || looksLikeRichTextDoc(value)) ? (
              <RichTextDisplay raw={value} showComments />
            ) : (
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{value || "—"}</p>
            )}
          </div>

          {/* Activity */}
          <div className="px-6 py-4">
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-3/4" />
                <Skeleton className="h-10 w-2/3" />
              </div>
            ) : (
              <FieldActivityStream comments={comments} viewer="teacher" onDelete={handleDelete} scrollToLatest />
            )}
          </div>
        </div>

        {/* Composer */}
        <div className="border-t px-6 py-3">
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

        {/* Full-width review actions */}
        <div className="flex items-center gap-2 border-t px-6 py-3">
          {(status.isComplete || status.revisionNeeded) ? (
            <Button variant="outline" className="flex-1 text-muted-foreground" disabled={acting} onClick={() => applyAction("ready")}>
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
      </SheetContent>
    </Sheet>
  )
}
