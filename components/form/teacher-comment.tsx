"use client"

import { useRef, useState } from "react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
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
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Comment01Icon,
  CheckmarkCircle02Icon,
  ArrowTurnBackwardIcon,
  Delete02Icon,
} from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { getWordCount } from "@/lib/form-types"
import type { Comment } from "@/lib/form-types"

function getRelativeTime(date: Date): string {
  const now = Date.now()
  const diff = Math.floor((now - date.getTime()) / 1000)

  if (diff < 5) return "just now"
  if (diff < 60) return `${diff}s ago`
  const mins = Math.floor(diff / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString()
}

function parseTimestamp(ts: string | number | undefined): number {
  if (!ts) return 0
  if (typeof ts === "number") return ts
  if (/^\d+$/.test(ts)) return Number(ts)
  return new Date(ts).getTime()
}

function sortByRecent(list: Comment[]): Comment[] {
  return [...list].sort(
    (a, b) => parseTimestamp(b.created_at) - parseTimestamp(a.created_at)
  )
}

interface TeacherCommentProps {
  fieldName: string
  fieldLabel: string
  fieldValue?: string
  minWords?: number
  comments: Comment[]
  onSubmit: (fieldName: string, note: string) => Promise<void>
  onMarkComplete: (commentId: number, isComplete: boolean) => Promise<void>
  onDelete: (commentId: number) => Promise<void>
}

export function TeacherComment({
  fieldName,
  fieldLabel,
  fieldValue,
  minWords,
  comments,
  onSubmit,
  onMarkComplete,
  onDelete,
}: TeacherCommentProps) {
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [showCompleted, setShowCompleted] = useState(false)

  const fieldComments = comments.filter((c) => c.field_name === fieldName)
  const activeComments = sortByRecent(fieldComments.filter((c) => !c.isComplete))
  const completedComments = sortByRecent(fieldComments.filter((c) => c.isComplete))
  const activeCount = activeComments.length

  const handleSubmit = async () => {
    if (!note.trim()) return
    setSubmitting(true)
    try {
      await onSubmit(fieldName, note.trim())
      setNote("")
    } finally {
      setSubmitting(false)
    }
  }

  const displayAnswer = fieldValue && fieldValue !== "—" && fieldValue !== "" ? fieldValue : null
  const wordCount = displayAnswer && minWords ? getWordCount(displayAnswer) : null
  const showAnswerBlock = displayAnswer || minWords

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hover:bg-accent relative inline-flex size-6 items-center justify-center rounded-full transition-colors"
      >
        <HugeiconsIcon
          icon={Comment01Icon}
          strokeWidth={2}
          className={cn(
            "size-4",
            activeCount > 0 ? "text-blue-500" : "text-muted-foreground/40"
          )}
        />
        {activeCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex size-3.5 items-center justify-center rounded-full bg-blue-500 text-[9px] font-bold text-white ring-2 ring-white">
            {activeCount}
          </span>
        )}
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="flex flex-col gap-0 p-0 sm:max-w-md">
          <SheetHeader className="border-b px-6 py-4">
            <SheetTitle className="text-base">Teacher Comments</SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto">
            {showAnswerBlock && (
              <>
                <div className="space-y-1 px-6 py-4">
                  <p className="text-muted-foreground text-sm">{fieldLabel}</p>
                  {displayAnswer && (
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{displayAnswer}</p>
                  )}
                  {!displayAnswer && (
                    <p className="text-muted-foreground/50 text-sm italic">No response</p>
                  )}
                  {wordCount !== null && minWords && (
                    <p className="text-muted-foreground/60 text-xs">
                      {wordCount} / {minWords} words
                    </p>
                  )}
                </div>
                <Separator />
              </>
            )}

            <div className="space-y-2 px-6 py-4">
              {activeComments.length === 0 && completedComments.length === 0 && (
                <p className="text-muted-foreground py-8 text-center text-sm">
                  No comments yet.
                </p>
              )}

              {activeComments.map((comment) => (
                <CommentCard
                  key={comment.id}
                  comment={comment}
                  onMarkComplete={onMarkComplete}
                  onDelete={onDelete}
                />
              ))}

              {completedComments.length > 0 && (
                <>
                  {activeComments.length > 0 && <Separator className="my-3" />}
                  <button
                    type="button"
                    onClick={() => setShowCompleted(!showCompleted)}
                    className="text-muted-foreground hover:text-foreground w-full text-left text-xs font-medium transition-colors"
                  >
                    {showCompleted ? "Hide" : "Show"} resolved ({completedComments.length})
                  </button>
                  {showCompleted &&
                    completedComments.map((comment) => (
                      <CommentCard
                        key={comment.id}
                        comment={comment}
                        onMarkComplete={onMarkComplete}
                        onDelete={onDelete}
                        completed
                      />
                    ))}
                </>
              )}
            </div>
          </div>

          <div className="border-t px-6 py-4">
            <div className="space-y-3">
              <Textarea
                placeholder="Add a comment..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSubmit}
                  disabled={!note.trim() || submitting}
                >
                  {submitting ? "Posting..." : "Post Comment"}
                </Button>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

function CommentCard({
  comment,
  onMarkComplete,
  onDelete,
  completed = false,
}: {
  comment: Comment
  onMarkComplete: (commentId: number, isComplete: boolean) => Promise<void>
  onDelete: (commentId: number) => Promise<void>
  completed?: boolean
}) {
  const [toggling, setToggling] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [exiting, setExiting] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  const animateOut = (callback: () => Promise<void>) => {
    setExiting(true)
    setTimeout(async () => {
      await callback()
      setExiting(false)
    }, 250)
  }

  const handleToggle = () => {
    if (!comment.id || toggling) return
    setToggling(true)
    animateOut(async () => {
      await onMarkComplete(comment.id!, !completed)
      setToggling(false)
    })
  }

  const handleDelete = () => {
    if (!comment.id) return
    setDeleting(true)
    setConfirmDelete(false)
    animateOut(async () => {
      await onDelete(comment.id!)
      setDeleting(false)
    })
  }

  const createdDate = comment.created_at
    ? new Date(parseTimestamp(comment.created_at))
    : null

  return (
    <div
      ref={cardRef}
      className={cn(
        "relative overflow-hidden rounded-md border p-3 text-sm transition-all duration-200 ease-in-out",
        completed && "bg-muted/40 text-muted-foreground",
        exiting && "max-h-0 scale-95 border-transparent opacity-0 !mb-0 !p-0"
      )}
      style={exiting ? { marginTop: 0, marginBottom: 0 } : undefined}
    >
      {comment.id && (
        <div className="absolute right-2 top-2 flex items-center gap-0.5">
          <button
            type="button"
            onClick={handleToggle}
            disabled={toggling || exiting}
            className={cn(
              "inline-flex size-5 items-center justify-center rounded transition-colors",
              completed
                ? "text-green-500 hover:bg-green-50 hover:text-green-600"
                : "text-muted-foreground/40 hover:bg-accent hover:text-muted-foreground"
            )}
            title={completed ? "Reopen" : "Resolve"}
          >
            <HugeiconsIcon
              icon={completed ? ArrowTurnBackwardIcon : CheckmarkCircle02Icon}
              strokeWidth={2}
              className="size-3.5"
            />
          </button>
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            disabled={deleting || exiting}
            className="inline-flex size-5 items-center justify-center rounded text-muted-foreground/40 transition-colors hover:bg-red-50 hover:text-red-500"
            title="Delete"
          >
            <HugeiconsIcon
              icon={Delete02Icon}
              strokeWidth={2}
              className="size-3.5"
            />
          </button>
        </div>
      )}

      <p className="whitespace-pre-wrap pr-14">{comment.note}</p>

      <div className="text-muted-foreground mt-2 flex items-center gap-1.5 text-xs">
        {createdDate && <span>{getRelativeTime(createdDate)}</span>}
        {createdDate && comment.teacher_name && <span>&middot;</span>}
        {comment.teacher_name && (
          <span className="font-medium">{comment.teacher_name}</span>
        )}
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
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
              onClick={handleDelete}
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
