"use client"

import { useCallback, useEffect, useState } from "react"
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

const XANO_BASE =
  process.env.NEXT_PUBLIC_XANO_API_BASE ??
  "https://xsc3-mvx7-r86m.n7e.xano.io/api:o2_UyOKn"

const PLAGIARISM_BASE = "https://xsc3-mvx7-r86m.n7e.xano.io/api:-S1CSX2N"
const PLAGIARISM_CHECK_ENDPOINT = `${PLAGIARISM_BASE}/plagiarism_checker`
const GPTZERO_BY_SECTION_ENDPOINT = `${PLAGIARISM_BASE}/gptzero_document_by_section`

const TEMPLATE_ENDPOINT = `${XANO_BASE}/lifeplan_template`
const RESPONSES_ENDPOINT = `${XANO_BASE}/lifemap_responses_by_student`
const CUSTOM_GROUP_ENDPOINT = `${XANO_BASE}/lifemap_custom_group`
const COMMENTS_ENDPOINT = `${XANO_BASE}/lifemap_comments`
const REVIEW_ENDPOINT = `${XANO_BASE}/lifemap_review`
const RESPONSE_PATCH_BASE = `${XANO_BASE}/lifemap_responses`
const QUESTION_TYPES_ENDPOINT = `${XANO_BASE}/question_types`

interface ReviewRecord {
  id: number
  lifemap_sections_id: number
  lifemap_custom_group_id: number | null
  students_id: string
  readyReview: boolean
  revisionNeeded: boolean
  isComplete: boolean
  update: string | number | null
}

interface GptZeroResult {
  lifemap_responses_id: number
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
  lifemap_sections_id: number
  isPublished: boolean
  isArchived: boolean
  isDraft?: boolean
  question_types_id: number
  _question_types?: { id: number; type: string; noInput?: boolean }
  lifemap_custom_group_id: number | null
  dropdownOptions: string[]
  sortOrder: number
  teacher_guideline?: string
}

interface CustomGroup {
  id: number
  group_name: string
  group_description: string
  instructions: string
  resources: string[]
  lifemap_sections_id: number
  order?: number
  lifemap_group_display_types_id?: number | null
  _lifemap_group_display_types?: { id: number; columns?: number }
}

interface StudentResponse {
  id: number
  lifemap_template_id: number
  student_response: string
  date_response: string | null
  image_response: Record<string, unknown> | null
  students_id: string
  isArchived?: boolean
  last_edited?: string | number | null
  readyReview?: boolean
  revisionNeeded?: boolean
  isComplete?: boolean
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
} as const

