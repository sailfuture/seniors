"use client"

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  CheckmarkCircle02Icon,
  CircleIcon,
  SentIcon,
  AlertCircleIcon,
  ArrowTurnBackwardIcon,
  ArrowDown01Icon,
} from "@hugeicons/core-free-icons"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import { TeacherComment } from "./teacher-comment"
import type { Comment } from "@/lib/form-types"
import { isGroupDisplayType, DISPLAY_TYPE } from "@/components/group-display-types"
import { LineItemsTable } from "@/components/line-items-table"
import { isLineItemsQuestion } from "@/lib/line-items"
import { extractPlainText, isRichTextQuestion, looksLikeRichTextDoc, richTextWordCount } from "@/lib/rich-text"
import { ZoomableImage } from "@/components/zoomable-image"
import { LIFEMAP_API_CONFIG, type FormApiConfig } from "@/lib/form-api-config"
import { eventTypeForAction, postResponseEvent } from "@/lib/response-events"
import { useRefreshRegister, useBumpSidebar } from "@/lib/refresh-context"

interface GptZeroResult {
  class_probability_ai?: number
  class_probability_human?: number
  mixed?: number
  [key: string]: unknown
}

interface TemplateQuestion {
  id: number
  field_name: string
  field_label: string
  min_words: number
  placeholder: string
  detailed_instructions: string
  resources: string[]
  examples: string[]
  sentence_starters: string[]
  isPublished: boolean
  isArchived: boolean
  isDraft?: boolean
  question_types_id: number
  _question_types?: { id: number; type: string; noInput?: boolean }
  dropdownOptions: string[]
  sortOrder: number
  teacher_guideline?: string
  [key: string]: unknown
}

interface CustomGroup {
  id: number
  group_name: string
  group_description: string
  instructions: string
  resources: string[]
  order?: number
  [key: string]: unknown
}

interface StudentResponse {
  id: number
  student_response: string
  date_response: string | null
  image_response: Record<string, unknown> | null
  students_id: string
  isArchived?: boolean
  last_edited?: string | number | null
  readyReview?: boolean
  revisionNeeded?: boolean
  isComplete?: boolean
  source_link?: string
  title_of_source?: string
  author_name_or_publisher?: string
  date_of_publication?: string
  [key: string]: unknown
}

