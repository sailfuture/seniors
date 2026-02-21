"use client"

import { use, useCallback, useEffect, useState } from "react"
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
  RefreshIcon,
  CheckmarkCircle02Icon,
  CircleIcon,
  SquareLock02Icon,
  SquareUnlock02Icon,
  AlertCircleIcon,
  SentIcon,
  Delete02Icon,
  ArrowTurnBackwardIcon,
} from "@hugeicons/core-free-icons"
import { titleToSlug, type LifeMapSection } from "@/lib/lifemap-sections"
import type { Comment } from "@/lib/form-types"

const XANO_BASE =
  process.env.NEXT_PUBLIC_XANO_API_BASE ??
  "https://xsc3-mvx7-r86m.n7e.xano.io/api:o2_UyOKn"

const REVIEW_ENDPOINT = `${XANO_BASE}/lifemap_review`
const REVIEW_SYNC_ENDPOINT = `${XANO_BASE}/lifemap_review_add_all`
const SECTIONS_ENDPOINT = `${XANO_BASE}/lifemap_sections`
const CUSTOM_GROUP_ENDPOINT = `${XANO_BASE}/lifemap_custom_group`
const TEMPLATE_ENDPOINT = `${XANO_BASE}/lifeplan_template`
const RESPONSES_ENDPOINT = `${XANO_BASE}/lifemap_responses_by_student`
const COMMENTS_ENDPOINT = `${XANO_BASE}/lifemap_comments`

interface ReviewRecord {
  id: number
  lifemap_sections_id: number
  lifemap_custom_group_id: number | null
  students_id: string
  teachers_id: string | null
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
}

interface StudentResponse {
  id: number
  lifemap_template_id: number
  student_response: string
  wordCount: number
  isComplete?: boolean
  last_edited?: string | number | null
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

function ReviewStatusIcon({ review }: { review: ReviewRecord | undefined }) {
  if (!review) return <HugeiconsIcon icon={CircleIcon} strokeWidth={1.5} className="text-muted-foreground/40 size-4" />
  if (review.isComplete) return <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} className="size-4 text-green-600" />
  if (review.revisionNeeded) return <HugeiconsIcon icon={AlertCircleIcon} strokeWidth={2} className="size-4 text-red-500" />
  if (review.readyReview) return <HugeiconsIcon icon={SentIcon} strokeWidth={2} className="size-4 text-blue-500" />
  return <HugeiconsIcon icon={CircleIcon} strokeWidth={1.5} className="text-muted-foreground/40 size-4" />
}

