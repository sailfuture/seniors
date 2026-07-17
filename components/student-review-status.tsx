"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon, PencilEdit02Icon } from "@hugeicons/core-free-icons"
import type { FormApiConfig } from "@/lib/form-api-config"
import type { Comment } from "@/lib/form-types"
import { FieldActivityStream } from "@/components/form/field-activity-stream"
import { RichTextDisplay } from "@/components/form/rich-text-display"
import { ZoomableImage } from "@/components/zoomable-image"
import { LineItemsTable } from "@/components/line-items-table"
import { extractPlainText, isRichTextQuestion, looksLikeRichTextDoc } from "@/lib/rich-text"
import { isLineItemsQuestion } from "@/lib/line-items"

const QUESTION_TYPE = {
  LONG_RESPONSE: 1,
  SHORT_RESPONSE: 2,
  IMAGE_UPLOAD: 4,
}

interface TemplateQuestion {
  id: number
  field_name: string
  field_label: string
  sortOrder: number
  isArchived: boolean
  isPublished: boolean
  min_words?: number
  question_types_id?: number | null
  [key: string]: unknown
}

interface StudentResponse {
  id: number
  student_response: string
  image_response?: Record<string, unknown> | null
  students_id?: string | number | null
  isArchived?: boolean
  isComplete?: boolean
  readyReview?: boolean
  revisionNeeded?: boolean
  last_edited?: number | string | null
  created_at?: number
  [key: string]: unknown
}

interface SectionInfo {
  id: number
  section_title: string
  isLocked?: boolean
  order?: number
}

function toTs(v: number | string | null | undefined): number | null {
  if (v == null) return null
  if (typeof v === "number") return v
  const p = Date.parse(v)
  return isNaN(p) ? null : p
}

