"use client"

import { useEffect, useRef, useState } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Marker, MarkerContent, MarkerIcon } from "@/components/ui/marker"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  AlertCircleIcon,
  CheckmarkCircle02Icon,
  CircleIcon,
  Delete02Icon,
  SentIcon,
} from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import type { Comment } from "@/lib/form-types"

function parseTimestamp(ts: string | number | undefined | null): number {
  if (!ts) return 0
  if (typeof ts === "number") return ts
  if (/^\d+$/.test(ts)) return Number(ts)
  return new Date(ts).getTime()
}

function getRelativeTime(ms: number): string {
  const diff = Math.floor((Date.now() - ms) / 1000)
  if (diff < 5) return "just now"
  if (diff < 60) return `${diff}s ago`
  const mins = Math.floor(diff / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(ms).toLocaleDateString()
}

function dayLabel(ms: number): string {
  const d = new Date(ms)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return "Today"
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday"
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

interface ResponseStatus {
  isComplete?: boolean
  revisionNeeded?: boolean
  readyReview?: boolean
}

/**
 * Chat-style activity stream for one input: teacher comments and student
 * replies as bubbles, revision requests as inline markers, date separators,
 * and the response's current submission state pinned at the end.
 *
 * The response tables only store the *current* state (no event log), so past
 * submissions/approvals appear indirectly via revision-feedback comments; the
 * terminal marker always reflects where the input stands right now.
 */
export function FieldActivityStream({
  comments,
  viewer,
  responseStatus,
  lastEdited,
  onDelete,
  onMarkRead,
  scrollToLatest = false,
  className,
}: {
  /** Comments already scoped to this field. */
  comments: Comment[]
  viewer: "teacher" | "student"
  /** Pass to pin the current submission state at the end; omit to hide it. */
  responseStatus?: ResponseStatus | null
  lastEdited?: string | number | null
  /** Teacher-side: delete a comment (confirmation handled here). */
  onDelete?: (commentId: number) => Promise<void>
  /** Student-side: mark an unread teacher comment as read. */
  onMarkRead?: (commentId: number) => void
  /** Scroll the newest comment into view on open and when one is added. */
  scrollToLatest?: boolean
  className?: string
}) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState(false)

  const sorted = [...comments].sort(
    (a, b) => parseTimestamp(a.created_at) - parseTimestamp(b.created_at)
  )

  // Land on the most recent comment when the thread opens (and follow new ones).
  const bottomRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (scrollToLatest && sorted.length > 0) {
      bottomRef.current?.scrollIntoView({ block: "end" })
    }
  }, [scrollToLatest, sorted.length])

  const handleConfirmDelete = async () => {
    if (confirmDeleteId == null || !onDelete) return
    setDeleting(true)
    try {
      await onDelete(confirmDeleteId)
    } finally {
      setDeleting(false)
      setConfirmDeleteId(null)
    }
  }

  let lastDay = ""

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {sorted.length === 0 && (
        <p className="text-muted-foreground py-4 text-center text-sm">No comments yet.</p>
      )}

      {sorted.map((c) => {
        const ts = parseTimestamp(c.created_at)
        const day = ts ? dayLabel(ts) : ""
        const showDay = day && day !== lastDay
        if (showDay) lastDay = day

        const isStudentAuthored = c.isStudentReply === true
        // "Own" messages sit on the right, like any chat app.
        const own = viewer === "teacher" ? !isStudentAuthored : isStudentAuthored
        // All comments read as light-gray bubbles with dark text; a revision
        // is a light bubble with red text and a thin red border, not a solid
        // red block. Alignment + author name distinguish sender.
        const isRevision = c.isRevisionFeedback === true
        const variant = isRevision ? "outline" : own ? "secondary" : "muted"
        const align = own ? "end" : "start"
        const authorName = c.teacher_name || (isStudentAuthored ? "Student" : "Teacher")
        const unreadForStudent = viewer === "student" && !isStudentAuthored && !c.isOld
        const readTime = c.isRead
          ? getRelativeTime(
              typeof c.isRead === "number" ? c.isRead : new Date(c.isRead as string).getTime()
            )
          : null

        return (
          <div key={c.id ?? `${c.field_name}-${ts}`} className="flex flex-col gap-1">
            {showDay && (
              <Marker variant="separator" className="my-1">
                <MarkerContent>{day}</MarkerContent>
              </Marker>
            )}

            {c.isRevisionFeedback && (
              <Marker className={cn(align === "end" && "justify-end")}>
                <MarkerIcon>
                  <HugeiconsIcon icon={AlertCircleIcon} strokeWidth={2} className="text-red-500" />
                </MarkerIcon>
                <MarkerContent className="font-medium text-red-600">Revision requested</MarkerContent>
              </Marker>
            )}

            <Bubble variant={variant} align={align} className="group/bubble">
              <BubbleContent
                className={cn(
                  // Revision reads as a light bubble with a red border only —
                  // the text stays black like every other comment.
                  isRevision && "border-red-300 bg-gray-50 dark:border-red-400/40 dark:bg-muted/40"
                )}
              >
                {c.note}
              </BubbleContent>
              <div
                className={cn(
                  "text-muted-foreground mt-1 flex items-center gap-1.5 text-[11px]",
                  align === "end" && "flex-row-reverse"
                )}
              >
                <span className="font-medium">{authorName}</span>
                {ts > 0 && (
                  <>
                    <span>&middot;</span>
                    <span>{getRelativeTime(ts)}</span>
                  </>
                )}
                {viewer === "teacher" && readTime && (
                  <>
                    <span>&middot;</span>
                    <span>Read {readTime}</span>
                  </>
                )}
                {viewer === "teacher" && onDelete && c.id != null && (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(c.id!)}
                    className="text-muted-foreground/40 inline-flex size-4 items-center justify-center rounded transition-colors hover:bg-red-50 hover:text-red-500 md:opacity-0 md:group-hover/bubble:opacity-100"
                    title="Delete"
                  >
                    <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} className="size-3" />
                  </button>
                )}
                {unreadForStudent && onMarkRead && c.id != null && (
                  <>
                    <span className="size-1.5 rounded-full bg-blue-500" aria-hidden />
                    <button
                      type="button"
                      onClick={() => onMarkRead(c.id!)}
                      className="font-medium text-blue-600 transition-colors hover:text-blue-700"
                    >
                      Mark read
                    </button>
                  </>
                )}
              </div>
            </Bubble>
          </div>
        )
      })}

      {responseStatus && <CurrentStatusMarker status={responseStatus} lastEdited={lastEdited} />}

      {/* Scroll target for "jump to the newest comment on open". */}
      <div ref={bottomRef} aria-hidden />

      <AlertDialog
        open={confirmDeleteId != null}
        onOpenChange={(open) => {
          if (!open) setConfirmDeleteId(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete comment?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this comment. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function CurrentStatusMarker({
  status,
  lastEdited,
}: {
  status: ResponseStatus
  lastEdited?: string | number | null
}) {
  const editedMs = parseTimestamp(lastEdited)
  const editedRel = editedMs > 0 ? getRelativeTime(editedMs) : null

  let icon = CircleIcon
  let iconClass = "text-muted-foreground/50"
  let label = "Not submitted"
  let labelClass = ""

  if (status.isComplete) {
    icon = CheckmarkCircle02Icon
    iconClass = "text-green-600"
    label = "Approved"
    labelClass = "font-medium text-green-700"
  } else if (status.revisionNeeded) {
    icon = AlertCircleIcon
    iconClass = "text-red-500"
    label = "Awaiting resubmission"
    labelClass = "font-medium text-red-600"
  } else if (status.readyReview) {
    icon = SentIcon
    iconClass = "text-blue-500"
    label = editedRel ? `Submitted for review · ${editedRel}` : "Submitted for review"
    labelClass = "font-medium text-blue-600"
  }

  return (
    <Marker variant="separator" className="mt-1" role="status">
      <MarkerIcon>
        <HugeiconsIcon icon={icon} strokeWidth={2} className={iconClass} />
      </MarkerIcon>
      <MarkerContent className={labelClass}>{label}</MarkerContent>
    </Marker>
  )
}
