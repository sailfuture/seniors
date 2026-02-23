"use client"

import { use, useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import Link from "next/link"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowLeft02Icon,
  CheckmarkCircle02Icon,
  CircleIcon,
  SquareLock02Icon,
  SquareUnlock02Icon,
  AlertCircleIcon,
  SentIcon,
  Delete02Icon,
  ArrowTurnBackwardIcon,
  ArrowRight01Icon,
  ArrowDown01Icon,
  ArrowUp01Icon,
  Comment01Icon,
  Link01Icon,
} from "@hugeicons/core-free-icons"
import { titleToSlug, type LifeMapSection } from "@/lib/lifemap-sections"
import type { Comment } from "@/lib/form-types"
import { useRefreshRegister } from "@/lib/refresh-context"

const XANO_BASE =
  process.env.NEXT_PUBLIC_XANO_API_BASE ??
  "https://xsc3-mvx7-r86m.n7e.xano.io/api:o2_UyOKn"

const SECTIONS_ENDPOINT = `${XANO_BASE}/lifemap_sections`
const CUSTOM_GROUP_ENDPOINT = `${XANO_BASE}/lifemap_custom_group`
const TEMPLATE_ENDPOINT = `${XANO_BASE}/lifeplan_template`
const RESPONSES_ENDPOINT = `${XANO_BASE}/lifemap_responses_by_student`
const COMMENTS_ENDPOINT = `${XANO_BASE}/lifemap_comments`
const QUESTION_TYPES_ENDPOINT = `${XANO_BASE}/question_types`

interface CustomGroup {
  id: number
  group_name: string
  group_description: string
  lifemap_sections_id: number
  order?: number
}

interface TemplateQuestion {
  id: number
  field_label: string
  field_name: string
  lifemap_sections_id: number
  lifemap_custom_group_id: number | null
  isArchived: boolean
  isPublished: boolean
  sortOrder: number
  min_words?: number
  question_types_id?: number | null
  _question_types?: { id: number; type: string; noInput?: boolean }
}

interface StudentResponse {
  id: number
  lifemap_template_id: number
  student_response: string
  wordCount: number
  isArchived?: boolean
  last_edited?: string | number | null
  readyReview?: boolean
  revisionNeeded?: boolean
  isComplete?: boolean
}

