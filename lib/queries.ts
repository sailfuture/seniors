"use client"

import { useMemo } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { fetchActiveStudents, type RosterStudent } from "@/lib/students"
import {
  fetchAdvisors,
  fetchAdvisorAssignments,
  type Advisor,
  type AdvisorAssignment,
} from "@/lib/advisors"

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
  advisors: ["advisors"] as const,
  advisorAssignments: ["advisor-assignments"] as const,
}

export function useStudents() {
  return useQuery({ queryKey: queryKeys.students, queryFn: fetchActiveStudents })
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