function formatRelativeTime(ts: string | number | null | undefined): string | null {
  if (!ts) return null
  const date = typeof ts === "number" ? new Date(ts) : new Date(ts)
  if (isNaN(date.getTime())) return null
  const diff = Math.floor((Date.now() - date.getTime()) / 1000)
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

const QUESTION_TYPE = {
  LONG_RESPONSE: 1,
  SHORT_RESPONSE: 2,
  CURRENCY: 3,
  IMAGE_UPLOAD: 4,
  DROPDOWN: 5,
  URL: 6,
  DATE: 7,
  SOURCE: 12,
} as const

interface ReadOnlyDynamicFormPageProps {
  title: string
  subtitle?: string
  sectionId: number
  studentId: string
  headerContent?: React.ReactNode
  apiConfig?: FormApiConfig
}

function getImageUrl(value: unknown): string | null {
  if (!value || typeof value !== "object") return null
  const obj = value as Record<string, unknown>
  if (typeof obj.url === "string" && obj.url) return obj.url
  if (typeof obj.path === "string" && obj.path) {
    return `https://xsc3-mvx7-r86m.n7e.xano.io${obj.path}`
  }
  return null
}

function getWordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

/** Anything the student actually answered — text, an uploaded image, or a
    source citation — is reviewable, submitted or not. */
function hasResponseContent(r: StudentResponse | undefined | null): boolean {
  if (!r) return false
  const img = r.image_response as { path?: string; url?: string } | null
  return (
    (r.student_response ?? "").trim().length > 0 ||
    !!(img && (img.path || img.url)) ||
    !!(r.source_link || r.title_of_source || r.author_name_or_publisher)
  )
}

function ConfirmAllButton({ readyCount, onConfirmAll }: { readyCount: number; onConfirmAll: () => Promise<void> }) {
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  return (
    <div className="flex items-center gap-2">
      <div className="h-6 w-px bg-border" />
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger asChild>
          <Button variant="outline" size="sm" disabled={loading}>
            {loading ? (
              <span className="mr-2 size-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <HugeiconsIcon icon={CheckmarkCircle02Icon} className="mr-1.5 size-4" />
            )}
            Confirm All ({readyCount})
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm all pending items?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark {readyCount} pending review {readyCount === 1 ? "item" : "items"} as complete. This action can be undone individually.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async (e) => {
                e.preventDefault()
                setLoading(true)
                setOpen(false)
                try { await onConfirmAll() } finally { setLoading(false) }
              }}
            >
              Confirm All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/** Bulk "send it back": flags every answered, unapproved item in the card
    for revision, with one optional feedback note for the whole set. */
function RequestRevisionAllButton({
  count,
  onConfirm,
}: {
  count: number
  onConfirm: (feedback: string) => Promise<void>
}) {
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [feedback, setFeedback] = useState("")
  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) setFeedback("")
      }}
    >
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={loading}
          className="border-red-200 bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800"
        >
          {loading ? (
            <span className="mr-2 size-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <HugeiconsIcon icon={ArrowTurnBackwardIcon} className="mr-1.5 size-4" />
          )}
          Revise All ({count})
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Request revisions on {count} {count === 1 ? "item" : "items"}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Every answered item here that isn&apos;t approved goes back to the student for another pass —
            including drafts and image uploads. Add one note explaining what to fix (optional).
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="What should the student revise?"
          rows={3}
        />
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-red-600 text-white hover:bg-red-700"
            onClick={async (e) => {
              e.preventDefault()
              setLoading(true)
              setOpen(false)
              try {
                await onConfirm(feedback.trim())
              } finally {
                setLoading(false)
              }
            }}
          >
            Request revisions
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function ReadOnlyDynamicFormPage({ title, subtitle, sectionId, studentId, headerContent, apiConfig = LIFEMAP_API_CONFIG }: ReadOnlyDynamicFormPageProps) {
  const cfg = apiConfig
  const F = cfg.fields
  const searchParams = useSearchParams()
  const focusField = searchParams.get("focus")
  const focusApplied = useRef(false)
  const { data: session } = useSession()
  const { register: registerRefresh, unregister: unregisterRefresh } = useRefreshRegister()
  const bumpSidebar = useBumpSidebar()
  const [questions, setQuestions] = useState<TemplateQuestion[]>([])
  const [customGroups, setCustomGroups] = useState<CustomGroup[]>([])
  const [responses, setResponses] = useState<Map<number, StudentResponse>>(new Map())
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [plagiarismData, setPlagiarismData] = useState<Map<number, GptZeroResult>>(new Map())
  const [revisionModal, setRevisionModal] = useState<{ responseId: number; templateId: number } | null>(null)
  const [revisionComment, setRevisionComment] = useState("")

  const loadData = useCallback(async (showLoading = false) => {
      if (showLoading) setLoading(true)
      try {
        const [templateRes, responsesRes, groupsRes, commentsRes, qTypesRes] = await Promise.all([
          fetch(cfg.templateEndpoint),
          fetch(`${cfg.responsesEndpoint}?students_id=${studentId}`),
          fetch(cfg.customGroupEndpoint),
          fetch(`${cfg.commentsEndpoint}?students_id=${studentId}&${F.sectionId}=${sectionId}`),
          fetch(cfg.questionTypesEndpoint),
        ])

        const noInputTypeIds = new Set<number>()
        if (qTypesRes.ok) {
          const types = (await qTypesRes.json()) as { id: number; noInput?: boolean }[]
          for (const t of types) {
            if (t.noInput) noInputTypeIds.add(t.id)
          }
        }

        let allTemplateQuestions: TemplateQuestion[] = []
        if (templateRes.ok) {
          allTemplateQuestions = (await templateRes.json()) as TemplateQuestion[]
          const filtered = allTemplateQuestions
            .filter((q) => Number(q[F.sectionId]) === sectionId && q.isPublished && !q.isArchived && !noInputTypeIds.has(q.question_types_id))
            .sort((a, b) => a.sortOrder - b.sortOrder)
          setQuestions(filtered)
        }

        const excludedTemplateIds = new Set(
          allTemplateQuestions.filter((q) => q.isArchived || q.isDraft).map((q) => q.id)
        )

        if (responsesRes.ok) {
          const data = (await responsesRes.json()) as StudentResponse[]
          const map = new Map<number, StudentResponse>()
          for (const r of data) {
            if (r.isArchived) continue
            map.set(Number(r[F.templateId]), r)
          }
          setResponses(map)
        }

        if (groupsRes.ok) {
          const allGroups = (await groupsRes.json()) as CustomGroup[]
          setCustomGroups(allGroups.filter((g) => Number(g[F.sectionId]) === sectionId))
        }

        if (commentsRes.ok) {
          const data = await commentsRes.json()
          if (Array.isArray(data)) {
            const enriched = data
              .filter((c: Record<string, unknown>) => {
                if (String(c.students_id) !== String(studentId)) return false
                if (Number(c[F.sectionId]) !== sectionId) return false
                // Inline essay-comment threads share the field's name; they
                // belong to the highlight, not the general activity stream.
                if (c.thread_id) return false
                const tid = c[F.templateId] as number | null | undefined
                if (tid && excludedTemplateIds.has(tid)) return false
                return true
              })
              .map((c: Record<string, unknown>) => {
                const teachers = c._teachers as { firstName?: string; lastName?: string }[] | undefined
                const singleTeacher = c._teacher as { firstName?: string; lastName?: string } | undefined
                const teacher = teachers?.[0] ?? singleTeacher
                const teacherName = teacher
                  ? `${teacher.firstName ?? ""} ${teacher.lastName ?? ""}`.trim()
                  : (c.teacher_name as string | undefined)
                return { ...c, teacher_name: teacherName || undefined } as Comment
              })
            setComments(enriched)
          }
        }
        if (cfg.gptzeroEndpoint) {
          try {
            const gptzeroRes = await fetch(
              `${cfg.gptzeroEndpoint}?${F.sectionId}=${sectionId}&students_id=${studentId}`
            )
            if (gptzeroRes.ok) {
              const gptzeroData = await gptzeroRes.json()
              if (Array.isArray(gptzeroData)) {
                const map = new Map<number, GptZeroResult>()
                for (const r of gptzeroData) {
                  const rec = r as Record<string, unknown>
                  let respId: number | undefined
                  for (const key of Object.keys(rec)) {
                    if (key.endsWith('_responses_id') && rec[key]) {
                      respId = Number(rec[key])
                      break
                    }
                  }
                  if (!respId) continue
                  const existing = map.get(respId)
                  if (!existing || (r.id as number) > (existing.id as number)) {
                    map.set(respId, r)
                  }
                }
                setPlagiarismData(map)
              }
            }
          } catch { /* ignore */ }
        }
      } catch {
        // Silently fail
      } finally {
        setLoading(false)
      }
  }, [studentId, sectionId, cfg, F])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    registerRefresh(async () => { await loadData(true) })
    return () => unregisterRefresh()
  }, [loadData, registerRefresh, unregisterRefresh])

  useEffect(() => {
    if (!focusField || loading || focusApplied.current) return
    focusApplied.current = true
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-field-name="${CSS.escape(focusField)}"]`) as HTMLElement | null
      if (!el) return
      el.scrollIntoView({ behavior: "smooth", block: "center" })
      setTimeout(() => {
        const commentBtn = el.querySelector("[data-comment-trigger]") as HTMLElement | null
        commentBtn?.click()
      }, 500)
    })
  }, [focusField, loading])

  const handlePostComment = useCallback(
    async (fieldName: string, note: string) => {
      const teacherName = session?.user?.name ?? "Teacher"
      const teachersId = (session?.user as Record<string, unknown>)?.teachers_id ?? null

      const payload: Record<string, unknown> = {
        students_id: studentId,
        teachers_id: teachersId,
        field_name: fieldName,
        [F.sectionId]: sectionId,
        note,
        isOld: false,
        isComplete: false,
        teacher_name: teacherName,
      }

      const res = await fetch(cfg.commentsEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        const newComment = await res.json()
        setComments((prev) => [
          ...prev,
          { ...newComment, teacher_name: newComment.teacher_name || teacherName },
        ])
      }
    },
    [studentId, session, sectionId, cfg, F]
  )

  const handleDelete = useCallback(
    async (commentId: number) => {
      const res = await fetch(`${cfg.commentsEndpoint}/${commentId}`, {
        method: "DELETE",
      })

      if (res.ok) {
        setComments((prev) => prev.filter((c) => c.id !== commentId))
      }
    },
    []
  )

  // For student replies, isOld doubles as "the teacher has seen it" — flip it
  // when the teacher opens a field's activity sheet so the badge clears.
  const handleMarkRepliesSeen = useCallback(
    async (commentIds: number[]) => {
      setComments((prev) =>
        prev.map((c) => (c.id != null && commentIds.includes(c.id) ? { ...c, isOld: true } : c))
      )
      for (const id of commentIds) {
        try {
          await fetch(`${cfg.commentsEndpoint}/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isOld: true }),
          })
        } catch { /* ignore */ }
      }
    },
    [cfg.commentsEndpoint]
  )

  const handleResponseReviewAction = useCallback(
    async (responseId: number, templateId: number, action: "complete" | "revision" | "ready" | "clear", comment?: string, silent = false) => {
      const now = new Date().toISOString()
      const patch =
        action === "complete"
          ? { isComplete: true, revisionNeeded: false, readyReview: false }
          : action === "revision"
            ? { revisionNeeded: true, isComplete: false, readyReview: false }
            : action === "ready"
              ? { readyReview: true, isComplete: false, revisionNeeded: false }
              : { readyReview: false, isComplete: false, revisionNeeded: false }

      try {
        const res = await fetch(`${cfg.responsePatchBase}/${responseId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        })
        if (res.ok) {
          // Log the transition so activity timelines show the history.
          {
            const q = questions.find((qq) => qq.id === templateId)
            if (q && studentId) {
              postResponseEvent(cfg, {
                studentId,
                templateId,
                fieldName: q.field_name,
                sectionId,
                eventType: eventTypeForAction(action),
                actorName: session?.user?.name ?? "Teacher",
                teachersId: ((session?.user as Record<string, unknown>)?.teachers_id as string) ?? null,
              })
            }
          }
          // Notify the sidebar badges of the state transition
          const prevResp = responses.get(templateId)
          const wasReady = !!(prevResp?.readyReview && !prevResp?.isComplete && !prevResp?.revisionNeeded)
          const nowReady = patch.readyReview && !patch.isComplete && !patch.revisionNeeded
          const wasRevision = !!prevResp?.revisionNeeded
          const nowRevision = patch.revisionNeeded
          const eventName = `${cfg.eventPrefix ?? ""}review-update`
          if (nowReady !== wasReady) {
            window.dispatchEvent(new CustomEvent(eventName, { detail: { sectionId, delta: nowReady ? 1 : -1 } }))
          }
          if (nowRevision !== wasRevision) {
            window.dispatchEvent(new CustomEvent(eventName, { detail: { sectionId, delta: nowRevision ? 1 : -1, type: "revision" } }))
          }
          // A completion change can flip a section's green "fully complete"
          // check; that set is only recomputed on a sidebar refetch, so bump it.
          if (!!prevResp?.isComplete !== !!patch.isComplete) {
            bumpSidebar()
          }

          setResponses((prev) => {
            const next = new Map(prev)
            const existing = next.get(templateId)
            if (existing) next.set(templateId, { ...existing, ...patch, last_edited: now })
            return next
          })

          if (comment?.trim()) {
            const teacherName = session?.user?.name ?? "Teacher"
            const teachersId = (session?.user as Record<string, unknown>)?.teachers_id ?? null
            const q = questions.find((q) => q.id === templateId)
            await fetch(cfg.commentsEndpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                students_id: studentId,
                teachers_id: teachersId,
                field_name: q?.field_name ?? "",
                [F.sectionId]: sectionId,
                note: comment.trim(),
                isOld: false,
                isComplete: false,
                isRevisionFeedback: true,
                teacher_name: teacherName,
              }),
            }).then(async (r) => {
              if (r.ok) {
                const newComment = await r.json()
                setComments((prev) => [...prev, { ...newComment, teacher_name: newComment.teacher_name || teacherName }])
              }
            }).catch(() => {})
          }

          if (!silent) {
            const labels: Record<string, string> = { complete: "Marked complete", revision: "Revision requested", ready: "Marked ready for review", clear: "Status cleared" }
            toast.success(labels[action] ?? "Status updated")
          }

        }
      } catch {
        if (!silent) toast.error("Failed to update status")
      }
    },
    [session, studentId, sectionId, questions, responses, cfg, F, bumpSidebar]
  )

  // One shared feedback note for a bulk revision request, scoped to the
  // section (or one group) so it lands in the matching activity stream.
  const postBulkRevisionNote = useCallback(
    async (note: string, groupId?: number) => {
      if (!note) return
      const teacherName = session?.user?.name ?? "Teacher"
      const teachersId = (session?.user as Record<string, unknown>)?.teachers_id ?? null
      const payload: Record<string, unknown> = {
        students_id: studentId,
        teachers_id: teachersId,
        field_name: "_section_comment",
        [F.sectionId]: sectionId,
        note,
        isOld: false,
        isComplete: false,
        teacher_name: teacherName,
        isRevisionFeedback: true,
      }
      if (groupId) payload[F.customGroupId] = groupId
      try {
        const res = await fetch(cfg.commentsEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        if (res.ok) {
          const created = await res.json()
          setComments((prev) => [...prev, { ...created, teacher_name: created.teacher_name || teacherName }])
        }
      } catch {
        /* the flags still landed; the note is best-effort */
      }
    },
    [cfg.commentsEndpoint, F, sectionId, studentId, session]
  )

  if (loading) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        <Skeleton className="h-8 w-48" />
        <Card>
          <CardContent className="p-6 space-y-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-5 w-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    )
  }

  const ungroupedQuestions = questions.filter((q) => !q[F.customGroupId])
  const groupedSections = [...customGroups]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((group) => ({
      group,
      questions: questions
        .filter((q) => Number(q[F.customGroupId]) === group.id)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    }))
    .filter((gs) => gs.questions.length > 0)

  const renderQuestionList = (qs: TemplateQuestion[], flat = false) => {
    const items = qs.map((q) => {
        const response = responses.get(q.id)
        const value = response?.student_response ?? ""
        const imageValue = response?.image_response ?? null
        const typeId = q.question_types_id
        const isLong = typeId === QUESTION_TYPE.LONG_RESPONSE
        const isImage = typeId === QUESTION_TYPE.IMAGE_UPLOAD
        const isCurrency = typeId === QUESTION_TYPE.CURRENCY
        const isSource = typeId === QUESTION_TYPE.SOURCE
        const isRichText = isRichTextQuestion(q)
        const colSpan = flat ? "" : (isLong || isImage || isSource || isRichText ? "md:col-span-6" : "md:col-span-3")

        const gptzero = response ? plagiarismData.get(response.id) : undefined
        const aiIsHighest = gptzero ? isAiHighest(gptzero) : false
        const qIsComplete = response?.isComplete === true
        const qNeedsRevision = response?.revisionNeeded === true
        const isSubmitted = response && (response.readyReview || response.isComplete || response.revisionNeeded)
        // Drafts with real content (an uploaded image, typed text) are still
        // reviewable — teachers can request a revision without waiting for a
        // submission.
        const hasReviewableContent = hasResponseContent(response)
        const qIsDimmed = qIsComplete || qNeedsRevision
        const relativeTime = formatRelativeTime(response?.last_edited)
        // The AI/originality report and last-edited time sit together in the
        // field's lower-right; only text answers have a GPTZero report.
        const showAiFooter = !!(gptzero && isSubmitted)

        let studentEditedSinceRevision = false
        if (qNeedsRevision && response) {
          const revisionComments = comments.filter(
            (c) => c.field_name === q.field_name && c.isRevisionFeedback
          )
          if (revisionComments.length > 0) {
            const latestRevision = revisionComments.reduce((a, b) => {
              const aTime = typeof a.created_at === "number" ? a.created_at : new Date(String(a.created_at)).getTime()
              const bTime = typeof b.created_at === "number" ? b.created_at : new Date(String(b.created_at)).getTime()
              return bTime > aTime ? b : a
            })
            const revisionTime = typeof latestRevision.created_at === "number"
              ? latestRevision.created_at
              : new Date(String(latestRevision.created_at)).getTime()
            const editTime = typeof response.last_edited === "number"
              ? response.last_edited
              : response.last_edited ? new Date(String(response.last_edited)).getTime() : 0
            studentEditedSinceRevision = editTime > revisionTime + 5000
          }
        }

        let displayValue: React.ReactNode
        if (isImage) {
          const url = getImageUrl(imageValue)
          displayValue = url ? (
            // Fixed frame: the image sits centered at its natural aspect, and
            // a blurred copy of itself fills the space around it.
            <div className="h-72 overflow-hidden rounded-lg border">
              <ZoomableImage src={url} alt={q.field_label} blurredFit caption={q.field_label} />
            </div>
          ) : (
            <div className="text-muted-foreground flex h-32 items-center justify-center rounded-lg border border-dashed text-sm">
              No image uploaded
            </div>
          )
        } else if (isCurrency) {
          const num = parseFloat(value) || 0
          displayValue = <p className={`text-sm ${qIsDimmed ? "" : "font-semibold"}`}>${num.toLocaleString("en-US")}</p>
        } else if (typeId === QUESTION_TYPE.URL) {
          displayValue = value ? (
            <a href={value} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-blue-600 underline break-all hover:text-blue-800 dark:text-blue-400">
              {value}
            </a>
          ) : (
            <p className="text-muted-foreground text-sm">—</p>
          )
        } else if (typeId === QUESTION_TYPE.SOURCE) {
          const sl = response?.source_link ?? ""
          const ts = response?.title_of_source ?? ""
          const ap = response?.author_name_or_publisher ?? ""
          const dp = response?.date_of_publication ?? ""
          const hasAny = sl || ts || ap || dp
          displayValue = hasAny ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <p className="text-muted-foreground text-[11px]">Source Link</p>
                {sl ? (
                  <a href={sl} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-blue-600 underline break-all hover:text-blue-800 dark:text-blue-400">{sl}</a>
                ) : <p className="text-muted-foreground text-sm">—</p>}
              </div>
              <div>
                <p className="text-muted-foreground text-[11px]">Title of Source</p>
                <p className="text-sm font-semibold">{ts || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-[11px]">Author / Publisher</p>
                <p className="text-sm font-semibold">{ap || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-[11px]">Date of Publication</p>
                <p className="text-sm font-semibold">{dp || "—"}</p>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">—</p>
          )
        } else if (isLineItemsQuestion(q)) {
          displayValue = <LineItemsTable raw={value} />
        } else if (isRichText || looksLikeRichTextDoc(value)) {
          // Essays never render inline here — the teacher opens them as a
          // full document (with inline + overall commenting and review
          // actions) from a compact card.
          const hasEssay = !!value && value.trim().length > 0
          const snippet = hasEssay ? extractPlainText(value).replace(/\s+/g, " ").trim() : ""
          displayValue = (
            <div>
              <div className="flex items-center justify-between gap-4 rounded-lg border bg-muted/30 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm">
                    {snippet ? snippet.slice(0, 110) : <span className="text-muted-foreground italic">No essay written yet.</span>}
                  </p>
                  {hasEssay && (
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {richTextWordCount(value)} words
                    </p>
                  )}
                </div>
                <Button asChild size="sm" variant="outline" className="shrink-0 bg-white dark:bg-transparent">
                  <Link href={`${cfg.adminBasePath}/${studentId}/essay/${q.id}`}>Open document</Link>
                </Button>
              </div>
              {(q.min_words > 0 || showAiFooter) && (
                <div className="text-muted-foreground/60 mt-1 flex items-center justify-between gap-2 text-xs">
                  <span>
                    {q.min_words > 0 ? `${richTextWordCount(value)} / ${q.min_words} words` : ""}
                  </span>
                  {showAiFooter && (
                    <span className="flex shrink-0 items-center gap-1.5">
                      <PlagiarismScoresInline data={gptzero!} />
                      {relativeTime && (
                        <>
                          <span className="text-muted-foreground/40">&mdash;</span>
                          <span>{relativeTime}</span>
                        </>
                      )}
                    </span>
                  )}
                </div>
              )}
            </div>
          )
        } else {
          displayValue = (
            <div>
              <p className={`whitespace-pre-wrap text-sm ${qIsDimmed ? "" : "font-semibold"}`}>
                {value || "—"}
              </p>
              {isLong && (q.min_words > 0 || showAiFooter) && (
                <div className="text-muted-foreground/60 mt-1 flex items-center justify-between gap-2 text-xs">
                  <span>
                    {isLong && q.min_words > 0 ? `${getWordCount(value)} / ${q.min_words} words` : ""}
                  </span>
                  {showAiFooter && (
                    <span className="flex shrink-0 items-center gap-1.5">
                      <PlagiarismScoresInline data={gptzero!} />
                      {relativeTime && (
                        <>
                          <span className="text-muted-foreground/40">&mdash;</span>
                          <span>{relativeTime}</span>
                        </>
                      )}
                    </span>
                  )}
                </div>
              )}
            </div>
          )
        }

        return (
          <CollapsibleQuestionCard
            key={q.id}
            fieldName={q.field_name}
            colSpan={colSpan}
            isDimmed={qIsDimmed}
            isComplete={qIsComplete}
            label={q.field_label}
            displayValue={displayValue}
          >
              <div className="flex items-center gap-2">
                {relativeTime && !showAiFooter && (
                  <span className="text-muted-foreground/60 text-[11px]">{relativeTime}</span>
                )}
                <TeacherComment
                  fieldName={q.field_name}
                  fieldLabel={q.field_label}
                  fieldValue={(isRichText ? extractPlainText(value) : value) || "—"}
                  imageUrl={isImage ? getImageUrl(imageValue) : undefined}
                  minWords={q.min_words > 0 ? q.min_words : undefined}
                  comments={comments}
                  onSubmit={handlePostComment}
                  onDelete={handleDelete}
                  plagiarism={(isLong || isRichText) && isSubmitted ? gptzero : undefined}
                  teacherGuideline={q.teacher_guideline}
                  responseStatus={response ? { isComplete: response.isComplete, revisionNeeded: response.revisionNeeded, readyReview: response.readyReview } : null}
                  lastEdited={response?.last_edited}
                  onMarkRepliesSeen={handleMarkRepliesSeen}
                  onMarkCompleteAction={isSubmitted || hasReviewableContent ? () => handleResponseReviewAction(response!.id, q.id, "complete") : undefined}
                  onRequestRevision={isSubmitted || hasReviewableContent ? () => { setRevisionModal({ responseId: response!.id, templateId: q.id }); setRevisionComment("") } : undefined}
                  onUndoStatus={isSubmitted && (response!.isComplete || (response!.revisionNeeded && !studentEditedSinceRevision)) ? () => handleResponseReviewAction(response!.id, q.id, "ready") : undefined}
                />
                {response && (() => {
                  if (!isSubmitted) {
                    return (
                      <>
                        {hasReviewableContent && (
                          <>
                            <Button
                              variant="outline"
                              size="icon"
                              className="size-6"
                              title="Request revision"
                              onClick={() => { setRevisionModal({ responseId: response.id, templateId: q.id }); setRevisionComment("") }}
                            >
                              <HugeiconsIcon icon={ArrowTurnBackwardIcon} strokeWidth={2} className="size-3.5 text-muted-foreground" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              className="size-6"
                              title="Mark complete"
                              onClick={() => handleResponseReviewAction(response.id, q.id, "complete")}
                            >
                              <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} className="size-3.5 text-muted-foreground" />
                            </Button>
                          </>
                        )}
                        <span className="text-muted-foreground/50 text-[10px] font-medium uppercase tracking-wide">Draft</span>
                      </>
                    )
                  }
                  if (response.isComplete) {
                    return (
                      <>
                        <div title="Complete">
                          <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} className="size-4 text-green-600" />
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 bg-white px-2 text-[10px] dark:bg-transparent"
                          title="Undo — return to review"
                          onClick={() => handleResponseReviewAction(response.id, q.id, "ready")}
                        >
                          Undo
                        </Button>
                      </>
                    )
                  }
                  if (response.revisionNeeded) {
                    return (
                      <>
                        <div title="Needs revision">
                          <HugeiconsIcon icon={AlertCircleIcon} strokeWidth={2} className="size-4 text-red-500" />
                        </div>
                        {!studentEditedSinceRevision && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 bg-white px-2 text-[10px] dark:bg-transparent"
                            title="Undo — return to review"
                            onClick={() => handleResponseReviewAction(response.id, q.id, "ready")}
                          >
                            Undo
                          </Button>
                        )}
                      </>
                    )
                  }
                  return (
                    <>
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-6"
                        title="Request revision"
                        onClick={() => { setRevisionModal({ responseId: response.id, templateId: q.id }); setRevisionComment("") }}
                      >
                        <HugeiconsIcon icon={ArrowTurnBackwardIcon} strokeWidth={2} className="size-3.5 text-muted-foreground" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-6"
                        title="Mark complete"
                        onClick={() => handleResponseReviewAction(response.id, q.id, "complete")}
                      >
                        <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} className="size-3.5 text-muted-foreground" />
                      </Button>
                      <div title="Ready for review">
                        <HugeiconsIcon icon={SentIcon} strokeWidth={2} className="size-4 text-blue-500" />
                      </div>
                    </>
                  )
                })()}
              </div>
          </CollapsibleQuestionCard>
        )
      })

    if (flat) return <>{items}</>
    return (
      <div className="grid gap-3 md:grid-cols-6">
        {items}
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          {subtitle && <p className="text-muted-foreground mt-1 text-sm">{subtitle}</p>}
        </div>
      </div>

      {headerContent}

      {questions.length === 0 ? (
        <p className="text-muted-foreground">No data submitted yet for this section.</p>
      ) : (
        <div className="space-y-6">
          {ungroupedQuestions.length > 0 && (() => {
            const ungroupedResponses = ungroupedQuestions.map((q) => responses.get(q.id)).filter(Boolean) as StudentResponse[]
            const completedCount = ungroupedResponses.filter((r) => r.isComplete).length
            const revisionCount = ungroupedResponses.filter((r) => r.revisionNeeded).length
            const readyCount = ungroupedResponses.filter((r) => r.readyReview && !r.isComplete && !r.revisionNeeded).length
            const blankCount = ungroupedQuestions.length - completedCount - revisionCount - readyCount
            const hasBadges = completedCount > 0 || readyCount > 0 || revisionCount > 0 || blankCount > 0
            return (
              <Card className="overflow-hidden !pt-0 !gap-0">
                {hasBadges && (
                  <div className="flex items-center justify-between border-b px-6 py-3">
                    <div className="flex shrink-0 items-center gap-2">
                      {completedCount > 0 && (
                        <div className="relative inline-flex size-8 items-center justify-center rounded-lg border" title={`${completedCount} complete`}>
                          <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} className="size-4 text-green-600" />
                          <span className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-green-600 text-[9px] font-bold text-white">{completedCount}</span>
                        </div>
                      )}
                      {readyCount > 0 && (
                        <div className="relative inline-flex size-8 items-center justify-center rounded-lg border" title={`${readyCount} ready for review`}>
                          <HugeiconsIcon icon={SentIcon} strokeWidth={2} className="size-4 text-blue-500" />
                          <span className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-blue-500 text-[9px] font-bold text-white">{readyCount}</span>
                        </div>
                      )}
                      {revisionCount > 0 && (
                        <div className="relative inline-flex size-8 items-center justify-center rounded-lg border" title={`${revisionCount} need revision`}>
                          <HugeiconsIcon icon={AlertCircleIcon} strokeWidth={2} className="size-4 text-red-500" />
                          <span className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">{revisionCount}</span>
                        </div>
                      )}
                      {blankCount > 0 && (
                        <div className="relative inline-flex size-8 items-center justify-center rounded-lg border" title={`${blankCount} not started`}>
                          <HugeiconsIcon icon={CircleIcon} strokeWidth={1.5} className="text-muted-foreground/40 size-4" />
                          <span className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-gray-400 text-[9px] font-bold text-white">{blankCount}</span>
                        </div>
                      )}
                    </div>
                    {readyCount > 0 && (
                      <ConfirmAllButton
                        readyCount={readyCount}
                        onConfirmAll={async () => {
                          const readyQs = ungroupedQuestions.filter((q) => {
                            const r = responses.get(q.id)
                            return r?.readyReview && !r?.isComplete && !r?.revisionNeeded
                          })
                          for (const q of readyQs) {
                            const r = responses.get(q.id)
                            if (r) await handleResponseReviewAction(r.id, q.id, "complete", undefined, true)
                          }
                          toast.success(`${readyQs.length} question${readyQs.length > 1 ? "s" : ""} confirmed`, { duration: 3000 })
                        }}
                      />
                    )}
                    {(() => {
                      const targets = ungroupedQuestions.filter((q) => {
                        const r = responses.get(q.id)
                        return hasResponseContent(r) && !r!.isComplete && !r!.revisionNeeded
                      })
                      if (targets.length === 0) return null
                      return (
                        <RequestRevisionAllButton
                          count={targets.length}
                          onConfirm={async (feedback) => {
                            for (const q of targets) {
                              const r = responses.get(q.id)
                              if (r) await handleResponseReviewAction(r.id, q.id, "revision", undefined, true)
                            }
                            await postBulkRevisionNote(feedback)
                            toast.success(`${targets.length} item${targets.length > 1 ? "s" : ""} sent back for revision`, { duration: 3000 })
                          }}
                        />
                      )
                    })()}
                  </div>
                )}
                <CardContent className="p-6">
                  {renderQuestionList(ungroupedQuestions)}
                </CardContent>
              </Card>
            )
          })()}

          {groupedSections.map(({ group, questions: gQuestions }) => {
            const groupResponses = gQuestions.map((q) => responses.get(q.id)).filter(Boolean) as StudentResponse[]
            const completedCount = groupResponses.filter((r) => r.isComplete).length
            const revisionCount = groupResponses.filter((r) => r.revisionNeeded).length
            const readyCount = groupResponses.filter((r) => r.readyReview && !r.isComplete && !r.revisionNeeded).length
            const blankCount = gQuestions.length - completedCount - revisionCount - readyCount
            const allComplete = completedCount === gQuestions.length && gQuestions.length > 0

            const hasDisplayType = isGroupDisplayType(group[F.displayTypesId] as number | null | undefined)
            const groupComments = comments.filter(
              (c) => c.field_name === "_section_comment" && Number(c[F.customGroupId]) === group.id
            )

            return (
              <ReadonlyGroupCard
                key={group.id}
                group={group}
                allComplete={allComplete}
                completedCount={completedCount}
                readyCount={readyCount}
                revisionCount={revisionCount}
                blankCount={blankCount}
                groupComments={groupComments}
                session={session}
                studentId={studentId}
                sectionId={sectionId}
                cfg={cfg}
                F={F}
                setComments={setComments}
                handleDelete={handleDelete}
                handleResponseReviewAction={handleResponseReviewAction}
                postBulkRevisionNote={postBulkRevisionNote}
                responses={responses}
                gQuestions={gQuestions}
                hasDisplayType={hasDisplayType}
                renderQuestionList={renderQuestionList}
              />
            )
          })}
        </div>
      )}

      <Dialog open={revisionModal !== null} onOpenChange={(open) => { if (!open) { setRevisionModal(null); setRevisionComment("") } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Revision</DialogTitle>
            <DialogDescription>
              Add a comment explaining what needs to be revised.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Comment</Label>
            <Textarea
              autoFocus
              placeholder="Describe what needs to be revised..."
              value={revisionComment}
              onChange={(e) => setRevisionComment(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && revisionComment.trim() && revisionModal) {
                  e.preventDefault()
                  handleResponseReviewAction(revisionModal.responseId, revisionModal.templateId, "revision", revisionComment)
                  setRevisionModal(null)
                  setRevisionComment("")
                }
              }}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRevisionModal(null); setRevisionComment("") }}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!revisionModal) return
                handleResponseReviewAction(revisionModal.responseId, revisionModal.templateId, "revision", revisionComment)
                setRevisionModal(null)
                setRevisionComment("")
              }}
            >
              Request Revision
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function toPercent(val: unknown): number {
  const n = typeof val === "string" ? parseFloat(val) : typeof val === "number" ? val : 0
  if (isNaN(n)) return 0
  return n <= 1 ? Math.round(n * 100) : Math.round(n)
}

function isAiHighest(data: GptZeroResult): boolean {
  const ai = toPercent(data.class_probability_ai ?? 0)
  const human = toPercent(data.class_probability_human ?? 0)
  const mixed = toPercent(data.mixed ?? 0)
  return ai >= human && ai >= mixed && ai > 0
}

function PlagiarismScoresInline({ data }: { data: GptZeroResult }) {
  const ai = toPercent(data.class_probability_ai ?? 0)
  const human = toPercent(data.class_probability_human ?? 0)
  const mixed = toPercent(data.mixed ?? 0)
  const relTime = data.created_at ? formatRelativeTime(
    typeof data.created_at === "number" ? data.created_at : new Date(String(data.created_at)).getTime()
  ) : null

  const max = Math.max(ai, human, mixed)
  const aiIsMax = ai === max
  const humanIsMax = human === max
  const mixedIsMax = mixed === max && !aiIsMax && !humanIsMax

  return (
    <span className="flex items-center gap-1.5 text-[11px]">
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
      {relTime && (
        <>
          <span className="text-muted-foreground/40">&mdash;</span>
          <span className="text-muted-foreground/60">{relTime}</span>
        </>
      )}
    </span>
  )
}

// Bumped each time a group is manually expanded, so every completed question
// inside opens with it instead of needing a click on each one.
const ReadonlyGroupExpandContext = createContext(0)

function CollapsibleQuestionCard({
  fieldName,
  colSpan,
  isDimmed,
  isComplete,
  label,
  displayValue,
  children,
}: {
  fieldName: string
  colSpan: string
  isDimmed: boolean
  isComplete: boolean
  label: string
  displayValue: React.ReactNode
  children: React.ReactNode
}) {
  const [collapsed, setCollapsed] = useState(isComplete)

  // When the surrounding group is expanded, open this question too. Adjusting
  // state during render (comparing against the last-seen key) is React's
  // recommended pattern for reacting to a changing value without an effect.
  const groupExpandKey = useContext(ReadonlyGroupExpandContext)
  const [lastExpandKey, setLastExpandKey] = useState(groupExpandKey)
  if (groupExpandKey !== lastExpandKey) {
    setLastExpandKey(groupExpandKey)
    if (groupExpandKey > 0) setCollapsed(false)
  }

  return (
    <div
      data-field-name={fieldName}
      className={`rounded-lg bg-gray-50 p-3 dark:bg-muted/30 ${colSpan} ${isDimmed ? "opacity-50" : ""}`}
    >
      <div
        className={`mb-1.5 flex items-center justify-between ${isComplete ? "cursor-pointer select-none" : ""}`}
        onClick={isComplete ? () => setCollapsed((v) => !v) : undefined}
      >
        <div className="flex items-center gap-1.5">
          <div className={`inline-flex size-4 items-center justify-center rounded-full border ${isComplete ? "border-gray-300" : "border-gray-200"}`}>
            <HugeiconsIcon
              icon={ArrowDown01Icon}
              strokeWidth={2}
              className={`size-2.5 shrink-0 transition-transform duration-200 ${isComplete ? "text-muted-foreground/60" : "text-muted-foreground/25"} ${collapsed ? "-rotate-90" : ""}`}
            />
          </div>
          <Label className={`text-muted-foreground text-xs font-medium ${isComplete ? "cursor-pointer" : ""}`}>
            {label}
          </Label>
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          {children}
        </div>
      </div>
      <div className={`grid transition-[grid-template-rows] duration-200 ease-in-out ${collapsed ? "grid-rows-[0fr]" : "grid-rows-[1fr]"}`}>
        <div className="overflow-hidden">
          {displayValue}
        </div>
      </div>
    </div>
  )
}

function ReadonlyGroupCard({
  group,
  allComplete,
  completedCount,
  readyCount,
  revisionCount,
  blankCount,
  groupComments,
  session,
  studentId,
  sectionId,
  cfg,
  F,
  setComments,
  handleDelete,
  handleResponseReviewAction,
  postBulkRevisionNote,
  responses,
  gQuestions,
  hasDisplayType,
  renderQuestionList,
}: {
  group: CustomGroup
  allComplete: boolean
  completedCount: number
  readyCount: number
  revisionCount: number
  blankCount: number
  groupComments: Comment[]
  session: ReturnType<typeof useSession>["data"]
  studentId: string
  sectionId: number
  cfg: FormApiConfig
  F: FormApiConfig["fields"]
  setComments: React.Dispatch<React.SetStateAction<Comment[]>>
  handleDelete: (id: number) => Promise<void>
  handleResponseReviewAction: (responseId: number, templateId: number, action: "complete" | "revision" | "ready" | "clear", comment?: string, silent?: boolean) => Promise<void>
  postBulkRevisionNote: (note: string, groupId?: number) => Promise<void>
  responses: Map<number, StudentResponse>
  gQuestions: TemplateQuestion[]
  hasDisplayType: boolean
  renderQuestionList: (qs: TemplateQuestion[], flat?: boolean) => React.ReactNode
}) {
  const [collapsed, setCollapsed] = useState(allComplete)
  const [expandKey, setExpandKey] = useState(0)

  const toggleCollapsed = () => {
    // Expanding the group opens every completed question inside it too.
    if (collapsed) setExpandKey((k) => k + 1)
    setCollapsed((v) => !v)
  }

  return (
    <Card className="overflow-hidden !pt-0 !gap-0">
      <div
        className="cursor-pointer border-b px-6 py-4 select-none"
        onClick={toggleCollapsed}
      >
        <div className="flex items-center justify-between">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div className="inline-flex size-7 items-center justify-center rounded-md border">
              <HugeiconsIcon
                icon={ArrowDown01Icon}
                strokeWidth={2}
                className={`text-muted-foreground size-3.5 shrink-0 transition-transform duration-200 ${collapsed ? "-rotate-90" : ""}`}
              />
            </div>
            <CardTitle className="min-w-0 flex-1 truncate text-lg">{group.group_name}</CardTitle>
          </div>
          <div className="flex shrink-0 items-center gap-2" onClick={(e) => e.stopPropagation()}>
            {completedCount > 0 && (
              <div className="relative inline-flex size-8 items-center justify-center rounded-lg border" title={`${completedCount} complete`}>
                <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} className="size-4 text-green-600" />
                <span className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-green-600 text-[9px] font-bold text-white">{completedCount}</span>
              </div>
            )}
            {readyCount > 0 && (
              <div className="relative inline-flex size-8 items-center justify-center rounded-lg border" title={`${readyCount} ready for review`}>
                <HugeiconsIcon icon={SentIcon} strokeWidth={2} className="size-4 text-blue-500" />
                <span className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-blue-500 text-[9px] font-bold text-white">{readyCount}</span>
              </div>
            )}
            {revisionCount > 0 && (
              <div className="relative inline-flex size-8 items-center justify-center rounded-lg border" title={`${revisionCount} need revision`}>
                <HugeiconsIcon icon={AlertCircleIcon} strokeWidth={2} className="size-4 text-red-500" />
                <span className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">{revisionCount}</span>
              </div>
            )}
            {blankCount > 0 && (
              <div className="relative inline-flex size-8 items-center justify-center rounded-lg border" title={`${blankCount} not started`}>
                <HugeiconsIcon icon={CircleIcon} strokeWidth={1.5} className="text-muted-foreground/40 size-4" />
                <span className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-gray-400 text-[9px] font-bold text-white">{blankCount}</span>
              </div>
            )}
            <TeacherComment
              fieldName="_section_comment"
              fieldLabel={group.group_name}
              fieldValue={group.group_description || undefined}
              comments={groupComments}
              onSubmit={async (_, note) => {
                const teacherName = session?.user?.name ?? "Teacher"
                const teachersId = (session?.user as Record<string, unknown>)?.teachers_id ?? null
                const payload: Record<string, unknown> = {
                  students_id: studentId,
                  teachers_id: teachersId,
                  field_name: "_section_comment",
                  [F.sectionId]: sectionId,
                  [F.customGroupId]: group.id,
                  note,
                  isOld: false,
                  isComplete: false,
                  teacher_name: teacherName,
                }
                const res = await fetch(cfg.commentsEndpoint, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(payload),
                })
                if (res.ok) {
                  const newComment = await res.json()
                  setComments((prev) => [...prev, { ...newComment, teacher_name: newComment.teacher_name || teacherName }])
                }
              }}
              onDelete={handleDelete}
              square
            />
            {readyCount > 0 && (
              <ConfirmAllButton
                readyCount={readyCount}
                onConfirmAll={async () => {
                  const readyQuestions = gQuestions.filter((q) => {
                    const r = responses.get(q.id)
                    return r?.readyReview && !r?.isComplete && !r?.revisionNeeded
                  })
                  for (const q of readyQuestions) {
                    const r = responses.get(q.id)
                    if (r) await handleResponseReviewAction(r.id, q.id, "complete", undefined, true)
                  }
                  toast.success(`${readyQuestions.length} question${readyQuestions.length > 1 ? "s" : ""} confirmed`, { duration: 3000 })
                }}
              />
            )}
            {(() => {
              const targets = gQuestions.filter((q) => {
                const r = responses.get(q.id)
                return hasResponseContent(r) && !r!.isComplete && !r!.revisionNeeded
              })
              if (targets.length === 0) return null
              return (
                <RequestRevisionAllButton
                  count={targets.length}
                  onConfirm={async (feedback) => {
                    for (const q of targets) {
                      const r = responses.get(q.id)
                      if (r) await handleResponseReviewAction(r.id, q.id, "revision", undefined, true)
                    }
                    await postBulkRevisionNote(feedback, group.id)
                    toast.success(`${targets.length} item${targets.length > 1 ? "s" : ""} sent back for revision`, { duration: 3000 })
                  }}
                />
              )
            })()}
          </div>
        </div>
        {!collapsed && group.group_description && (
          <p className="text-muted-foreground mt-1 text-sm">{group.group_description}</p>
        )}
      </div>
      <div className={`grid transition-[grid-template-rows] duration-200 ease-in-out ${collapsed ? "grid-rows-[0fr]" : "grid-rows-[1fr]"}`}>
        <div className="overflow-hidden">
          <CardContent className="p-6">
            <ReadonlyGroupExpandContext.Provider value={expandKey}>
              {hasDisplayType ? (() => {
                const displayExpansion = group[F.displayTypesExpansion] as { id: number; columns?: number } | undefined
                const cols = displayExpansion?.columns ?? 4
                const colClass = cols === 1 ? "" : cols === 2 ? "md:grid-cols-2" : cols === 3 ? "md:grid-cols-3" : "md:grid-cols-4"
                return cols === 1 ? renderQuestionList(gQuestions) : (
                  <div className={`grid gap-3 ${colClass}`}>
                    {renderQuestionList(gQuestions, true)}
                  </div>
                )
              })() : (
                renderQuestionList(gQuestions)
              )}
            </ReadonlyGroupExpandContext.Provider>
          </CardContent>
        </div>
      </div>
    </Card>
  )
}
