"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { useSession } from "@/components/session-provider"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
  addStaffMember,
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

interface StaffForm {
  firstName: string
  lastName: string
  email: string
  role: StaffRole
}

const EMPTY_FORM: StaffForm = { firstName: "", lastName: "", email: "", role: "teacher" }

/**
 * Staff tiers for the Senior Dashboard. Staff members themselves live in the
 * shared Toddle teachers roster; admins can add someone to it from here
 * (archiving and other edits stay in Toddle). Only admins can add staff or
 * change a tier, and nobody can change their own.
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
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState<StaffForm>(EMPTY_FORM)
  const [adding, setAdding] = useState(false)

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

  const openAdd = () => {
    setForm(EMPTY_FORM)
    setAddOpen(true)
  }

  const add = async () => {
    const email = form.email.trim().toLowerCase()
    if (!form.firstName.trim() || !email) {
      toast.error("First name and email are required.")
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("That email doesn't look right.")
      return
    }
    setAdding(true)
    try {
      const result = await addStaffMember({ ...form, email })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      const { member, reactivated } = result
      cache.staffAdded(member)

      // Toddle only knows Admin/Teacher; a supervisor needs an override row.
      // The person exists either way, so a failure here only downgrades the toast.
      let tierSet = true
      if (effectiveStaffRole(member, overrides) !== form.role) {
        const next = await setStaffRole(member, form.role, overrides)
        if (next) cache.setOverrides(next)
        else tierSet = false
      }

      if (tierSet) {
        toast.success(
          `${staffName(member)} ${reactivated ? "is back on staff" : "added to Toddle"} as ${STAFF_ROLE_LABEL[form.role].toLowerCase()}`,
          { description: "They can sign in with their school Google account." }
        )
      } else {
        toast.warning(`${staffName(member)} added, but their role didn't save — set it in the table.`)
      }
      setAddOpen(false)
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-muted-foreground max-w-2xl text-sm">
          Staff live in Toddle&apos;s teacher roster, and anyone added here is added there
          too. Archiving and other edits still happen in Toddle. Their role here decides
          what they can do on the Senior Dashboard.
          {!editable && " Only admins can add staff or change roles."}
        </p>
        <div className="flex w-full max-w-md items-center gap-2 sm:w-auto">
          <Input
            placeholder="Search staff…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            spellCheck={false}
            className="w-full sm:w-64"
          />
          {editable && <Button onClick={openAdd}>Add staff member</Button>}
        </div>
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

      <Dialog open={addOpen} onOpenChange={(o) => { if (!adding) setAddOpen(o) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add staff member</DialogTitle>
            <DialogDescription>
              Adds them to Toddle&apos;s teacher roster. Use their school Google email —
              it&apos;s what they sign in with.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="staff-first">First name</Label>
                <Input
                  id="staff-first"
                  value={form.firstName}
                  onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                  spellCheck={false}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="staff-last">Last name</Label>
                <Input
                  id="staff-last"
                  value={form.lastName}
                  onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                  spellCheck={false}
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="staff-email">Email</Label>
              <Input
                id="staff-email"
                type="email"
                placeholder="name@sailfuture.org"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="staff-role">Role</Label>
              <Select
                value={form.role}
                onValueChange={(v) => setForm((f) => ({ ...f, role: v as StaffRole }))}
              >
                <SelectTrigger id="staff-role" className="w-full">
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
              <p className="text-muted-foreground text-xs">
                {ROLE_HELP[form.role]}
                {form.role === "supervisor" && " Shows as Teacher in Toddle."}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={adding} onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button disabled={adding} onClick={add}>
              {adding ? "Adding…" : "Add staff member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
