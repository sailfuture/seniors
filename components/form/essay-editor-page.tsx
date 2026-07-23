"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowLeft02Icon, CheckmarkCircle02Icon, SentIcon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { RichTextEditor } from "./rich-text-editor"
import { SaveIndicator } from "./save-indicator"
import { isRichTextQuestion, richTextWordCount, extractPlainText } from "@/lib/rich-text"
import { useSaveRegister } from "@/lib/save-context"
import { useRefreshRegister } from "@/lib/refresh-context"
import { LIFEMAP_API_CONFIG, type FormApiConfig } from "@/lib/form-api-config"
import type { SaveStatus } from "@/lib/form-types"
import { useProjectLock } from "@/lib/project-lock"
import { ProjectLockedBanner } from "@/components/form/project-locked-banner"

interface TemplateQuestion {
  id: number
  field_name: string
  field_label: string
  placeholder: string
  min_words: number
  detailed_instructions: string
  sentence_starters: string[]
  isPublished: boolean
  isArchived: boolean
  question_types_id: number
  _question_types?: { id: number; type: string; noInput?: boolean }
  [key: string]: unknown
}

interface StudentResponse {
  id: number
  student_response: string
  isArchived?: boolean
  readyReview?: boolean
  revisionNeeded?: boolean
  isComplete?: boolean
  [key: string]: unknown
}

/**
 * Focused, document-style editing page for a single rich-text (essay)
 * question. Loads its own data and saves through the exact PATCH shape the
 * section form uses, so the section page and review flow see the result as
 * if it had been typed inline.
 */
