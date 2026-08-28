"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { commentMatchesQuestion } from "@/lib/form-types"
import type { Comment } from "@/lib/form-types"

/** Opaque id shared by a highlight's `comment` mark and its thread's rows. */
export function generateThreadId(): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 12)
      : Math.random().toString(36).slice(2, 14)
  return `t_${rand}`
}

export interface InlineThread {
  threadId: string
  comments: Comment[]
  resolved: boolean
  /** Latest activity, for ordering / unread checks. */
  lastAt: number
}

interface UseInlineCommentsArgs {
  commentsEndpoint: string
  /** e.g. "lifemap_sections_id" — the section FK on the comments table. */
  sectionIdField: string
  studentId: string | null | undefined
  sectionId: number
  /** Question this essay belongs to; threads are scoped to it. */
  fieldName: string
  /** The question's template id — field names can repeat across questions. */
  templateId?: number
  /** FK column name for the template id, e.g. "lifemap_template_id". */
  templateIdField?: string
  viewer: "teacher" | "student"
  authorName: string
  teachersId?: string | null
}

function ts(v: Comment["created_at"]): number {
  if (v == null) return 0
  if (typeof v === "number") return v
  if (/^\d+$/.test(String(v))) return Number(v)
  const p = Date.parse(String(v))
  return isNaN(p) ? 0 : p
}

/**
 * Loads and mutates the inline-comment threads for one rich-text question.
 * Threads live in the same Xano comments table as field/section comments,
 * distinguished by a non-null `thread_id` (which matches a highlight's mark).
 * Reuses the existing authoring conventions: a teacher writes isOld:false
 * (unread for the student); a student reply writes isStudentReply:true.
 */
export function useInlineComments({
  commentsEndpoint,
  sectionIdField,
  studentId,
  sectionId,
  fieldName,
  templateId,
  templateIdField,
  viewer,
  authorName,
  teachersId,
}: UseInlineCommentsArgs) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!studentId) {
      setComments([])
      setLoading(false)
      return
    }
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch(`${commentsEndpoint}?students_id=${studentId}`)
        const data: Comment[] = res.ok ? await res.json() : []
        if (cancelled) return
        // Xano ignores students_id — re-filter. Keep only this field's inline
        // threads (thread_id present, matching field_name).
        setComments(
          data.filter(
            (c) =>
              String(c.students_id ?? "") === String(studentId) &&
              (templateIdField
                ? commentMatchesQuestion(c, fieldName, templateId, templateIdField)
                : c.field_name === fieldName) &&
              !!c.thread_id
          )
        )
      } catch {
        /* leave empty */
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [commentsEndpoint, studentId, fieldName, templateId, templateIdField])

  const threads = useMemo(() => {
    const byId = new Map<string, Comment[]>()
    for (const c of comments) {
      const id = c.thread_id as string
      const arr = byId.get(id) ?? []
      arr.push(c)
      byId.set(id, arr)
    }
    const out = new Map<string, InlineThread>()
    for (const [threadId, list] of byId) {
      const sorted = [...list].sort((a, b) => ts(a.created_at) - ts(b.created_at))
      out.set(threadId, {
        threadId,
        comments: sorted,
        // A thread is resolved once any message flags it complete.
        resolved: sorted.some((c) => c.isComplete),
        lastAt: sorted.reduce((m, c) => Math.max(m, ts(c.created_at)), 0),
      })
    }
    return out
  }, [comments])

  const post = useCallback(
    async (threadId: string, note: string, quote?: string): Promise<Comment | null> => {
      if (!studentId) return null
      const isTeacher = viewer === "teacher"
      const payload: Record<string, unknown> = {
        students_id: studentId,
        teachers_id: isTeacher ? (teachersId ?? null) : null,
        field_name: fieldName,
        [sectionIdField]: sectionId,
        ...(templateIdField && templateId ? { [templateIdField]: templateId } : {}),
        thread_id: threadId,
        // The anchored passage, so the thread stays legible after resolution
        // removes the highlight. Harmless if the column doesn't exist yet.
        ...(quote ? { quote } : {}),
        note,
        // Unread for the *other* party. A student reply is born read by the
        // student; a teacher comment is born unread for the student.
        isOld: false,
        isComplete: false,
        teacher_name: authorName,
        isStudentReply: !isTeacher,
      }
      try {
        const res = await fetch(commentsEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        if (!res.ok) return null
        const created = (await res.json()) as Comment
        // Feature-detect the thread_id column: if Xano dropped it, this reply
        // would be orphaned from its highlight — delete it and fail.
        if (created.thread_id !== threadId) {
          if (created.id) fetch(`${commentsEndpoint}/${created.id}`, { method: "DELETE" }).catch(() => {})
          return null
        }
        // Keep the quote locally even if Xano lacks the column, so the
        // current session still shows it.
        setComments((prev) => [...prev, quote && !created.quote ? { ...created, quote } : created])
        return created
      } catch {
        return null
      }
    },
    [commentsEndpoint, studentId, sectionId, sectionIdField, fieldName, templateId, templateIdField, viewer, authorName, teachersId]
  )

  const createThread = useCallback(
    (note: string): Promise<{ threadId: string; comment: Comment } | null> => {
      const threadId = generateThreadId()
      return post(threadId, note).then((c) => (c ? { threadId, comment: c } : null))
    },
    [post]
  )

  const reply = useCallback(
    (threadId: string, note: string, quote?: string) => post(threadId, note, quote),
    [post]
  )

  /** Delete one message. The caller handles what happens when it was the
   *  thread's last message (removing the now-orphaned highlight). */
  const deleteComment = useCallback(
    async (commentId: number): Promise<boolean> => {
      try {
        const res = await fetch(`${commentsEndpoint}/${commentId}`, { method: "DELETE" })
        if (!res.ok) return false
        setComments((prev) => prev.filter((c) => c.id !== commentId))
        return true
      } catch {
        return false
      }
    },
    [commentsEndpoint]
  )

  const markRead = useCallback(
    async (commentId: number) => {
      const now = new Date().toISOString()
      setComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, isOld: true, isRead: now } : c)))
      try {
        await fetch(`${commentsEndpoint}/${commentId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isOld: true, isRead: now }),
        })
      } catch {
        /* ignore */
      }
    },
    [commentsEndpoint]
  )

  /** Mark every message in a thread complete (resolved). The caller removes
   *  the highlight mark from the document; passing `quote` (captured while the
   *  highlight still exists) backfills it onto the thread's first comment so
   *  older threads keep their passage too. */
  const resolveThread = useCallback(
    async (threadId: string, quote?: string) => {
      const mine = comments
        .filter((c) => c.thread_id === threadId && c.id != null)
        .sort((a, b) => ts(a.created_at) - ts(b.created_at))
      const firstId = mine[0]?.id
      const needsQuote = !!quote && !mine.some((c) => c.quote)
      setComments((prev) =>
        prev.map((c) =>
          c.thread_id === threadId
            ? { ...c, isComplete: true, ...(needsQuote && c.id === firstId ? { quote } : {}) }
            : c
        )
      )
      for (const c of mine) {
        try {
          await fetch(`${commentsEndpoint}/${c.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              isComplete: true,
              ...(needsQuote && c.id === firstId ? { quote } : {}),
            }),
          })
        } catch {
          /* ignore */
        }
      }
    },
    [commentsEndpoint, comments]
  )

  return { threads, loading, createThread, reply, markRead, resolveThread, deleteComment }
}
