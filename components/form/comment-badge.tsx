"use client"

import { useState } from "react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Separator } from "@/components/ui/separator"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Comment01Icon,
  CheckmarkCircle02Icon,
  ArrowRight01Icon,
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

  const unread = fieldComments.filter((c) => !c.isOld)
  const read = fieldComments.filter((c) => c.isOld)
  const hasUnread = unread.length > 0

  const handleMarkSingleRead = (commentId: number) => {
    if (onMarkRead) onMarkRead([commentId])
  }

  const displayAnswer = fieldValue && fieldValue !== "—" && fieldValue !== "" ? fieldValue : null
  const wordCount = displayAnswer && minWords ? getWordCount(displayAnswer) : null
  const showAnswerBlock = displayAnswer || minWords

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
              {unread.map((comment, i) => {
                const createdDate = comment.created_at
                  ? new Date(parseTimestamp(comment.created_at))
                  : null

                return (
                  <div
                    key={comment.id ?? i}
                    className="relative rounded-md border border-blue-200 bg-blue-50 p-3 text-sm"
                  >
                    {comment.id != null && onMarkRead && (
                      <button
                        type="button"
                        onClick={() => handleMarkSingleRead(comment.id!)}
                        className="absolute right-2 top-2 inline-flex size-6 items-center justify-center rounded transition-colors text-muted-foreground/40 hover:text-green-600 hover:bg-accent"
                        title="Mark as read"
                      >
                        <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} className="size-4" />
                      </button>
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
                    </div>
                  </div>
                )
              })}

              {read.length > 0 && (
                <Collapsible>
                  <CollapsibleTrigger className="text-muted-foreground hover:text-foreground flex w-full items-center gap-1.5 py-2 text-xs font-medium transition-colors">
                    <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="size-3.5 transition-transform [[data-state=open]>&]:rotate-90" />
                    Read ({read.length})
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="space-y-2 pt-1">
                      {read.map((comment, i) => {
                        const createdDate = comment.created_at
                          ? new Date(parseTimestamp(comment.created_at))
                          : null
                        const readTime = comment.isRead
                          ? getRelativeTime(new Date(typeof comment.isRead === "number" ? comment.isRead : new Date(comment.isRead as string).getTime()))
                          : null

                        return (
                          <div
                            key={comment.id ?? i}
                            className="rounded-md border p-3 text-sm"
                          >
                            <p className="whitespace-pre-wrap">{comment.note}</p>
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
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