export function EssayEditorPage({
  questionId,
  apiConfig = LIFEMAP_API_CONFIG,
  backHref,
  backLabel = "Back",
}: {
  questionId: number
  apiConfig?: FormApiConfig
  backHref: string
  backLabel?: string
}) {
  const cfg = apiConfig
  const F = cfg.fields
  const { data: session } = useSession()
  const studentId = (session?.user as Record<string, unknown>)?.students_id as string | undefined
  const { register: registerSave, unregister: unregisterSave } = useSaveRegister()
  const { register: registerRefresh, unregister: unregisterRefresh } = useRefreshRegister()
  // A locked project makes the essay view-only regardless of its own state.
  const projectLock = useProjectLock(cfg.locksEndpoint, studentId)
  const projectLockRef = useRef(false)
  useEffect(() => {
    projectLockRef.current = !!projectLock
  }, [projectLock])

  const [loading, setLoading] = useState(true)
  const [question, setQuestion] = useState<TemplateQuestion | null>(null)
  const [response, setResponse] = useState<StudentResponse | null>(null)
  const [value, setValue] = useState("")
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle")
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [hasDirty, setHasDirty] = useState(false)

  const valueRef = useRef("")
  const dirtyRef = useRef(false)
  // The prose (plain text) at the last save, to tell a real edit from a
  // comment-mark-only change (resolving/adding a highlight) — the latter must
  // not bump last_edited and reorder the teacher's review queue.
  const savedProseRef = useRef("")
  const responseRef = useRef<StudentResponse | null>(null)
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Bumped when a save starts or completes, so a refresh whose fetch
  // overlapped a save never adopts the pre-save server snapshot
  const saveEpochRef = useRef(0)

  const loadData = useCallback(async () => {
    if (!studentId) return
    const epochAtFetch = saveEpochRef.current
    try {
      const [templateRes, responsesRes] = await Promise.all([
        fetch(cfg.templateEndpoint),
        fetch(`${cfg.responsesEndpoint}?students_id=${studentId}`),
      ])

      if (templateRes.ok) {
        const all = (await templateRes.json()) as TemplateQuestion[]
        const q = all.find((tq) => tq.id === questionId && tq.isPublished && !tq.isArchived)
        setQuestion(q ?? null)
      }

      if (responsesRes.ok) {
        const data = (await responsesRes.json()) as StudentResponse[]
        const r = data.find((resp) => !resp.isArchived && Number(resp[F.templateId]) === questionId)
        setResponse(r ?? null)
        responseRef.current = r ?? null
        // Never clobber unsaved local edits or a fresher save with a refetch
        if (!dirtyRef.current && saveEpochRef.current === epochAtFetch) {
          const v = r?.student_response ?? ""
          setValue(v)
          valueRef.current = v
          savedProseRef.current = extractPlainText(v)
        }
      }
    } catch {
      // Silently fail, same as the section form
    } finally {
      setLoading(false)
    }
  }, [studentId, questionId, cfg, F])

  useEffect(() => {
    loadData()
  }, [loadData])

  const save = useCallback(async () => {
    // Locked projects never write (belt for the disabled editor).
    if (projectLockRef.current) return
    const resp = responseRef.current
    if (!resp || !dirtyRef.current) return
    setSaveStatus("saving")
    saveEpochRef.current++
    try {
      const now = new Date().toISOString()
      const savedValue = valueRef.current
      const proseNow = extractPlainText(savedValue)
      // A comment-mark-only change (same prose) saves the doc but leaves
      // last_edited/wordCount alone, so annotating doesn't look like an edit.
      const proseChanged = proseNow !== savedProseRef.current
      const patch: Record<string, unknown> = proseChanged
        ? { student_response: savedValue, wordCount: richTextWordCount(savedValue), last_edited: now }
        : { student_response: savedValue }
      const res = await fetch(`${cfg.responsePatchBase}/${resp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      })
      if (!res.ok) throw new Error("save failed")
      saveEpochRef.current++
      if (valueRef.current === savedValue) {
        savedProseRef.current = proseNow
        dirtyRef.current = false
        setHasDirty(false)
        setSaveStatus("saved")
        setLastSavedAt(new Date())
      } else {
        // Keystrokes arrived while the PATCH was in flight; leave the dirty
        // flag set so the debounce timer those keystrokes scheduled saves them
        setSaveStatus("idle")
      }
      setResponse((prev) => (prev ? { ...prev, ...patch } : prev))
      if (responseRef.current) {
        responseRef.current = { ...responseRef.current, ...patch }
      }
    } catch {
      setSaveStatus("error")
    }
  }, [cfg.responsePatchBase])

  const saveRef = useRef(save)
  saveRef.current = save

  const saveNow = useCallback(() => {
    save().then(() => {
      if (!dirtyRef.current) toast("Changes saved", { duration: 2000 })
    })
  }, [save])

  useEffect(() => {
    registerSave({ saveStatus, saveNow, lastSavedAt, hasDirty })
  }, [saveStatus, saveNow, lastSavedAt, hasDirty, registerSave])

  useEffect(() => {
    return () => unregisterSave()
  }, [unregisterSave])

  useEffect(() => {
    registerRefresh(async () => {
      await loadData()
    })
    return () => unregisterRefresh()
  }, [loadData, registerRefresh, unregisterRefresh])

  useEffect(() => {
    const handleSave = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault()
        saveNow()
      }
    }
    window.addEventListener("keydown", handleSave, true)
    return () => window.removeEventListener("keydown", handleSave, true)
  }, [saveNow])

  // Flush pending edits when leaving the page
  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)
      if (dirtyRef.current) saveRef.current()
    }
  }, [])

  const handleChange = (v: string) => {
    setValue(v)
    valueRef.current = v
    dirtyRef.current = true
    setHasDirty(true)
    setSaveStatus("idle")
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)
    autosaveTimerRef.current = setTimeout(() => {
      if (dirtyRef.current) saveRef.current()
    }, 1500)
  }

  const handleBlur = () => {
    if (dirtyRef.current) {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)
      saveRef.current()
    }
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-3xl flex-1 space-y-6 p-4 md:p-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (!question || !isRichTextQuestion(question)) {
    return (
      <div className="mx-auto w-full max-w-3xl flex-1 space-y-4 p-4 md:p-6">
        <BackButton href={backHref} label={backLabel} />
        <p className="text-muted-foreground">
          This essay question was not found. It may have been unpublished or removed.
        </p>
      </div>
    )
  }

  if (!response) {
    return (
      <div className="mx-auto w-full max-w-3xl flex-1 space-y-4 p-4 md:p-6">
        <BackButton href={backHref} label={backLabel} />
        <h1 className="text-2xl font-bold">{question.field_label}</h1>
        <p className="text-muted-foreground">
          This question is not set up for your account yet. Please check back later or ask your
          teacher to publish it.
        </p>
      </div>
    )
  }

  const isComplete = response.isComplete === true
  const isReadyForReview = response.readyReview === true && !isComplete && !response.revisionNeeded
  const isLocked = isComplete || isReadyForReview || !!projectLock
  const wordCount = richTextWordCount(value)
  const minWords = question.min_words > 0 ? question.min_words : null

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 p-4 md:p-6">
      <div className="flex items-center justify-between gap-2">
        <BackButton href={backHref} label={backLabel} />
        <SaveIndicator status={saveStatus} />
      </div>

      <div className="mt-6 space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{question.field_label}</h1>
        {question.detailed_instructions && (
          <p className="text-muted-foreground whitespace-pre-wrap text-sm">
            {question.detailed_instructions}
          </p>
        )}
      </div>

      {projectLock ? (
        <ProjectLockedBanner className="mt-4" />
      ) : (
        isLocked && (
          <div className="bg-muted/50 text-muted-foreground mt-4 flex items-center gap-2 rounded-lg border px-4 py-3 text-sm">
            <HugeiconsIcon
              icon={isComplete ? CheckmarkCircle02Icon : SentIcon}
              strokeWidth={2}
              className={`size-4 shrink-0 ${isComplete ? "text-green-600" : "text-blue-500"}`}
            />
            {isComplete
              ? "This essay has been marked complete. Reopen it from the section page to make changes."
              : "This essay has been sent for review. Withdraw the submission from the section page to keep editing."}
          </div>
        )
      )}

      {/* Document frame: the editor sits as a white "page" on a light-gray
          surround, so the writing surface reads like a real document. */}
      <div className="mt-4 rounded-xl bg-muted/40 p-2 sm:p-4 dark:bg-muted/20">
        <RichTextEditor
          className="rounded-lg border bg-white shadow-sm dark:bg-card"
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          disabled={isLocked}
          placeholder={question.placeholder}
          showThreadList
          comments={
            studentId
              ? {
                  commentsEndpoint: cfg.commentsEndpoint,
                  sectionIdField: F.sectionId,
                  studentId,
                  sectionId: Number(question[F.sectionId] ?? 0),
                  fieldName: question.field_name,
                  viewer: "student",
                  authorName: session?.user?.name ?? "Student",
                }
              : undefined
          }
        />
      </div>

      <div className="text-muted-foreground/60 sticky bottom-0 border-t bg-background/95 py-2 text-xs backdrop-blur supports-[backdrop-filter]:bg-background/75">
        {minWords ? (
          <span className={wordCount >= minWords ? "" : "text-muted-foreground"}>
            {wordCount} / {minWords} min words
          </span>
        ) : (
          <span>{wordCount} {wordCount === 1 ? "word" : "words"}</span>
        )}
      </div>
    </div>
  )
}

function BackButton({ href, label }: { href: string; label: string }) {
  return (
    <Button variant="outline" size="sm" asChild className="gap-2">
      <Link href={href}>
        <HugeiconsIcon icon={ArrowLeft02Icon} strokeWidth={2} className="size-4" />
        {label}
      </Link>
    </Button>
  )
}
