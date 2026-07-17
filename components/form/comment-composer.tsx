"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

/**
 * Self-contained comment box: keystrokes stay in local state so typing never
 * re-renders the (heavy) page or sheet around it. The current draft is
 * mirrored into `draftRef` for actions that submit it out-of-band — e.g.
 * "Request revision" sending the typed feedback along with the status change.
 */
export function CommentComposer({
  onSubmit,
  draftRef,
  placeholder = "Add a comment…",
  buttonLabel = "Post comment",
}: {
  /** Post the note; resolve true to clear the box. */
  onSubmit: (note: string) => Promise<boolean>
  draftRef?: React.MutableRefObject<string>
  placeholder?: string
  buttonLabel?: string
}) {
  const [note, setNote] = useState("")
  const [posting, setPosting] = useState(false)

  const update = (v: string) => {
    setNote(v)
    if (draftRef) draftRef.current = v
  }

  const post = async () => {
    if (!note.trim() || posting) return
    setPosting(true)
    try {
      const ok = await onSubmit(note.trim())
      if (ok) update("")
    } finally {
      setPosting(false)
    }
  }

  return (
    <div>
      <Textarea
        placeholder={placeholder}
        value={note}
        onChange={(e) => update(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && note.trim() && !posting) {
            e.preventDefault()
            post()
          }
        }}
        rows={2}
      />
      <div className="mt-2 flex justify-end">
        <Button size="sm" variant="outline" onClick={post} disabled={!note.trim() || posting}>
          {posting ? "Posting…" : buttonLabel}
        </Button>
      </div>
    </div>
  )
}
