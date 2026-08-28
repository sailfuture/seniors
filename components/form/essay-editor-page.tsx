"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Loader2 } from "lucide-react"
import { useSession } from "@/components/session-provider"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowLeft02Icon,
  CheckmarkCircle02Icon,
  AiSearchIcon,
} from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { RichTextEditor } from "./rich-text-editor"
import { SaveIndicator } from "./save-indicator"
import { isRichTextQuestion, richTextWordCount, extractPlainText } from "@/lib/rich-text"
import { checkSubmissionForAi, AI_BLOCK_THRESHOLD, type AiGateResult } from "@/lib/ai-submission-check"
import { postResponseEvent } from "@/lib/response-events"
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

  // Submit / withdraw without leaving the editor.
  const [confirmSubmit, setConfirmSubmit] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const patchReviewState = async (
    patch: { readyReview: boolean },
    eventType: "submitted" | "reopened",
    delta: 1 | -1
  ): Promise<boolean> => {
    const resp = responseRef.current
    const q = question
    if (!resp || !q || !studentId) return false
    const sectionIdNum = Number(q[F.sectionId] ?? 0)
    const full = { ...patch, isComplete: false, revisionNeeded: false }
    try {
      const res = await fetch(`${cfg.responsePatchBase}/${resp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(full),
      })
      if (!res.ok) return false
      postResponseEvent(cfg, {
        studentId,
        templateId: q.id,
        fieldName: q.field_name,
        sectionId: sectionIdNum,
        eventType,
        actorName: session?.user?.name ?? "Student",
      })
      window.dispatchEvent(
        new CustomEvent(`${cfg.eventPrefix ?? ""}review-update`, {
          detail: { sectionId: sectionIdNum, delta },
        })
      )
      setResponse((prev) => (prev ? { ...prev, ...full } : prev))
      if (responseRef.current) responseRef.current = { ...responseRef.current, ...full }
      return true
    } catch {
      return false
    }
  }

  const submitForReview = async () => {
    const resp = responseRef.current
    const q = question
    if (!resp || !q || !studentId) return
    setSubmitting(true)
    try {
      // Flush any pending edits so the checked text is the saved text.
      if (dirtyRef.current) await saveRef.current()
      const gate = await checkSubmissionForAi(cfg, {
        responseId: resp.id,
        studentId,
        sectionId: Number(q[F.sectionId] ?? 0),
        text: extractPlainText(valueRef.current),
      })
      if (gate.verdict === "blocked") {
        toast.error(
          `Submission rejected — this essay scored ${Math.round(gate.aiPercent ?? 0)}% likely AI-generated (limit ${AI_BLOCK_THRESHOLD}%). Please revise it in your own words.`,
          { duration: 6000 }
        )
        return
      }
      if (gate.verdict === "unavailable") {
        toast.error(
          "The AI check couldn't run, so this essay wasn't submitted. Please try again in a moment.",
          { duration: 6000 }
        )
        return
      }
      if (await patchReviewState({ readyReview: true }, "submitted", 1)) {
        toast.success("Submitted for review")
      } else {
        toast.error("Couldn't submit. Please try again.")
      }
    } finally {
      setSubmitting(false)
      setConfirmSubmit(false)
    }
  }

  const withdrawSubmission = async () => {
    setSubmitting(true)
    try {
      if (await patchReviewState({ readyReview: false }, "reopened", -1)) {
        toast.success("Submission withdrawn — you can keep editing")
      } else {
        toast.error("Couldn't withdraw. Please try again.")
      }
    } finally {
      setSubmitting(false)
    }
  }

  // "Check for AI" self-check before submitting.
  const [aiOpen, setAiOpen] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiGate, setAiGate] = useState<AiGateResult | null>(null)
  const [aiResult, setAiResult] = useState<{
    likelihood: "low" | "medium" | "high"
    summary: string
    observations: string[]
  } | null>(null)

  const runAiCheck = async () => {
    const resp = responseRef.current
    const q = question
    if (!resp || !q || !studentId) return
    setAiOpen(true)
    setAiLoading(true)
    setAiError(null)
    setAiGate(null)
    setAiResult(null)
    const text = extractPlainText(valueRef.current)
    try {
      // The authoritative score is the SAME check submissions are gated on
      // (dry run — its record is deleted); the LLM adds the "why" notes.
      const [gate, llmRes] = await Promise.all([
        checkSubmissionForAi(cfg, {
          responseId: resp.id,
          studentId,
          sectionId: Number(q[F.sectionId] ?? 0),
          text,
          keepRecord: "never",
        }),
        fetch("/api/essay/ai-check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        }),
      ])
      setAiGate(gate)
      const data = await llmRes.json().catch(() => null)
      if (llmRes.ok && data) {
        setAiResult(data)
      } else if (gate.verdict === "skipped" || gate.verdict === "unavailable") {
        // Neither signal came back — surface the failure.
        setAiError(data?.error ?? "The check could not be completed. Please try again.")
      }
    } catch {
      setAiError("The check could not be completed. Please try again.")
    } finally {
      setAiLoading(false)
    }
  }

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

  // Response rows are only provisioned by Xano's publish_questions, which runs
  // when a teacher publishes drafts — so a student who joined the roster after
  // a question was published has no row for it and would dead-end on this
  // page. Create the missing row on demand rather than turning them away.
  const createInFlightRef = useRef<Promise<StudentResponse | null> | null>(null)

  const createMissingResponse = useCallback(
    async (q: TemplateQuestion): Promise<StudentResponse | null> => {
      if (!studentId) return null
      try {
        const res = await fetch(cfg.responsePatchBase, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            students_id: studentId,
            [F.templateId]: q.id,
            // Mirrors what publish_questions writes, so the section form and
            // the review queue group this answer exactly as they would a
            // normally provisioned one.
            [F.customGroupId]: q[F.customGroupId] ?? null,
            student_response: "",
            wordCount: 0,
            readyReview: false,
            revisionNeeded: false,
            isComplete: false,
          }),
        })
        if (!res.ok) return null
        const created = (await res.json()) as StudentResponse
        // Without the identifying fields echoed back, autosave would PATCH a
        // row that isn't this student's answer to this question — fail instead.
        if (!created?.id || Number(created[F.templateId]) !== Number(q.id)) return null
        return created
      } catch {
        return null
      }
    },
    [studentId, cfg, F]
  )

  const loadData = useCallback(async () => {
    if (!studentId) return
    const epochAtFetch = saveEpochRef.current
    try {
      const [templateRes, responsesRes] = await Promise.all([
        fetch(cfg.templateEndpoint),
        fetch(`${cfg.responsesEndpoint}?students_id=${studentId}`),
      ])

      let q: TemplateQuestion | null = null
      if (templateRes.ok) {
        const all = (await templateRes.json()) as TemplateQuestion[]
        q = all.find((tq) => tq.id === questionId && tq.isPublished && !tq.isArchived) ?? null
        setQuestion(q)
      }

      if (responsesRes.ok) {
        const data = (await responsesRes.json()) as StudentResponse[]
        let r = data.find((resp) => !resp.isArchived && Number(resp[F.templateId]) === questionId)
        if (!r && q && isRichTextQuestion(q)) {
          // Share one in-flight POST: a StrictMode double-mount or an
          // overlapping refresh must not create two rows for the same answer.
          if (!createInFlightRef.current) createInFlightRef.current = createMissingResponse(q)
          const created = await createInFlightRef.current
          // Keep a successful result cached; only clear so a failure can retry.
          if (!created) createInFlightRef.current = null
          r = created ?? undefined
        }
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
  }, [studentId, questionId, cfg, F, createMissingResponse])

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
    // Mirror the loaded layout: full width, editor frame filling the page.
    return (
      <div className="flex w-full flex-1 flex-col gap-6 p-4 md:p-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="min-h-96 w-full flex-1" />
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
          We couldn&apos;t open this essay just now. Refresh the page to try again — if it keeps
          happening, let your teacher know.
        </p>
      </div>
    )
  }

  const isComplete = response.isComplete === true
  const isReadyForReview = response.readyReview === true && !isComplete && !response.revisionNeeded
  const isLocked = isComplete || isReadyForReview || !!projectLock
  const wordCount = richTextWordCount(value)
  const minWords = question.min_words > 0 ? question.min_words : null

  const toolbarExtras = (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={runAiCheck}
        disabled={aiLoading || isLocked}
        className="hover:bg-accent inline-flex h-8 items-center gap-1.5 rounded-md border px-2 text-xs font-medium transition-colors disabled:opacity-50"
        title={
          isLocked
            ? "Unavailable while the essay is submitted for review"
            : "Check this essay for AI-generated writing"
        }
      >
        <HugeiconsIcon icon={AiSearchIcon} strokeWidth={2} className="size-4" />
        Check for AI
      </button>
      <span className="text-muted-foreground whitespace-nowrap text-xs tabular-nums">
        {minWords ? (
          <span className={wordCount >= minWords ? "text-green-600" : undefined}>
            {wordCount} / {minWords} min words
          </span>
        ) : (
          <>{wordCount} {wordCount === 1 ? "word" : "words"}</>
        )}
      </span>
    </div>
  )

  const canSubmit = wordCount > 0 && (!minWords || wordCount >= minWords)

  // Upper-left of the editor card: save status + submission actions, opposite
  // the AI check and word count. These stay clickable while the document is
  // locked — withdrawing IS the way back to editing.
  const toolbarActions = (
    <div className="flex items-center gap-2">
      <SaveIndicator status={saveStatus} />
      {isReadyForReview && !projectLock && (
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          disabled={submitting}
          onClick={withdrawSubmission}
        >
          {submitting ? "Withdrawing…" : "Edit Submission"}
        </Button>
      )}
      {!isLocked && (
        <Button
          size="sm"
          className="h-8 bg-[#0f1f52] text-xs text-white hover:bg-[#152a6b]"
          disabled={!canSubmit || submitting}
          onClick={() => setConfirmSubmit(true)}
          title={
            !canSubmit
              ? minWords
                ? `Minimum ${minWords} words required`
                : "The essay is empty"
              : undefined
          }
        >
          Submit for Review
        </Button>
      )}
    </div>
  )

  return (
    <div className="flex w-full flex-1 flex-col p-4 md:p-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{question.field_label}</h1>
        {question.detailed_instructions && (
          <p className="text-muted-foreground whitespace-pre-wrap text-sm">
            {question.detailed_instructions}
          </p>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <BackButton href={backHref} label={backLabel} />
      </div>

      {projectLock ? (
        <ProjectLockedBanner className="mt-4" />
      ) : (
        isComplete && (
          <div className="bg-muted/50 text-muted-foreground mt-4 flex items-center gap-2 rounded-lg border px-4 py-3 text-sm">
            <HugeiconsIcon
              icon={CheckmarkCircle02Icon}
              strokeWidth={2}
              className="size-4 shrink-0 text-green-600"
            />
            This essay has been marked complete. Reopen it from the section page
            to make changes.
          </div>
        )
      )}

      {/* Document frame: the editor sits as a white "page" on a light-gray
          surround, so the writing surface reads like a real document. The
          flex-1 chain stretches it to the bottom of the container. */}
      <div className="mt-4 flex flex-1 flex-col rounded-xl bg-muted/40 p-2 sm:p-4 dark:bg-muted/20">
        <RichTextEditor
          className="flex-1 rounded-lg border bg-white shadow-sm dark:bg-card"
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          disabled={isLocked}
          placeholder={question.placeholder}
          showThreadList
          toolbarLeft={toolbarActions}
          toolbarRight={toolbarExtras}
          comments={
            studentId && !isLocked
              ? {
                  commentsEndpoint: cfg.commentsEndpoint,
                  sectionIdField: F.sectionId,
                  studentId,
                  sectionId: Number(question[F.sectionId] ?? 0),
                  fieldName: question.field_name,
                  templateId: question.id,
                  templateIdField: F.templateId,
                  viewer: "student",
                  authorName: session?.user?.name ?? "Student",
                }
              : undefined
          }
        />
      </div>

      <Dialog open={aiOpen} onOpenChange={(o) => { if (!aiLoading) setAiOpen(o) }}>
        <DialogContent
          // The check can't be abandoned mid-flight: outside clicks and
          // Escape are ignored until it finishes.
          onPointerDownOutside={(e) => { if (aiLoading) e.preventDefault() }}
          onInteractOutside={(e) => { if (aiLoading) e.preventDefault() }}
          onEscapeKeyDown={(e) => { if (aiLoading) e.preventDefault() }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HugeiconsIcon icon={AiSearchIcon} strokeWidth={2} className="size-5" />
              AI writing check
            </DialogTitle>
            <DialogDescription>
              The same detector that gates submissions — essays scoring over{" "}
              {AI_BLOCK_THRESHOLD}% likely AI are blocked from submitting.
            </DialogDescription>
          </DialogHeader>

          {aiLoading ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="text-muted-foreground size-8 animate-spin" />
              <p className="text-sm font-medium">Checking your essay…</p>
              <p className="text-muted-foreground text-xs">
                This can take up to a minute — please keep this window open.
              </p>
            </div>
          ) : aiError ? (
            <p className="text-destructive py-2 text-sm">{aiError}</p>
          ) : (
            <div className="space-y-3 py-1">
              {aiGate?.aiPercent != null && aiGate.verdict !== "skipped" ? (
                <div
                  className={
                    aiGate.verdict === "blocked"
                      ? "rounded-md bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-400"
                      : "rounded-md bg-green-50 px-3 py-2 text-sm font-semibold text-green-700 dark:bg-green-950/40 dark:text-green-400"
                  }
                >
                  {Math.round(aiGate.aiPercent)}% likely AI —{" "}
                  {aiGate.verdict === "blocked"
                    ? `this would be blocked at submission (limit ${AI_BLOCK_THRESHOLD}%)`
                    : `under the ${AI_BLOCK_THRESHOLD}% submission limit`}
                </div>
              ) : aiResult ? (
                <div
                  className={
                    aiResult.likelihood === "high"
                      ? "inline-flex rounded-md bg-red-50 px-2.5 py-1 text-sm font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-400"
                      : aiResult.likelihood === "medium"
                        ? "inline-flex rounded-md bg-amber-50 px-2.5 py-1 text-sm font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                        : "inline-flex rounded-md bg-green-50 px-2.5 py-1 text-sm font-semibold text-green-700 dark:bg-green-950/40 dark:text-green-400"
                  }
                >
                  {aiResult.likelihood === "high"
                    ? "High likelihood of AI writing"
                    : aiResult.likelihood === "medium"
                      ? "Some signs of AI writing"
                      : "Low likelihood of AI writing"}
                </div>
              ) : null}
              {aiResult?.summary && <p className="text-sm">{aiResult.summary}</p>}
              {aiGate?.verdict === "unavailable" && (
                <p className="text-amber-600 text-xs">
                  The submission detector couldn&rsquo;t score this essay just
                  now. Submissions are held until it can — try again in a moment.
                </p>
              )}
              <p className="text-muted-foreground/70 text-xs">
                Automated detection is an estimate, not proof — your teacher
                makes the final call.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={confirmSubmit} onOpenChange={(o) => { if (!submitting) setConfirmSubmit(o) }}>
        <DialogContent
          onPointerDownOutside={(e) => { if (submitting) e.preventDefault() }}
          onInteractOutside={(e) => { if (submitting) e.preventDefault() }}
          onEscapeKeyDown={(e) => { if (submitting) e.preventDefault() }}
        >
          <DialogHeader>
            <DialogTitle>Send for review?</DialogTitle>
            <DialogDescription>
              This will notify your teacher that this essay is ready for review,
              and pause editing until it&rsquo;s reviewed or withdrawn. An AI
              check runs as part of submitting.
            </DialogDescription>
          </DialogHeader>
          {submitting && (
            <div className="flex items-center gap-2 py-1">
              <Loader2 className="text-muted-foreground size-4 animate-spin" />
              <p className="text-muted-foreground text-sm">
                Running the AI check and submitting…
              </p>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" disabled={submitting} onClick={() => setConfirmSubmit(false)}>
              Cancel
            </Button>
            <Button
              className="bg-[#0f1f52] text-white hover:bg-[#152a6b]"
              disabled={submitting}
              onClick={submitForReview}
            >
              {submitting ? "Submitting…" : "Send for Review"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
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
