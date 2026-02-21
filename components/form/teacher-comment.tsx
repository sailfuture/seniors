"use client"

import { useRef, useState } from "react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
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

interface PlagiarismData {
  class_probability_ai?: number
  class_probability_human?: number
  mixed?: number
  [key: string]: unknown
}

interface TeacherCommentProps {
  fieldName: string
  fieldLabel: string
  fieldValue?: string
  minWords?: number
  comments: Comment[]
  onSubmit: (fieldName: string, note: string) => Promise<void>
  onMarkComplete?: (commentId: number, isComplete: boolean) => Promise<void>
  onDelete: (commentId: number) => Promise<void>
  square?: boolean
  plagiarism?: PlagiarismData
}

export function TeacherComment({
  fieldName,
  fieldLabel,
  fieldValue,
  minWords,
  comments,
  onSubmit,
  onDelete,
  square,
  plagiarism,
}: TeacherCommentProps) {
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const fieldComments = sortByRecent(comments.filter((c) => c.field_name === fieldName))
  const commentCount = fieldComments.filter((c) => !c.isOld).length
  const aiIsHighest = plagiarism ? isAiHighest(plagiarism) : false

  const handleSubmit = async () => {
    if (!note.trim()) return
    setSubmitting(true)
    try {
      await onSubmit(fieldName, note.trim())
      setNote("")
      setOpen(false)
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
        className={cn(
          "relative inline-flex items-center justify-center transition-colors",
          square
            ? "size-8 rounded-md border hover:bg-accent"
            : "size-6 rounded-full hover:bg-accent"
        )}
      >
        <HugeiconsIcon
          icon={Comment01Icon}
          strokeWidth={2}
          className={cn(
            "size-4",
            commentCount > 0 ? "text-gray-500" : "text-muted-foreground/40"
          )}
        />
        {commentCount > 0 && (
          <span className={cn(
            "absolute flex items-center justify-center rounded-full bg-gray-500 font-bold text-white",
            square
              ? "-right-1 -top-1 size-4 text-[10px] font-medium"
              : "-right-0.5 -top-0.5 size-3.5 text-[9px] ring-2 ring-white"
          )}>
            {commentCount}
          </span>
        )}
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="flex flex-col gap-0 p-0 sm:max-w-md">
          <SheetHeader className="border-b px-6 py-4">
            <SheetTitle className="text-base">Teacher Comments</SheetTitle>
            <SheetDescription className="sr-only">
              View and add comments for {fieldLabel}
            </SheetDescription>
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
                  {plagiarism && <PlagiarismDisplay data={plagiarism} />}
                </div>
                <Separator />
              </>
            )}

            <div className="space-y-2 px-6 py-4">
              {fieldComments.length === 0 && (
                <p className="text-muted-foreground py-8 text-center text-sm">
                  No comments yet.
                </p>
              )}

              {fieldComments.map((comment) => (
                <CommentCard
                  key={comment.id}
                  comment={comment}
                  onDelete={onDelete}
                />
              ))}
            </div>
          </div>

          <div className="border-t px-6 py-4">
            <div className="space-y-3">
              <Textarea
                autoFocus
                placeholder="Add a comment..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && note.trim() && !submitting) {
                    e.preventDefault()
                    handleSubmit()
                  }
                }}
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
  onDelete,
}: {
  comment: Comment
  onDelete: (commentId: number) => Promise<void>
}) {
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [exiting, setExiting] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  const handleDelete = () => {
    if (!comment.id) return
    setDeleting(true)
    setConfirmDelete(false)
    setExiting(true)
    setTimeout(async () => {
      await onDelete(comment.id!)
      setDeleting(false)
      setExiting(false)
    }, 250)
  }

  const createdDate = comment.created_at
    ? new Date(parseTimestamp(comment.created_at))
    : null

  const readTime = comment.isRead
    ? getRelativeTime(new Date(typeof comment.isRead === "number" ? comment.isRead : new Date(comment.isRead as string).getTime()))
    : null

  return (
    <div
      ref={cardRef}
      className={cn(
        "relative overflow-hidden rounded-md border p-3 text-sm transition-all duration-200 ease-in-out",
        exiting && "max-h-0 scale-95 border-transparent opacity-0 !mb-0 !p-0"
      )}
      style={exiting ? { marginTop: 0, marginBottom: 0 } : undefined}
    >
      {comment.id && (
        <div className="absolute right-2 top-2">
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

      <p className="whitespace-pre-wrap pr-7">{comment.note}</p>

      <div className="text-muted-foreground mt-2 flex items-center gap-1.5 text-xs">
        {createdDate && <span>{getRelativeTime(createdDate)}</span>}
        {createdDate && comment.teacher_name && <span>&middot;</span>}
        {comment.teacher_name && (
          <span className="font-medium">{comment.teacher_name}</span>
        )}
        {comment.isRevisionFeedback && (
          <>
            <span>&middot;</span>
            <span className="font-semibold text-red-500">Revision</span>
          </>
        )}
        {readTime && (
          <>
            <span>&middot;</span>
            <span className="text-green-600">Read {readTime}</span>
          </>
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

function toPercent(val: unknown): number {
  const n = typeof val === "string" ? parseFloat(val) : typeof val === "number" ? val : 0
  if (isNaN(n)) return 0
  return n <= 1 ? Math.round(n * 100) : Math.round(n)
}

function isAiHighest(data: PlagiarismData): boolean {
  const ai = toPercent(data.class_probability_ai ?? 0)
  const human = toPercent(data.class_probability_human ?? 0)
  const mixed = toPercent(data.mixed ?? 0)
  return ai >= human && ai >= mixed && ai > 0
}

function PlagiarismDisplay({ data }: { data: PlagiarismData }) {
  const ai = toPercent(data.class_probability_ai ?? 0)
  const human = toPercent(data.class_probability_human ?? 0)
  const mixed = toPercent(data.mixed ?? 0)

  const max = Math.max(ai, human, mixed)
  const aiIsMax = ai === max
  const humanIsMax = human === max
  const mixedIsMax = mixed === max && !aiIsMax && !humanIsMax

  return (
    <div className="mt-1 flex items-center gap-2 text-xs">
      <span className={aiIsMax ? "font-bold text-red-600" : "text-muted-foreground"}>
        AI: {ai}%
      </span>
      <span className="text-muted-foreground/40">&bull;</span>
      <span className={humanIsMax ? "font-bold text-green-600" : "text-muted-foreground"}>
        Human: {human}%
      </span>
      <span className="text-muted-foreground/40">&bull;</span>
      <span className={mixedIsMax ? "font-bold text-amber-600" : "text-muted-foreground"}>
        Mixed: {mixed}%
      </span>
    </div>
  )
}
