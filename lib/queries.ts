"use client"

import { useMemo } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { fetchActiveStudents, fetchArchivedStudents, type RosterStudent } from "@/lib/students"
import {
  fetchAdvisors,
  fetchAdvisorAssignments,
  type Advisor,
  type AdvisorAssignment,
} from "@/lib/advisors"
import {
  fetchStaff,
  fetchStaffRoleOverrides,
  type StaffMember,
  type StaffRoleOverride,
} from "@/lib/staff"

/**
 * Shared TanStack Query hooks for the roster-ish tables that many surfaces
 * read (sidebar, rosters, advisor directory, assign dialogs). One fetch fills
 * every consumer for staleTime instead of each component pulling the whole
 * table itself.
 *
 * Query keys live here so mutation sites update/invalidate the same cache
 * entries the readers subscribe to.
 */
export const queryKeys = {
  students: ["students"] as const,
  archivedStudents: ["students", "archived"] as const,
  advisors: ["advisors"] as const,
  advisorAssignments: ["advisor-assignments"] as const,
  staff: ["staff"] as const,
  staffRoles: ["staff-roles"] as const,
}

/** Staff members (the shared teachers table) — only read by the Users page. */
export function useStaff({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({ queryKey: queryKeys.staff, queryFn: fetchStaff, enabled })
}

/** This app's staff-tier overrides; the Users page writes them back with
    `setStaffRoleOverrides` after each change. */
export function useStaffRoleOverrides({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({ queryKey: queryKeys.staffRoles, queryFn: fetchStaffRoleOverrides, enabled })
}

export function useStaffRoleCacheActions() {
  const qc = useQueryClient()
  return useMemo(
    () => ({
      setOverrides: (rows: StaffRoleOverride[]) =>
        qc.setQueryData<StaffRoleOverride[]>(queryKeys.staffRoles, rows),
      staffAdded: (member: StaffMember) =>
        qc.setQueryData<StaffMember[]>(queryKeys.staff, (prev) => [
          ...(prev ?? []).filter((t) => t.id !== member.id),
          member,
        ]),
    }),
    [qc]
  )
}

export function useStudents({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({ queryKey: queryKeys.students, queryFn: fetchActiveStudents, enabled })
}

export function useArchivedStudents({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.archivedStudents,
    queryFn: fetchArchivedStudents,
    enabled,
  })
}

/**
 * Active and graduated students together, for surfaces that must resolve any
 * student id — advisor assignments outlive graduation, so an advisor's list
 * can point at an archived student. `data` is undefined until both lists
 * have loaded.
 */
export function useAllStudents({ enabled = true }: { enabled?: boolean } = {}) {
  const active = useStudents({ enabled })
  const archived = useArchivedStudents({ enabled })
  const data = useMemo<RosterStudent[] | undefined>(() => {
    if (!active.data || !archived.data) return undefined
    const seen = new Set(active.data.map((s) => String(s.id)))
    return [...active.data, ...archived.data.filter((s) => !seen.has(String(s.id)))]
  }, [active.data, archived.data])
  return { data, isPending: active.isPending || archived.isPending }
}

export function useAdvisors() {
  return useQuery({ queryKey: queryKeys.advisors, queryFn: fetchAdvisors })
}

export function useAdvisorAssignments() {
  return useQuery({
    queryKey: queryKeys.advisorAssignments,
    queryFn: fetchAdvisorAssignments,
  })
}

/**
 * Cache writers for the advisor tables, shared by every mutation site.
 * Memoized on the query client so the returned object is referentially stable
 * — callers put it in useCallback/useEffect dependency arrays.
 */
export function useAdvisorCacheActions() {
  const qc = useQueryClient()
  return useMemo(
    () => ({
      advisorCreated: (a: Advisor) =>
        qc.setQueryData<Advisor[]>(queryKeys.advisors, (prev) => [...(prev ?? []), a]),
      advisorUpdated: (id: number, patch: Partial<Advisor>) =>
        qc.setQueryData<Advisor[]>(queryKeys.advisors, (prev) =>
          (prev ?? []).map((a) => (a.id === id ? { ...a, ...patch } : a))
        ),
      advisorDeleted: (id: number) => {
        qc.setQueryData<Advisor[]>(queryKeys.advisors, (prev) =>
          (prev ?? []).filter((a) => a.id !== id)
        )
        qc.setQueryData<AdvisorAssignment[]>(queryKeys.advisorAssignments, (prev) =>
          (prev ?? []).filter((x) => x.advisors_id !== id)
        )
      },
      assignmentCreated: (a: AdvisorAssignment) =>
        qc.setQueryData<AdvisorAssignment[]>(queryKeys.advisorAssignments, (prev) => [
          ...(prev ?? []),
          a,
        ]),
      assignmentRemoved: (assignmentId: number) =>
        qc.setQueryData<AdvisorAssignment[]>(queryKeys.advisorAssignments, (prev) =>
          (prev ?? []).filter((x) => x.id !== assignmentId)
        ),
    }),
    [qc]
  )
}

/** Convenience view of the students query as a Map keyed by id. */
export function studentsById(students: RosterStudent[] | undefined): Map<string, RosterStudent> {
  return new Map((students ?? []).map((s) => [String(s.id), s]))
}
