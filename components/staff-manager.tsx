"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { useSession } from "@/components/session-provider"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { canManageStaff, STAFF_ROLE_LABEL, type StaffRole } from "@/lib/roles"
import {
  effectiveStaffRole,
  setStaffRole,
  staffInitials,
  staffName,
  staffPhoto,
  staffRoleFromToddle,
  type StaffMember,
} from "@/lib/staff"
import { useStaff, useStaffRoleCacheActions, useStaffRoleOverrides } from "@/lib/queries"

const STAFF_ROLES: StaffRole[] = ["admin", "teacher", "supervisor"]

const ROLE_HELP: Record<StaffRole, string> = {
  admin: "Everything, including this page.",
  teacher: "Student rosters, reviews, and the two templates.",
  supervisor: "Student rosters, reviews, and the thesis advisors — no template editing.",
}

/**
 * Staff tiers for the Senior Dashboard. Staff members themselves come from
 * the shared teachers roster (added and archived in Toddle); this page only
 * decides what each of them can do here. Only admins can change a tier, and
 * nobody can change their own.
 */
export function StaffManager() {
  const { data: session } = useSession()
  const myRole = (session?.user as Record<string, unknown> | undefined)?.role
  const myEmail = ((session?.user as Record<string, unknown> | undefined)?.email as string | undefined)
    ?.toLowerCase()
  const editable = canManageStaff(myRole)

  const staffQuery = useStaff()
  const overridesQuery = useStaffRoleOverrides()
  const cache = useStaffRoleCacheActions()
  const staff = staffQuery.data
  const overrides = overridesQuery.data ?? []
  const loading = staffQuery.isPending || overridesQuery.isPending

  const [search, setSearch] = useState("")
  const [busyId, setBusyId] = useState<string | null>(null)

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return [...(staff ?? [])]
      .filter(
        (t) =>
          !q ||
          staffName(t).toLowerCase().includes(q) ||
          t.email.toLowerCase().includes(q)
      )
      .sort((a, b) => staffName(a).localeCompare(staffName(b)))
  }, [staff, search])

  const change = async (member: StaffMember, role: StaffRole) => {
    setBusyId(member.id)
    const next = await setStaffRole(member, role, overrides)
    setBusyId(null)
    if (!next) {
      toast.error("Couldn't change the role — please try again.")
      return
    }
    cache.setOverrides(next)
    toast.success(`${staffName(member)} is now ${STAFF_ROLE_LABEL[role].toLowerCase()}`, {
      description: "Takes effect the next time they sign in.",
    })
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-muted-foreground max-w-2xl text-sm">
          Staff are added and archived in Toddle. Their role here decides what they can
          do on the Senior Dashboard.
          {!editable && " Only admins can change roles."}
        </p>
        <Input
          placeholder="Search staff…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          spellCheck={false}
          className="w-full max-w-xs"
        />
      </div>

      <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
        {STAFF_ROLES.map((r) => (
          <div key={r} className="rounded-lg border px-3 py-2">
            <dt className="font-medium">{STAFF_ROLE_LABEL[r]}</dt>
            <dd className="text-muted-foreground text-xs">{ROLE_HELP[r]}</dd>
          </div>
        ))}
      </dl>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[55%]">Staff member</TableHead>
                <TableHead className="w-[25%]">Role</TableHead>
                <TableHead className="w-[20%]">Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-muted-foreground py-8 text-center">
                    No staff found.
                  </TableCell>
                </TableRow>
              )}
              {rows.map((t) => {
                const role = effectiveStaffRole(t, overrides)
                const fallback = staffRoleFromToddle(t.role)
                const isMe = !!myEmail && t.email.toLowerCase() === myEmail
                const busy = busyId === t.id
                return (
                  <TableRow key={t.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-9">
                          <AvatarImage src={staffPhoto(t)} />
                          <AvatarFallback className="text-xs">{staffInitials(t)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 leading-tight">
                          <p className="truncate font-medium">
                            {staffName(t)}
                            {isMe && <span className="text-muted-foreground font-normal"> (you)</span>}
                          </p>
                          <p className="text-muted-foreground truncate text-xs">{t.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={role}
                        onValueChange={(v) => change(t, v as StaffRole)}
                        disabled={!editable || isMe || busy}
                      >
                        <SelectTrigger
                          className="w-[190px]"
                          aria-label={`Role for ${staffName(t)}`}
                          title={isMe ? "You can't change your own role." : undefined}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STAFF_ROLES.map((r) => (
                            <SelectItem key={r} value={r}>
                              {STAFF_ROLE_LABEL[r]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {role === fallback ? (
                        <span className="text-muted-foreground text-xs">
                          From Toddle{t.role ? ` (${t.role})` : ""}
                        </span>
                      ) : (
                        <Badge variant="outline" className="font-normal">
                          Set here
                        </Badge>
                      )}
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
}
