import type { StaffRole } from "@/lib/roles"

/**
 * Staff members come from the shared Toddle `teachers` table; this app only
 * reads it. The Senior Dashboard tier (admin / teacher / supervisor) is
 * stored in this app's own `senior_staff_roles` table so changing it here
 * never touches what Toddle means by "Admin".
 */
const TEACHERS_ENDPOINT = "https://xsc3-mvx7-r86m.n7e.xano.io/api:fJsHVIeC/teachers"

const STAFF_ROLES_ENDPOINT = "https://xsc3-mvx7-r86m.n7e.xano.io/api:psozOWLd/senior_staff_roles"

export interface StaffMember {
  id: string
  email: string
  firstName: string
  lastName: string
  /** Toddle's role column: "Admin" / "Teacher" / blank. */
  role?: string | null
  isArchived?: boolean
  picture?: { url?: string } | null
  headshot?: { url?: string } | null
}

export interface StaffRoleOverride {
  id: number
  teachers_id: string
  role: StaffRole
  created_at?: number
}

export function staffName(t: Pick<StaffMember, "firstName" | "lastName" | "email">): string {
  return `${t.firstName ?? ""} ${t.lastName ?? ""}`.trim() || t.email
}

export function staffInitials(t: Pick<StaffMember, "firstName" | "lastName" | "email">): string {
  const f = (t.firstName ?? "").charAt(0)
  const l = (t.lastName ?? "").charAt(0)
  return (f + l).toUpperCase() || (t.email ?? "").charAt(0).toUpperCase() || "?"
}

export function staffPhoto(t: StaffMember): string | undefined {
  return t.headshot?.url || t.picture?.url || undefined
}

/** Toddle's role column decides the default tier: "Admin" → admin, else teacher. */
export function staffRoleFromToddle(role: unknown): StaffRole {
  return String(role ?? "").trim().toLowerCase() === "admin" ? "admin" : "teacher"
}

function isStaffRoleValue(v: unknown): v is StaffRole {
  return v === "admin" || v === "teacher" || v === "supervisor"
}

/** Active (non-archived) staff, with only the fields the Users page shows. */
export async function fetchStaff(): Promise<StaffMember[]> {
  try {
    const res = await fetch(TEACHERS_ENDPOINT)
    if (!res.ok) return []
    const rows = await res.json()
    if (!Array.isArray(rows)) return []
    return (rows as StaffMember[])
      .filter((t) => t.isArchived !== true && t.email)
      .map((t) => ({
        id: String(t.id),
        email: t.email,
        firstName: t.firstName ?? "",
        lastName: t.lastName ?? "",
        role: t.role ?? null,
        isArchived: t.isArchived,
        picture: t.picture ?? null,
        headshot: t.headshot ?? null,
      }))
  } catch {
    return []
  }
}

export async function fetchStaffRoleOverrides(): Promise<StaffRoleOverride[]> {
  try {
    const res = await fetch(STAFF_ROLES_ENDPOINT)
    if (!res.ok) return []
    const rows = await res.json()
    if (!Array.isArray(rows)) return []
    return (rows as StaffRoleOverride[]).filter((r) => isStaffRoleValue(r.role))
  } catch {
    return []
  }
}

/** The tier a staff member resolves to: their override, else Toddle's column. */
export function effectiveStaffRole(
  member: Pick<StaffMember, "id" | "role">,
  overrides: StaffRoleOverride[]
): StaffRole {
  const o = overrides.find((x) => String(x.teachers_id) === String(member.id))
  return o?.role ?? staffRoleFromToddle(member.role)
}

/**
 * Sets a staff member's tier. Creates or updates their override row, or
 * removes it when the requested tier is what Toddle's column already implies
 * (so the table only holds real exceptions). Returns the new override list.
 */
export async function setStaffRole(
  member: Pick<StaffMember, "id" | "role">,
  role: StaffRole,
  overrides: StaffRoleOverride[]
): Promise<StaffRoleOverride[] | null> {
  const existing = overrides.find((x) => String(x.teachers_id) === String(member.id))
  const others = overrides.filter((x) => x !== existing)
  const isDefault = role === staffRoleFromToddle(member.role)

  try {
    if (isDefault) {
      if (!existing) return overrides
      const res = await fetch(`${STAFF_ROLES_ENDPOINT}/${existing.id}`, { method: "DELETE" })
      return res.ok ? others : null
    }
    if (existing) {
      const res = await fetch(`${STAFF_ROLES_ENDPOINT}/${existing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      })
      if (!res.ok) return null
      return [...others, { ...existing, role }]
    }
    const res = await fetch(STAFF_ROLES_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teachers_id: member.id, role }),
    })
    if (!res.ok) return null
    const created = (await res.json()) as StaffRoleOverride
    return [...others, created]
  } catch {
    return null
  }
}