function reviewStatusLabel(review: ReviewRecord | undefined): string {
  if (!review) return ""
  if (review.isComplete) return "Complete"
  if (review.revisionNeeded) return "Needs Revision"
  if (review.readyReview) return "Ready for Review"
  return ""
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
  const [syncing, setSyncing] = useState(false)
  const [comments, setComments] = useState<Comment[]>([])
  const [allReviews, setAllReviews] = useState<ReviewRecord[]>([])

  const [sheetRow, setSheetRow] = useState<SectionRow | null>(null)
  const [sheetGroupId, setSheetGroupId] = useState<number | null>(null)
  const [savingReview, setSavingReview] = useState(false)

  const [sectionQuestions, setSectionQuestions] = useState<TemplateQuestion[]>([])
  const [sectionResponses, setSectionResponses] = useState<StudentResponse[]>([])
  const [loadingSheet, setLoadingSheet] = useState(false)

  const [commentNote, setCommentNote] = useState("")
  const [postingComment, setPostingComment] = useState(false)
  const [confirmModal, setConfirmModal] = useState<"revision" | "complete" | null>(null)
  const [revisionNote, setRevisionNote] = useState("")

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
      const [sectionsRes, reviewRes, groupsRes] = await Promise.all([
        fetch(SECTIONS_ENDPOINT),
        fetch(REVIEW_ENDPOINT),
        fetch(CUSTOM_GROUP_ENDPOINT),
      ])

      const sections: LifeMapSection[] = sectionsRes.ok ? await sectionsRes.json() : []
      const reviews: ReviewRecord[] = reviewRes.ok ? await reviewRes.json() : []
      const groups: CustomGroup[] = groupsRes.ok ? await groupsRes.json() : []

      const studentReviews = reviews.filter((r) => r.students_id === studentId)
      setAllReviews(studentReviews)

      const sorted = sections.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

      const result: SectionRow[] = sorted.map((s) => ({
        section: s,
        slug: titleToSlug(s.section_title),
        groups: groups.filter((g) => g.lifemap_sections_id === s.id),
        reviews: studentReviews.filter((r) => r.lifemap_sections_id === s.id),
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

  const handleSync = async () => {
    setSyncing(true)
    try {
      const res = await fetch(REVIEW_SYNC_ENDPOINT, { method: "POST" })
      if (!res.ok) throw new Error()
      toast.success("Review records synced")
      await loadData()
    } catch {
      toast.error("Failed to sync review records")
    } finally {
      setSyncing(false)
    }
  }

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
        setSectionResponses(allResponses.filter((r) => !(r as Record<string, unknown>).isArchived))
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

  const handlePatchReview = async (reviewId: number, patch: Partial<ReviewRecord>) => {
    setSavingReview(true)
    const now = new Date().toISOString()
    const fullPatch = { ...patch, update: now }
    try {
      const res = await fetch(`${REVIEW_ENDPOINT}/${reviewId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fullPatch),
      })
      if (!res.ok) throw new Error()
      setAllReviews((prev) =>
        prev.map((r) => (r.id === reviewId ? { ...r, ...fullPatch } : r))
      )
      toast.success("Review updated")
      setSheetRow(null)
    } catch {
      toast.error("Failed to save review")
    } finally {
      setSavingReview(false)
    }
  }

  const handleConfirmAction = async () => {
    const review = sheetRow ? getReviewForGroup(sheetRow.section.id, sheetGroupId) : undefined
    if (!review || !confirmModal) return

    const patch: Partial<ReviewRecord> = confirmModal === "complete"
      ? { isComplete: true, revisionNeeded: false, readyReview: false }
      : { revisionNeeded: true, isComplete: false, readyReview: false }

    setSavingReview(true)
    const now = new Date().toISOString()
    const fullPatch = { ...patch, update: now }
    try {
      const res = await fetch(`${REVIEW_ENDPOINT}/${review.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fullPatch),
      })
      if (!res.ok) throw new Error()
      setAllReviews((prev) =>
        prev.map((r) => (r.id === review.id ? { ...r, ...fullPatch } : r))
      )

      if (confirmModal === "revision" && revisionNote.trim()) {
        const teacherName = session?.user?.name ?? "Teacher"
        const teachersId = (session?.user as Record<string, unknown>)?.teachers_id ?? null
        const commentPayload: Record<string, unknown> = {
          students_id: studentId,
          teachers_id: teachersId,
          field_name: "_section_comment",
          lifemap_sections_id: sheetRow.section.id,
          note: revisionNote.trim(),
          isOld: false,
          isComplete: false,
          isRevisionFeedback: true,
          teacher_name: teacherName,
        }
        if (sheetGroupId !== null) {
          commentPayload.lifemap_custom_group_id = sheetGroupId
        }
        try {
          const commentRes = await fetch(COMMENTS_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(commentPayload),
          })
          if (commentRes.ok) {
            const newComment = await commentRes.json()
            setComments((prev) => [
              ...prev,
              { ...newComment, teacher_name: newComment.teacher_name || teacherName },
            ])
          }
        } catch { /* ignore */ }
      }

      toast.success(confirmModal === "complete" ? "Marked as complete" : "Resubmission requested")
      setConfirmModal(null)
      setRevisionNote("")
      setSheetRow(null)
    } catch {
      toast.error("Failed to update review")
    } finally {
      setSavingReview(false)
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

  const sheetReview = sheetRow ? getReviewForGroup(sheetRow.section.id, sheetGroupId) : undefined
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
        <Button
          variant="outline"
          size="sm"
          onClick={handleSync}
          disabled={syncing}
          className="gap-2"
        >
          <HugeiconsIcon icon={RefreshIcon} strokeWidth={2} className={`size-4 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing..." : "Sync Reviews"}
        </Button>
      </div>

      <div className="rounded-md border">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="text-muted-foreground w-[44px] text-xs font-medium uppercase tracking-wide" />
              <TableHead className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Section / Group</TableHead>
              <TableHead className="text-muted-foreground w-[100px] text-center text-xs font-medium uppercase tracking-wide">Status</TableHead>
              <TableHead className="text-muted-foreground w-[100px] text-right text-xs font-medium uppercase tracking-wide">Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const locked = row.section.isLocked
              return (
                <SectionTableRows
                  key={row.section.id}
                  row={row}
                  locked={locked}
                  getReviewForGroup={getReviewForGroup}
                  onRowClick={(slug) => router.push(`/admin/life-map/${studentId}/${slug}`)}
                  onViewSummary={(groupId) => openSheet(row, groupId)}
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
            {sheetReview && (
              <div className="border-b px-6 py-4">
                <Label className="text-muted-foreground mb-2 block text-xs font-medium uppercase tracking-wide">Review Status</Label>
                <div className="flex items-center gap-2">
                  <ReviewStatusIcon review={sheetReview} />
                  <span className="text-sm font-medium">
                    {reviewStatusLabel(sheetReview) || "No Status"}
                  </span>
                </div>
              </div>
            )}

            {!sheetReview && (
              <div className="border-b px-6 py-4">
                <p className="text-muted-foreground text-center text-xs">
                  No review record found. Click &ldquo;Sync Reviews&rdquo; to create one.
                </p>
              </div>
            )}

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

            <div className="px-6 py-4">
              <Label className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Questions</Label>
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
                  const complete = response?.isComplete ?? false
                  const relTime = formatRelativeTime(response?.last_edited)
                  return (
                    <div key={q.id} className="flex items-center gap-3 border-b px-6 py-3">
                      {complete ? (
                        <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} className="size-4 shrink-0 text-green-600" />
                      ) : (
                        <HugeiconsIcon icon={CircleIcon} strokeWidth={1.5} className="text-muted-foreground/40 size-4 shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{q.field_label || q.field_name}</p>
                      </div>
                      <span className={`shrink-0 text-xs ${complete ? "text-green-600" : "text-muted-foreground"}`}>
                        {complete ? "Complete" : relTime ?? "—"}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="shrink-0 border-t">
            <div className="space-y-2 px-6 py-3">
              <Textarea
                placeholder="Add a comment..."
                value={commentNote}
                onChange={(e) => setCommentNote(e.target.value)}
                rows={2}
              />
              <Button
                variant="outline"
                className="w-full"
                onClick={handlePostComment}
                disabled={!commentNote.trim() || postingComment}
              >
                {postingComment ? "Posting..." : "Add Comment"}
              </Button>
            </div>
            <div className="flex items-center gap-2 border-t px-6 py-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  if (!sheetRow) return
                  router.push(`/admin/life-map/${studentId}/${sheetRow.slug}`)
                  setSheetRow(null)
                }}
              >
                View Responses
              </Button>
              {sheetReview && !sheetReview.isComplete && (
                <Button
                  variant="outline"
                  size="icon"
                  className="size-9 shrink-0"
                  onClick={() => { setConfirmModal("revision"); setRevisionNote("") }}
                  disabled={savingReview}
                  title="Needs Revision"
                >
                  <HugeiconsIcon icon={AlertCircleIcon} strokeWidth={2} className="size-4 text-red-500" />
                </Button>
              )}
              {sheetReview && !sheetReview.isComplete && (
                <Button
                  variant="outline"
                  size="icon"
                  className="size-9 shrink-0"
                  onClick={() => setConfirmModal("complete")}
                  disabled={savingReview}
                  title="Mark Complete"
                >
                  <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} className="size-4 text-green-600" />
                </Button>
              )}
              {sheetReview?.isComplete && (
                <Button
                  variant="outline"
                  size="icon"
                  className="size-9 shrink-0"
                  onClick={() => handlePatchReview(sheetReview.id, { isComplete: false, revisionNeeded: false, readyReview: false })}
                  disabled={savingReview}
                  title="Reopen"
                >
                  <HugeiconsIcon icon={ArrowTurnBackwardIcon} strokeWidth={2} className="size-4" />
                </Button>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={confirmModal !== null} onOpenChange={(open) => { if (!open) { setConfirmModal(null); setRevisionNote("") } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmModal === "complete" ? "Mark as Complete?" : "Request Resubmission?"}
            </DialogTitle>
            <DialogDescription>
              {confirmModal === "complete"
                ? `This will mark "${sheetGroupId !== null ? rows.flatMap((r) => r.groups).find((g) => g.id === sheetGroupId)?.group_name : sheetRow?.section.section_title}" as complete.`
                : `This will request a resubmission for "${sheetGroupId !== null ? rows.flatMap((r) => r.groups).find((g) => g.id === sheetGroupId)?.group_name : sheetRow?.section.section_title}".`}
            </DialogDescription>
          </DialogHeader>
          {confirmModal === "revision" && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Comment (optional)</Label>
              <Textarea
                placeholder="Add a note for the student..."
                value={revisionNote}
                onChange={(e) => setRevisionNote(e.target.value)}
                rows={3}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setConfirmModal(null); setRevisionNote("") }}>
              Cancel
            </Button>
            <Button onClick={handleConfirmAction} disabled={savingReview}>
              {savingReview ? "Saving..." : confirmModal === "complete" ? "Mark Complete" : "Request Resubmission"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SectionTableRows({
  row,
  locked,
  getReviewForGroup,
  onRowClick,
  onViewSummary,
}: {
  row: SectionRow
  locked: boolean
  getReviewForGroup: (sectionId: number, groupId: number | null) => ReviewRecord | undefined
  onRowClick: (slug: string) => void
  onViewSummary: (groupId: number | null) => void
}) {
  const bgClass = locked
    ? "bg-gray-50 hover:bg-gray-100 dark:bg-gray-900/30 dark:hover:bg-gray-900/50"
    : "hover:bg-muted/50"

  if (row.groups.length === 0) {
    const review = getReviewForGroup(row.section.id, null)
    const relTime = formatRelativeTime(review?.update)
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
        <TableCell className="text-center">
          <div className="inline-flex size-7 items-center justify-center rounded-md border">
            <ReviewStatusIcon review={review} />
          </div>
        </TableCell>
        <TableCell className="text-right">
          {relTime && <span className="text-muted-foreground/60 text-[11px]">{relTime}</span>}
        </TableCell>
      </TableRow>
    )
  }

  const completedCount = row.groups.filter((g) => getReviewForGroup(row.section.id, g.id)?.isComplete).length

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
        <TableCell colSpan={2}>
          <div className="min-w-0">
            <span className="text-sm font-medium">{row.section.section_title}</span>
            {row.section.section_description && (
              <p className="text-muted-foreground mt-0.5 truncate text-xs">{row.section.section_description}</p>
            )}
          </div>
        </TableCell>
        <TableCell className="text-right">
          <span className={`text-xs font-medium ${completedCount === row.groups.length && row.groups.length > 0 ? "text-green-600" : "text-muted-foreground"}`}>
            {completedCount}/{row.groups.length}
          </span>
        </TableCell>
      </TableRow>
      {row.groups.map((group) => {
        const review = getReviewForGroup(row.section.id, group.id)
        const relTime = formatRelativeTime(review?.update)
        return (
          <TableRow
            key={group.id}
            className={`cursor-pointer [&>td]:py-2.5 ${bgClass}`}
            onClick={() => onViewSummary(group.id)}
          >
            <TableCell />
            <TableCell>
              <span className="text-muted-foreground pl-4 text-sm">{group.group_name}</span>
            </TableCell>
            <TableCell className="text-center">
              <div className="inline-flex size-7 items-center justify-center rounded-md border">
                <ReviewStatusIcon review={review} />
              </div>
            </TableCell>
            <TableCell className="text-right">
              {relTime && <span className="text-muted-foreground/60 text-[11px]">{relTime}</span>}
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
