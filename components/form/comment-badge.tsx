"use client"

import { useState } from "react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Comment01Icon,
  CheckmarkCircle02Icon,
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

interface PlagiarismData {
  class_probability_ai?: number
  class_probability_human?: number
  mixed?: number
  [key: string]: unknown
}

function toPercent(val: unknown): number {
  const n = typeof val === "string" ? parseFloat(val) : typeof val === "number" ? val : 0
  if (isNaN(n)) return 0
  return n <= 1 ? Math.round(n * 100) : Math.round(n)
}

interface CommentBadgeProps {
  fieldName: string
  fieldLabel: string
  fieldValue?: string
  minWords?: number
  comments: Comment[]
  onMarkRead?: (commentIds: number[]) => void
  plagiarism?: PlagiarismData
}

export function CommentBadge({
  fieldName,
  fieldLabel,
  fieldValue,
  minWords,
  comments,
  onMarkRead,
  plagiarism,
}: CommentBadgeProps) {
  const [open, setOpen] = useState(false)

  const fieldComments = comments
    .filter((c) => c.field_name === fieldName && !c.isComplete)
    .sort((a, b) => parseTimestamp(b.created_at) - parseTimestamp(a.created_at))

  if (fieldComments.length === 0) return null

  const unreadCount = fieldComments.filter((c) => !c.isOld).length
  const hasUnread = unreadCount > 0

  const handleMarkSingleRead = (commentId: number) => {
    if (onMarkRead) onMarkRead([commentId])
  }

  const displayAnswer = fieldValue && fieldValue !== "—" && fieldValue !== "" ? fieldValue : null
  const wordCount = displayAnswer && minWords ? getWordCount(displayAnswer) : null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative inline-flex size-6 items-center justify-center rounded-full transition-colors hover:bg-accent"
      >
        <HugeiconsIcon
          icon={Comment01Icon}
          strokeWidth={2}
          className={cn(
            "size-4",
            hasUnread ? "text-blue-500" : "text-muted-foreground/50"
          )}
        />
        {hasUnread && (
          <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-blue-500 ring-2 ring-white" />
        )}
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="flex flex-col gap-0 p-0 sm:max-w-md">
          <SheetHeader className="border-b px-6 py-4">
            <SheetTitle className="text-base">Teacher Comments</SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto">
            <div className="space-y-1 px-6 py-4">
              <p className="text-sm font-semibold">{fieldLabel}</p>
              {displayAnswer ? (
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{displayAnswer}</p>
              ) : (
                <p className="text-muted-foreground/50 text-sm italic">No response</p>
              )}
              {wordCount !== null && minWords && (
                <p className="text-muted-foreground/60 text-xs">
                  {wordCount} / {minWords} words
                </p>
              )}
              {plagiarism && <PlagiarismScoresInline data={plagiarism} />}
            </div>
            <Separator />

            <div className="space-y-2 px-6 py-4">
              {fieldComments.map((comment, i) => {
                const isRead = !!comment.isOld
                const createdDate = comment.created_at
                  ? new Date(parseTimestamp(comment.created_at))
                  : null
                const readTime = comment.isRead
                  ? getRelativeTime(new Date(typeof comment.isRead === "number" ? comment.isRead : new Date(comment.isRead as string).getTime()))
                  : null

                return (
                  <div
                    key={comment.id ?? i}
                    className={cn(
                      "relative rounded-md border p-3 text-sm",
                      isRead && "bg-muted/50"
                    )}
                  >
                    {!isRead && comment.id != null && onMarkRead && (
                      <button
                        type="button"
                        onClick={() => handleMarkSingleRead(comment.id!)}
                        className="absolute right-2 top-2 inline-flex size-6 items-center justify-center rounded transition-colors text-muted-foreground/40 hover:text-green-600 hover:bg-accent"
                        title="Mark as read"
                      >
                        <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} className="size-4" />
                      </button>
                    )}
                    <p className={cn("whitespace-pre-wrap", !isRead && "pr-7")}>{comment.note}</p>
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
                  </div>
                )
              })}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

function PlagiarismScoresInline({ data }: { data: PlagiarismData }) {
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
