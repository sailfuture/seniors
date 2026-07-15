"use client"

import { useCallback, useRef, useState } from "react"
import { RichTextEditor, type RichTextCommentConfig } from "./rich-text-editor"
import { extractPlainText } from "@/lib/rich-text"

/**
 * Teacher-facing editor for a student's rich-text essay: full inline editing
 * plus anchored comment threads, with every open thread listed below the
 * document (including the student's replies). Edits and highlights persist to
 * student_response — but deliberately leave last_edited/wordCount alone, since
 * a teacher's touch is not a student edit and must not reorder the review
 * queue.
 *
 * The teacher writes to the same field the student edits; the callers only
 * mount this once the essay is locked for review (submitted or approved), so
 * a teacher save can never clobber a live student draft.
 */
export function TeacherEssayAnnotator({
  initialValue,
  patchUrl,
  comments,
  bodyClassName,
  onFirstProseEdit,
}: {
  initialValue: string
  /** Full URL of the response to PATCH, e.g. `${responsePatchBase}/${id}`. */
  patchUrl: string
  comments: RichTextCommentConfig
  /** Page margins around the document body. */
  bodyClassName?: string
  /** Fires once, with the pristine student text, just before the teacher's
   *  first prose edit — so a snapshot can preserve the original. Highlight-only
   *  changes don't trigger it. */
  onFirstProseEdit?: (original: string) => void
}) {
  const [value, setValue] = useState(initialValue)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latest = useRef(initialValue)
  const savedProse = useRef(extractPlainText(initialValue))
  const snapshotted = useRef(false)

  const persist = useCallback(async () => {
    try {
      await fetch(patchUrl, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_response: latest.current }),
      })
    } catch {
      /* best-effort; the highlight stays locally until the next change */
    }
  }, [patchUrl])

  const handleChange = useCallback(
    (v: string) => {
      // Preserve the student's original prose right before the teacher's first
      // real edit (adding a highlight leaves the prose unchanged and is skipped).
      if (!snapshotted.current && extractPlainText(v) !== savedProse.current) {
        snapshotted.current = true
        onFirstProseEdit?.(initialValue)
      }
      setValue(v)
      latest.current = v
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(persist, 600)
    },
    [persist, onFirstProseEdit, initialValue]
  )

  // No overflow-hidden on the editor container: an overflow ancestor would
  // become the sticky toolbar's scrollport and stop it pinning to the viewport.
  return (
    <RichTextEditor
      className="rounded-lg border bg-white dark:bg-card"
      value={value}
      onChange={handleChange}
      minHeightClass="min-h-0"
      bodyClassName={bodyClassName}
      comments={comments}
      showThreadList
    />
  )
}
