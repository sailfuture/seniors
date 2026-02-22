"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
  InputGroupTextarea,
} from "@/components/ui/input-group"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ImageUploadIcon,
  HelpCircleIcon,
  Link01Icon,
  CheckmarkCircle02Icon,
  CircleIcon,
  Comment01Icon,
  SentIcon,
  AlertCircleIcon,
} from "@hugeicons/core-free-icons"
import { WordCount } from "./word-count"
import { CommentBadge } from "./comment-badge"
import { useSaveRegister } from "@/lib/save-context"
import type { SaveStatus, Comment } from "@/lib/form-types"

const XANO_BASE =
  process.env.NEXT_PUBLIC_XANO_API_BASE ??
  "https://xsc3-mvx7-r86m.n7e.xano.io/api:o2_UyOKn"

const PLAGIARISM_BASE = "https://xsc3-mvx7-r86m.n7e.xano.io/api:-S1CSX2N"
const PLAGIARISM_CHECK_ENDPOINT = `${PLAGIARISM_BASE}/plagiarism_checker`
const GPTZERO_BY_SECTION_ENDPOINT = `${PLAGIARISM_BASE}/gptzero_document_by_section`

const TEMPLATE_ENDPOINT = `${XANO_BASE}/lifeplan_template`
const RESPONSES_ENDPOINT = `${XANO_BASE}/lifemap_responses_by_student`
const RESPONSE_PATCH_BASE = `${XANO_BASE}/lifemap_responses`
const CUSTOM_GROUP_ENDPOINT = `${XANO_BASE}/lifemap_custom_group`
const COMMENTS_ENDPOINT = `${XANO_BASE}/lifemap_comments`
const REVIEW_ENDPOINT = `${XANO_BASE}/lifemap_review`

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
  order?: number
}

