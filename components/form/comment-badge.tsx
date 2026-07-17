"use client"

import { useState } from "react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { HugeiconsIcon } from "@hugeicons/react"
import { Comment01Icon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { getWordCount } from "@/lib/form-types"
import type { Comment } from "@/lib/form-types"
import { FieldActivityStream } from "./field-activity-stream"

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

interface ResponseStatus {
  isComplete?: boolean
  revisionNeeded?: boolean
  readyReview?: boolean
}

interface CommentBadgeProps {
  fieldName: string
  fieldLabel: string
  fieldValue?: string
  minWords?: number
  comments: Comment[]
  onMarkRead?: (commentIds: number[]) => void
  plagiarism?: PlagiarismData
  responseStatus?: ResponseStatus | null
  lastEdited?: string | number | null
  /** Post a student reply; resolve true when it persisted (backend flag intact). */
  onReply?: (fieldName: string, note: string) => Promise<boolean>
}

export function CommentBadge({
  fieldName,
  fieldLabel,
  fieldValue,
  minWords,
  comments,
  onMarkRead,
  plagiarism,
  responseStatus,
  lastEdited,
  onReply,
}: CommentBadgeProps) {
  const [open, setOpen] = useState(false)
  const [reply, setReply] = useState("")
  const [sending, setSending] = useState(false)
  const [replyError, setReplyError] = useState<string | null>(null)

  const fieldComments = comments
    .filter((c) => c.field_name === fieldName && !c.isComplete)
    .sort((a, b) => parseTimestamp(b.created_at) - parseTimestamp(a.created_at))

  if (fieldComments.length === 0) return null

  const unreadCount = fieldComments.filter((c) => !c.isOld && !c.isStudentReply).length
  const hasUnread = unreadCount > 0

  const handleMarkSingleRead = (commentId: number) => {
    if (onMarkRead) onMarkRead([commentId])
  }

  const handleSendReply = async () => {
    if (!reply.trim() || !onReply) return
    setSending(true)
    setReplyError(null)
    try {
      const ok = await onReply(fieldName, reply.trim())
      if (ok) {
        setReply("")
      } else {
        setReplyError("Couldn't post your reply — please try again or ask your teacher.")
      }
    } finally {
      setSending(false)
    }
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
            <SheetTitle className="text-base">Activity</SheetTitle>
            <SheetDescription className="sr-only">
              Teacher feedback and review activity for {fieldLabel}
            </SheetDescription>
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

            <div className="px-6 py-4">
              <FieldActivityStream
                comments={fieldComments}
                viewer="student"
                responseStatus={responseStatus}
                lastEdited={lastEdited}
                onMarkRead={handleMarkSingleRead}
                autoMarkRead
                scrollToLatest={open}
              />
            </div>
          </div>

          {onReply && (
            <div className="border-t px-6 py-4">
              <div className="space-y-2">
                <Textarea
                  placeholder="Reply to your teacher..."
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && reply.trim() && !sending) {
                      e.preventDefault()
                      handleSendReply()
                    }
                  }}
                  rows={2}
                />
                {replyError && <p className="text-xs text-red-600">{replyError}</p>}
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={handleSendReply}
                    disabled={!reply.trim() || sending}
                  >
                    {sending ? "Sending..." : "Reply"}
                  </Button>
                </div>
              </div>
            </div>
          )}
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
