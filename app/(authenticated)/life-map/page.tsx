"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  CheckmarkCircle02Icon,
  CircleIcon,
  SquareLock02Icon,
  SquareUnlock02Icon,
  AlertCircleIcon,
  SentIcon,
  ArrowRight01Icon,
  ArrowDown01Icon,
  ArrowUp01Icon,
  Comment01Icon,
} from "@hugeicons/core-free-icons"
import { titleToSlug, type LifeMapSection } from "@/lib/lifemap-sections"
import type { Comment } from "@/lib/form-types"
import { cn } from "@/lib/utils"

const XANO_BASE =
  process.env.NEXT_PUBLIC_XANO_API_BASE ??
  "https://xsc3-mvx7-r86m.n7e.xano.io/api:o2_UyOKn"

const REVIEW_ENDPOINT = `${XANO_BASE}/lifemap_review`
const SECTIONS_ENDPOINT = `${XANO_BASE}/lifemap_sections`
const CUSTOM_GROUP_ENDPOINT = `${XANO_BASE}/lifemap_custom_group`
const TEMPLATE_ENDPOINT = `${XANO_BASE}/lifeplan_template`
const RESPONSES_ENDPOINT = `${XANO_BASE}/lifemap_responses_by_student`
const COMMENTS_ENDPOINT = `${XANO_BASE}/lifemap_comments`
const QUESTION_TYPES_ENDPOINT = `${XANO_BASE}/question_types`

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
  reviews: ReviewRecord[]
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

function reviewStatusLabel(review: ReviewRecord | undefined): string {
  if (!review) return ""
  if (review.isComplete) return "Complete"
  if (review.revisionNeeded) return "Needs Revision"
  if (review.readyReview) return "Ready for Review"
  return ""
}

export default function StudentLifeMapOverviewPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const studentId = (session?.user as Record<string, unknown>)?.students_id as string | undefined

  const [rows, setRows] = useState<SectionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [comments, setComments] = useState<Comment[]>([])
  const [allReviews, setAllReviews] = useState<ReviewRecord[]>([])
  const [questionTypes, setQuestionTypes] = useState<{ id: number; type: string }[]>([])
  const [allTemplateQuestions, setAllTemplateQuestions] = useState<TemplateQuestion[]>([])
  const [allResponses, setAllResponses] = useState<StudentResponse[]>([])

  const [sheetRow, setSheetRow] = useState<SectionRow | null>(null)
  const [sheetGroupId, setSheetGroupId] = useState<number | null>(null)

  const [sectionQuestions, setSectionQuestions] = useState<TemplateQuestion[]>([])
  const [sectionResponses, setSectionResponses] = useState<StudentResponse[]>([])
  const [loadingSheet, setLoadingSheet] = useState(false)

  const loadComments = useCallback(async () => {
    if (!studentId) return
    try {
      const res = await fetch(`${COMMENTS_ENDPOINT}?students_id=${studentId}`)
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data)) setComments(data)
      }
    } catch { /* ignore */ }
  }, [studentId])

  const loadData = useCallback(async () => {
    if (!studentId) return
    try {
      const [sectionsRes, reviewRes, groupsRes, qTypesRes, templateRes, responsesRes] = await Promise.all([
        fetch(SECTIONS_ENDPOINT),
        fetch(REVIEW_ENDPOINT),
        fetch(CUSTOM_GROUP_ENDPOINT),
        fetch(QUESTION_TYPES_ENDPOINT),
        fetch(TEMPLATE_ENDPOINT),
        fetch(`${RESPONSES_ENDPOINT}?students_id=${studentId}`),
      ])

      const sections: LifeMapSection[] = sectionsRes.ok ? await sectionsRes.json() : []
      const reviews: ReviewRecord[] = reviewRes.ok ? await reviewRes.json() : []
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

      const studentReviews = reviews.filter((r) => r.students_id === studentId)
      setAllReviews(studentReviews)

      const sorted = sections.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

      const result: SectionRow[] = sorted.map((s) => ({
        section: s,
        slug: titleToSlug(s.section_title),
        groups: groups.filter((g) => g.lifemap_sections_id === s.id).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
        reviews: studentReviews.filter((r) => r.lifemap_sections_id === s.id),
      }))

      setRows(result)
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }, [studentId])

  useEffect(() => {
    loadData()
    loadComments()
  }, [loadData, loadComments])

  const openSheet = async (row: SectionRow, groupId: number | null) => {
    setSheetRow(row)
    setSheetGroupId(groupId)
    setLoadingSheet(true)
    setSectionQuestions([])
    setSectionResponses([])

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
        const resp: StudentResponse[] = await responsesRes.json()
        setSectionResponses(resp.filter((r) => !r.isArchived))
      }
    } catch { /* ignore */ } finally {
      setLoadingSheet(false)
    }
  }

  const getReviewForGroup = (sectionId: number, groupId: number | null): ReviewRecord | undefined => {
    return allReviews.find(
      (r) => r.lifemap_sections_id === sectionId && r.lifemap_custom_group_id === (groupId ?? null)
    )
  }

  const handleMarkCommentRead = useCallback(async (commentId: number) => {
    const now = new Date().toISOString()
    setComments((prev) =>
      prev.map((c) =>
        c.id === commentId ? { ...c, isOld: true, isRead: now } : c
      )
    )
    try {
      await fetch(`${COMMENTS_ENDPOINT}/${commentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isOld: true, isRead: now }),
      })
    } catch { /* ignore */ }
  }, [])

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
  const sortedSheetComments = [...sheetComments].sort((a, b) => {
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

  if (loading || !studentId) {
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
          View your progress across all sections.
        </p>
      </div>

      <hr className="border-border -mb-3" />

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
                  getReviewForGroup={getReviewForGroup}
                  onRowClick={(slug) => router.push(`/life-map/${slug}`)}
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
            <SheetDescription className="sr-only">Section details</SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto">
            <div className="border-b px-6 py-4">
              <Label className="text-muted-foreground mb-3 block text-xs font-medium uppercase tracking-wide">Comments</Label>
              {sortedSheetComments.length === 0 ? (
                <p className="text-muted-foreground py-4 text-center text-sm">No comments yet.</p>
              ) : (
                <div className="space-y-2">
                  {sortedSheetComments.map((c) => (
                    <CommentCard
                      key={c.id}
                      comment={c}
                      onMarkRead={handleMarkCommentRead}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between px-6 py-4">
              <Label className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Questions</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (!sheetRow) return
                  router.push(`/life-map/${sheetRow.slug}`)
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
                    <div key={q.id} className="flex items-start gap-3 border-b px-6 py-3">
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
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

function SectionTableRows({
  row,
  locked,
  getReviewForGroup,
  onRowClick,
  onViewSummary,
  templateQuestions,
  responses,
  comments,
}: {
  row: SectionRow
  locked: boolean
  getReviewForGroup: (sectionId: number, groupId: number | null) => ReviewRecord | undefined
  onRowClick: (slug: string) => void
  onViewSummary: (groupId: number | null) => void
  templateQuestions: TemplateQuestion[]
  responses: StudentResponse[]
  comments: Comment[]
}) {
  const [collapsed, setCollapsed] = useState(false)

  const bgClass = locked
    ? "bg-gray-50 hover:bg-gray-100 dark:bg-gray-900/30 dark:hover:bg-gray-900/50"
    : "hover:bg-muted/50"

  const sectionComments = comments.filter(
    (c) => c.field_name === "_section_comment" && Number(c.lifemap_sections_id) === row.section.id
  )

  if (row.groups.length === 0) {
    const review = getReviewForGroup(row.section.id, null)
    const relTime = formatRelativeTime(review?.update)
    const statusLabel = reviewStatusLabel(review)
    const unreadCount = sectionComments.filter((c) => !c.isOld && !c.lifemap_custom_group_id).length
    return (
      <TableRow
        className={`${locked ? "cursor-not-allowed" : "cursor-pointer"} [&>td]:py-3.5 ${bgClass}`}
        onClick={() => { if (!locked) onViewSummary(null) }}
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
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{row.section.section_title}</span>
              {(relTime || statusLabel) && (
                <span className="text-muted-foreground/50 text-xs">
                  {relTime && <>· {relTime}</>}
                  {relTime && statusLabel && " "}
                  {statusLabel && <>· {statusLabel}</>}
                </span>
              )}
              {unreadCount > 0 && (
                <div className="relative inline-flex size-7 items-center justify-center rounded-md border" title={`${unreadCount} unread comment${unreadCount !== 1 ? "s" : ""}`}>
                  <HugeiconsIcon icon={Comment01Icon} strokeWidth={2} className="size-3.5 text-blue-500" />
                  <span className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-blue-500 text-[9px] font-bold text-white">{unreadCount}</span>
                </div>
              )}
            </div>
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
        className={`${locked ? "cursor-not-allowed" : "cursor-pointer"} [&>td]:py-3.5 ${bgClass}`}
        onClick={() => { if (!locked) onRowClick(row.slug) }}
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
            <span className={`text-xs font-medium ${completedGroups === totalGroups && totalGroups > 0 ? "text-green-600" : "text-muted-foreground"}`}>
              {completedGroups}/{totalGroups}
            </span>
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
        const unreadGroupComments = sectionComments.filter(
          (c) => !c.isOld && Number(c.lifemap_custom_group_id) === group.id
        ).length
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
            className={`${locked ? "cursor-not-allowed" : "cursor-pointer"} [&>td]:py-2.5 ${groupRowBg}`}
            onClick={() => { if (!locked) onViewSummary(group.id) }}
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
                <span className={`text-sm ${isGroupComplete ? "text-muted-foreground" : "font-semibold text-foreground"}`}>{group.group_name}</span>
                {unreadGroupComments > 0 && (
                  <div className="relative inline-flex size-7 items-center justify-center rounded-md border" title={`${unreadGroupComments} unread comment${unreadGroupComments !== 1 ? "s" : ""}`}>
                    <HugeiconsIcon icon={Comment01Icon} strokeWidth={2} className="size-3.5 text-blue-500" />
                    <span className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-blue-500 text-[9px] font-bold text-white">{unreadGroupComments}</span>
                  </div>
                )}
              </div>
            </TableCell>
            <TableCell className="text-right">
              {isGroupComplete ? (
                <span className="text-muted-foreground/60 text-xs">
                  {formatRelativeTime(lastCompletedTime) ?? "Completed"}
                </span>
              ) : (
                <div className="flex items-center justify-end gap-2">
                  {groupCompleted > 0 && (
                    <div className="relative inline-flex size-8 items-center justify-center rounded-lg border" title={`${groupCompleted} complete`}>
                      <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} className="size-4 text-green-600" />
                      <span className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-green-600 text-[9px] font-bold text-white">{groupCompleted}</span>
                    </div>
                  )}
                  {groupReady > 0 && (
                    <div className="relative inline-flex size-8 items-center justify-center rounded-lg border" title={`${groupReady} ready for review`}>
                      <HugeiconsIcon icon={SentIcon} strokeWidth={2} className="size-4 text-blue-500" />
                      <span className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-blue-500 text-[9px] font-bold text-white">{groupReady}</span>
                    </div>
                  )}
                  {groupRevision > 0 && (
                    <div className="relative inline-flex size-8 items-center justify-center rounded-lg border" title={`${groupRevision} need revision`}>
                      <HugeiconsIcon icon={AlertCircleIcon} strokeWidth={2} className="size-4 text-red-500" />
                      <span className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">{groupRevision}</span>
                    </div>
                  )}
                  {groupBlank > 0 && (
                    <div className="relative inline-flex size-8 items-center justify-center rounded-lg border" title={`${groupBlank} not started`}>
                      <HugeiconsIcon icon={CircleIcon} strokeWidth={1.5} className="text-muted-foreground/40 size-4" />
                      <span className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-gray-400 text-[9px] font-bold text-white">{groupBlank}</span>
                    </div>
                  )}
                </div>
              )}
            </TableCell>
          </TableRow>
        )
      })}
    </>
  )
}

function CommentCard({
  comment: c,
  onMarkRead,
}: {
  comment: Comment
  onMarkRead: (commentId: number) => void
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
      {!isRead && c.id != null && (
        <button
          type="button"
          onClick={() => onMarkRead(c.id!)}
          className="absolute right-2 top-2 inline-flex size-6 items-center justify-center rounded text-muted-foreground/40 transition-colors hover:bg-accent hover:text-green-600"
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