interface ReviewRecord {
  id: number
  lifemap_sections_id: number
  lifemap_custom_group_id: number | null
  students_id: string
  readyReview: boolean
  revisionNeeded: boolean
  isComplete: boolean
  update?: string | number | null
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

const QUESTION_TYPE = {
  LONG_RESPONSE: 1,
  SHORT_RESPONSE: 2,
  CURRENCY: 3,
  IMAGE_UPLOAD: 4,
  DROPDOWN: 5,
  URL: 6,
  DATE: 7,
} as const

interface DynamicFormPageProps {
  title: string
  subtitle?: string
  sectionId: number
}

export function DynamicFormPage({ title, subtitle, sectionId }: DynamicFormPageProps) {
  const { data: session } = useSession()
  const { register: registerSave, unregister: unregisterSave } = useSaveRegister()
  const [questions, setQuestions] = useState<TemplateQuestion[]>([])
  const [customGroups, setCustomGroups] = useState<CustomGroup[]>([])
  const [responses, setResponses] = useState<Map<number, StudentResponse>>(new Map())
  const [localValues, setLocalValues] = useState<Map<number, string>>(new Map())
  const [comments, setComments] = useState<Comment[]>([])
  const [groupReviews, setGroupReviews] = useState<Map<number | null, ReviewRecord>>(new Map())
  const [sectionCommentsOpen, setSectionCommentsOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle")
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [plagiarismData, setPlagiarismData] = useState<Map<number, GptZeroResult>>(new Map())
  const [checkingPlagiarism, setCheckingPlagiarism] = useState<Set<number>>(new Set())
  const [hasDirty, setHasDirty] = useState(false)
  const dirtyRef = useRef(new Set<number>())

  const studentId = (session?.user as Record<string, unknown>)?.students_id as string | undefined

  const loadData = useCallback(async () => {
    if (!studentId) return

    try {
      const [templateRes, responsesRes, groupsRes, commentsRes] = await Promise.all([
        fetch(TEMPLATE_ENDPOINT),
        fetch(`${RESPONSES_ENDPOINT}?students_id=${studentId}`),
        fetch(CUSTOM_GROUP_ENDPOINT),
        fetch(`${COMMENTS_ENDPOINT}?students_id=${studentId}&lifemap_sections_id=${sectionId}`),
      ])

      let allTemplateQuestions: TemplateQuestion[] = []
      if (templateRes.ok) {
        allTemplateQuestions = (await templateRes.json()) as TemplateQuestion[]
        const filtered = allTemplateQuestions
          .filter((q) => q.lifemap_sections_id === sectionId && q.isPublished && !q.isArchived)
          .sort((a, b) => a.sortOrder - b.sortOrder)
        setQuestions(filtered)
      }

      const excludedTemplateIds = new Set(
        allTemplateQuestions.filter((q) => q.isArchived || q.isDraft).map((q) => q.id)
      )

      if (responsesRes.ok) {
        const data = (await responsesRes.json()) as StudentResponse[]
        const map = new Map<number, StudentResponse>()
        const values = new Map<number, string>()
        for (const r of data) {
          if (r.isArchived) continue
          map.set(r.lifemap_template_id, r)
          values.set(r.lifemap_template_id, r.student_response ?? "")
        }
        setResponses(map)
        setLocalValues(values)
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
                : (c.teacher_name as string | undefined)
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
            const sectionReviews = allReviews.filter(
              (r: ReviewRecord) => r.lifemap_sections_id === sectionId && r.students_id === studentId
            )
            const map = new Map<number | null, ReviewRecord>()
            for (const r of sectionReviews) {
              map.set(r.lifemap_custom_group_id ?? null, r)
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
  }, [studentId, sectionId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const saveAll = useCallback(async () => {
    const dirty = dirtyRef.current
    if (dirty.size === 0) return

    setSaveStatus("saving")
    try {
      const promises = Array.from(dirty).map(async (templateId) => {
        const response = responses.get(templateId)
        const value = localValues.get(templateId) ?? ""
        const wordCount = value.trim().split(/\s+/).filter(Boolean).length

        if (response) {
          const now = new Date().toISOString()
          await fetch(`${RESPONSE_PATCH_BASE}/${response.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ student_response: value, wordCount, last_edited: now }),
          })
          setResponses((prev) => {
            const next = new Map(prev)
            next.set(templateId, { ...response, student_response: value, last_edited: now })
            return next
          })
        }
      })

      await Promise.all(promises)
      dirtyRef.current = new Set()
      setHasDirty(false)
      setSaveStatus("saved")
      setLastSavedAt(new Date())
    } catch {
      setSaveStatus("error")
    }
  }, [responses, localValues])

  const saveNow = useCallback(() => {
    saveAll().then(() => {
      if (dirtyRef.current.size === 0) {
        toast("Changes saved", { duration: 2000 })
      }
    })
  }, [saveAll])

  useEffect(() => {
    registerSave({ saveStatus, saveNow, lastSavedAt, hasDirty })
  }, [saveStatus, saveNow, lastSavedAt, hasDirty, registerSave])

  useEffect(() => {
    return () => unregisterSave()
  }, [unregisterSave])

  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)
    }
  }, [])

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

  const handleChange = (templateId: number, value: string) => {
    setLocalValues((prev) => {
      const next = new Map(prev)
      next.set(templateId, value)
      return next
    })
    dirtyRef.current.add(templateId)
    setHasDirty(true)
    setSaveStatus("idle")

    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)
    autosaveTimerRef.current = setTimeout(() => {
      if (dirtyRef.current.size > 0) saveAll()
    }, 3000)
  }

  const dispatchCommentRead = useCallback((count: number) => {
    window.dispatchEvent(new CustomEvent("comment-read", { detail: { sectionId, count } }))
  }, [sectionId])

  const handleMarkRead = useCallback(async (commentIds: number[]) => {
    const now = new Date().toISOString()
    let readCount = 0
    setComments((prev) =>
      prev.map((c) => {
        if (commentIds.includes(c.id!) && !c.isOld) { readCount++; return { ...c, isOld: true, isRead: now } }
        return commentIds.includes(c.id!) ? { ...c, isOld: true, isRead: now } : c
      })
    )
    if (readCount > 0) dispatchCommentRead(readCount)
    for (const id of commentIds) {
      try {
        await fetch(`${COMMENTS_ENDPOINT}/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isOld: true, isRead: now }),
        })
      } catch { /* ignore */ }
    }
  }, [dispatchCommentRead])

  const handleMarkCommentRead = useCallback(async (commentId: number) => {
    const now = new Date().toISOString()
    let wasUnread = false
    setComments((prev) =>
      prev.map((c) => {
        if (c.id === commentId && !c.isOld) { wasUnread = true }
        return c.id === commentId ? { ...c, isOld: true, isRead: now } : c
      })
    )
    if (wasUnread) dispatchCommentRead(1)
    try {
      await fetch(`${COMMENTS_ENDPOINT}/${commentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isOld: true, isRead: now }),
      })
    } catch { /* ignore */ }
  }, [dispatchCommentRead])

  const handleImageUpload = async (templateId: number, file: File) => {
    try {
      const { uploadImageToXano } = await import("@/lib/xano")
      const result = await uploadImageToXano(file)
      const imageData = { ...result, meta: result.meta ?? {} }

      const response = responses.get(templateId)
      if (response) {
        const now = new Date().toISOString()
        await fetch(`${RESPONSE_PATCH_BASE}/${response.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image_response: imageData, last_edited: now }),
        })
        setResponses((prev) => {
          const next = new Map(prev)
          next.set(templateId, { ...response, image_response: imageData, last_edited: now })
          return next
        })
      }
      toast("Image uploaded", { duration: 2000 })
    } catch {
      toast("Image upload failed", { duration: 3000 })
    }
  }

  const handleResponseStatusChange = useCallback(
    async (responseId: number, templateId: number, action: "ready" | "clear") => {
      if (action === "ready" && studentId) {
        const response = responses.get(templateId)
        const text = localValues.get(templateId) ?? response?.student_response ?? ""
        const textWordCount = text.trim().split(/\s+/).filter(Boolean).length

        if (textWordCount >= 20) {
          setCheckingPlagiarism((prev) => new Set(prev).add(templateId))
          try {
            const params = new URLSearchParams({
              text,
              lifemap_responses_id: String(responseId),
              students_id: studentId,
              lifemap_sections_id: String(sectionId),
            })
            const checkRes = await fetch(`${PLAGIARISM_CHECK_ENDPOINT}?${params}`)
            if (checkRes.ok) {
              const record = await checkRes.json() as GptZeroResult
              if (record?.lifemap_responses_id) {
                setPlagiarismData((prev) => {
                  const next = new Map(prev)
                  next.set(responseId, record)
                  return next
                })
              }
              const aiPct = typeof record.class_probability_ai === "string"
                ? parseFloat(record.class_probability_ai)
                : typeof record.class_probability_ai === "number"
                  ? record.class_probability_ai
                  : 0
              const normalizedAi = aiPct <= 1 ? aiPct * 100 : aiPct
              if (normalizedAi > 50) {
                toast.error("Submission rejected — AI-generated content detected. Please revise your response.", { duration: 5000 })
                return
              }
            }
          } catch {
            // Allow submission if plagiarism check fails
          } finally {
            setCheckingPlagiarism((prev) => {
              const next = new Set(prev)
              next.delete(templateId)
              return next
            })
          }
        }
      }

      const now = new Date().toISOString()
      const patch = action === "ready"
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
          toast.success(action === "ready" ? "Sent for review" : "Reopened for editing")
        }
      } catch {
        toast.error("Failed to update status")
      }
    },
    [studentId, sectionId, responses, localValues, questions]
  )

  if (loading) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        <Skeleton className="h-8 w-48" />
        <Card>
          <CardHeader><Skeleton className="h-5 w-40" /></CardHeader>
          <CardContent>
            <div className="space-y-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i}>
                  <Skeleton className="mb-2 h-4 w-32" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (questions.length === 0) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle && <p className="text-muted-foreground text-sm">{subtitle}</p>}
        <p className="text-muted-foreground">No questions have been published for this section yet.</p>
      </div>
    )
  }

  const ungroupedQuestions = questions.filter((q) => !q.lifemap_custom_group_id)
  const groupedSections = [...customGroups]
    .filter((g) => g.id)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((g) => ({
      group: g,
      questions: questions
        .filter((q) => q.lifemap_custom_group_id === g.id)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    }))
    .filter((gs) => gs.questions.length > 0)

  const renderQuestionList = (qs: TemplateQuestion[]) => (
    <div className="space-y-8">
      {qs.map((q) => {
        const response = responses.get(q.id)
        const value = localValues.get(q.id) ?? ""
        return (
          <DynamicField
            key={q.id}
            comments={comments}
            onMarkRead={handleMarkRead}
            question={q}
            value={value}
            imageValue={response?.image_response ?? null}
            lastEdited={response?.last_edited}
            plagiarism={response ? plagiarismData.get(response.id) : undefined}
            onChange={(v) => handleChange(q.id, v)}
            onImageUpload={(file) => handleImageUpload(q.id, file)}
            submittingForReview={checkingPlagiarism.has(q.id)}
            responseStatus={response ? { isComplete: response.isComplete, revisionNeeded: response.revisionNeeded, readyReview: response.readyReview } : undefined}
            onSendForReview={response && q.question_types_id !== QUESTION_TYPE.IMAGE_UPLOAD ? () => handleResponseStatusChange(response.id, q.id, "ready") : undefined}
            onEditSubmission={response?.readyReview ? () => handleResponseStatusChange(response.id, q.id, "clear") : undefined}
            onRequestReopen={response?.isComplete ? () => handleResponseStatusChange(response.id, q.id, "clear") : undefined}
          />
        )
      })}
    </div>
  )

  const allSectionComments = comments.filter((c) => c.field_name === "_section_comment" && !c.isComplete && !c.lifemap_custom_group_id)
  const allGroupComments = comments.filter((c) => c.field_name === "_section_comment" && !c.isComplete && !!c.lifemap_custom_group_id)
  const unreadSectionCount = allSectionComments.filter((c) => !c.isOld).length

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">{title}</h1>
          {allSectionComments.length > 0 && (
            <button
              type="button"
              onClick={() => setSectionCommentsOpen(true)}
              className="relative inline-flex size-7 items-center justify-center rounded-md border transition-colors hover:bg-accent"
            >
              <HugeiconsIcon icon={Comment01Icon} strokeWidth={2} className={`size-4 ${unreadSectionCount > 0 ? "text-blue-500" : "text-muted-foreground/50"}`} />
              {unreadSectionCount > 0 && (
                <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-blue-500 text-[10px] font-medium text-white">
                  {unreadSectionCount}
                </span>
              )}
            </button>
          )}
        </div>
        {subtitle && <p className="text-muted-foreground mt-1 text-sm">{subtitle}</p>}
      </div>

      <Sheet open={sectionCommentsOpen} onOpenChange={setSectionCommentsOpen}>
        <SheetContent className="flex flex-col gap-0 p-0 sm:max-w-md">
          <SheetHeader className="border-b px-6 py-4">
            <SheetTitle className="text-base">{title} — Comments</SheetTitle>
            <SheetDescription className="sr-only">Section-level teacher comments</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <StudentCommentList comments={allSectionComments} onMarkRead={handleMarkCommentRead} />
          </div>
        </SheetContent>
      </Sheet>

      {ungroupedQuestions.length > 0 && (
        <Card>
          <CardContent className="p-6">
            {renderQuestionList(ungroupedQuestions)}
          </CardContent>
        </Card>
      )}

      {groupedSections.map(({ group, questions: gQuestions }) => (
        <GroupSection
          key={group.id}
          group={group}
          review={groupReviews.get(group.id)}
          groupComments={allGroupComments.filter((c) => Number(c.lifemap_custom_group_id) === group.id)}
          onMarkCommentRead={handleMarkCommentRead}
          questionResponses={gQuestions.map((q) => responses.get(q.id)).filter(Boolean) as StudentResponse[]}
          totalQuestions={gQuestions.length}
          onStatusChange={async (patch) => {
            const review = groupReviews.get(group.id)
            if (!review) return
            const now = new Date().toISOString()
            const fullPatch = { ...patch, update: now }
            try {
              const res = await fetch(`${REVIEW_ENDPOINT}/${review.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(fullPatch),
              })
              if (!res.ok) throw new Error()
              setGroupReviews((prev) => {
                const next = new Map(prev)
                next.set(group.id, { ...review, ...fullPatch })
                return next
              })
              if (patch.readyReview) toast.success("Marked as ready for review")
              else if (patch.isComplete === false && patch.readyReview === false && patch.revisionNeeded === false) toast.success("Status cleared")
            } catch {
              toast.error("Failed to update status")
            }
          }}
        >
          {renderQuestionList(gQuestions)}
        </GroupSection>
      ))}
    </div>
  )
}

function GroupSection({
  group,
  children,
  review,
  groupComments = [],
  onStatusChange,
  onMarkCommentRead,
  questionResponses = [],
  totalQuestions = 0,
}: {
  group: CustomGroup
  children: React.ReactNode
  review?: ReviewRecord
  groupComments?: Comment[]
  onStatusChange?: (patch: Partial<ReviewRecord>) => void
  onMarkCommentRead?: (commentId: number) => void
  questionResponses?: StudentResponse[]
  totalQuestions?: number
}) {
  const [instructionsOpen, setInstructionsOpen] = useState(false)
  const [groupCommentsOpen, setGroupCommentsOpen] = useState(false)
  const [confirmAction, setConfirmAction] = useState<"reopen" | "ready" | null>(null)
  const hasInstructions = group.instructions || group.resources?.length > 0

  const completedCount = questionResponses.filter((r) => r.isComplete).length
  const revisionCount = questionResponses.filter((r) => r.revisionNeeded).length
  const readyCount = questionResponses.filter((r) => r.readyReview && !r.isComplete && !r.revisionNeeded).length
  const blankCount = totalQuestions - completedCount - revisionCount - readyCount
  const allComplete = completedCount === totalQuestions && totalQuestions > 0

  const handleStatusClick = () => {
    if (!review || !onStatusChange) return
    if (review.isComplete) {
      setConfirmAction("reopen")
    } else if (review.revisionNeeded || (!review.readyReview && !review.isComplete && !review.revisionNeeded)) {
      setConfirmAction("ready")
    }
  }

  const handleConfirm = () => {
    if (confirmAction === "reopen") {
      onStatusChange?.({ isComplete: false, revisionNeeded: false, readyReview: false })
    } else if (confirmAction === "ready") {
      onStatusChange?.({ readyReview: true, isComplete: false, revisionNeeded: false })
    }
    setConfirmAction(null)
  }

  const isClickable = review && (review.isComplete || review.revisionNeeded || (!review.readyReview && !review.isComplete && !review.revisionNeeded))

  return (
    <Card className="overflow-hidden !pt-0 !gap-0">
      <div className="flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-2">
          <CardTitle className="text-lg">{group.group_name}</CardTitle>
          {hasInstructions && (
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setInstructionsOpen(true)}
            >
              <HugeiconsIcon icon={HelpCircleIcon} strokeWidth={1.5} className="size-5" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
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
          {groupComments.length > 0 && (() => {
            const unreadGroupCount = groupComments.filter((c) => !c.isOld).length
            return (
              <button
                type="button"
                onClick={() => setGroupCommentsOpen(true)}
                className="relative inline-flex size-7 items-center justify-center rounded-md border transition-colors hover:bg-accent"
              >
                <HugeiconsIcon icon={Comment01Icon} strokeWidth={2} className={`size-4 ${unreadGroupCount > 0 ? "text-blue-500" : "text-muted-foreground/50"}`} />
                {unreadGroupCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-blue-500 text-[10px] font-medium text-white">
                    {unreadGroupCount}
                  </span>
                )}
              </button>
            )
          })()}
        </div>
      </div>
      {group.group_description && (
        <div className="border-b px-6 py-3">
          <p className="text-muted-foreground text-sm">{group.group_description}</p>
        </div>
      )}
      <CardContent className="p-6">
        {children}
      </CardContent>

      {hasInstructions && (
        <Sheet open={instructionsOpen} onOpenChange={setInstructionsOpen}>
          <SheetContent className="flex flex-col gap-0 p-0">
            <SheetHeader className="shrink-0 border-b px-6 py-4">
              <SheetTitle className="text-base">{group.group_name}</SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {group.instructions && (
                <div className="text-sm whitespace-pre-wrap">{group.instructions}</div>
              )}
              {group.resources?.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs uppercase tracking-wide">Resources</Label>
                  <div className="space-y-2">
                    {group.resources.map((url, i) => (
                      <a
                        key={i}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors hover:bg-muted/50"
                      >
                        <HugeiconsIcon icon={Link01Icon} strokeWidth={1.5} className="text-muted-foreground size-4 shrink-0" />
                        <span className="truncate text-sm text-blue-600 dark:text-blue-400">{url}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </SheetContent>
        </Sheet>
      )}

      <Sheet open={groupCommentsOpen} onOpenChange={setGroupCommentsOpen}>
        <SheetContent className="flex flex-col gap-0 p-0 sm:max-w-md">
          <SheetHeader className="border-b px-6 py-4">
            <SheetTitle className="text-base">{group.group_name} — Comments</SheetTitle>
            <SheetDescription className="sr-only">Group-level teacher comments</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <StudentCommentList comments={groupComments} onMarkRead={onMarkCommentRead} />
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!confirmAction} onOpenChange={(open) => { if (!open) setConfirmAction(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction === "reopen" ? "Reopen for Editing?" : "Submit for Review?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === "reopen"
                ? "This section has been marked as complete by your teacher. Reopening it will clear the completion status and allow you to make changes."
                : "This will notify your teacher that this section is ready for review. Make sure you have completed all responses before submitting."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>
              {confirmAction === "reopen" ? "Reopen" : "Submit for Review"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
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

function StudentCommentCard({
  comment: c,
  onMarkRead,
}: {
  comment: Comment
  onMarkRead?: (commentId: number) => void
}) {
  const commentTime = c.created_at ? formatRelativeTime(
    typeof c.created_at === "number" ? c.created_at : new Date(c.created_at as string).getTime()
  ) : null
  const readTime = c.isRead ? formatRelativeTime(
    typeof c.isRead === "number" ? c.isRead : new Date(c.isRead as string).getTime()
  ) : null
  const isRead = !!c.isRead || c.isOld

  return (
    <div className={cn("relative rounded-md border p-3 text-sm", isRead && "bg-muted/50")}>
      {!isRead && c.id != null && onMarkRead && (
        <button
          type="button"
          onClick={() => onMarkRead(c.id!)}
          className="absolute right-2 top-2 inline-flex size-6 items-center justify-center rounded transition-colors text-muted-foreground/40 hover:text-green-600 hover:bg-accent"
          title="Mark as read"
        >
          <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} className="size-4" />
        </button>
      )}
      <p className={cn("whitespace-pre-wrap", !isRead && "pr-7")}>{c.note}</p>
      <div className="text-muted-foreground mt-2 flex items-center gap-1.5 text-xs">
        {commentTime && <span>{commentTime}</span>}
        {commentTime && c.teacher_name && <span>&middot;</span>}
        {c.teacher_name && <span className="font-medium">{c.teacher_name}</span>}
        {c.isRevisionFeedback && (
          <>
            <span>&middot;</span>
            <span className="font-semibold text-red-500">Revision</span>
          </>
        )}
        {readTime && (
          <>
            <span>&middot;</span>
            <span className="text-green-600">Read {readTime}</span>
          </>
        )}
      </div>
    </div>
  )
}

function StudentCommentList({
  comments,
  onMarkRead,
}: {
  comments: Comment[]
  onMarkRead?: (commentId: number) => void
}) {
  const sorted = [...comments].sort((a, b) => {
    const aUnread = !a.isOld ? 0 : 1
    const bUnread = !b.isOld ? 0 : 1
    if (aUnread !== bUnread) return aUnread - bUnread
    const aTime = a.created_at
      ? (typeof a.created_at === "number" ? a.created_at : new Date(a.created_at as string).getTime())
      : 0
    const bTime = b.created_at
      ? (typeof b.created_at === "number" ? b.created_at : new Date(b.created_at as string).getTime())
      : 0
    return bTime - aTime
  })

  if (comments.length === 0) {
    return <p className="text-muted-foreground py-8 text-center text-sm">No comments.</p>
  }

  return (
    <div className="space-y-3">
      {sorted.map((c) => (
        <StudentCommentCard key={c.id} comment={c} onMarkRead={onMarkRead} />
      ))}
    </div>
  )
}

function DynamicField({
  question,
  value,
  imageValue,
  onChange,
  onImageUpload,
  comments,
  onMarkRead,
  lastEdited,
  plagiarism,
  submittingForReview,
  responseStatus,
  onSendForReview,
  onRequestReopen,
  onEditSubmission,
}: {
  question: TemplateQuestion
  value: string
  imageValue: Record<string, unknown> | null
  onChange: (value: string) => void
  onImageUpload: (file: File) => void
  comments: Comment[]
  onMarkRead: (commentIds: number[]) => void
  lastEdited?: string | number | null
  plagiarism?: GptZeroResult
  submittingForReview?: boolean
  responseStatus?: { isComplete?: boolean; revisionNeeded?: boolean; readyReview?: boolean }
  onSendForReview?: () => void
  onRequestReopen?: () => void
  onEditSubmission?: () => void
}) {
  const typeId = question.question_types_id
  const [detailedOpen, setDetailedOpen] = useState(false)
  const [confirmAction, setConfirmAction] = useState<"send" | "reopen" | "edit" | null>(null)

  const hasInstructions = question.detailed_instructions || question.resources?.length > 0 || question.examples?.length > 0 || question.sentence_starters?.length > 0 || question.min_words > 0

  const fieldComments = comments.filter((c) => c.field_name === question.field_name && !c.isComplete)
  const hasComments = fieldComments.length > 0
  const aiIsHighest = plagiarism ? (() => {
    const ai = toPercent(plagiarism.class_probability_ai ?? 0)
    const human = toPercent(plagiarism.class_probability_human ?? 0)
    const mixed = toPercent(plagiarism.mixed ?? 0)
    return ai >= human && ai >= mixed && ai > 0
  })() : false

  const relativeTime = formatRelativeTime(lastEdited)
  const isComplete = responseStatus?.isComplete === true
  const isReadyForReview = responseStatus?.readyReview === true && !isComplete && !responseStatus?.revisionNeeded
  const isDimmed = isComplete || isReadyForReview
  const wordCount = value.trim().split(/\s+/).filter(Boolean).length
  const meetsMinWords = !question.min_words || question.min_words <= 0 || wordCount >= question.min_words
  const canSubmitForReview = value.trim().length > 0 && meetsMinWords

  return (
    <div className={`space-y-2 ${isDimmed ? "opacity-50" : ""}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Label className="text-muted-foreground text-xs font-medium">{question.field_label}</Label>
          {hasComments && (
            <CommentBadge
              fieldName={question.field_name}
              fieldLabel={question.field_label}
              fieldValue={value || "—"}
              minWords={question.min_words > 0 ? question.min_words : undefined}
              comments={comments}
              onMarkRead={onMarkRead}
              plagiarism={plagiarism}
            />
          )}
          {hasInstructions && (
            <>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setDetailedOpen(true)}
              >
                <HugeiconsIcon icon={HelpCircleIcon} strokeWidth={1.5} className="size-4" />
              </button>
              <Sheet open={detailedOpen} onOpenChange={setDetailedOpen}>
                <SheetContent className="flex flex-col gap-0 p-0">
                  <SheetHeader className="shrink-0 border-b px-6 py-4">
                    <SheetTitle className="text-base">Question Instructions</SheetTitle>
                  </SheetHeader>
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                  {question.detailed_instructions && (
                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-xs uppercase tracking-wide">Instructions</Label>
                      <div className="text-sm whitespace-pre-wrap">{question.detailed_instructions}</div>
                    </div>
                  )}
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs uppercase tracking-wide">Question</Label>
                    <p className="text-sm font-medium">{question.field_label}</p>
                  </div>
                  {question.sentence_starters?.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-xs uppercase tracking-wide">Sentence Starters</Label>
                      <div className="space-y-1.5">
                        {question.sentence_starters.map((s, i) => (
                          <p key={i} className="text-muted-foreground text-sm italic">&ldquo;{s}&rdquo;</p>
                        ))}
                      </div>
                    </div>
                  )}
                  {question.min_words > 0 && (
                    <div className="space-y-1">
                      <Label className="text-muted-foreground text-xs uppercase tracking-wide">Word Count</Label>
                      <p className="text-sm">Minimum {question.min_words} words required</p>
                    </div>
                  )}
                  {question.examples?.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-xs uppercase tracking-wide">Examples</Label>
                      <div className="space-y-2">
                        {question.examples.map((ex, i) => (
                          <div key={i} className="rounded-md border border-dashed bg-muted/30 px-3 py-2.5">
                            <p className="text-sm">{ex}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {question.resources?.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-xs uppercase tracking-wide">Resources</Label>
                      <div className="space-y-2">
                        {question.resources.map((url, i) => (
                          <a
                            key={i}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors hover:bg-muted/50"
                          >
                            <HugeiconsIcon icon={Link01Icon} strokeWidth={1.5} className="text-muted-foreground size-4 shrink-0" />
                            <span className="truncate text-sm text-blue-600 dark:text-blue-400">{url}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </>
        )}
          {responseStatus?.isComplete && (
            <div title="Complete"><HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} className="size-4 text-green-600" /></div>
          )}
          {responseStatus?.revisionNeeded && (
            <div title="Needs revision"><HugeiconsIcon icon={AlertCircleIcon} strokeWidth={2} className="size-4 text-red-500" /></div>
          )}
          {responseStatus?.readyReview && !responseStatus?.isComplete && !responseStatus?.revisionNeeded && (
            <div title="Ready for review"><HugeiconsIcon icon={SentIcon} strokeWidth={2} className="size-4 text-blue-500" /></div>
          )}
          {responseStatus && !responseStatus.isComplete && !responseStatus.readyReview && onSendForReview && (
            <span className={!canSubmitForReview || submittingForReview ? "cursor-not-allowed" : ""}>
              <Button
                variant="outline"
                size="sm"
                className={`h-6 px-2 text-[10px] ${!canSubmitForReview || submittingForReview ? "pointer-events-none" : ""}`}
                onClick={() => setConfirmAction("send")}
                disabled={!canSubmitForReview || submittingForReview}
                title={!canSubmitForReview ? (value.trim().length === 0 ? "Response is empty" : `Minimum ${question.min_words} words required`) : undefined}
              >
                {submittingForReview ? "Checking..." : "Send for Review"}
              </Button>
            </span>
          )}
          {responseStatus?.readyReview && !responseStatus?.isComplete && !responseStatus?.revisionNeeded && onEditSubmission && (
            <Button
              variant="outline"
              size="sm"
              className="h-6 px-2 text-[10px]"
              onClick={() => setConfirmAction("edit")}
            >
              Edit Submission
            </Button>
          )}
          {responseStatus?.isComplete && onRequestReopen && (
            <Button
              variant="outline"
              size="sm"
              className="h-6 px-2 text-[10px]"
              onClick={() => setConfirmAction("reopen")}
            >
              Reopen
            </Button>
          )}
        </div>
        {relativeTime && (
          <span className="text-muted-foreground/60 shrink-0 text-[11px]">{relativeTime}</span>
        )}
      </div>

      <AlertDialog open={confirmAction !== null} onOpenChange={(open) => { if (!open) setConfirmAction(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction === "send" ? "Send for Review?" : confirmAction === "edit" ? "Edit Submission?" : "Reopen for Editing?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === "send"
                ? "This will notify your teacher that this response is ready for review. Make sure you are satisfied with your answer."
                : confirmAction === "edit"
                  ? "This will withdraw your submission and allow you to make changes. You will need to resubmit for review when you are done."
                  : "This will clear the completion status and allow you to make changes to this response."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (confirmAction === "send") onSendForReview?.()
              else if (confirmAction === "edit") onEditSubmission?.()
              else if (confirmAction === "reopen") onRequestReopen?.()
              setConfirmAction(null)
            }}>
              {confirmAction === "send" ? "Send for Review" : confirmAction === "edit" ? "Edit Submission" : "Reopen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {typeId === QUESTION_TYPE.SHORT_RESPONSE && (
        <InputGroup>
          <InputGroupInput
            className={isDimmed ? "" : "font-semibold"}
            placeholder={question.placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            spellCheck
          />
        </InputGroup>
      )}

      {typeId === QUESTION_TYPE.LONG_RESPONSE && (
        <InputGroup>
          <InputGroupTextarea
            className={isDimmed ? "" : "font-semibold"}
            placeholder={question.placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={4}
            spellCheck
          />
          {(question.min_words > 0 || plagiarism) && (
            <InputGroupAddon align="block-end">
              <InputGroupText className="flex w-full items-center justify-between text-xs">
                <span>{question.min_words > 0 ? <WordCount value={value} minWords={question.min_words} /> : ""}</span>
                {plagiarism && <PlagiarismScores data={plagiarism} />}
              </InputGroupText>
            </InputGroupAddon>
          )}
        </InputGroup>
      )}

      {typeId === QUESTION_TYPE.CURRENCY && (
        <CurrencyInput value={value} onChange={onChange} />
      )}

      {typeId === QUESTION_TYPE.IMAGE_UPLOAD && (
        <ImageUpload
          imageValue={imageValue}
          onUpload={onImageUpload}
          locked={!!responseStatus?.isComplete}
        />
      )}

      {typeId === QUESTION_TYPE.DROPDOWN && (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className={`w-full ${isDimmed ? "" : "font-semibold"}`}>
            <SelectValue placeholder={question.placeholder || "Select..."} />
          </SelectTrigger>
          <SelectContent>
            {question.dropdownOptions.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {typeId === QUESTION_TYPE.URL && (
        <InputGroup>
          <InputGroupInput
            className={isDimmed ? "" : "font-semibold"}
            type="url"
            placeholder={question.placeholder || "https://..."}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        </InputGroup>
      )}

      {typeId === QUESTION_TYPE.DATE && (
        <InputGroup>
          <InputGroupInput
            className={isDimmed ? "" : "font-semibold"}
            type="date"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        </InputGroup>
      )}

    </div>
  )
}

function toPercent(val: unknown): number {
  const n = typeof val === "string" ? parseFloat(val) : typeof val === "number" ? val : 0
  if (isNaN(n)) return 0
  return n <= 1 ? Math.round(n * 100) : Math.round(n)
}

function PlagiarismScores({ data }: { data: GptZeroResult }) {
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

function CurrencyInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const numValue = parseInt(value.replace(/[^0-9]/g, ""), 10) || 0
  const display = numValue > 0 ? numValue.toLocaleString("en-US") : ""

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/[^0-9]/g, "")
    const num = digits ? parseInt(digits, 10) : 0
    onChange(num.toString())
  }

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (numValue === 0) {
      e.target.value = ""
    }
    requestAnimationFrame(() => e.target.select())
  }

  return (
    <InputGroup>
      <InputGroupAddon align="inline-start">
        <InputGroupText>$</InputGroupText>
      </InputGroupAddon>
      <InputGroupInput
        className="font-semibold"
        type="text"
        inputMode="numeric"
        placeholder="0"
        value={display}
        onChange={handleChange}
        onFocus={handleFocus}
      />
    </InputGroup>
  )
}

function getImageUrl(value: Record<string, unknown> | null): string | null {
  if (!value || Object.keys(value).length === 0) return null
  if (typeof value.url === "string" && value.url) return value.url
  if (typeof value.path === "string" && value.path) {
    return `https://xsc3-mvx7-r86m.n7e.xano.io${value.path}`
  }
  return null
}

function ImageUpload({
  imageValue,
  onUpload,
  locked = false,
}: {
  imageValue: Record<string, unknown> | null
  onUpload: (file: File) => void
  locked?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [localPreview, setLocalPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  const savedUrl = getImageUrl(imageValue)
  const preview = localPreview ?? savedUrl

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (ev) => setLocalPreview(ev.target?.result as string)
    reader.readAsDataURL(file)

    setUploading(true)
    try {
      await onUpload(file)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleChange}
      />
      {preview ? (
        <div className="group relative overflow-hidden rounded-lg border">
          <img src={preview} alt="Upload" className="h-40 w-full object-cover" />
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <div className="flex items-center gap-2 rounded-md bg-white/90 px-3 py-1.5 text-xs font-medium text-black">
                <span className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Uploading...
              </div>
            </div>
          )}
          {!uploading && !locked && (
            <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                type="button"
                className="rounded-md bg-white/90 px-3 py-1.5 text-xs font-medium text-black"
                onClick={() => inputRef.current?.click()}
              >
                Replace
              </button>
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          className="border-input hover:bg-accent flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 transition-colors"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          <div className="bg-muted flex size-10 items-center justify-center rounded-full">
            <HugeiconsIcon icon={ImageUploadIcon} strokeWidth={1.5} className="text-muted-foreground size-5" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium">Click to upload</p>
            <p className="text-muted-foreground text-xs">PNG, JPG, GIF up to 10MB</p>
          </div>
        </button>
      )}
    </div>
  )
}