function relativeDate(ts: number | null): string {
  if (!ts) return "—"
  const diff = Math.floor((Date.now() - ts) / 1000)
  if (diff < 45) return "just now"
  const mins = Math.floor(diff / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  const weeks = Math.floor(days / 7)
  if (weeks < 5) return `${weeks}w ago`
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function resolveImageUrl(image: Record<string, unknown> | null | undefined): string | null {
  if (!image) return null
  const path = (image.path ?? image.url) as string | undefined
  if (!path) return null
  return path.startsWith("http") ? path : `https://xsc3-mvx7-r86m.n7e.xano.io${path}`
}

/** One-line preview of a response, same size as the question label. */
function previewOf(q: TemplateQuestion, r: StudentResponse): string {
  if ((q.question_types_id ?? null) === QUESTION_TYPE.IMAGE_UPLOAD) return "Image submission"
  if (isLineItemsQuestion(q)) return "Cost / product breakdown"
  const raw = r.student_response ?? ""
  const text = isRichTextQuestion(q) || looksLikeRichTextDoc(raw) ? extractPlainText(raw) : raw
  const t = text.trim().replace(/\s+/g, " ")
  if (!t) return "—"
  return t.length > 90 ? `${t.slice(0, 90)}…` : t
}

/** Group items (which each carry a section) by section, in section order. */
function groupBySection<T extends { section: SectionInfo }>(items: T[]): { section: SectionInfo; items: T[] }[] {
  const groups = new Map<number, { section: SectionInfo; items: T[] }>()
  for (const it of items) {
    const g = groups.get(it.section.id) ?? { section: it.section, items: [] }
    g.items.push(it)
    groups.set(it.section.id, g)
  }
  return [...groups.values()].sort((a, b) => (a.section.order ?? 0) - (b.section.order ?? 0))
}

/** Read-only render of a response, for the detail sheet. */
function ResponseView({ q, r }: { q: TemplateQuestion; r: StudentResponse | undefined }) {
  if (!r) return null
  const typeId = q.question_types_id ?? null
  const value = r.student_response ?? ""
  if (typeId === QUESTION_TYPE.IMAGE_UPLOAD) {
    const url = resolveImageUrl(r.image_response)
    return url ? (
      <ZoomableImage src={url} alt={q.field_label} className="rounded-lg border" caption={q.field_label} />
    ) : (
      <p className="text-muted-foreground text-sm italic">No image uploaded.</p>
    )
  }
  if (isLineItemsQuestion(q)) return <LineItemsTable raw={value} />
  if (isRichTextQuestion(q) || looksLikeRichTextDoc(value)) return <RichTextDisplay raw={value} />
  return <p className="whitespace-pre-wrap text-sm leading-relaxed">{value || "—"}</p>
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="bg-muted/40 text-muted-foreground px-4 py-1.5 text-xs font-semibold uppercase tracking-wide">
      {title}
    </div>
  )
}

/** The question name and its response, same size, bullet-separated, truncated. */
function RowLabel({ label, preview }: { label: string; preview: string }) {
  return (
    <span className="min-w-0 flex-1 truncate text-sm">
      <span className="font-medium">{label}</span>
      <span className="text-muted-foreground"> &middot; </span>
      <span className="font-normal">{preview}</span>
    </span>
  )
}

interface SheetTarget {
  kind: "comment" | "revision"
  fieldName: string
  questionId: number | null
  // For _section_comment threads (shared field_name), scope to one section/group.
  sectionId?: number
  groupId?: number | null
}

/**
 * Full "Review Status" page for a student: separate cards for revisions
 * (grouped by section), pending reviews, and unread comments. Rows open sheets
 * — a comment thread for comments, and an inline edit-and-resubmit surface for
 * revisions (running the same GPTZero AI check as the main editor).
 */
export function StudentReviewStatus({
  apiConfig,
  slugify,
  studentId,
  basePath,
}: {
  apiConfig: FormApiConfig
  slugify: (title: string) => string
  studentId: string | null | undefined
  basePath: string
}) {
  const cfg = apiConfig
  const F = cfg.fields
  const router = useRouter()
  const { data: session } = useSession()

  const [loading, setLoading] = useState(true)
  const [sections, setSections] = useState<SectionInfo[]>([])
  const [questions, setQuestions] = useState<TemplateQuestion[]>([])
  const [responses, setResponses] = useState<Map<number, StudentResponse>>(new Map())
  const [comments, setComments] = useState<Comment[]>([])
  const [sheet, setSheet] = useState<SheetTarget | null>(null)

  useEffect(() => {
    if (studentId === undefined) return
    if (!studentId) {
      setLoading(false)
      return
    }
    let cancelled = false
    const load = async () => {
      try {
        const [sectionsRes, templateRes, responsesRes, commentsRes] = await Promise.all([
          fetch(cfg.sectionsEndpoint),
          fetch(cfg.templateEndpoint),
          fetch(`${cfg.responsesEndpoint}?students_id=${studentId}`),
          fetch(`${cfg.commentsEndpoint}?students_id=${studentId}`),
        ])
        const sectionsData: SectionInfo[] = sectionsRes.ok ? await sectionsRes.json() : []
        const template: TemplateQuestion[] = templateRes.ok ? await templateRes.json() : []
        // Xano ignores students_id on these endpoints — re-filter client-side.
        const responsesData: StudentResponse[] = (responsesRes.ok ? await responsesRes.json() : []).filter(
          (r: StudentResponse) => String(r.students_id ?? "") === String(studentId)
        )
        const commentsData: Comment[] = (commentsRes.ok ? await commentsRes.json() : []).filter(
          // Exclude inline essay-comment threads — they belong to a highlight,
          // not the field/section comment surfaces.
          (c: Comment) => String(c.students_id ?? "") === String(studentId) && !c.thread_id
        )
        if (cancelled) return

        const live = template.filter((q) => !q.isArchived && q.isPublished)
        const respMap = new Map<number, StudentResponse>()
        for (const r of responsesData) {
          if (!r.isArchived) respMap.set(Number(r[F.templateId]), r)
        }
        setSections(sectionsData)
        setQuestions(live)
        setResponses(respMap)
        setComments(commentsData)
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
  }, [studentId, cfg, F])

  const sectionById = useMemo(() => new Map(sections.map((s) => [s.id, s])), [sections])
  const questionById = useMemo(() => new Map(questions.map((q) => [q.id, q])), [questions])
  const questionByField = useMemo(() => new Map(questions.map((q) => [q.field_name, q])), [questions])
  const responseByTemplate = responses

  const sectionOf = useCallback(
    (q: TemplateQuestion): SectionInfo | undefined => sectionById.get(Number(q[F.sectionId])),
    [sectionById, F]
  )

  // --- Derived lists (all grouped by section) ------------------------------
  const { revisionsBySection, pendingBySection, unreadBySection, revisionCount, pendingCount, unreadCount } =
    useMemo(() => {
      const revItems: { q: TemplateQuestion; r: StudentResponse; section: SectionInfo }[] = []
      const pendItems: { q: TemplateQuestion; r: StudentResponse; section: SectionInfo }[] = []
      for (const r of responses.values()) {
        const q = questionById.get(Number(r[F.templateId]))
        if (!q) continue
        const section = sectionOf(q)
        if (!section || section.isLocked) continue
        if (r.isComplete) continue
        if (r.revisionNeeded) revItems.push({ q, r, section })
        else if (r.readyReview) pendItems.push({ q, r, section })
      }

      const revisionsBySection = groupBySection(revItems)
      const pendingBySection = groupBySection(pendItems)
      for (const g of [...revisionsBySection, ...pendingBySection]) {
        g.items.sort((a, b) => a.q.field_label.localeCompare(b.q.field_label))
      }

      const unreadItems: { c: Comment; q?: TemplateQuestion; section: SectionInfo; when: number | null }[] = []
      for (const c of comments) {
        if (c.isOld || c.isComplete || c.isStudentReply || c.thread_id) continue
        const q = questionByField.get(c.field_name)
        const section = sectionById.get(Number(c[F.sectionId]))
        if (!section || section.isLocked) continue
        unreadItems.push({ c, q, section, when: toTs(c.created_at as number | undefined) })
      }
      const unreadBySection = groupBySection(unreadItems)
      for (const g of unreadBySection) g.items.sort((a, b) => (b.when ?? 0) - (a.when ?? 0))

      return {
        revisionsBySection,
        pendingBySection,
        unreadBySection,
        revisionCount: revItems.length,
        pendingCount: pendItems.length,
        unreadCount: unreadItems.length,
      }
    }, [responses, comments, questionById, questionByField, sectionById, sectionOf, F])

  // --- Comment handlers (used by the sheets) -------------------------------
  const handleMarkRead = useCallback(
    async (commentId: number) => {
      const now = new Date().toISOString()
      // Look the comment up BEFORE the state update — updater callbacks run
      // deferred, so anything captured inside them is too late to use here.
      const target = comments.find((c) => c.id === commentId)
      setComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, isOld: true, isRead: now } : c)))
      // The sidebar keeps its own unread counts — tell it one was read, the
      // same way the section form does, so the badge clears immediately.
      const sectionId = target ? Number(target[F.sectionId]) || 0 : 0
      if (sectionId && target && !target.isOld) {
        window.dispatchEvent(
          new CustomEvent(`${cfg.eventPrefix ?? ""}comment-read`, { detail: { sectionId, count: 1 } })
        )
      }
      try {
        await fetch(`${cfg.commentsEndpoint}/${commentId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isOld: true, isRead: now }),
        })
      } catch {
        /* ignore */
      }
    },
    [cfg.commentsEndpoint, cfg.eventPrefix, F, comments]
  )

  const handleReply = useCallback(
    async (fieldName: string, note: string): Promise<boolean> => {
      if (!studentId) return false
      const q = questionByField.get(fieldName)
      const section = q ? sectionOf(q) : undefined
      const studentName = session?.user?.name ?? "Student"
      const payload: Record<string, unknown> = {
        students_id: studentId,
        teachers_id: null,
        field_name: fieldName,
        [F.sectionId]: section?.id ?? Number(q?.[F.sectionId] ?? 0),
        note,
        isOld: false,
        isComplete: false,
        teacher_name: studentName,
        isStudentReply: true,
      }
      try {
        const res = await fetch(cfg.commentsEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        if (!res.ok) return false
        const created = await res.json()
        if (created?.isStudentReply !== true) {
          if (created?.id) {
            fetch(`${cfg.commentsEndpoint}/${created.id}`, { method: "DELETE" }).catch(() => {})
          }
          return false
        }
        setComments((prev) => [...prev, created as Comment])
        return true
      } catch {
        return false
      }
    },
    [studentId, session, cfg.commentsEndpoint, F, questionByField, sectionOf]
  )

  // --- Revision editing / resubmit -----------------------------------------
  const applyResponsePatch = useCallback((templateId: number, patch: Partial<StudentResponse>) => {
    setResponses((prev) => {
      const next = new Map(prev)
      const existing = next.get(templateId)
      if (existing) next.set(templateId, { ...existing, ...patch, last_edited: Date.now() })
      return next
    })
  }, [])

  const handleSaveDraft = useCallback(
    async (responseId: number, templateId: number, value: string): Promise<boolean> => {
      try {
        // Match the main editor's save: bump wordCount + last_edited so the
        // teacher's queue dates and newest-first sort stay accurate.
        const now = new Date().toISOString()
        const wordCount = value.trim().split(/\s+/).filter(Boolean).length
        const res = await fetch(`${cfg.responsePatchBase}/${responseId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ student_response: value, wordCount, last_edited: now }),
        })
        if (!res.ok) return false
        applyResponsePatch(templateId, { student_response: value })
        return true
      } catch {
        return false
      }
    },
    [cfg.responsePatchBase, applyResponsePatch]
  )

  const runAiCheck = useCallback(
    async (responseId: number, sectionId: number, text: string): Promise<"ok" | "rejected" | "error"> => {
      const wordCount = text.trim().split(/\s+/).filter(Boolean).length
      if (wordCount < 20 || !cfg.plagiarismCheckEndpoint) return "ok"
      try {
        const respIdField = cfg.plagiarismResponseIdField ?? `${F.sectionId.replace("_id", "")}_responses_id`
        const params = new URLSearchParams({
          text,
          [respIdField]: String(responseId),
          students_id: String(studentId),
          [F.sectionId]: String(sectionId),
        })
        const checkRes = await fetch(`${cfg.plagiarismCheckEndpoint}?${params}`)
        if (!checkRes.ok) return "ok"
        const record = await checkRes.json()
        const aiRaw = record?.class_probability_ai
        const aiPct = typeof aiRaw === "string" ? parseFloat(aiRaw) : typeof aiRaw === "number" ? aiRaw : 0
        const normalizedAi = aiPct <= 1 ? aiPct * 100 : aiPct
        if (normalizedAi > 50) {
          if (record?.id && cfg.gptzeroDeleteBase) {
            fetch(`${cfg.gptzeroDeleteBase}/${record.id}`, { method: "DELETE" }).catch(() => {})
          }
          return "rejected"
        }
        return "ok"
      } catch {
        return "ok" // fail open, matching the main editor
      }
    },
    [cfg.plagiarismCheckEndpoint, cfg.plagiarismResponseIdField, cfg.gptzeroDeleteBase, F, studentId]
  )

  const handleResubmit = useCallback(
    async (q: TemplateQuestion, responseId: number, value: string): Promise<boolean> => {
      const sectionId = Number(q[F.sectionId])
      // Persist the edit first so a rejected AI check still keeps their work.
      const saved = await handleSaveDraft(responseId, q.id, value)
      if (!saved) {
        toast.error("Couldn't save your changes. Please try again.")
        return false
      }
      const ai = await runAiCheck(responseId, sectionId, value)
      if (ai === "rejected") {
        toast.error("Submission rejected — AI-generated content detected. Please revise your response.", {
          duration: 5000,
        })
        return false
      }
      try {
        const res = await fetch(`${cfg.responsePatchBase}/${responseId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ readyReview: true, isComplete: false, revisionNeeded: false }),
        })
        if (!res.ok) {
          toast.error("Couldn't resubmit. Please try again.")
          return false
        }
        applyResponsePatch(q.id, { readyReview: true, isComplete: false, revisionNeeded: false })
        // Keep the sidebar badges in sync: leaving revision, entering pending.
        const eventName = `${cfg.eventPrefix ?? ""}review-update`
        window.dispatchEvent(new CustomEvent(eventName, { detail: { sectionId, delta: -1, type: "revision" } }))
        window.dispatchEvent(new CustomEvent(eventName, { detail: { sectionId, delta: 1 } }))
        // Addressing the revision clears its unread feedback so it doesn't
        // linger in the "Unread comments" card as still needing attention.
        for (const c of comments) {
          if (c.field_name === q.field_name && !c.isOld && !c.isStudentReply && c.id != null) {
            handleMarkRead(c.id)
          }
        }
        toast.success("Resubmitted for review")
        return true
      } catch {
        toast.error("Couldn't resubmit. Please try again.")
        return false
      }
    },
    [cfg.responsePatchBase, cfg.eventPrefix, F, handleSaveDraft, runAiCheck, applyResponsePatch, comments, handleMarkRead]
  )

  // --- Sheet data ----------------------------------------------------------
  const openField = sheet
    ? sheet.questionId != null
      ? questionById.get(sheet.questionId)
      : questionByField.get(sheet.fieldName)
    : undefined
  const openResponse = openField ? responseByTemplate.get(openField.id) : undefined
  // Exclude resolved (isComplete) comments, matching the editor's stream. For
  // the shared "_section_comment" field_name, scope to the clicked comment's
  // own section/group so unrelated sections' threads don't bleed together.
  const sheetComments = useMemo(() => {
    if (!sheet) return []
    if (sheet.fieldName === "_section_comment") {
      return comments.filter(
        (c) =>
          c.field_name === "_section_comment" &&
          !c.isComplete &&
          Number(c[F.sectionId]) === sheet.sectionId &&
          (sheet.groupId != null ? Number(c[F.customGroupId]) === sheet.groupId : !c[F.customGroupId])
      )
    }
    return comments.filter((c) => c.field_name === sheet.fieldName && !c.isComplete)
  }, [sheet, comments, F])
  const openStatus = openResponse
    ? {
        isComplete: openResponse.isComplete,
        revisionNeeded: openResponse.revisionNeeded,
        readyReview: openResponse.readyReview,
      }
    : null

  if (loading) {
    return (
      <div className="space-y-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-44" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-24 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (!studentId) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-10 text-center text-sm italic">
          No student account is linked to this login.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Pending review — top; grouped by section; rows open the detail sheet */}
      <StatusCard dot="bg-blue-500" title="Pending review" count={pendingCount}>
        {pendingCount === 0 ? (
          <Empty text="Nothing waiting on your teacher." />
        ) : (
          <div className="divide-y">
            {pendingBySection.map((g) => (
              <div key={g.section.id}>
                <SectionHeader title={g.section.section_title} />
                {g.items.map(({ q, r }) => (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() =>
                      setSheet({ kind: "comment", fieldName: q.field_name, questionId: q.id, sectionId: g.section.id })
                    }
                    className="hover:bg-muted/50 flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors"
                  >
                    <RowLabel label={q.field_label} preview={previewOf(q, r)} />
                    <span className="text-muted-foreground shrink-0 text-xs whitespace-nowrap">
                      {relativeDate(toTs(r.last_edited) ?? r.created_at ?? null)}
                    </span>
                    <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="text-muted-foreground/40 size-4 shrink-0" />
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </StatusCard>

      {/* Unread comments — under pending review, grouped by section */}
      <StatusCard dot="bg-gray-400" title="Unread comments" count={unreadCount}>
        {unreadCount === 0 ? (
          <Empty text="No unread comments." />
        ) : (
          <div className="divide-y">
            {unreadBySection.map((g) => (
              <div key={g.section.id}>
                <SectionHeader title={g.section.section_title} />
                {g.items.map(({ c, q, when }) => {
                  const fieldLabel = q?.field_label ?? (c.field_name === "_section_comment" ? "Section comment" : c.field_name)
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() =>
                        setSheet({
                          kind: "comment",
                          fieldName: c.field_name,
                          questionId: q?.id ?? null,
                          sectionId: Number(c[F.sectionId]),
                          groupId: c[F.customGroupId] != null ? Number(c[F.customGroupId]) || null : null,
                        })
                      }
                      className="hover:bg-muted/50 flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-1 text-sm">
                          <span className="font-medium">{c.note}</span>
                          <span className="text-muted-foreground"> &middot; {fieldLabel}</span>
                        </span>
                        {c.teacher_name && (
                          <span className="text-muted-foreground/70 text-xs">{c.teacher_name}</span>
                        )}
                      </span>
                      <span className="text-muted-foreground shrink-0 text-xs whitespace-nowrap">{relativeDate(when)}</span>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        )}
      </StatusCard>

      {/* Revisions requested — bottom; grouped by section */}
      <StatusCard dot="bg-red-500" title="Revisions requested" count={revisionCount}>
        {revisionCount === 0 ? (
          <Empty text="No revisions requested." />
        ) : (
          <div className="divide-y">
            {revisionsBySection.map((g) => (
              <div key={g.section.id}>
                <SectionHeader title={g.section.section_title} />
                {g.items.map(({ q, r }) => (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setSheet({ kind: "revision", fieldName: q.field_name, questionId: q.id })}
                    className="hover:bg-muted/50 flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors"
                  >
                    <HugeiconsIcon icon={PencilEdit02Icon} strokeWidth={2} className="text-red-500 size-4 shrink-0" />
                    <RowLabel label={q.field_label} preview={previewOf(q, r)} />
                    <span className="text-muted-foreground shrink-0 text-xs whitespace-nowrap">
                      {relativeDate(toTs(r.last_edited) ?? r.created_at ?? null)}
                    </span>
                    <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="text-muted-foreground/40 size-4 shrink-0" />
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </StatusCard>

      {/* Comment thread sheet */}
      <Sheet open={sheet?.kind === "comment"} onOpenChange={(o) => { if (!o) setSheet(null) }}>
        <SheetContent className="flex flex-col gap-0 p-0 sm:max-w-md">
          <SheetHeader className="border-b px-6 py-4">
            <SheetTitle className="text-base">
              {openField?.field_label ?? "Comments"}
            </SheetTitle>
            <SheetDescription className="sr-only">Teacher comments and your replies</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto">
            {openField && openResponse && sheet?.fieldName !== "_section_comment" && (
              <div className="border-b px-6 py-4">
                <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">Your response</p>
                <ResponseView q={openField} r={openResponse} />
              </div>
            )}
            <div className="px-6 py-4">
              <FieldActivityStream
                comments={sheetComments}
                viewer="student"
                responseStatus={openStatus}
                lastEdited={openResponse?.last_edited}
                onMarkRead={handleMarkRead}
                scrollToLatest={sheet?.kind === "comment"}
              />
            </div>
          </div>
          {openField && sheet?.fieldName !== "_section_comment" && (
            <ReplyBox onSend={(note) => handleReply(sheet!.fieldName, note)} />
          )}
        </SheetContent>
      </Sheet>

      {/* Revision edit sheet */}
      <Sheet open={sheet?.kind === "revision"} onOpenChange={(o) => { if (!o) setSheet(null) }}>
        <SheetContent className="flex flex-col gap-0 p-0 sm:max-w-lg">
          <SheetHeader className="border-b px-6 py-4">
            <SheetTitle className="text-base">{openField?.field_label ?? "Revision"}</SheetTitle>
            <SheetDescription className="sr-only">Revision feedback and your response</SheetDescription>
          </SheetHeader>
          {openField && openResponse && (
            <RevisionEditor
              key={openField.id}
              question={openField}
              response={openResponse}
              comments={sheetComments}
              onMarkRead={handleMarkRead}
              onSaveDraft={(value) => handleSaveDraft(openResponse.id, openField.id, value)}
              onResubmit={async (value) => {
                const ok = await handleResubmit(openField, openResponse.id, value)
                if (ok) setSheet(null)
                return ok
              }}
              onOpenEditor={() => {
                const section = sectionOf(openField)
                if (section) {
                  router.push(
                    `${basePath}/${slugify(section.section_title)}?focus=${encodeURIComponent(openField.field_name)}`
                  )
                }
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

function StatusCard({
  dot,
  title,
  count,
  children,
}: {
  dot: string
  title: string
  count: number
  children: React.ReactNode
}) {
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b py-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className={`size-2 rounded-full ${dot}`} />
          {title}
          <span className="text-muted-foreground text-sm font-normal">({count})</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">{children}</CardContent>
    </Card>
  )
}

function Empty({ text }: { text: string }) {
  return <p className="text-muted-foreground px-6 py-6 text-center text-sm italic">{text}</p>
}

function ReplyBox({ onSend }: { onSend: (note: string) => Promise<boolean> }) {
  const [reply, setReply] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const send = async () => {
    if (!reply.trim()) return
    setSending(true)
    setError(null)
    const ok = await onSend(reply.trim())
    setSending(false)
    if (ok) setReply("")
    else setError("Couldn't post your reply — please try again or ask your teacher.")
  }

  return (
    <div className="border-t px-6 py-4">
      <Textarea
        placeholder="Reply to your teacher..."
        value={reply}
        onChange={(e) => setReply(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && reply.trim() && !sending) {
            e.preventDefault()
            send()
          }
        }}
        rows={2}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      <div className="mt-2 flex justify-end">
        <Button size="sm" onClick={send} disabled={!reply.trim() || sending}>
          {sending ? "Sending..." : "Reply"}
        </Button>
      </div>
    </div>
  )
}

function RevisionEditor({
  question,
  response,
  comments,
  onMarkRead,
  onSaveDraft,
  onResubmit,
  onOpenEditor,
}: {
  question: TemplateQuestion
  response: StudentResponse
  comments: Comment[]
  onMarkRead: (commentId: number) => void
  onSaveDraft: (value: string) => Promise<boolean>
  onResubmit: (value: string) => Promise<boolean>
  onOpenEditor: () => void
}) {
  const typeId = question.question_types_id ?? null
  const editable = typeId === QUESTION_TYPE.LONG_RESPONSE || typeId === QUESTION_TYPE.SHORT_RESPONSE
  const [value, setValue] = useState(response.student_response ?? "")
  const [savingDraft, setSavingDraft] = useState(false)
  const [resubmitting, setResubmitting] = useState(false)

  const wordCount = value.trim().split(/\s+/).filter(Boolean).length
  const minWords = question.min_words ?? 0
  const meetsMin = !minWords || wordCount >= minWords
  const dirty = value !== (response.student_response ?? "")

  const saveDraft = async () => {
    setSavingDraft(true)
    const ok = await onSaveDraft(value)
    setSavingDraft(false)
    if (ok) toast.success("Draft saved")
    else toast.error("Couldn't save your draft.")
  }

  const resubmit = async () => {
    setResubmitting(true)
    await onResubmit(value)
    setResubmitting(false)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">Feedback</p>
        <FieldActivityStream
          comments={comments}
          viewer="student"
          responseStatus={{ revisionNeeded: response.revisionNeeded, readyReview: response.readyReview, isComplete: response.isComplete }}
          lastEdited={response.last_edited}
          onMarkRead={onMarkRead}
        />

        <p className="text-muted-foreground mb-2 mt-6 text-xs font-medium uppercase tracking-wide">Your response</p>
        {editable ? (
          <>
            <Textarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              rows={typeId === QUESTION_TYPE.LONG_RESPONSE ? 8 : 3}
              className="resize-y"
              placeholder="Edit your response..."
            />
            {minWords > 0 && (
              <p className={`mt-1 text-xs ${meetsMin ? "text-muted-foreground/60" : "text-amber-600"}`}>
                {wordCount} / {minWords} words
              </p>
            )}
          </>
        ) : (
          <div className="space-y-3">
            <div className="text-muted-foreground rounded-md border bg-muted/30 px-3 py-2 text-sm">
              {response.student_response
                ? <span className="line-clamp-4 whitespace-pre-wrap">{response.student_response}</span>
                : <span className="italic">This response type is edited in the full editor.</span>}
            </div>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={onOpenEditor}>
              Open in editor
              <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="size-3.5" />
            </Button>
          </div>
        )}
      </div>

      {editable && (
        <div className="flex items-center justify-end gap-2 border-t px-6 py-3">
          <Button variant="outline" size="sm" onClick={saveDraft} disabled={!dirty || savingDraft || resubmitting}>
            {savingDraft ? "Saving..." : "Save draft"}
          </Button>
          <Button
            size="sm"
            onClick={resubmit}
            disabled={resubmitting || savingDraft || !value.trim() || !meetsMin}
          >
            {resubmitting ? "Resubmitting..." : "Save & resubmit"}
          </Button>
        </div>
      )}
    </div>
  )
}
