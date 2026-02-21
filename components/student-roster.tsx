"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
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
import { HugeiconsIcon } from "@hugeicons/react"
import { Link01Icon, RefreshIcon, ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { toast } from "sonner"

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

const ALL_REVIEWS_ENDPOINT =
  "https://xsc3-mvx7-r86m.n7e.xano.io/api:o2_UyOKn/all_reviews"

const REVIEW_SYNC_ENDPOINT =
  "https://xsc3-mvx7-r86m.n7e.xano.io/api:o2_UyOKn/lifemap_review_add_all"

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
      students: list.sort((a, b) => a.lastName.localeCompare(b.lastName)),
    }))
    .sort((a, b) => a.sortKey - b.sortKey)
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
  publicIdParam?: string
}

export function StudentRoster({ title, description, basePath, publicBaseUrl, publicIdParam = "id" }: StudentRosterProps) {
  const router = useRouter()
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [syncing, setSyncing] = useState(false)
  const [reviewCounts, setReviewCounts] = useState<Map<string, number>>(new Map())
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [studentsRes, reviewsRes] = await Promise.all([
          fetch(STUDENTS_ENDPOINT),
          fetch(ALL_REVIEWS_ENDPOINT),
        ])

        if (studentsRes.ok) {
          const data = await studentsRes.json()
          const studentList: Student[] = Array.isArray(data) ? data : []
          setStudents(studentList)

          const yearGroups = new Set(studentList.map((s) => s.yearGroup || "Other"))
          const nonBatch2026 = [...yearGroups].filter((g) => !g.includes("2026"))
          setCollapsedGroups(new Set(nonBatch2026))
        }

        if (reviewsRes.ok) {
          const reviews = await reviewsRes.json()
          if (Array.isArray(reviews)) {
            const counts = new Map<string, number>()
            for (const r of reviews) {
              const sid = String(r.students_id)
              counts.set(sid, (counts.get(sid) ?? 0) + 1)
            }
            setReviewCounts(counts)
          }
        }
      } catch {
        // Silently fail
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const handleSync = async () => {
    setSyncing(true)
    try {
      const res = await fetch(REVIEW_SYNC_ENDPOINT)
      if (!res.ok) throw new Error()
      toast.success("Review records synced")
    } catch {
      toast.error("Failed to sync review records")
    } finally {
      setSyncing(false)
    }
  }

  const filtered = students.filter((s) => {
    const q = search.toLowerCase()
    return (
      s.firstName.toLowerCase().includes(q) ||
      s.lastName.toLowerCase().includes(q) ||
      s.studentEmail.toLowerCase().includes(q) ||
      (s.crewName?.toLowerCase().includes(q) ?? false)
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
          <div className="flex items-center gap-2">
            <Input
              placeholder="Search by name, email, or crew..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
            <Button
              variant="outline"
              onClick={handleSync}
              disabled={syncing}
              className="gap-2"
            >
              <HugeiconsIcon icon={RefreshIcon} strokeWidth={2} className={`size-4 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing..." : "Sync Reviews"}
            </Button>
          </div>

          {groups.length === 0 && (
            <p className="text-muted-foreground py-8 text-center">No students found.</p>
          )}

          {groups.map((group) => {
            const isCollapsed = collapsedGroups.has(group.label)
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
                className="text-muted-foreground flex cursor-pointer select-none items-center gap-1 text-sm font-semibold uppercase tracking-wide"
                onClick={toggleCollapse}
              >
                <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className={`size-4 transition-transform ${isCollapsed ? "" : "rotate-90"}`} />
                {group.label}
                <span className="text-muted-foreground/60 ml-1 text-xs font-normal normal-case">
                  ({group.students.length} {group.students.length === 1 ? "student" : "students"})
                </span>
              </h2>
              {!isCollapsed && (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[280px]">Student</TableHead>
                      <TableHead>Crew</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead className="w-[60px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.students.map((student) => (
                      <TableRow
                        key={student.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => router.push(`${basePath}/${student.id}`)}
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
                              {(reviewCounts.get(student.id) ?? 0) > 0 && (
                                <span className="absolute -right-1.5 -top-1.5 inline-flex size-4 items-center justify-center rounded-full bg-blue-500 text-[9px] font-bold text-white ring-2 ring-white">
                                  {reviewCounts.get(student.id)}
                                </span>
                              )}
                            </div>
                            <span className="font-medium">
                              {student.firstName} {student.lastName}
                            </span>
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
                        <TableCell className="text-muted-foreground">
                          {student.studentEmail}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {publicBaseUrl && (
                              <Button
                                variant="outline"
                                size="icon"
                                className="text-muted-foreground size-8"
                                asChild
                                onClick={(e) => e.stopPropagation()}
                              >
                                <a
                                  href={`${publicBaseUrl}?${publicIdParam}=${student.id}`}
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
                    ))}
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
