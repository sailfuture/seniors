"use client"

import { useEffect, useState } from "react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Comment01Icon,
  CheckmarkCircle02Icon,
  ArrowTurnBackwardIcon,
} from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { getWordCount } from "@/lib/form-types"
import type { Comment } from "@/lib/form-types"
import { BlurredFitImage } from "./blurred-fit-image"
import { FieldActivityStream } from "./field-activity-stream"

interface PlagiarismData {
  class_probability_ai?: number
  class_probability_human?: number
  mixed?: number
  [key: string]: unknown
}

interface ResponseStatus {
  isComplete?: boolean
  revisionNeeded?: boolean
  readyReview?: boolean
}

interface TeacherCommentProps {
  fieldName: string
  fieldLabel: string
  fieldValue?: string
  imageUrl?: string | null
  minWords?: number
  comments: Comment[]
  onSubmit: (fieldName: string, note: string) => Promise<void>
  onMarkComplete?: (commentId: number, isComplete: boolean) => Promise<void>
  onDelete: (commentId: number) => Promise<void>
  square?: boolean
  plagiarism?: PlagiarismData
  teacherGuideline?: string
  responseStatus?: ResponseStatus | null
  lastEdited?: string | number | null
  /** Called with unseen student-reply ids when the sheet opens, so the
   *  teacher's badge clears once they've looked at the activity. */
  onMarkRepliesSeen?: (commentIds: number[]) => void
  onMarkCompleteAction?: () => void
  onRequestRevision?: () => void
  onClearStatus?: () => void
  onUndoStatus?: () => void
}

export function TeacherComment({
  fieldName,
  fieldLabel,
  fieldValue,
  imageUrl,
  minWords,
  comments,
  onSubmit,
  onDelete,
  square,
  plagiarism,
  teacherGuideline,
  responseStatus,
  lastEdited,
  onMarkRepliesSeen,
  onMarkCompleteAction,
  onRequestRevision,
  onClearStatus,
  onUndoStatus,
}: TeacherCommentProps) {
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const fieldComments = comments.filter((c) => c.field_name === fieldName)
  // Two directions of "unread": teacher comments the student hasn't read yet,
  // and student replies the teacher hasn't seen yet. Both surface in the
  // badge; only the replies are the teacher's own to-do (blue).
  const studentUnreadCount = fieldComments.filter((c) => !c.isOld && !c.isStudentReply).length
  const unseenReplyIds = fieldComments
    .filter((c) => c.isStudentReply && !c.isOld && c.id != null)
    .map((c) => c.id!)
  const commentCount = studentUnreadCount + unseenReplyIds.length
  const hasUnseenReplies = unseenReplyIds.length > 0
  const aiIsHighest = plagiarism ? isAiHighest(plagiarism) : false

  // Opening the sheet counts as the teacher seeing any new replies.
  useEffect(() => {
    if (open && hasUnseenReplies && onMarkRepliesSeen) {
      onMarkRepliesSeen(unseenReplyIds)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

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

  return (
    <>
      <button
        type="button"
        data-comment-trigger
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
            hasUnseenReplies
              ? "text-blue-500"
              : commentCount > 0
                ? "text-gray-500"
                : "text-muted-foreground/40"
          )}
        />
        {commentCount > 0 && (
          <span className={cn(
            "absolute flex items-center justify-center rounded-full font-bold text-white",
            hasUnseenReplies ? "bg-blue-500" : "bg-gray-500",
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
            <SheetTitle className="text-base">Activity</SheetTitle>
            <SheetDescription className="sr-only">
              Comments, submissions, and review activity for {fieldLabel}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto">
            <div className="space-y-3 px-6 py-4">
              <p className="text-sm font-semibold">{fieldLabel}</p>
              {imageUrl ? (
                <a href={imageUrl} target="_blank" rel="noopener noreferrer" className="block">
                  <BlurredFitImage src={imageUrl} alt={fieldLabel} className="rounded-lg border" />
                </a>
              ) : displayAnswer ? (
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{displayAnswer}</p>
              ) : (
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

            {teacherGuideline && (
              <div className="border-b px-6 py-4">
                <p className="text-muted-foreground mb-1 text-xs font-medium uppercase tracking-wide">Teacher Guideline</p>
                <p className="text-sm">{teacherGuideline}</p>
              </div>
            )}

            <div className="px-6 py-4">
              <FieldActivityStream
                comments={fieldComments}
                viewer="teacher"
                responseStatus={responseStatus}
                lastEdited={lastEdited}
                onDelete={onDelete}
                scrollToLatest={open}
              />
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

          {responseStatus && (onMarkCompleteAction || onRequestRevision || onUndoStatus) && (
            <div className="border-t px-6 py-3">
              {/* Current status lives in the activity stream; these are full-width actions. */}
              <div className="flex items-center gap-2">
                {(responseStatus.isComplete || responseStatus.revisionNeeded) && onUndoStatus && (
                  <Button
                    variant="outline"
                    className="flex-1 gap-1.5 bg-white dark:bg-transparent"
                    onClick={() => { onUndoStatus(); setOpen(false) }}
                  >
                    Undo review
                  </Button>
                )}
                {!responseStatus.revisionNeeded && !responseStatus.isComplete && onRequestRevision && (
                  <Button
                    variant="outline"
                    className="flex-1 gap-1.5 border-red-200 bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800"
                    onClick={() => { onRequestRevision() }}
                  >
                    <HugeiconsIcon icon={ArrowTurnBackwardIcon} strokeWidth={2} className="size-4" />
                    Revision
                  </Button>
                )}
                {!responseStatus.isComplete && !responseStatus.revisionNeeded && onMarkCompleteAction && (
                  <Button
                    variant="outline"
                    className="flex-1 gap-1.5 border-green-200 bg-green-50 text-green-700 hover:bg-green-100 hover:text-green-800"
                    onClick={() => { onMarkCompleteAction(); setOpen(false) }}
                  >
                    <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} className="size-4" />
                    Complete
                  </Button>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
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
