import { useEffect, useState } from "react"
import type { FormApiConfig } from "@/lib/form-api-config"

/**
 * Snapshot-on-lock: a finished project is frozen by capturing the exact four
 * datasets every renderer joins — sections, template questions, custom
 * groups, and the student's responses — as one JSON blob. The public page
 * and print route render from the snapshot when a lock exists, so later
 * template edits can never reach a locked document.
 */
export interface ProjectSnapshot {
  sections: unknown[]
  questions: unknown[]
  groups: unknown[]
  responses: unknown[]
  meta: { product: string; lockedBy: string; lockedAt: number; version: 1 }
}

export interface ProjectLock {
  id: number
  students_id: string
  snapshot: ProjectSnapshot
  locked_by: string
  locked_time?: number | string | null
  created_at?: number | string | null
}

/** A lock row without its snapshot — all a badge or view-only check needs. */
export type ProjectLockStatus = Omit<ProjectLock, "snapshot">

function lockTime(l: ProjectLockStatus): number {
  const t = l.locked_time ?? l.created_at
  if (typeof t === "number") return t
  const p = Date.parse(String(t ?? ""))
  return isNaN(p) ? 0 : p
}

function isValidSnapshot(s: unknown): s is ProjectSnapshot {
  const snap = s as ProjectSnapshot | null
  return !!(
    snap &&
    Array.isArray(snap.sections) &&
    Array.isArray(snap.questions) &&
    Array.isArray(snap.groups) &&
    Array.isArray(snap.responses)
  )
}

/** The student's active lock — the newest row with a usable snapshot. */
export async function fetchProjectLock(
  locksEndpoint: string,
  studentId: string
): Promise<ProjectLock | null> {
  try {
    // Snapshots are large (hundreds of KB each), so only ask for this
    // student's rows; the filter below still guards the result.
    const res = await fetch(`${locksEndpoint}?students_id=${studentId}`)
    if (!res.ok) return null
    const rows = (await res.json()) as ProjectLock[]
    if (!Array.isArray(rows)) return null
    const mine = rows.filter(
      (l) => String(l.students_id ?? "") === String(studentId) && isValidSnapshot(l.snapshot)
    )
    if (mine.length === 0) return null
    return mine.sort((a, b) => lockTime(b) - lockTime(a) || b.id - a.id)[0]
  } catch {
    return null
  }
}

/** All locks, keyed by student — for the roster's badges. Reads the
    snapshot-free status endpoint, which only lists rows that have one. */
export async function fetchAllProjectLocks(
  lockStatusEndpoint: string
): Promise<Map<string, ProjectLockStatus>> {
  const map = new Map<string, ProjectLockStatus>()
  try {
    const res = await fetch(lockStatusEndpoint)
    if (!res.ok) return map
    const rows = (await res.json()) as ProjectLockStatus[]
    if (!Array.isArray(rows)) return map
    for (const l of rows) {
      const sid = String(l.students_id ?? "")
      const prev = map.get(sid)
      if (!prev || lockTime(l) > lockTime(prev) || (lockTime(l) === lockTime(prev) && l.id > prev.id)) {
        map.set(sid, l)
      }
    }
  } catch {
    /* empty map = nothing locked */
  }
  return map
}

/** Capture the live join inputs for one student, exactly as the pages fetch
    them (responses re-filtered client-side — Xano ignores the param). */
export async function captureProjectSnapshot(
  cfg: FormApiConfig,
  studentId: string,
  lockedBy: string,
  product: string
): Promise<ProjectSnapshot> {
  const [sectionsRes, templateRes, groupsRes, responsesRes] = await Promise.all([
    fetch(cfg.sectionsEndpoint),
    fetch(cfg.templateEndpoint),
    fetch(cfg.customGroupEndpoint),
    fetch(`${cfg.responsesEndpoint}?students_id=${studentId}`),
  ])
  if (!sectionsRes.ok || !templateRes.ok || !groupsRes.ok || !responsesRes.ok) {
    throw new Error("capture failed")
  }
  const responses = ((await responsesRes.json()) as { students_id?: unknown; isArchived?: boolean }[]).filter(
    (r) => String(r.students_id ?? "") === String(studentId) && !r.isArchived
  )
  return {
    sections: await sectionsRes.json(),
    questions: await templateRes.json(),
    groups: await groupsRes.json(),
    responses,
    meta: { product, lockedBy, lockedAt: Date.now(), version: 1 },
  }
}

/** Capture + insert the lock row. Returns the created lock. */
export async function lockProject(
  cfg: FormApiConfig,
  locksEndpoint: string,
  studentId: string,
  lockedBy: string,
  product: string
): Promise<ProjectLock> {
  const snapshot = await captureProjectSnapshot(cfg, studentId, lockedBy, product)
  const res = await fetch(locksEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ students_id: studentId, snapshot, locked_by: lockedBy, locked_time: Date.now() }),
  })
  if (!res.ok) throw new Error("lock failed")
  const created = (await res.json()) as ProjectLock
  return { ...created, snapshot }
}

export async function unlockProject(locksEndpoint: string, lockId: number): Promise<boolean> {
  const res = await fetch(`${locksEndpoint}/${lockId}`, { method: "DELETE" })
  return res.ok
}

/** The student's newest lock row, without its snapshot. */
async function fetchProjectLockStatus(
  lockStatusEndpoint: string,
  studentId: string
): Promise<ProjectLockStatus | null> {
  try {
    const res = await fetch(`${lockStatusEndpoint}?students_id=${studentId}`)
    if (!res.ok) return null
    const rows = (await res.json()) as ProjectLockStatus[]
    if (!Array.isArray(rows)) return null
    const mine = rows.filter((l) => String(l.students_id ?? "") === String(studentId))
    if (mine.length === 0) return null
    return mine.sort((a, b) => lockTime(b) - lockTime(a) || b.id - a.id)[0]
  } catch {
    return null
  }
}

/** The student's active lock, for client surfaces that must go view-only
    while the project is frozen. Null while loading or when unlocked. */
export function useProjectLock(
  lockStatusEndpoint: string | undefined,
  studentId: string | null | undefined
): ProjectLockStatus | null {
  const [lock, setLock] = useState<ProjectLockStatus | null>(null)
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      const l =
        lockStatusEndpoint && studentId ? await fetchProjectLockStatus(lockStatusEndpoint, studentId) : null
      if (!cancelled) setLock(l)
    }
    run()
    return () => {
      cancelled = true
    }
  }, [lockStatusEndpoint, studentId])
  return lock
}
