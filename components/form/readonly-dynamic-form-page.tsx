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
  Robot01Icon,
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
import { toast } from "sonner"
import { TeacherComment } from "./teacher-comment"
import type { Comment } from "@/lib/form-types"

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
  question_types_id: number
  lifemap_custom_group_id: number | null
  dropdownOptions: string[]
  sortOrder: number
}

interface CustomGroup {
  id: number
  group_name: string
  group_description: string
  instructions: string
  resources: string[]
  lifemap_sections_id: number
}

interface StudentResponse {
  id: number
  lifemap_template_id: number
  student_response: string
  date_response: string | null
  image_response: Record<string, unknown> | null
  students_id: string
  last_edited?: string | number | null
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

export function ReadOnlyDynamicFormPage({ title, subtitle, sectionId, studentId, headerContent }: ReadOnlyDynamicFormPageProps) {
  const { data: session } = useSession()
  const [questions, setQuestions] = useState<TemplateQuestion[]>([])
  const [customGroups, setCustomGroups] = useState<CustomGroup[]>([])
  const [responses, setResponses] = useState<Map<number, StudentResponse>>(new Map())
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [plagiarismData, setPlagiarismData] = useState<Map<number, GptZeroResult>>(new Map())
  const [checkingPlagiarism, setCheckingPlagiarism] = useState<Set<number>>(new Set())
  const [groupReviews, setGroupReviews] = useState<Map<number, ReviewRecord>>(new Map())
  const [reviewModal, setReviewModal] = useState<{ groupId: number; action: "resubmission" | "complete" } | null>(null)
  const [reviewComment, setReviewComment] = useState("")

  useEffect(() => {
    const loadData = async () => {
      try {
        const [templateRes, responsesRes, groupsRes, commentsRes] = await Promise.all([
          fetch(TEMPLATE_ENDPOINT),
          fetch(`${RESPONSES_ENDPOINT}?students_id=${studentId}`),
          fetch(CUSTOM_GROUP_ENDPOINT),
          fetch(`${COMMENTS_ENDPOINT}?students_id=${studentId}&lifemap_sections_id=${sectionId}`),
        ])

        if (templateRes.ok) {
          const all = (await templateRes.json()) as TemplateQuestion[]
          const filtered = all
            .filter((q) => q.lifemap_sections_id === sectionId && q.isPublished && !q.isArchived)
            .sort((a, b) => a.sortOrder - b.sortOrder)
          setQuestions(filtered)
        }

        if (responsesRes.ok) {
          const data = (await responsesRes.json()) as StudentResponse[]
          const map = new Map<number, StudentResponse>()
          for (const r of data) {
            if ((r as Record<string, unknown>).isArchived) continue
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
              .filter((c: Record<string, unknown>) => Number(c.lifemap_sections_id) === sectionId)
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
                if (r.lifemap_responses_id) map.set(r.lifemap_responses_id, r)
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

  const handlePlagiarismCheck = useCallback(
    async (responseId: number, text: string, templateId: number) => {
      if (!text.trim()) return
      setCheckingPlagiarism((prev) => new Set(prev).add(templateId))
      try {
        const params = new URLSearchParams({
          text,
          lifemap_responses_id: String(responseId),
          students_id: studentId,
          lifemap_sections_id: String(sectionId),
        })
        const res = await fetch(`${PLAGIARISM_CHECK_ENDPOINT}?${params}`)
        if (!res.ok) throw new Error()
        const result: GptZeroResult = await res.json()
        setPlagiarismData((prev) => {
          const next = new Map(prev)
          next.set(responseId, result)
          return next
        })
        toast.success("Plagiarism check complete")
      } catch {
        toast.error("Plagiarism check failed")
      } finally {
        setCheckingPlagiarism((prev) => {
          const next = new Set(prev)
          next.delete(templateId)
          return next
        })
      }
    },
    [studentId, sectionId]
  )

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
  const groupedSections = customGroups
    .map((group) => ({
      group,
      questions: questions.filter((q) => q.lifemap_custom_group_id === group.id),
    }))
    .filter((gs) => gs.questions.length > 0)

  const renderQuestionList = (qs: TemplateQuestion[]) => (
    <div className="grid gap-3 md:grid-cols-6">
      {qs.map((q) => {
        const response = responses.get(q.id)
        const value = response?.student_response ?? ""
        const imageValue = response?.image_response ?? null
        const typeId = q.question_types_id
        const isLong = typeId === QUESTION_TYPE.LONG_RESPONSE
        const isImage = typeId === QUESTION_TYPE.IMAGE_UPLOAD
        const isCurrency = typeId === QUESTION_TYPE.CURRENCY
        const colSpan = isLong || isImage ? "md:col-span-6" : "md:col-span-3"

        const gptzero = response ? plagiarismData.get(response.id) : undefined
        const isChecking = checkingPlagiarism.has(q.id)
        const aiIsHighest = gptzero ? isAiHighest(gptzero) : false

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
          displayValue = <p className="text-sm font-semibold">${num.toLocaleString("en-US")}</p>
        } else {
          displayValue = (
            <div>
              <p className={`text-sm font-semibold ${isLong ? "whitespace-pre-wrap" : ""}`}>
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
            className={`rounded-lg bg-gray-50 p-3 dark:bg-muted/30 ${colSpan}`}
          >
            <div className="mb-1.5 flex items-center justify-between">
              <Label className={cn("text-xs font-medium", aiIsHighest ? "text-red-600" : "text-muted-foreground")}>
                {q.field_label}
              </Label>
              <div className="flex items-center gap-2">
                {relativeTime && (
                  <span className="text-muted-foreground/60 text-[11px]">{relativeTime}</span>
                )}
                {isLong && (
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-6"
                    disabled={isChecking || !response || getWordCount(value) < 15}
                    onClick={() => response && handlePlagiarismCheck(response.id, value, q.id)}
                    title="Check for plagiarism"
                  >
                    {isChecking ? (
                      <span className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : (
                      <HugeiconsIcon icon={Robot01Icon} strokeWidth={2} className="size-3.5" />
                    )}
                  </Button>
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
                />
              </div>
            </div>
            {displayValue}
          </div>
        )
      })}
    </div>
  )

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle && <p className="text-muted-foreground mt-1 text-sm">{subtitle}</p>}
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
            const review = groupReviews.get(group.id)
            const relTime = review?.update ? formatRelativeTime(review.update) : null
            const statusDisplay = review?.isComplete
              ? { icon: CheckmarkCircle02Icon, color: "text-green-600", label: "Complete" }
              : review?.revisionNeeded
                ? { icon: AlertCircleIcon, color: "text-red-500", label: "Needs Revision" }
                : review?.readyReview
                  ? { icon: SentIcon, color: "text-blue-500", label: "Ready for Review" }
                  : { icon: CircleIcon, color: "text-muted-foreground/40", label: "No Status" }

            return (
              <Card key={group.id} className="overflow-hidden !pt-0 !gap-0">
                <div className="border-b px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-lg">{group.group_name}</CardTitle>
                      {group.group_description && (
                        <p className="text-muted-foreground mt-1 text-sm">{group.group_description}</p>
                      )}
                    </div>
                    {review && (
                      <div className="flex shrink-0 items-center gap-2">
                        {relTime && (
                          <span className="text-muted-foreground/60 text-[11px]">{relTime}</span>
                        )}
                        <div className="inline-flex size-7 items-center justify-center rounded-md border" title={statusDisplay.label}>
                          <HugeiconsIcon icon={statusDisplay.icon} strokeWidth={statusDisplay.icon === CircleIcon ? 1.5 : 2} className={`size-4 ${statusDisplay.color}`} />
                        </div>
                        <Button
                          variant="outline"
                          size="icon"
                          className="size-7"
                          title="Request resubmission"
                          onClick={() => { setReviewModal({ groupId: group.id, action: "resubmission" }); setReviewComment("") }}
                        >
                          <HugeiconsIcon icon={ArrowTurnBackwardIcon} strokeWidth={2} className="size-3.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="size-7"
                          title="Mark complete"
                          onClick={() => { setReviewModal({ groupId: group.id, action: "complete" }); setReviewComment("") }}
                        >
                          <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} className="size-3.5 text-green-600" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
                <CardContent className="p-6">
                  {renderQuestionList(gQuestions)}
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