interface ReadOnlyDynamicFormPageProps {
  title: string
  subtitle?: string
  sectionId: number
  studentId: string
  headerContent?: React.ReactNode
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

export function ReadOnlyDynamicFormPage({ title, subtitle, sectionId, studentId, headerContent }: ReadOnlyDynamicFormPageProps) {
  const { data: session } = useSession()
  const [questions, setQuestions] = useState<TemplateQuestion[]>([])
  const [customGroups, setCustomGroups] = useState<CustomGroup[]>([])
  const [responses, setResponses] = useState<Map<number, StudentResponse>>(new Map())
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [plagiarismData, setPlagiarismData] = useState<Map<number, GptZeroResult>>(new Map())
  const [groupReviews, setGroupReviews] = useState<Map<number, ReviewRecord>>(new Map())
  const [reviewModal, setReviewModal] = useState<{ groupId: number; action: "resubmission" | "complete" } | null>(null)
  const [revisionModal, setRevisionModal] = useState<{ responseId: number; templateId: number } | null>(null)
  const [revisionComment, setRevisionComment] = useState("")
  const [reviewComment, setReviewComment] = useState("")

  useEffect(() => {
    const loadData = async () => {
      try {
        const [templateRes, responsesRes, groupsRes, commentsRes, qTypesRes] = await Promise.all([
          fetch(TEMPLATE_ENDPOINT),
          fetch(`${RESPONSES_ENDPOINT}?students_id=${studentId}`),
          fetch(CUSTOM_GROUP_ENDPOINT),
          fetch(`${COMMENTS_ENDPOINT}?students_id=${studentId}&lifemap_sections_id=${sectionId}`),
          fetch(QUESTION_TYPES_ENDPOINT),
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
            .filter((q) => q.lifemap_sections_id === sectionId && q.isPublished && !q.isArchived && !noInputTypeIds.has(q.question_types_id))
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
            map.set(r.lifemap_template_id, r)
          }
          setResponses(map)
        }

        if (groupsRes.ok) {
          const allGroups = (await groupsRes.json()) as CustomGroup[]
          setCustomGroups(allGroups.filter((g) => g.lifemap_sections_id === sectionId))
        }

        if (commentsRes.ok) {
          const data = await commentsRes.json()
          if (Array.isArray(data)) {
            const enriched = data
              .filter((c: Record<string, unknown>) => {
                if (Number(c.lifemap_sections_id) !== sectionId) return false
                const tid = c.lifemap_template_id as number | null | undefined
                if (tid && excludedTemplateIds.has(tid)) return false
                return true
              })
              .map((c: Record<string, unknown>) => {
                const teachers = c._teachers as { firstName?: string; lastName?: string }[] | undefined
                const teacher = teachers?.[0]
                const teacherName = teacher
                  ? `${teacher.firstName ?? ""} ${teacher.lastName ?? ""}`.trim()
                  : undefined
                return { ...c, teacher_name: teacherName } as Comment
              })
            setComments(enriched)
          }
        }
        try {
          const reviewRes = await fetch(REVIEW_ENDPOINT)
          if (reviewRes.ok) {
            const allReviews = await reviewRes.json()
            if (Array.isArray(allReviews)) {
              const map = new Map<number, ReviewRecord>()
              for (const r of allReviews) {
                if (String(r.students_id) === String(studentId) && Number(r.lifemap_sections_id) === sectionId && r.lifemap_custom_group_id) {
                  map.set(r.lifemap_custom_group_id, r)
                }
              }
              setGroupReviews(map)
            }
          }
        } catch { /* ignore */ }

        try {
          const gptzeroRes = await fetch(
            `${GPTZERO_BY_SECTION_ENDPOINT}?lifemap_sections_id=${sectionId}&students_id=${studentId}`
          )
          if (gptzeroRes.ok) {
            const gptzeroData = await gptzeroRes.json()
            if (Array.isArray(gptzeroData)) {
              const map = new Map<number, GptZeroResult>()
              for (const r of gptzeroData) {
                if (!r.lifemap_responses_id) continue
                const existing = map.get(r.lifemap_responses_id)
                if (!existing || (r.id as number) > (existing.id as number)) {
                  map.set(r.lifemap_responses_id, r)
                }
              }
              setPlagiarismData(map)
            }
          }
        } catch { /* ignore */ }
      } catch {
        // Silently fail
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [studentId, sectionId])

  const handleReviewAction = useCallback(
    async () => {
      if (!reviewModal) return
      const { groupId, action } = reviewModal
      const review = groupReviews.get(groupId)
      if (!review) return

      const patch: Partial<ReviewRecord> = action === "complete"
        ? { isComplete: true, revisionNeeded: false, readyReview: false, update: new Date().toISOString() }
        : { revisionNeeded: true, readyReview: false, isComplete: false, update: new Date().toISOString() }

      try {
        const res = await fetch(`${REVIEW_ENDPOINT}/${review.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        })
        if (!res.ok) throw new Error()

        setGroupReviews((prev) => {
          const next = new Map(prev)
          next.set(groupId, { ...review, ...patch })
          return next
        })

        if (review.readyReview) {
          window.dispatchEvent(new CustomEvent("review-update", { detail: { sectionId, delta: -1 } }))
        }

        if (reviewComment.trim()) {
          const teacherName = session?.user?.name ?? "Teacher"
          const teachersId = (session?.user as Record<string, unknown>)?.teachers_id ?? null
          await fetch(COMMENTS_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              students_id: studentId,
              teachers_id: teachersId,
              field_name: "_section_comment",
              lifemap_sections_id: sectionId,
              lifemap_custom_group_id: groupId,
              note: reviewComment.trim(),
              isOld: false,
              isComplete: false,
              isRevisionFeedback: action === "resubmission",
              teacher_name: teacherName,
            }),
          })
        }

        toast.success(action === "complete" ? "Marked as complete" : "Resubmission requested")
      } catch {
        toast.error("Failed to update review status")
      } finally {
        setReviewModal(null)
        setReviewComment("")
      }
    },
    [reviewModal, groupReviews, reviewComment, session, studentId, sectionId, customGroups]
  )

  const handlePostComment = useCallback(
    async (fieldName: string, note: string) => {
      const teacherName = session?.user?.name ?? "Teacher"
      const teachersId = (session?.user as Record<string, unknown>)?.teachers_id ?? null

      const payload = {
        students_id: studentId,
        teachers_id: teachersId,
        field_name: fieldName,
        lifemap_sections_id: sectionId,
        note,
        isOld: false,
        isComplete: false,
        teacher_name: teacherName,
      }

      const res = await fetch(COMMENTS_ENDPOINT, {
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
    [studentId, session, sectionId]
  )

  const handleDelete = useCallback(
    async (commentId: number) => {
      const res = await fetch(`${COMMENTS_ENDPOINT}/${commentId}`, {
        method: "DELETE",
      })

      if (res.ok) {
        setComments((prev) => prev.filter((c) => c.id !== commentId))
      }
    },
    []
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
        const res = await fetch(`${RESPONSE_PATCH_BASE}/${responseId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        })
        if (res.ok) {
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
            await fetch(COMMENTS_ENDPOINT, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                students_id: studentId,
                teachers_id: teachersId,
                field_name: q?.field_name ?? "",
                lifemap_sections_id: sectionId,
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

          if (action === "complete") {
            const q = questions.find((qt) => qt.id === templateId)
            if (q?.lifemap_custom_group_id) {
              const groupId = q.lifemap_custom_group_id
              const groupQuestions = questions.filter((gq) => gq.lifemap_custom_group_id === groupId)
              setResponses((prev) => {
                const allComplete = groupQuestions.every((gq) => {
                  if (gq.id === templateId) return true
                  const r = prev.get(gq.id)
                  return r?.isComplete === true
                })
                if (allComplete) {
                  const review = groupReviews.get(groupId)
                  if (review && !review.isComplete) {
                    const groupPatch = { isComplete: true, revisionNeeded: false, readyReview: false, update: new Date().toISOString() }
                    fetch(`${REVIEW_ENDPOINT}/${review.id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(groupPatch),
                    }).then((r) => {
                      if (r.ok) {
                        setGroupReviews((gp) => {
                          const next = new Map(gp)
                          next.set(groupId, { ...review, ...groupPatch })
                          return next
                        })
                        if (!silent) toast.success("Group automatically marked complete")
                      }
                    }).catch(() => {})
                  }
                }
                return prev
              })
            }
          }
        }
      } catch {
        if (!silent) toast.error("Failed to update status")
      }
    },
    [session, studentId, sectionId, questions, groupReviews]
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

  const ungroupedQuestions = questions.filter((q) => !q.lifemap_custom_group_id)
  const groupedSections = [...customGroups]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((group) => ({
      group,
      questions: questions
        .filter((q) => q.lifemap_custom_group_id === group.id)
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
        const colSpan = flat ? "" : (isLong || isImage ? "md:col-span-6" : "md:col-span-3")

        const gptzero = response ? plagiarismData.get(response.id) : undefined
        const aiIsHighest = gptzero ? isAiHighest(gptzero) : false
        const qIsComplete = response?.isComplete === true
        const qNeedsRevision = response?.revisionNeeded === true
        const qIsDimmed = qIsComplete || qNeedsRevision

        let displayValue: React.ReactNode
        if (isImage) {
          const url = getImageUrl(imageValue)
          displayValue = url ? (
            <img src={url} alt={q.field_label} className="h-40 w-full rounded-lg border object-cover" />
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
        } else {
          displayValue = (
            <div>
              <p className={`whitespace-pre-wrap text-sm ${qIsDimmed ? "" : "font-semibold"}`}>
                {value || "—"}
              </p>
              {isLong && (q.min_words > 0 || gptzero) && (
                <div className="text-muted-foreground/60 mt-1 flex items-center justify-between text-xs">
                  <span>
                    {isLong && q.min_words > 0 ? `${getWordCount(value)} / ${q.min_words} words` : ""}
                  </span>
                  {gptzero && <PlagiarismScoresInline data={gptzero} />}
                </div>
              )}
            </div>
          )
        }

        const relativeTime = formatRelativeTime(response?.last_edited)

        return (
          <div
            key={q.id}
            className={`rounded-lg bg-gray-50 p-3 dark:bg-muted/30 ${colSpan} ${qIsDimmed ? "opacity-50" : ""}`}
          >
            <div className="mb-1.5 flex items-center justify-between">
              <Label className="text-muted-foreground text-xs font-medium">
                {q.field_label}
              </Label>
              <div className="flex items-center gap-2">
                {relativeTime && (
                  <span className="text-muted-foreground/60 text-[11px]">{relativeTime}</span>
                )}
                <TeacherComment
                  fieldName={q.field_name}
                  fieldLabel={q.field_label}
                  fieldValue={value || "—"}
                  minWords={q.min_words > 0 ? q.min_words : undefined}
                  comments={comments}
                  onSubmit={handlePostComment}
                  onDelete={handleDelete}
                  plagiarism={isLong ? gptzero : undefined}
                  teacherGuideline={q.teacher_guideline}
                />
                {response && (
                  <>
                    {!response.revisionNeeded && (
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-6"
                        title="Request revision"
                        onClick={() => { setRevisionModal({ responseId: response.id, templateId: q.id }); setRevisionComment("") }}
                      >
                        <HugeiconsIcon icon={ArrowTurnBackwardIcon} strokeWidth={2} className="size-3.5 text-muted-foreground" />
                      </Button>
                    )}
                    {!response.isComplete && (
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-6"
                        title="Mark complete"
                        onClick={() => handleResponseReviewAction(response.id, q.id, "complete")}
                      >
                        <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} className="size-3.5 text-muted-foreground" />
                      </Button>
                    )}
                    {response.isComplete && (
                      <div title="Complete">
                        <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} className="size-4 text-green-600" />
                      </div>
                    )}
                    {response.revisionNeeded && (
                      <div title="Needs revision">
                        <HugeiconsIcon icon={AlertCircleIcon} strokeWidth={2} className="size-4 text-red-500" />
                      </div>
                    )}
                    {response.readyReview && !response.isComplete && !response.revisionNeeded && (
                      <div title="Ready for review">
                        <HugeiconsIcon icon={SentIcon} strokeWidth={2} className="size-4 text-blue-500" />
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
            {displayValue}
          </div>
        )
      })

    if (flat) return <>{items}</>
    return (
      <div className="grid gap-3 md:grid-cols-6">
        {items}
      </div>
    )
  }

  const allReadyQuestions = questions.filter((q) => {
    const r = responses.get(q.id)
    return r?.readyReview && !r?.isComplete && !r?.revisionNeeded
  })

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          {subtitle && <p className="text-muted-foreground mt-1 text-sm">{subtitle}</p>}
        </div>
        {allReadyQuestions.length > 0 && (
          <ConfirmAllButton
            readyCount={allReadyQuestions.length}
            onConfirmAll={async () => {
              for (const q of allReadyQuestions) {
                const r = responses.get(q.id)
                if (r) await handleResponseReviewAction(r.id, q.id, "complete", undefined, true)
              }
              toast.success(`${allReadyQuestions.length} question${allReadyQuestions.length > 1 ? "s" : ""} confirmed`, { duration: 3000 })
            }}
          />
        )}
      </div>

      {headerContent}

      {questions.length === 0 ? (
        <p className="text-muted-foreground">No data submitted yet for this section.</p>
      ) : (
        <div className="space-y-6">
          {ungroupedQuestions.length > 0 && (
            <Card>
              <CardContent className="p-6">
                {renderQuestionList(ungroupedQuestions)}
              </CardContent>
            </Card>
          )}

          {groupedSections.map(({ group, questions: gQuestions }) => {
            const groupResponses = gQuestions.map((q) => responses.get(q.id)).filter(Boolean) as StudentResponse[]
            const completedCount = groupResponses.filter((r) => r.isComplete).length
            const revisionCount = groupResponses.filter((r) => r.revisionNeeded).length
            const readyCount = groupResponses.filter((r) => r.readyReview && !r.isComplete && !r.revisionNeeded).length
            const blankCount = gQuestions.length - completedCount - revisionCount - readyCount

            const hasDisplayType = isGroupDisplayType(group.lifemap_group_display_types_id)

            return (
              <Card key={group.id} className="overflow-hidden !pt-0 !gap-0">
                <div className="border-b px-6 py-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="min-w-0 flex-1 truncate text-lg">{group.group_name}</CardTitle>
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
                    </div>
                  </div>
                  {group.group_description && (
                    <p className="text-muted-foreground mt-1 text-sm">{group.group_description}</p>
                  )}
                </div>
                <CardContent className="p-6">
                  {hasDisplayType ? (() => {
                    const cols = group._lifemap_group_display_types?.columns ?? 4
                    const colClass = cols === 1 ? "" : cols === 2 ? "md:grid-cols-2" : cols === 3 ? "md:grid-cols-3" : "md:grid-cols-4"
                    return cols === 1 ? renderQuestionList(gQuestions) : (
                      <div className={`grid gap-3 ${colClass}`}>
                        {renderQuestionList(gQuestions, true)}
                      </div>
                    )
                  })() : (
                    renderQuestionList(gQuestions)
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog open={reviewModal !== null} onOpenChange={(open) => { if (!open) { setReviewModal(null); setReviewComment("") } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewModal?.action === "complete" ? "Mark Group as Complete?" : "Request Resubmission?"}
            </DialogTitle>
            <DialogDescription>
              {reviewModal?.action === "complete"
                ? `This will mark "${customGroups.find((g) => g.id === reviewModal?.groupId)?.group_name ?? "this group"}" as complete.`
                : `This will request a resubmission for "${customGroups.find((g) => g.id === reviewModal?.groupId)?.group_name ?? "this group"}".`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Comment (optional)</Label>
            <Textarea
              placeholder="Add a note for the student..."
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setReviewModal(null); setReviewComment("") }}>
              Cancel
            </Button>
            <Button onClick={handleReviewAction}>
              {reviewModal?.action === "complete" ? "Mark Complete" : "Request Resubmission"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
