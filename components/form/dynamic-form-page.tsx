"use client"

import { Loader2 } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
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
  ArrowLeft02Icon,
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
import { useRefreshRegister } from "@/lib/refresh-context"
import type { SaveStatus, Comment } from "@/lib/form-types"
import { isGroupDisplayType, DISPLAY_TYPE } from "@/components/group-display-types"
import { LIFEMAP_API_CONFIG, type FormApiConfig } from "@/lib/form-api-config"

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

interface SourceFields {
  source_link: string
  title_of_source: string
  author_name_or_publisher: string
  date_of_publication: string
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

interface DynamicFormPageProps {
  title: string
  subtitle?: string
  sectionId: number
  apiConfig?: FormApiConfig
  backHref?: string
}

export function DynamicFormPage({ title, subtitle, sectionId, apiConfig = LIFEMAP_API_CONFIG, backHref }: DynamicFormPageProps) {
  const cfg = apiConfig
  const F = cfg.fields
  const searchParams = useSearchParams()
  const focusField = searchParams.get("focus")
  const { data: session } = useSession()
  const { register: registerSave, unregister: unregisterSave } = useSaveRegister()
  const { register: registerRefresh, unregister: unregisterRefresh } = useRefreshRegister()
  const [questions, setQuestions] = useState<TemplateQuestion[]>([])
  const [customGroups, setCustomGroups] = useState<CustomGroup[]>([])
  const [responses, setResponses] = useState<Map<number, StudentResponse>>(new Map())
  const [localValues, setLocalValues] = useState<Map<number, string>>(new Map())
  const [localSourceValues, setLocalSourceValues] = useState<Map<number, SourceFields>>(new Map())
  const [comments, setComments] = useState<Comment[]>([])
  const [sectionCommentsOpen, setSectionCommentsOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle")
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [plagiarismData, setPlagiarismData] = useState<Map<number, GptZeroResult>>(new Map())
  const focusApplied = useRef(false)
  const [checkingPlagiarism, setCheckingPlagiarism] = useState<Set<number>>(new Set())
  const [updatingStatus, setUpdatingStatus] = useState<Set<number>>(new Set())
  const [hasDirty, setHasDirty] = useState(false)
  const dirtyRef = useRef(new Set<number>())
  
  const saveAllRef = useRef<() => Promise<void>>(() => Promise.resolve())

  const studentId = (session?.user as Record<string, unknown>)?.students_id as string | undefined

  const loadData = useCallback(async (showLoading = false) => {
    if (!studentId) return
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
        const values = new Map<number, string>()
        const sourceValues = new Map<number, SourceFields>()
        for (const r of data) {
          if (r.isArchived) continue
          const tid = Number(r[F.templateId])
          map.set(tid, r)
          values.set(tid, r.student_response ?? "")
          if (r.source_link || r.title_of_source || r.author_name_or_publisher || r.date_of_publication) {
            sourceValues.set(tid, {
              source_link: r.source_link ?? "",
              title_of_source: r.title_of_source ?? "",
              author_name_or_publisher: r.author_name_or_publisher ?? "",
              date_of_publication: r.date_of_publication ?? "",
            })
          }
        }
        setResponses(map)
        setLocalValues(values)
        setLocalSourceValues(sourceValues)
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
              if (Number(c[F.sectionId]) !== sectionId) return false
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
    if (!focusField || loading || focusApplied.current) return
    focusApplied.current = true
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-field-name="${CSS.escape(focusField)}"]`) as HTMLElement | null
      if (!el) return
      el.scrollIntoView({ behavior: "smooth", block: "center" })
      setTimeout(() => {
        const input = el.querySelector("input, textarea, select") as HTMLElement | null
        input?.focus()
      }, 400)
    })
  }, [focusField, loading])

  const saveAll = useCallback(async () => {
    const dirty = dirtyRef.current
    if (dirty.size === 0) return

    setSaveStatus("saving")
    try {
      const promises = Array.from(dirty).map(async (templateId) => {
        const response = responses.get(templateId)
        const question = questions.find((q) => q.id === templateId)
        const isSource = question?.question_types_id === QUESTION_TYPE.SOURCE

        if (response) {
          const now = new Date().toISOString()
          let patch: Record<string, unknown>

          if (isSource) {
            const source = localSourceValues.get(templateId) ?? { source_link: "", title_of_source: "", author_name_or_publisher: "", date_of_publication: "" }
            patch = { ...source, last_edited: now }
          } else {
            const value = localValues.get(templateId) ?? ""
            const wordCount = value.trim().split(/\s+/).filter(Boolean).length
            patch = { student_response: value, wordCount, last_edited: now }
          }

          await fetch(`${cfg.responsePatchBase}/${response.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patch),
          })
          setResponses((prev) => {
            const next = new Map(prev)
            const latest = next.get(templateId)
            if (latest) {
              next.set(templateId, { ...latest, ...patch, last_edited: now })
            }
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
  }, [responses, localValues, localSourceValues, questions])

  saveAllRef.current = saveAll

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

  useEffect(() => {
    registerRefresh(async () => { await loadData(true) })
    return () => unregisterRefresh()
  }, [loadData, registerRefresh, unregisterRefresh])

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

    const response = responses.get(templateId)
    if (response && plagiarismData.has(response.id)) {
      setPlagiarismData((prev) => {
        const next = new Map(prev)
        next.delete(response.id)
        return next
      })
    }

    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)
    autosaveTimerRef.current = setTimeout(() => {
      if (dirtyRef.current.size > 0) saveAllRef.current()
    }, 1500)
  }

  const handleSourceChange = (templateId: number, field: keyof SourceFields, value: string) => {
    setLocalSourceValues((prev) => {
      const next = new Map(prev)
      const existing = next.get(templateId) ?? { source_link: "", title_of_source: "", author_name_or_publisher: "", date_of_publication: "" }
      next.set(templateId, { ...existing, [field]: value })
      return next
    })
    dirtyRef.current.add(templateId)
    setHasDirty(true)
    setSaveStatus("idle")

    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)
    autosaveTimerRef.current = setTimeout(() => {
      if (dirtyRef.current.size > 0) saveAllRef.current()
    }, 1500)
  }

  const handleFieldBlur = useCallback(() => {
    if (dirtyRef.current.size > 0) {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)
      saveAllRef.current()
    }
  }, [])

  const eventPrefix = cfg.eventPrefix ?? ""
  const dispatchCommentRead = useCallback((count: number) => {
    window.dispatchEvent(new CustomEvent(`${eventPrefix}comment-read`, { detail: { sectionId, count } }))
  }, [sectionId, eventPrefix])

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
        await fetch(`${cfg.commentsEndpoint}/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isOld: true, isRead: now }),
        })
      } catch { /* ignore */ }
    }
  }, [dispatchCommentRead, cfg.commentsEndpoint])

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
      await fetch(`${cfg.commentsEndpoint}/${commentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isOld: true, isRead: now }),
      })
    } catch { /* ignore */ }
  }, [dispatchCommentRead, cfg.commentsEndpoint])

  const handleImageUpload = async (templateId: number, file: File) => {
    try {
      const formData = new FormData()
      formData.append("content", file)
      const uploadRes = await fetch(cfg.uploadEndpoint, { method: "POST", body: formData })
      if (!uploadRes.ok) throw new Error("Upload failed")
      const result = await uploadRes.json()
      const imageData = { ...result, meta: result.meta ?? {} }

      const response = responses.get(templateId)
      if (response) {
        const now = new Date().toISOString()
        await fetch(`${cfg.responsePatchBase}/${response.id}`, {
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
    async (responseId: number, templateId: number, action: "ready" | "clear", silent = false) => {
      if (!silent) setUpdatingStatus((prev) => new Set(prev).add(templateId))
      try {
      if (action === "ready" && studentId) {
        const response = responses.get(templateId)
        const question = questions.find((q) => q.id === templateId)
        const isSourceQ = question?.question_types_id === QUESTION_TYPE.SOURCE
        const text = localValues.get(templateId) ?? response?.student_response ?? ""
        const textWordCount = text.trim().split(/\s+/).filter(Boolean).length

        if (!isSourceQ && textWordCount >= 20 && cfg.plagiarismCheckEndpoint) {
          setCheckingPlagiarism((prev) => new Set(prev).add(templateId))
          try {
            const respIdField = cfg.plagiarismResponseIdField ?? `${F.sectionId.replace('_id', '')}_responses_id`
            const params = new URLSearchParams({
              text,
              [respIdField]: String(responseId),
              students_id: studentId,
              [F.sectionId]: String(sectionId),
            })
            const checkRes = await fetch(`${cfg.plagiarismCheckEndpoint}?${params}`)
            if (checkRes.ok) {
              const record = await checkRes.json() as GptZeroResult
              const aiPct = typeof record?.class_probability_ai === "string"
                ? parseFloat(record.class_probability_ai)
                : typeof record?.class_probability_ai === "number"
                  ? record.class_probability_ai
                  : 0
              const normalizedAi = aiPct <= 1 ? aiPct * 100 : aiPct
              if (record) {
                setPlagiarismData((prev) => {
                  const next = new Map(prev)
                  next.set(responseId, record)
                  return next
                })
              }
              if (normalizedAi > 50) {
                if (record?.id && cfg.gptzeroDeleteBase) {
                  fetch(`${cfg.gptzeroDeleteBase}/${record.id}`, { method: "DELETE" }).catch(() => {})
                }
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
        const res = await fetch(`${cfg.responsePatchBase}/${responseId}`, {
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
          if (!silent) toast.success(action === "ready" ? "Sent for review" : "Reopened for editing")
        }
      } catch {
        if (!silent) toast.error("Failed to update status")
      }
      } finally {
        if (!silent) setUpdatingStatus((prev) => { const next = new Set(prev); next.delete(templateId); return next })
      }
    },
    [studentId, sectionId, responses, localValues, questions, cfg, F]
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

  const ungroupedQuestions = questions.filter((q) => !q[F.customGroupId])
  const groupedSections = [...customGroups]
    .filter((g) => g.id)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((g) => ({
      group: g,
      questions: questions
        .filter((q) => Number(q[F.customGroupId]) === g.id)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    }))
    .filter((gs) => gs.questions.length > 0)

  const renderQuestionList = (qs: TemplateQuestion[], flat = false) => {
    const items = qs.map((q) => {
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
          onBlur={handleFieldBlur}
          onImageUpload={(file) => handleImageUpload(q.id, file)}
          submittingForReview={checkingPlagiarism.has(q.id)}
          updatingStatus={updatingStatus.has(q.id)}
          responseStatus={response ? { isComplete: response.isComplete, revisionNeeded: response.revisionNeeded, readyReview: response.readyReview } : undefined}
          onSendForReview={response ? () => handleResponseStatusChange(response.id, q.id, "ready") : undefined}
          onEditSubmission={response?.readyReview ? () => handleResponseStatusChange(response.id, q.id, "clear") : undefined}
          onRequestReopen={response?.isComplete ? () => handleResponseStatusChange(response.id, q.id, "clear") : undefined}
          sourceValues={localSourceValues.get(q.id)}
          onSourceChange={(field, v) => handleSourceChange(q.id, field, v)}
        />
      )
    })

    if (flat) return <>{items}</>
    return (
      <div className="space-y-8">
        {items}
      </div>
    )
  }

  const allSectionComments = comments.filter((c) => c.field_name === "_section_comment" && !c.isComplete && !c[F.customGroupId])
  const allGroupComments = comments.filter((c) => c.field_name === "_section_comment" && !c.isComplete && !!c[F.customGroupId])
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
        {backHref && (
          <div className="mt-3">
            <Button variant="outline" size="sm" asChild className="gap-2">
              <Link href={backHref}>
                <HugeiconsIcon icon={ArrowLeft02Icon} strokeWidth={2} className="size-4" />
                Back
              </Link>
            </Button>
          </div>
        )}
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

      {groupedSections.map(({ group, questions: gQuestions }) => {
        const eligibleForReview = gQuestions.filter((q) => {
          const r = responses.get(q.id)
          if (!r) return false
          if (r.isComplete || r.readyReview) return false
          if (q.question_types_id === QUESTION_TYPE.IMAGE_UPLOAD) {
            const img = r.image_response
            return !!img && Object.keys(img).length > 0 && !!(img.path || img.url || img.name)
          }
          if (q.question_types_id === QUESTION_TYPE.SOURCE) {
            const src = localSourceValues.get(q.id)
            return !!(src && (src.source_link.trim() || src.title_of_source.trim()))
          }
          const text = localValues.get(q.id) ?? r.student_response ?? ""
          if (!text.trim()) return false
          const wordCount = text.trim().split(/\s+/).filter(Boolean).length
          if (q.min_words && q.min_words > 0 && wordCount < q.min_words) return false
          return true
        })

        return (
        <GroupSection
          key={group.id}
          group={group}
          groupComments={allGroupComments.filter((c) => Number(c[F.customGroupId]) === group.id)}
          onMarkCommentRead={handleMarkCommentRead}
          questionResponses={gQuestions.map((q) => responses.get(q.id)).filter(Boolean) as StudentResponse[]}
          totalQuestions={gQuestions.length}
          submitAllCount={eligibleForReview.length}
          onSubmitAllForReview={async () => {
            if (eligibleForReview.length === 0) {
              toast.info("No eligible questions to submit", { duration: 2000 })
              return
            }
            for (const q of eligibleForReview) {
              const r = responses.get(q.id)
              if (r) await handleResponseStatusChange(r.id, q.id, "ready", true)
            }
            toast.success(`${eligibleForReview.length} question${eligibleForReview.length > 1 ? "s" : ""} submitted for review`, { duration: 3000 })
          }}
        >
          {isGroupDisplayType(group[F.displayTypesId] as number | null | undefined) ? (() => {
            const displayExpansion = group[F.displayTypesExpansion] as { id: number; columns?: number } | undefined
            const cols = displayExpansion?.columns ?? 3
            const colClass = cols === 1 ? "" : cols === 2 ? "md:grid-cols-2" : cols === 4 ? "md:grid-cols-3 lg:grid-cols-4" : "md:grid-cols-3"
            return cols === 1 ? renderQuestionList(gQuestions) : (
              <div className={`grid gap-6 ${colClass}`}>
                {renderQuestionList(gQuestions, true)}
              </div>
            )
          })() : (
            renderQuestionList(gQuestions)
          )}
        </GroupSection>
        )
      })}
    </div>
  )
}

function GroupSection({
  group,
  children,
  groupComments = [],
  onMarkCommentRead,
  questionResponses = [],
  totalQuestions = 0,
  onSubmitAllForReview,
  submitAllCount = 0,
}: {
  group: CustomGroup
  children: React.ReactNode
  groupComments?: Comment[]
  onMarkCommentRead?: (commentId: number) => void
  questionResponses?: StudentResponse[]
  totalQuestions?: number
  onSubmitAllForReview?: () => Promise<void>
  submitAllCount?: number
}) {
  const [instructionsOpen, setInstructionsOpen] = useState(false)
  const [groupCommentsOpen, setGroupCommentsOpen] = useState(false)
  const [submittingAll, setSubmittingAll] = useState(false)
  const [confirmSubmitAll, setConfirmSubmitAll] = useState(false)
  const hasInstructions = group.instructions || group.resources?.length > 0

  const completedCount = questionResponses.filter((r) => r.isComplete).length
  const revisionCount = questionResponses.filter((r) => r.revisionNeeded).length
  const readyCount = questionResponses.filter((r) => r.readyReview && !r.isComplete && !r.revisionNeeded).length
  const blankCount = totalQuestions - completedCount - revisionCount - readyCount
  const allComplete = completedCount === totalQuestions && totalQuestions > 0

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
          {onSubmitAllForReview && !allComplete && (
            <>
              <div className="mx-1 h-6 w-px bg-gray-200" />
              <Button
                variant="outline"
                size="sm"
                className={`h-7 gap-1.5 text-xs ${submitAllCount === 0 ? "cursor-not-allowed" : ""}`}
                disabled={submittingAll || submitAllCount === 0}
                onClick={() => setConfirmSubmitAll(true)}
              >
                {submittingAll ? <Loader2 className="size-3.5 animate-spin" /> : <HugeiconsIcon icon={SentIcon} strokeWidth={2} className="size-3.5" />}
                {submittingAll ? "Submitting..." : `Submit All (${submitAllCount})`}
              </Button>
              <AlertDialog open={confirmSubmitAll} onOpenChange={setConfirmSubmitAll}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Submit all for review?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will submit {submitAllCount} {submitAllCount === 1 ? "question" : "questions"} for teacher review. You won&apos;t be able to edit them until your teacher responds.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={async (e) => {
                        e.preventDefault()
                        setConfirmSubmitAll(false)
                        setSubmittingAll(true)
                        try {
                          await onSubmitAllForReview()
                        } finally {
                          setSubmittingAll(false)
                        }
                      }}
                    >
                      Submit All
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
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
  onBlur,
  onImageUpload,
  comments,
  onMarkRead,
  lastEdited,
  plagiarism,
  submittingForReview,
  updatingStatus,
  responseStatus,
  onSendForReview,
  onRequestReopen,
  onEditSubmission,
  sourceValues,
  onSourceChange,
}: {
  question: TemplateQuestion
  value: string
  imageValue: Record<string, unknown> | null
  onChange: (value: string) => void
  onBlur?: () => void
  onImageUpload: (file: File) => void
  comments: Comment[]
  onMarkRead: (commentIds: number[]) => void
  lastEdited?: string | number | null
  plagiarism?: GptZeroResult
  submittingForReview?: boolean
  updatingStatus?: boolean
  sourceValues?: SourceFields
  onSourceChange?: (field: keyof SourceFields, value: string) => void
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
  const isImageType = typeId === QUESTION_TYPE.IMAGE_UPLOAD
  const isSourceType = typeId === QUESTION_TYPE.SOURCE
  const hasImage = !!imageValue && Object.keys(imageValue).length > 0 && !!(imageValue.path || imageValue.url || imageValue.name)
  const wordCount = value.trim().split(/\s+/).filter(Boolean).length
  const meetsMinWords = !question.min_words || question.min_words <= 0 || wordCount >= question.min_words
  const hasSourceContent = isSourceType && sourceValues && (sourceValues.source_link.trim().length > 0 || sourceValues.title_of_source.trim().length > 0)
  const hasContent = isImageType ? hasImage : isSourceType ? !!hasSourceContent : value.trim().length > 0
  const canSubmitForReview = hasContent && meetsMinWords

  return (
    <div className="space-y-2" data-field-name={question.field_name}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className={isDimmed ? "opacity-50" : ""}>
            <Label className="text-muted-foreground text-xs font-medium">{question.field_label}</Label>
          </span>
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
            <div title="Complete" className={isDimmed ? "opacity-50" : ""}><HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} className="size-4 text-green-600" /></div>
          )}
          {responseStatus?.revisionNeeded && (
            <div title="Needs revision"><HugeiconsIcon icon={AlertCircleIcon} strokeWidth={2} className="size-4 text-red-500" /></div>
          )}
          {responseStatus?.readyReview && !responseStatus?.isComplete && !responseStatus?.revisionNeeded && (
            <div title="Ready for review" className={isDimmed ? "opacity-50" : ""}><HugeiconsIcon icon={SentIcon} strokeWidth={2} className="size-4 text-blue-500" /></div>
          )}
          {responseStatus && !responseStatus.isComplete && !responseStatus.readyReview && onSendForReview && (
            <span className={!canSubmitForReview || submittingForReview || updatingStatus ? "cursor-not-allowed" : ""}>
              <Button
                variant="outline"
                size="sm"
                className={`h-6 px-2 text-[10px] ${!canSubmitForReview || submittingForReview || updatingStatus ? "pointer-events-none" : ""}`}
                onClick={() => setConfirmAction("send")}
                disabled={!canSubmitForReview || submittingForReview || updatingStatus}
                title={!canSubmitForReview ? (!hasContent ? (isImageType ? "No image uploaded" : "Response is empty") : `Minimum ${question.min_words} words required`) : undefined}
              >
                {updatingStatus ? <><Loader2 className="size-3 animate-spin" /> Sending...</> : submittingForReview ? "Checking..." : "Send for Review"}
              </Button>
            </span>
          )}
          {responseStatus?.readyReview && !responseStatus?.isComplete && !responseStatus?.revisionNeeded && onEditSubmission && (
            <Button
              variant="outline"
              size="sm"
              className="h-6 px-2 text-[10px]"
              onClick={() => setConfirmAction("edit")}
              disabled={updatingStatus}
            >
              {updatingStatus ? <><Loader2 className="size-3 animate-spin" /> Updating...</> : "Edit Submission"}
            </Button>
          )}
          {responseStatus?.isComplete && onRequestReopen && (
            <Button
              variant="outline"
              size="sm"
              className="h-6 px-2 text-[10px]"
              onClick={() => setConfirmAction("reopen")}
              disabled={updatingStatus}
            >
              {updatingStatus ? <><Loader2 className="size-3 animate-spin" /> Reopening...</> : "Reopen"}
            </Button>
          )}
        </div>
        {relativeTime && (
          <span className={`text-muted-foreground/60 shrink-0 text-[11px] ${isDimmed ? "opacity-50" : ""}`}>{relativeTime}</span>
        )}
      </div>

      <div className={isDimmed ? "opacity-50" : ""}>
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
            onBlur={onBlur}
            disabled={isDimmed}
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
            onBlur={onBlur}
            disabled={isDimmed}
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
        <CurrencyInput value={value} onChange={onChange} onBlur={onBlur} disabled={isDimmed} />
      )}

      {typeId === QUESTION_TYPE.IMAGE_UPLOAD && (
        <ImageUpload
          imageValue={imageValue}
          onUpload={onImageUpload}
          locked={isDimmed}
        />
      )}

      {typeId === QUESTION_TYPE.DROPDOWN && (
        <Select value={value} onValueChange={onChange} disabled={isDimmed}>
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
            onBlur={onBlur}
            disabled={isDimmed}
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
            onBlur={onBlur}
            disabled={isDimmed}
          />
        </InputGroup>
      )}

      {typeId === QUESTION_TYPE.SOURCE && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-muted-foreground text-[11px]">Source Link</Label>
            <InputGroup>
              <InputGroupInput
                className={isDimmed ? "" : "font-semibold"}
                type="url"
                placeholder="https://..."
                value={sourceValues?.source_link ?? ""}
                onChange={(e) => onSourceChange?.("source_link", e.target.value)}
                onBlur={onBlur}
                disabled={isDimmed}
              />
            </InputGroup>
          </div>
          <div className="space-y-1">
            <Label className="text-muted-foreground text-[11px]">Title of Source</Label>
            <InputGroup>
              <InputGroupInput
                className={isDimmed ? "" : "font-semibold"}
                placeholder="Enter title..."
                value={sourceValues?.title_of_source ?? ""}
                onChange={(e) => onSourceChange?.("title_of_source", e.target.value)}
                onBlur={onBlur}
                disabled={isDimmed}
              />
            </InputGroup>
          </div>
          <div className="space-y-1">
            <Label className="text-muted-foreground text-[11px]">Author / Publisher</Label>
            <InputGroup>
              <InputGroupInput
                className={isDimmed ? "" : "font-semibold"}
                placeholder="Enter author or publisher..."
                value={sourceValues?.author_name_or_publisher ?? ""}
                onChange={(e) => onSourceChange?.("author_name_or_publisher", e.target.value)}
                onBlur={onBlur}
                disabled={isDimmed}
              />
            </InputGroup>
          </div>
          <div className="space-y-1">
            <Label className="text-muted-foreground text-[11px]">Date of Publication</Label>
            <InputGroup>
              <InputGroupInput
                className={isDimmed ? "" : "font-semibold"}
                type="date"
                value={sourceValues?.date_of_publication ?? ""}
                onChange={(e) => onSourceChange?.("date_of_publication", e.target.value)}
                onBlur={onBlur}
                disabled={isDimmed}
              />
            </InputGroup>
          </div>
        </div>
      )}

      </div>
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

function CurrencyInput({ value, onChange, onBlur, disabled }: { value: string; onChange: (v: string) => void; onBlur?: () => void; disabled?: boolean }) {
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
        disabled={disabled}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={onBlur}
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
