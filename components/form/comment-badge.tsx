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
import { Comment01Icon } from "@hugeicons/core-free-icons"
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

interface CommentBadgeProps {
  fieldName: string
  fieldLabel: string
  fieldValue?: string
  minWords?: number
  comments: Comment[]
  onMarkRead?: (commentIds: number[]) => void
}

export function CommentBadge({
  fieldName,
  fieldLabel,
  fieldValue,
  minWords,
  comments,
  onMarkRead,
}: CommentBadgeProps) {
  const [open, setOpen] = useState(false)

  const fieldComments = comments
    .filter((c) => c.field_name === fieldName && !c.isComplete)
    .sort((a, b) => parseTimestamp(b.created_at) - parseTimestamp(a.created_at))

  if (fieldComments.length === 0) return null

  const hasUnread = fieldComments.some((c) => !c.isOld)

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen)
    if (isOpen && hasUnread && onMarkRead) {
      const unreadIds = fieldComments
        .filter((c) => !c.isOld && c.id)
        .map((c) => c.id!)
      if (unreadIds.length > 0) onMarkRead(unreadIds)
    }
  }

  const displayAnswer = fieldValue && fieldValue !== "—" && fieldValue !== "" ? fieldValue : null
  const wordCount = displayAnswer && minWords ? getWordCount(displayAnswer) : null
  const showAnswerBlock = displayAnswer || minWords

  return (
    <>
      <button
        type="button"
        onClick={() => handleOpen(true)}
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

      <Sheet open={open} onOpenChange={handleOpen}>
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
              {fieldComments.map((comment, i) => {
                const createdDate = comment.created_at
                  ? new Date(parseTimestamp(comment.created_at))
                  : null

                return (
                  <div
                    key={comment.id ?? i}
                    className={cn(
                      "rounded-md border p-3 text-sm",
                      !comment.isOld && "border-blue-200 bg-blue-50"
                    )}
                  >
                    <p className="whitespace-pre-wrap">{comment.note}</p>
                    <div className="text-muted-foreground mt-2 flex items-center gap-1.5 text-xs">
                      {createdDate && <span>{getRelativeTime(createdDate)}</span>}
                      {createdDate && comment.teacher_name && <span>&middot;</span>}
                      {comment.teacher_name && (
                        <span className="font-medium">{comment.teacher_name}</span>
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
