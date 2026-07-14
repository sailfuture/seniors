"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { HugeiconsIcon } from "@hugeicons/react"
import { CheckmarkCircle02Icon, Cancel01Icon } from "@hugeicons/core-free-icons"
import type { Comment } from "@/lib/form-types"
import { FieldActivityStream } from "./field-activity-stream"

/**
 * A floating card anchored near a comment highlight showing that thread's
 * messages plus a composer. Used for both a brand-new thread (empty, compose
 * the first message) and an existing one (reply / mark read / resolve).
 */
export function CommentThreadPopover({
  anchor,
  comments,
  viewer,
  isNew,
  onSend,
  onMarkRead,
  onResolve,
  onClose,
}: {
  anchor: { x: number; y: number }
  comments: Comment[]
  viewer: "teacher" | "student"
  isNew: boolean
  onSend: (note: string) => Promise<boolean>
  onMarkRead?: (commentId: number) => void
  onResolve?: () => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [note, setNote] = useState("")
  const [sending, setSending] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener("keydown", onKey)
    // Defer so the opening click doesn't immediately close it.
    const t = setTimeout(() => document.addEventListener("mousedown", onDown), 0)
    return () => {
      document.removeEventListener("keydown", onKey)
      document.removeEventListener("mousedown", onDown)
      clearTimeout(t)
    }
  }, [onClose])

  const send = async () => {
    if (!note.trim()) return
    setSending(true)
    const ok = await onSend(note.trim())
    setSending(false)
    if (ok) setNote("")
  }

  // Clamp to the viewport (card is ~320px wide).
  const width = 320
  const left = Math.max(8, Math.min(anchor.x, window.innerWidth - width - 8))
  const top = Math.min(anchor.y + 6, window.innerHeight - 220)

  return (
    <div
      ref={ref}
      style={{ position: "fixed", left, top, width }}
      className="bg-popover text-popover-foreground z-50 flex max-h-[60vh] flex-col rounded-lg border shadow-lg"
    >
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide">
          {isNew ? "New comment" : "Comment"}
        </span>
        <div className="flex items-center gap-1">
          {onResolve && !isNew && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1 px-1.5 text-[11px] text-green-700 hover:bg-green-50 hover:text-green-800"
              onClick={onResolve}
              title="Resolve and remove the highlight"
            >
              <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} className="size-3.5" />
              Resolve
            </Button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground inline-flex size-6 items-center justify-center rounded"
            title="Close"
          >
            <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} className="size-3.5" />
          </button>
        </div>
      </div>

      {comments.length > 0 && (
        <div className="flex-1 overflow-y-auto px-3 py-2">
          <FieldActivityStream comments={comments} viewer={viewer} onMarkRead={onMarkRead} />
        </div>
      )}

      <div className="border-t px-3 py-2">
        <Textarea
          autoFocus
          placeholder={isNew ? "Write a comment…" : "Reply…"}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && note.trim() && !sending) {
              e.preventDefault()
              send()
            }
          }}
          rows={2}
          className="text-sm"
        />
        <div className="mt-2 flex justify-end">
          <Button size="sm" className="h-7 text-xs" onClick={send} disabled={!note.trim() || sending}>
            {sending ? "Sending…" : isNew ? "Comment" : "Reply"}
          </Button>
        </div>
      </div>
    </div>
  )
}
