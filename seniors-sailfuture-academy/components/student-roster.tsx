"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
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
}

export function StudentRoster({ title, description, basePath }: StudentRosterProps) {
  const router = useRouter()
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const res = await fetch(STUDENTS_ENDPOINT)
        if (res.ok) {
          const data = await res.json()
          setStudents(Array.isArray(data) ? data : [])
        }
      } catch {
        // Silently fail
      } finally {
        setLoading(false)
      }
    }

    fetchStudents()
  }, [])

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
          <Input
            placeholder="Search by name, email, or crew..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />

          {groups.length === 0 && (
            <p className="text-muted-foreground py-8 text-center">No students found.</p>
          )}

          {groups.map((group) => (
            <div key={group.label} className="space-y-2">
              <h2 className="text-muted-foreground text-sm font-semibold uppercase tracking-wide">
                {group.label}
                <span className="text-muted-foreground/60 ml-2 text-xs font-normal normal-case">
                  ({group.students.length} {group.students.length === 1 ? "student" : "students"})
                </span>
              </h2>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[280px]">Student</TableHead>
                      <TableHead>Crew</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead className="w-[100px] text-right">Action</TableHead>
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
                            <Avatar className="size-8">
                              <AvatarImage src={student.profileImage} />
                              <AvatarFallback className="text-xs">
                                {getInitials(student.firstName, student.lastName)}
                              </AvatarFallback>
                            </Avatar>
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
                          <Link
                            href={`${basePath}/${student.id}`}
                            className="text-primary text-sm font-medium hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            View
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
