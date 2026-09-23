"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "@/components/session-provider"
import { toast } from "sonner"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  Link01Icon,
  ArrowRight01Icon,
  CheckmarkCircle02Icon,
  SquareLock01Icon,
  SquareUnlock01Icon,
  PrinterIcon,
  BookOpen02Icon,
} from "@hugeicons/core-free-icons"
import { formatYearGroup } from "@/lib/year-group"
import type { FormApiConfig } from "@/lib/form-api-config"
import { fetchAllProjectLocks, lockProject, unlockProject, type ProjectLockStatus } from "@/lib/project-lock"
import { cachedFetch } from "@/lib/cached-fetch"
import {
  advisorName,
  assignAdvisor,
  assignmentsFor,
  unassignAdvisor,
  type AdvisorProduct,
} from "@/lib/advisors"
import { AdvisorAssignDialog } from "@/components/advisor-assign-dialog"
import { useAdvisorAssignments, useAdvisorCacheActions, useAdvisors } from "@/lib/queries"
import { classYearOf, currentClassYear } from "@/lib/students"

interface Student {
  id: string
  firstName: string
  lastName: string
  studentEmail: string
  profileImage: string
  yearGroup?: string
  crewName?: string
}

interface GroupedStudents {
  label: string
  sortKey: number
  students: Student[]
}

const STUDENTS_ENDPOINT =
  "https://xsc3-mvx7-r86m.n7e.xano.io/api:fJsHVIeC/get_active_students_email"

// Graduated classes (and students who left) are archived in Xano, so past
// classes come from their own list.
const ARCHIVED_STUDENTS_ENDPOINT =
  "https://xsc3-mvx7-r86m.n7e.xano.io/api:fJsHVIeC/get_archived_students_email"

const LM_RESPONSES_ENDPOINT =
  "https://xsc3-mvx7-r86m.n7e.xano.io/api:o2_UyOKn/lifemap_responses"

const LM_TEMPLATE_ENDPOINT =
  "https://xsc3-mvx7-r86m.n7e.xano.io/api:o2_UyOKn/lifeplan_template"

const QUESTION_TYPES_ENDPOINT =
  "https://xsc3-mvx7-r86m.n7e.xano.io/api:o2_UyOKn/question_types"

function getInitials(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
}

function extractSortYear(yearGroup: string): number {
  const match = yearGroup.match(/(\d{4})/)
  return match ? parseInt(match[1], 10) : 9999
}

function groupByYearGroup(students: Student[]): GroupedStudents[] {
  const map = new Map<string, Student[]>()

  for (const s of students) {
    const group = s.yearGroup || "Other"
    if (!map.has(group)) map.set(group, [])
    map.get(group)!.push(s)
  }

  return Array.from(map.entries())
    .map(([label, list]) => ({
      label,
      sortKey: extractSortYear(label),
      students: list.sort(
        (a, b) => a.firstName.localeCompare(b.firstName) || a.lastName.localeCompare(b.lastName)
      ),
    }))
    .sort((a, b) => a.sortKey - b.sortKey)
}

/** A class table renders as a flat list of rows, optionally split into two
    labeled bands. */
interface RosterItem {
  key: string
  header?: { label: string; count: number }
  student?: Student
}

/**
 * Split one class into two bands with a label above each: by default students
 * still working, then students who are settled (every section approved, or
 * the project locked). When there's nothing to split, the bands are dropped so
 * the table reads exactly as it did before.
 */
function rosterItems(
  students: Student[],
  inSecondBand: (s: Student) => boolean,
  labels: [string, string] = ["In progress", "Completed & locked"]
): RosterItem[] {
  const first = students.filter((s) => !inSecondBand(s))
  const second = students.filter(inSecondBand)
  if (first.length === 0 || second.length === 0) {
    return students.map((s) => ({ key: s.id, student: s }))
  }
  return [
    { key: "hdr-first", header: { label: labels[0], count: first.length } },
    ...first.map((s) => ({ key: s.id, student: s })),
    { key: "hdr-second", header: { label: labels[1], count: second.length } },
    ...second.map((s) => ({ key: s.id, student: s })),
  ]
}

function TableSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-64" />
      {Array.from({ length: 2 }).map((_, g) => (
        <div key={g} className="space-y-2">
          <Skeleton className="h-5 w-32" />
          <div className="rounded-md border">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 border-b px-4 py-3 last:border-0">
                <Skeleton className="size-8 rounded-full" />
                <Skeleton className="h-4 w-36" />
                <Skeleton className="ml-auto h-4 w-48" />
                <Skeleton className="h-4 w-12" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

interface StudentRosterProps {
  title: string
  description: string
  basePath: string
  publicBaseUrl?: string
  responsesEndpoint?: string
  templateEndpoint?: string
  templateIdField?: string
  sectionIdField?: string
  /** Enables the per-student Lock/Unlock actions (needs cfg.locksEndpoint). */
  apiConfig?: FormApiConfig
  /** Product tag stored in snapshot meta, e.g. "business-thesis". */
  product?: string
}

export function StudentRoster({
  title,
  description,
  basePath,
  publicBaseUrl,
  responsesEndpoint = LM_RESPONSES_ENDPOINT,
  templateEndpoint = LM_TEMPLATE_ENDPOINT,
  templateIdField = "lifemap_template_id",
  sectionIdField = "lifemap_sections_id",
  apiConfig,
  product = "project",
}: StudentRosterProps) {
  const router = useRouter()
  const { data: session } = useSession()
  const [students, setStudents] = useState<Student[]>([])
  const [archivedStudents, setArchivedStudents] = useState<Student[]>([])
  // "current" shows the active roster; a year shows that graduated class.
  const [classView, setClassView] = useState<"current" | number>("current")
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [reviewCounts, setReviewCounts] = useState<Map<string, number>>(new Map())
  const [allComplete, setAllComplete] = useState<Set<string>>(new Set())
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [locks, setLocks] = useState<Map<string, ProjectLockStatus>>(new Map())
  // The student a Lock/Unlock confirm dialog is open for, and in-flight state.
  const [lockDialog, setLockDialog] = useState<Student | null>(null)
  const [lockActing, setLockActing] = useState(false)
  // Advisor tables come from the shared cache, so assigning here also updates
  // the advisor directory and dashboard without a refetch.
  const advisors = useAdvisors().data ?? []
  const assignments = useAdvisorAssignments().data ?? []
  const advisorCache = useAdvisorCacheActions()
  const [advisorDialog, setAdvisorDialog] = useState<Student | null>(null)
  const [advisorBusy, setAdvisorBusy] = useState(false)

  const locksEndpoint = apiConfig?.locksEndpoint
  const lockStatusEndpoint = apiConfig?.lockStatusEndpoint
  // The roster only reads review flags, never the response text, so it uses
  // the status-only rows when the product has them.
  const statusEndpoint = apiConfig?.responseStatusEndpoint ?? responsesEndpoint
  // Advisor assignments are product-scoped; the roster knows which product
  // it's showing, so assignments made here grant access to that one only.
  const advisorProduct = (product === "life-map" ? "life-map" : "business-thesis") as AdvisorProduct

  const fetchData = useCallback(async () => {
    try {
      const [studentsRes, reviewsRes, templateRes, typesRes, lockMap, archivedRes] =
        await Promise.all([
          cachedFetch(STUDENTS_ENDPOINT),
          fetch(statusEndpoint),
          cachedFetch(templateEndpoint),
          cachedFetch(QUESTION_TYPES_ENDPOINT),
          lockStatusEndpoint
            ? fetchAllProjectLocks(lockStatusEndpoint)
            : Promise.resolve(new Map<string, ProjectLockStatus>()),
          cachedFetch(ARCHIVED_STUDENTS_ENDPOINT).catch(() => null),
        ])
      setLocks(lockMap)

      if (archivedRes?.ok) {
        const data = await archivedRes.json()
        setArchivedStudents(Array.isArray(data) ? data : [])
      }

      if (studentsRes.ok) {
        const data = await studentsRes.json()
        const studentList: Student[] = Array.isArray(data) ? data : []
        setStudents(studentList)

        // Only the current graduating class is expanded by default; every
        // other class year (including graduated ones) starts collapsed.
        const current = String(currentClassYear())
        const yearGroups = new Set(studentList.map((s) => s.yearGroup || "Other"))
        setCollapsedGroups(new Set([...yearGroups].filter((g) => !g.includes(current))))
      }

      // Question types flagged noInput (headers etc.) never require answers,
      // so they don't count toward a section being fully complete.
      const noInput = new Set<number>()
      if (typesRes.ok) {
        const types = await typesRes.json()
        if (Array.isArray(types)) {
          for (const t of types as { id: number; noInput?: boolean }[]) if (t.noInput) noInput.add(t.id)
        }
      }

      // Only questions that still exist on the form can produce review work;
      // responses on archived/unpublished questions are unreachable in the
      // section view and must not badge the roster. The same live set drives
      // the per-section totals for the "everything approved" check, matching
      // the sidebar's green-check rule.
      const liveTemplateIds = new Set<number>()
      const templateToSection = new Map<number, number>()
      const sectionTotal = new Map<number, number>()
      if (templateRes.ok) {
        const templates = await templateRes.json()
        if (Array.isArray(templates)) {
          for (const t of templates as { id: number; isArchived?: boolean; isPublished?: boolean; question_types_id?: number; [key: string]: unknown }[]) {
            if (t.isArchived || !t.isPublished) continue
            liveTemplateIds.add(t.id)
            const sec = Number(t[sectionIdField])
            if (!sec) continue
            templateToSection.set(t.id, sec)
            if (t.question_types_id != null && noInput.has(t.question_types_id)) continue
            sectionTotal.set(sec, (sectionTotal.get(sec) ?? 0) + 1)
          }
        }
      }

      if (reviewsRes.ok) {
        const responses = await reviewsRes.json()
        if (Array.isArray(responses)) {
          const counts = new Map<string, number>()
          const completeBySection = new Map<string, Map<number, number>>()
          for (const r of responses) {
            if (r.isArchived) continue
            const sid = String(r.students_id)
            if (r.isComplete) {
              const sec = templateToSection.get(Number(r[templateIdField]))
              if (sec) {
                let m = completeBySection.get(sid)
                if (!m) {
                  m = new Map()
                  completeBySection.set(sid, m)
                }
                m.set(sec, (m.get(sec) ?? 0) + 1)
              }
            }
            if (!r.readyReview || r.isComplete || r.revisionNeeded) continue
            if (!liveTemplateIds.has(Number(r[templateIdField]))) continue
            counts.set(sid, (counts.get(sid) ?? 0) + 1)
          }
          setReviewCounts(counts)

          // A student is fully done when every section that has input
          // questions has all of them approved (isComplete).
          const done = new Set<string>()
          const requiredSections = [...sectionTotal.entries()].filter(([, total]) => total > 0)
          if (requiredSections.length > 0) {
            for (const [sid, bySection] of completeBySection) {
              if (requiredSections.every(([sec, total]) => (bySection.get(sec) ?? 0) >= total)) done.add(sid)
            }
          }
          setAllComplete(done)
        }
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false)
    }
  }, [statusEndpoint, templateEndpoint, templateIdField, sectionIdField, lockStatusEndpoint])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleAssignAdvisor = useCallback(
    async (advisorId: number) => {
      if (!advisorDialog) return
      setAdvisorBusy(true)
      try {
        const created = await assignAdvisor(advisorDialog.id, advisorId, advisorProduct)
        if (!created) throw new Error()
        advisorCache.assignmentCreated(created)
        const a = advisors.find((x) => x.id === advisorId)
        toast.success(`${a ? advisorName(a) : "Advisor"} assigned to ${advisorDialog.firstName}`)
      } catch {
        toast.error("Couldn't assign the advisor — please try again.")
      } finally {
        setAdvisorBusy(false)
      }
    },
    [advisorDialog, advisorProduct, advisors, advisorCache]
  )

  const handleUnassignAdvisor = useCallback(async (assignmentId: number) => {
    setAdvisorBusy(true)
    try {
      const ok = await unassignAdvisor(assignmentId)
      if (!ok) throw new Error()
      advisorCache.assignmentRemoved(assignmentId)
      toast.success("Advisor removed")
    } catch {
      toast.error("Couldn't remove the advisor — please try again.")
    } finally {
      setAdvisorBusy(false)
    }
  }, [advisorCache])

  // Lock = freeze the public page + PDF as they render right now; Unlock
  // returns them to the live template join.
  const handleLockToggle = useCallback(async () => {
    if (!lockDialog || !apiConfig || !locksEndpoint) return
    const student = lockDialog
    const existing = locks.get(student.id)
    setLockActing(true)
    try {
      if (existing) {
        const ok = await unlockProject(locksEndpoint, existing.id)
        if (!ok) throw new Error("unlock failed")
        setLocks((prev) => {
          const next = new Map(prev)
          next.delete(student.id)
          return next
        })
        toast.success(`${student.firstName}'s project unlocked — pages render live data again`)
      } else {
        const teacherName = session?.user?.name ?? "Teacher"
        const created = await lockProject(apiConfig, locksEndpoint, student.id, teacherName, product)
        setLocks((prev) => new Map(prev).set(student.id, created))
        toast.success(`${student.firstName}'s project locked — public page and PDF are frozen`)
      }
      setLockDialog(null)
    } catch {
      toast.error(existing ? "Couldn't unlock — please try again." : "Couldn't capture the snapshot — please try again.")
    } finally {
      setLockActing(false)
    }
  }, [lockDialog, apiConfig, locksEndpoint, locks, session, product])

  // Graduated classes are archived students whose class year has passed;
  // archived students in current classes left the school instead.
  const thisClassYear = currentClassYear()
  const pastClassYears = [
    ...new Set(
      archivedStudents.map(classYearOf).filter((y): y is number => y != null && y < thisClassYear)
    ),
  ].sort((a, b) => b - a)
  const pastYear = classView === "current" ? null : classView
  const shown = pastYear == null ? students : archivedStudents.filter((s) => classYearOf(s) === pastYear)

  // Archived rows can be missing an email, so every field is optional here.
  const filtered = shown.filter((s) => {
    const q = search.toLowerCase()
    return [s.firstName, s.lastName, s.studentEmail, s.crewName].some((v) =>
      (v ?? "").toLowerCase().includes(q)
    )
  })

  const groups = groupByYearGroup(filtered)

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-muted-foreground mt-1">{description}</p>
      </div>

      {loading ? (
        <TableSkeleton />
      ) : (
        <div className="space-y-8">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <Input
                placeholder="Search by name, email, or crew..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-sm"
              />
              {pastClassYears.length > 0 && (
                <Select
                  value={String(classView)}
                  onValueChange={(v) => setClassView(v === "current" ? "current" : Number(v))}
                >
                  <SelectTrigger className="w-[220px]" aria-label="Class">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="current">Current students</SelectItem>
                    <SelectSeparator />
                    {pastClassYears.map((year) => (
                      <SelectItem key={year} value={String(year)}>
                        Class of {year} (graduated)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            {pastYear != null && (
              <p className="text-muted-foreground text-sm">
                Open a student to see their project as it was locked. Projects that were
                never locked show the student&apos;s last saved answers.
              </p>
            )}
          </div>

          {groups.length === 0 && (
            <p className="text-muted-foreground py-8 text-center">No students found.</p>
          )}

          {/* Thesis advisor assignment for one student + this product */}
          <AdvisorAssignDialog
            open={advisorDialog != null}
            onOpenChange={(o) => { if (!o) setAdvisorDialog(null) }}
            studentName={advisorDialog ? `${advisorDialog.firstName} ${advisorDialog.lastName}` : ""}
            productLabel={advisorProduct === "life-map" ? "Life Map" : "Business Thesis"}
            advisors={advisors}
            assigned={
              advisorDialog ? assignmentsFor(assignments, advisorDialog.id, advisorProduct) : []
            }
            busy={advisorBusy}
            onAssign={handleAssignAdvisor}
            onUnassign={handleUnassignAdvisor}
          />

          {/* Lock / Unlock confirmation */}
          <AlertDialog open={lockDialog != null} onOpenChange={(o) => { if (!o && !lockActing) setLockDialog(null) }}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {lockDialog && locks.has(lockDialog.id)
                    ? `Unlock ${lockDialog.firstName}'s project?`
                    : `Lock ${lockDialog?.firstName ?? ""}'s project?`}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {lockDialog && locks.has(lockDialog.id)
                    ? "The public page and printed PDF go back to rendering live data, so template edits will affect them again."
                    : "Freezes the public page and printed PDF exactly as they render right now. Later template edits (or answer changes) won't touch the locked document until you unlock it."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={lockActing}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  disabled={lockActing}
                  onClick={(e) => {
                    e.preventDefault()
                    handleLockToggle()
                  }}
                >
                  {lockActing
                    ? "Working…"
                    : lockDialog && locks.has(lockDialog.id)
                      ? "Unlock"
                      : "Lock project"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {groups.map((group) => {
            // A graduated class is the only group on screen, so it stays open.
            const isCollapsed = pastYear == null && collapsedGroups.has(group.label)
            const toggleCollapse = () => {
              setCollapsedGroups((prev) => {
                const next = new Set(prev)
                if (next.has(group.label)) next.delete(group.label)
                else next.add(group.label)
                return next
              })
            }
            return (
            <div key={group.label} className="space-y-2">
              <h2
                className={`text-muted-foreground flex select-none items-center gap-1 text-sm font-semibold uppercase tracking-wide ${
                  pastYear == null ? "cursor-pointer" : ""
                }`}
                onClick={pastYear == null ? toggleCollapse : undefined}
              >
                {pastYear == null && (
                  <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className={`size-4 transition-transform ${isCollapsed ? "" : "rotate-90"}`} />
                )}
                {formatYearGroup(group.label)}
                <span className="text-muted-foreground/60 ml-1 text-xs font-normal normal-case">
                  ({group.students.length} {group.students.length === 1 ? "student" : "students"})
                </span>
              </h2>
              {!isCollapsed && (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[240px]">Student</TableHead>
                      <TableHead className="w-[110px]">Crew</TableHead>
                      <TableHead>Email</TableHead>
                      {pastYear == null && <TableHead className="w-[230px]">Advisor</TableHead>}
                      <TableHead className="w-[160px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(pastYear == null
                      ? rosterItems(group.students, (s) => allComplete.has(s.id) || locks.has(s.id))
                      : // Past classes are here to be reviewed, so locked projects come first.
                        rosterItems(group.students, (s) => !locks.has(s.id), ["Locked", "Not locked"])
                    ).map((item) => {
                      if (item.header) {
                        return (
                          <TableRow key={item.key} className="bg-muted/50 hover:bg-muted/50">
                            <TableCell colSpan={pastYear == null ? 5 : 4} className="py-1.5">
                              <span className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wide">
                                {item.header.label}{" "}
                                <span className="font-normal">({item.header.count})</span>
                              </span>
                            </TableCell>
                          </TableRow>
                        )
                      }
                      const student = item.student!
                      // Past classes don't dim: their locked projects are
                      // what the view is for.
                      const settled = pastYear == null && (allComplete.has(student.id) || locks.has(student.id))
                      return (
                      <TableRow
                        key={student.id}
                        // Settled students read as done: the whole row dims
                        // until hovered so active students stand out.
                        className={`cursor-pointer hover:bg-muted/50 ${
                          settled ? "opacity-50 transition-opacity hover:opacity-100" : ""
                        }`}
                        onClick={() => {
                          // A graduated student's project is reviewed as it was
                          // locked: the public page renders the frozen snapshot.
                          if (pastYear != null && publicBaseUrl) {
                            window.open(`${publicBaseUrl}/${student.id}`, "_blank", "noopener,noreferrer")
                          } else {
                            router.push(`${basePath}/${student.id}`)
                          }
                        }}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <Avatar className="size-8">
                                <AvatarImage src={student.profileImage} />
                                <AvatarFallback className="text-xs">
                                  {getInitials(student.firstName, student.lastName)}
                                </AvatarFallback>
                              </Avatar>
                              {pastYear == null && (reviewCounts.get(student.id) ?? 0) > 0 && (
                                <span className="absolute -right-1.5 -top-1.5 inline-flex size-4 items-center justify-center rounded-full bg-blue-500 text-[9px] font-bold text-white ring-2 ring-white">
                                  {reviewCounts.get(student.id)}
                                </span>
                              )}
                            </div>
                            <span className="font-medium">
                              {student.firstName} {student.lastName}
                            </span>
                            {allComplete.has(student.id) && (
                              <span title="All sections complete" className="inline-flex shrink-0">
                                <HugeiconsIcon
                                  icon={CheckmarkCircle02Icon}
                                  strokeWidth={2.5}
                                  className="size-4 text-green-600"
                                />
                              </span>
                            )}
                            {locks.has(student.id) && (
                              <span
                                title={`Locked by ${locks.get(student.id)!.locked_by || "teacher"} — public page and PDF are frozen`}
                                className="inline-flex shrink-0"
                              >
                                <HugeiconsIcon
                                  icon={SquareLock01Icon}
                                  strokeWidth={2.5}
                                  className="size-4 text-amber-600"
                                />
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {student.crewName ? (
                            <Badge variant="secondary" className="font-normal">
                              {student.crewName}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-0 truncate">
                          {student.studentEmail || "—"}
                        </TableCell>
                        {pastYear == null && (
                        <TableCell>
                          {(() => {
                            const mine = assignmentsFor(assignments, student.id, advisorProduct)
                            const names = mine
                              .map((m) => advisors.find((a) => a.id === m.advisors_id))
                              .filter(Boolean)
                              .map((a) => advisorName(a!))
                            const label = names.join(", ")
                            return (
                              <button
                                type="button"
                                className="hover:text-foreground block w-full min-w-0 text-left text-sm transition-colors"
                                title={names.length ? label : "Assign a thesis advisor"}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setAdvisorDialog(student)
                                }}
                              >
                                {names.length === 0 ? (
                                  <span className="text-muted-foreground/60 underline decoration-dotted underline-offset-4">
                                    Assign
                                  </span>
                                ) : (
                                  // One name reads inline; more collapse to a
                                  // count so the column can't blow out.
                                  <span className="truncate">
                                    {names.length === 1 ? names[0] : `${names[0]} +${names.length - 1}`}
                                  </span>
                                )}
                              </button>
                            )
                          })()}
                        </TableCell>
                        )}
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {locksEndpoint && (
                              <Button
                                variant="outline"
                                size="icon"
                                className={`size-8 ${locks.has(student.id) ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:text-amber-800" : "text-muted-foreground"}`}
                                title={locks.has(student.id) ? "Unlock project" : "Lock project (freeze public page + PDF)"}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setLockDialog(student)
                                }}
                              >
                                <HugeiconsIcon
                                  icon={locks.has(student.id) ? SquareLock01Icon : SquareUnlock01Icon}
                                  strokeWidth={2}
                                  className="size-4"
                                />
                              </Button>
                            )}
                            {publicBaseUrl && (
                              <Button
                                variant="outline"
                                size="icon"
                                className="text-muted-foreground size-8"
                                asChild
                                onClick={(e) => e.stopPropagation()}
                              >
                                <a
                                  href={`${publicBaseUrl}/${student.id}/print`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="Download PDF (print view)"
                                >
                                  <HugeiconsIcon icon={PrinterIcon} strokeWidth={2} className="size-4" />
                                </a>
                              </Button>
                            )}
                            {publicBaseUrl && (
                              <Button
                                variant="outline"
                                size="icon"
                                className="text-muted-foreground size-8"
                                asChild
                                onClick={(e) => e.stopPropagation()}
                              >
                                <a
                                  href={`${publicBaseUrl}/${student.id}/print?booklet=1`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="Booklet PDF (bound-edge margins)"
                                >
                                  <HugeiconsIcon icon={BookOpen02Icon} strokeWidth={2} className="size-4" />
                                </a>
                              </Button>
                            )}
                            {publicBaseUrl && (
                              <Button
                                variant="outline"
                                size="icon"
                                className="text-muted-foreground size-8"
                                asChild
                                onClick={(e) => e.stopPropagation()}
                              >
                                <a
                                  href={`${publicBaseUrl}/${student.id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="Open public page"
                                >
                                  <HugeiconsIcon icon={Link01Icon} strokeWidth={2} className="size-4" />
                                </a>
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
              )}
            </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