interface SectionRow {
  section: LifeMapSection
  slug: string
  groups: CustomGroup[]
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

export default function AdminStudentLifeMapOverviewPage({
  params,
}: {
  params: Promise<{ studentId: string }>
}) {
  const { studentId } = use(params)
  const router = useRouter()
  const { data: session } = useSession()

  const [rows, setRows] = useState<SectionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [comments, setComments] = useState<Comment[]>([])
  const [questionTypes, setQuestionTypes] = useState<{ id: number; type: string }[]>([])
  const [allTemplateQuestions, setAllTemplateQuestions] = useState<TemplateQuestion[]>([])
  const [allResponses, setAllResponses] = useState<StudentResponse[]>([])

  const [sheetRow, setSheetRow] = useState<SectionRow | null>(null)
  const [sheetGroupId, setSheetGroupId] = useState<number | null>(null)
  const commentTextareaRef = useRef<HTMLTextAreaElement>(null)

  const [sectionQuestions, setSectionQuestions] = useState<TemplateQuestion[]>([])
  const [sectionResponses, setSectionResponses] = useState<StudentResponse[]>([])
  const [loadingSheet, setLoadingSheet] = useState(false)

  const [commentNote, setCommentNote] = useState("")
  const [postingComment, setPostingComment] = useState(false)

  useEffect(() => {
    if (sheetRow) {
      const timer = setTimeout(() => commentTextareaRef.current?.focus(), 300)
      return () => clearTimeout(timer)
    }
  }, [sheetRow])

  const loadComments = useCallback(async () => {
    try {
      const res = await fetch(`${COMMENTS_ENDPOINT}?students_id=${studentId}`)
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data)) setComments(data)
      }
    } catch { /* ignore */ }
  }, [studentId])

  const loadData = useCallback(async () => {
    try {
      const [sectionsRes, groupsRes, qTypesRes, templateRes, responsesRes] = await Promise.all([
        fetch(SECTIONS_ENDPOINT),
        fetch(CUSTOM_GROUP_ENDPOINT),
        fetch(QUESTION_TYPES_ENDPOINT),
        fetch(TEMPLATE_ENDPOINT),
        fetch(`${RESPONSES_ENDPOINT}?students_id=${studentId}`),
      ])

      const sections: LifeMapSection[] = sectionsRes.ok ? await sectionsRes.json() : []
      const groups: CustomGroup[] = groupsRes.ok ? await groupsRes.json() : []
      if (qTypesRes.ok) {
        const types = await qTypesRes.json()
        if (Array.isArray(types)) setQuestionTypes(types)
      }
      if (templateRes.ok) {
        const tqs: TemplateQuestion[] = await templateRes.json()
        setAllTemplateQuestions(tqs.filter((q) => !q.isArchived && q.isPublished))
      }
      if (responsesRes.ok) {
        const resps: StudentResponse[] = await responsesRes.json()
        setAllResponses(resps.filter((r) => !r.isArchived))
      }

      const sorted = sections.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

      const result: SectionRow[] = sorted.map((s) => ({
        section: s,
        slug: titleToSlug(s.section_title),
        groups: groups.filter((g) => g.lifemap_sections_id === s.id).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
      }))

      setRows(result)
    } catch {
      toast.error("Failed to load data")
    } finally {
      setLoading(false)
    }
  }, [studentId])

  useEffect(() => {
    loadData()
    loadComments()
  }, [loadData, loadComments])

  const { register, unregister } = useRefreshRegister()
  useEffect(() => {
    const fn = async () => {
      setLoading(true)
      await Promise.all([loadData(), loadComments()])
    }
    register(fn)
    return () => unregister()
  }, [loadData, loadComments, register, unregister])

  const openSheet = async (row: SectionRow, groupId: number | null) => {
    setSheetRow(row)
    setSheetGroupId(groupId)
    setLoadingSheet(true)
    setSectionQuestions([])
    setSectionResponses([])
    setCommentNote("")

    try {
      const [templateRes, responsesRes] = await Promise.all([
        fetch(TEMPLATE_ENDPOINT),
        fetch(`${RESPONSES_ENDPOINT}?students_id=${studentId}`),
      ])

      if (templateRes.ok) {
        const allQs: TemplateQuestion[] = await templateRes.json()
        const sectionQs = allQs
          .filter((q) => !q.isArchived && q.isPublished && q.lifemap_sections_id === row.section.id)
          .sort((a, b) => a.sortOrder - b.sortOrder)
        setSectionQuestions(
          groupId !== null
            ? sectionQs.filter((q) => q.lifemap_custom_group_id === groupId)
            : sectionQs
        )
      }

      if (responsesRes.ok) {
        const allResponses: StudentResponse[] = await responsesRes.json()
        setSectionResponses(allResponses.filter((r) => !r.isArchived))
      }
    } catch { /* ignore */ } finally {
      setLoadingSheet(false)
    }
  }

  const handlePostComment = async () => {
    if (!commentNote.trim() || !sheetRow) return
    setPostingComment(true)
    const teacherName = session?.user?.name ?? "Teacher"
    const teachersId = (session?.user as Record<string, unknown>)?.teachers_id ?? null
    const payload: Record<string, unknown> = {
      students_id: studentId,
      teachers_id: teachersId,
      field_name: "_section_comment",
      lifemap_sections_id: sheetRow.section.id,
      note: commentNote.trim(),
      isOld: false,
      isComplete: false,
      teacher_name: teacherName,
    }
    if (sheetGroupId !== null) {
      payload.lifemap_custom_group_id = sheetGroupId
    }
    try {
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
        setCommentNote("")
      }
    } catch { /* ignore */ } finally {
      setPostingComment(false)
    }
  }

  const handleDeleteComment = useCallback(
    async (commentId: number) => {
      const res = await fetch(`${COMMENTS_ENDPOINT}/${commentId}`, { method: "DELETE" })
      if (res.ok) {
        setComments((prev) => prev.filter((c) => c.id !== commentId))
      }
    },
    []
  )

  const sheetComments = sheetRow
    ? comments.filter((c) => {
        if (c.field_name !== "_section_comment") return false
        if (Number(c.lifemap_sections_id) !== sheetRow.section.id) return false
        if (sheetGroupId !== null) {
          return Number(c.lifemap_custom_group_id) === sheetGroupId
        }
        return !c.lifemap_custom_group_id
      })
    : []
  const sortedSheetComments = [...sheetComments].sort(
    (a, b) => parseTimestamp(b.created_at) - parseTimestamp(a.created_at)
  )

  if (loading) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        <Skeleton className="h-8 w-64" />
        <div className="space-y-2">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">Life Map Overview</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Review section progress and provide feedback.
        </p>
      </div>

      <hr className="border-border -mb-3" />

      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" className="gap-2" asChild>
          <Link href="/admin/life-map">
            <HugeiconsIcon icon={ArrowLeft02Icon} strokeWidth={2} className="size-4" />
            Back
          </Link>
        </Button>
        <Button variant="outline" size="sm" className="gap-2" asChild>
          <a href={`/public/life-map/${studentId}`} target="_blank" rel="noopener noreferrer">
            <HugeiconsIcon icon={Link01Icon} strokeWidth={2} className="size-4" />
            View Life Map
          </a>
        </Button>
      </div>

      <div className="rounded-md border">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="text-muted-foreground w-[44px] text-xs font-medium uppercase tracking-wide" />
              <TableHead className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Section / Group</TableHead>
              <TableHead className="text-muted-foreground w-auto text-right text-xs font-medium uppercase tracking-wide">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const locked = row.section.isLocked ?? false
              return (
                <SectionTableRows
                  key={row.section.id}
                  row={row}
                  locked={locked}
                  onRowClick={(slug) => router.push(`/admin/life-map/${studentId}/${slug}`)}
                  onViewSummary={(groupId) => openSheet(row, groupId)}
                  templateQuestions={allTemplateQuestions}
                  responses={allResponses}
                  comments={comments}
                />
              )
            })}
          </TableBody>
        </Table>
      </div>

      <Sheet open={!!sheetRow} onOpenChange={(open) => { if (!open) setSheetRow(null) }}>
        <SheetContent className="flex flex-col gap-0 p-0 sm:max-w-lg">
          <SheetHeader className="shrink-0 border-b px-6 py-4">
            <SheetTitle className="text-base">
              {sheetGroupId !== null
                ? rows.flatMap((r) => r.groups).find((g) => g.id === sheetGroupId)?.group_name
                : sheetRow?.section.section_title}
            </SheetTitle>
            <SheetDescription className="sr-only">Review section details</SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto">
            <div className="border-b px-6 py-4">
              <Label className="text-muted-foreground mb-3 block text-xs font-medium uppercase tracking-wide">Comments</Label>
              {sortedSheetComments.length === 0 && (
                <p className="text-muted-foreground py-4 text-center text-sm">No comments yet.</p>
              )}
              <div className="space-y-2">
                {sortedSheetComments.map((c) => (
                  <InlineCommentCard
                    key={c.id}
                    comment={c}
                    onDelete={() => c.id && handleDeleteComment(c.id)}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between px-6 py-4">
              <Label className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Questions</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (!sheetRow) return
                  router.push(`/admin/life-map/${studentId}/${sheetRow.slug}`)
                  setSheetRow(null)
                }}
              >
                View Responses <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="ml-1 size-3.5" />
              </Button>
            </div>

            {loadingSheet ? (
              <div className="space-y-2 px-6">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : sectionQuestions.length === 0 ? (
              <div className="px-6 pb-6 text-center">
                <p className="text-muted-foreground text-sm">No published questions.</p>
              </div>
            ) : (
              <div>
                {sectionQuestions.map((q) => {
                  const response = sectionResponses.find((r) => r.lifemap_template_id === q.id)
                  const relTime = formatRelativeTime(response?.last_edited)
                  const typeName = q._question_types?.type ?? (q.question_types_id ? questionTypes.find((t) => t.id === q.question_types_id)?.type : undefined)

                  const statusIcon = response?.isComplete
                    ? <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} className="size-4 text-green-600" />
                    : response?.revisionNeeded
                      ? <HugeiconsIcon icon={AlertCircleIcon} strokeWidth={2} className="size-4 text-red-500" />
                      : response?.readyReview
                        ? <HugeiconsIcon icon={SentIcon} strokeWidth={2} className="size-4 text-blue-500" />
                        : <HugeiconsIcon icon={CircleIcon} strokeWidth={1.5} className="text-muted-foreground/40 size-4" />

                  return (
                    <button
                      key={q.id}
                      type="button"
                      className="flex w-full items-start gap-3 border-b px-6 py-3 text-left transition-colors hover:bg-muted/50"
                      onClick={() => {
                        if (!sheetRow) return
                        router.push(`/admin/life-map/${studentId}/${sheetRow.slug}?focus=${encodeURIComponent(q.field_name)}`)
                        setSheetRow(null)
                      }}
                    >
                      <div className="mt-0.5 shrink-0">{statusIcon}</div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <p className="truncate text-sm font-medium">{q.field_label || q.field_name}</p>
                          <span className="text-muted-foreground shrink-0 text-xs">
                            {relTime ?? "—"}
                          </span>
                        </div>
                        {(typeName || (q.min_words != null && q.min_words > 0)) && (
                          <div className="text-muted-foreground mt-0.5 text-xs">
                            {typeName}{typeName && q.min_words != null && q.min_words > 0 && " · "}{q.min_words != null && q.min_words > 0 && `${q.min_words} min words`}
                          </div>
                        )}
                      </div>
                      <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="mt-0.5 size-4 shrink-0 text-muted-foreground/40" />
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div className="shrink-0 border-t">
            <div className="px-6 py-3">
              <Textarea
                ref={commentTextareaRef}
                placeholder="Add a comment..."
                value={commentNote}
                onChange={(e) => setCommentNote(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && commentNote.trim() && !postingComment) {
                    e.preventDefault()
                    handlePostComment()
                  }
                }}
                rows={3}
                className="w-full"
              />
            </div>
            <div className="flex items-center gap-2 border-t px-6 py-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handlePostComment}
                disabled={!commentNote.trim() || postingComment}
              >
                {postingComment ? "Posting..." : "Post Comment"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

    </div>
  )
}

function SectionTableRows({
  row,
  locked,
  onRowClick,
  onViewSummary,
  templateQuestions,
  responses,
  comments,
}: {
  row: SectionRow
  locked: boolean
  onRowClick: (slug: string) => void
  onViewSummary: (groupId: number | null) => void
  templateQuestions: TemplateQuestion[]
  responses: StudentResponse[]
  comments: Comment[]
}) {
  const [collapsed, setCollapsed] = useState(false)

  const sectionComments = comments.filter(
    (c) => c.field_name === "_section_comment" && Number(c.lifemap_sections_id) === row.section.id
  )

  const bgClass = locked
    ? "bg-gray-50 hover:bg-gray-100 dark:bg-gray-900/30 dark:hover:bg-gray-900/50"
    : "hover:bg-muted/50"

  if (row.groups.length === 0) {
    return (
      <TableRow
        className={`cursor-pointer [&>td]:py-3.5 ${bgClass}`}
        onClick={() => onViewSummary(null)}
      >
        <TableCell>
          <div className="inline-flex size-7 items-center justify-center rounded-md border">
            <HugeiconsIcon
              icon={locked ? SquareLock02Icon : SquareUnlock02Icon}
              strokeWidth={1.5}
              className={`size-4 ${locked ? "text-muted-foreground" : "text-green-600"}`}
            />
          </div>
        </TableCell>
        <TableCell>
          <div className="min-w-0">
            <span className="text-sm font-medium">{row.section.section_title}</span>
            {row.section.section_description && (
              <p className="text-muted-foreground mt-0.5 truncate text-xs">{row.section.section_description}</p>
            )}
          </div>
        </TableCell>
        <TableCell />
      </TableRow>
    )
  }

  const sectionQs = templateQuestions.filter((q) => q.lifemap_sections_id === row.section.id)
  const responseMap = new Map(responses.map((r) => [r.lifemap_template_id, r]))

  const groupCompletionCounts = row.groups.map((group) => {
    const groupQs = sectionQs.filter((q) => q.lifemap_custom_group_id === group.id)
    return groupQs.length > 0 && groupQs.every((q) => responseMap.get(q.id)?.isComplete)
  })
  const completedGroups = groupCompletionCounts.filter(Boolean).length
  const totalGroups = row.groups.length

  return (
    <>
      <TableRow
        className={`cursor-pointer [&>td]:py-3.5 ${bgClass}`}
        onClick={() => onRowClick(row.slug)}
      >
        <TableCell>
          <div className="inline-flex size-7 items-center justify-center rounded-md border">
            <HugeiconsIcon
              icon={locked ? SquareLock02Icon : SquareUnlock02Icon}
              strokeWidth={1.5}
              className={`size-4 ${locked ? "text-muted-foreground" : "text-green-600"}`}
            />
          </div>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium">{row.section.section_title}</span>
            <span className="text-muted-foreground text-sm">({totalGroups})</span>
          </div>
          {row.section.section_description && (
            <p className="text-muted-foreground mt-0.5 truncate text-xs">{row.section.section_description}</p>
          )}
        </TableCell>
        <TableCell className="text-right">
          <button
            type="button"
            className="inline-flex size-7 items-center justify-center rounded-md border transition-colors hover:bg-accent"
            onClick={(e) => { e.stopPropagation(); setCollapsed((prev) => !prev) }}
            title={collapsed ? "Expand groups" : "Collapse groups"}
          >
            <HugeiconsIcon icon={collapsed ? ArrowDown01Icon : ArrowUp01Icon} strokeWidth={2} className="text-muted-foreground size-3.5" />
          </button>
        </TableCell>
      </TableRow>
      {!collapsed && row.groups.map((group) => {
        const groupQs = sectionQs.filter((q) => q.lifemap_custom_group_id === group.id)
        const groupCompleted = groupQs.filter((q) => responseMap.get(q.id)?.isComplete).length
        const groupRevision = groupQs.filter((q) => responseMap.get(q.id)?.revisionNeeded).length
        const groupReady = groupQs.filter((q) => {
          const r = responseMap.get(q.id)
          return r?.readyReview && !r?.isComplete && !r?.revisionNeeded
        }).length
        const groupBlank = groupQs.length - groupCompleted - groupRevision - groupReady
        const groupComments = sectionComments.filter(
          (c) => Number(c.lifemap_custom_group_id) === group.id
        )
        const groupCommentCount = groupComments.length
        const groupUnreadComments = groupComments.filter((c) => !c.isOld).length
        const isGroupComplete = groupQs.length > 0 && groupCompleted === groupQs.length
        const lastCompletedTime = isGroupComplete
          ? groupQs.reduce<string | number | null | undefined>((latest, q) => {
              const r = responseMap.get(q.id)
              if (!r?.last_edited) return latest
              const rTime = typeof r.last_edited === "number" ? r.last_edited : new Date(r.last_edited).getTime()
              const lTime = latest ? (typeof latest === "number" ? latest : new Date(latest).getTime()) : 0
              return rTime > lTime ? r.last_edited : latest
            }, null)
          : null
        const groupRowBg = bgClass
        return (
          <TableRow
            key={group.id}
            className={`cursor-pointer [&>td]:py-2.5 ${groupRowBg}`}
            onClick={() => onViewSummary(group.id)}
          >
            <TableCell>
              {isGroupComplete ? (
                <div className="inline-flex size-7 items-center justify-center rounded-md border">
                  <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} className="size-4 text-green-600" />
                </div>
              ) : (
                <div className="inline-flex size-7 items-center justify-center rounded-md border">
                  <HugeiconsIcon icon={CircleIcon} strokeWidth={1.5} className="text-muted-foreground/40 size-4" />
                </div>
              )}
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-2 pl-4">
                <span className="text-sm font-semibold text-foreground">{group.group_name}</span>
                {groupCommentCount > 0 && (
                  <div className="relative inline-flex size-7 items-center justify-center rounded-md border" title={`${groupCommentCount} comment${groupCommentCount !== 1 ? "s" : ""}`}>
                    <HugeiconsIcon icon={Comment01Icon} strokeWidth={2} className="size-3.5 text-muted-foreground/50" />
                    {groupUnreadComments > 0 && (
                      <span className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-gray-400 text-[9px] font-bold text-white">{groupUnreadComments}</span>
                    )}
                  </div>
                )}
                {!isGroupComplete && groupRevision > 0 && (
                  <div className="relative inline-flex size-7 items-center justify-center rounded-lg border" title={`${groupRevision} need revision`}>
                    <HugeiconsIcon icon={AlertCircleIcon} strokeWidth={2} className="size-3.5 text-red-500" />
                    <span className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">{groupRevision}</span>
                  </div>
                )}
                <span className="text-muted-foreground text-xs">·</span>
                <span className={`text-xs font-medium ${isGroupComplete ? "text-green-600" : "text-muted-foreground"}`}>
                  {isGroupComplete ? "Completed" : `${Math.round((groupCompleted / groupQs.length) * 100)}%`}
                </span>
              </div>
            </TableCell>
            <TableCell className="text-right">
              {isGroupComplete ? (
                <span className="text-muted-foreground/60 text-xs">
                  {formatRelativeTime(lastCompletedTime)}
                </span>
              ) : (() => {
                const remaining = groupQs.length - groupCompleted
                return (
                  <div className="flex items-center justify-end gap-1.5">
                    <div className="inline-flex size-7 items-center justify-center rounded-md border text-sm font-semibold text-green-600" title={`${groupCompleted} completed`}>
                      {groupCompleted}
                    </div>
                    <div className="inline-flex size-7 items-center justify-center rounded-md border text-sm font-semibold text-muted-foreground" title={`${remaining} remaining`}>
                      {remaining}
                    </div>
                  </div>
                )
              })()}
            </TableCell>
          </TableRow>
        )
      })}
    </>
  )
}

function InlineCommentCard({
  comment,
  onDelete,
}: {
  comment: Comment
  onDelete: () => void
}) {
  const createdDate = comment.created_at ? new Date(parseTimestamp(comment.created_at)) : null
  const readTime = comment.isRead ? formatRelativeTime(
    typeof comment.isRead === "number" ? comment.isRead : new Date(comment.isRead as string).getTime()
  ) : null

  return (
    <div className="relative rounded-md border p-3 text-sm">
      {comment.id && (
        <div className="absolute right-2 top-2">
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex size-5 items-center justify-center rounded text-muted-foreground/40 transition-colors hover:bg-red-50 hover:text-red-500"
            title="Delete"
          >
            <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} className="size-3.5" />
          </button>
        </div>
      )}
      <p className="whitespace-pre-wrap pr-7">{comment.note}</p>
      <div className="text-muted-foreground mt-2 flex items-center gap-1.5 text-xs">
        {createdDate && <span>{formatRelativeTime(createdDate.getTime())}</span>}
        {createdDate && comment.teacher_name && <span>&middot;</span>}
        {comment.teacher_name && <span className="font-medium">{comment.teacher_name}</span>}
        {comment.isRevisionFeedback && (
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


function parseTimestamp(ts: string | number | undefined): number {
  if (!ts) return 0
  if (typeof ts === "number") return ts
  if (/^\d+$/.test(String(ts))) return Number(ts)
  return new Date(String(ts)).getTime()
}
