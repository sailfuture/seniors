"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { UserAdd01Icon, PencilEdit02Icon, UserGroupIcon, Delete02Icon } from "@hugeicons/core-free-icons"
import {
  advisorInitials,
  advisorName,
  createAdvisor,
  deleteAdvisor,
  fetchAdvisorAssignments,
  fetchAdvisors,
  updateAdvisor,
  type Advisor,
  type AdvisorAssignment,
} from "@/lib/advisors"
import { fetchActiveStudents, studentName, type RosterStudent } from "@/lib/students"
import { AdvisorStudentsDialog } from "@/components/advisor-students-dialog"

const PRODUCT_LABEL: Record<string, string> = {
  "business-thesis": "Business Thesis",
  "life-map": "Life Map",
}

/**
 * Advisor directory: add outside thesis advisors, edit their details,
 * deactivate them without deleting (so their past feedback keeps its author),
 * or delete them outright — which also removes their Clerk sign-in account.
 * Assigning an advisor to a student happens on each product's roster.
 */
export function AdvisorManager() {
  const [advisors, setAdvisors] = useState<Advisor[]>([])
  const [assignments, setAssignments] = useState<AdvisorAssignment[]>([])
  const [students, setStudents] = useState<RosterStudent[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Advisor | null>(null)
  const [managing, setManaging] = useState<Advisor | null>(null)
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "" })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<Advisor | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)

  const load = useCallback(async () => {
    const [a, asg, s] = await Promise.all([
      fetchAdvisors(),
      fetchAdvisorAssignments(),
      fetchActiveStudents(),
    ])
    setAdvisors(a)
    setAssignments(asg)
    setStudents(s)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Assignments per advisor, so the table can show who they cover.
  const countsByAdvisor = useMemo(() => {
    const m = new Map<number, AdvisorAssignment[]>()
    for (const a of assignments) {
      m.set(a.advisors_id, [...(m.get(a.advisors_id) ?? []), a])
    }
    return m
  }, [assignments])

  const studentsById = useMemo(
    () => new Map(students.map((s) => [String(s.id), s])),
    [students]
  )

  const openAdd = () => {
    setEditing(null)
    setForm({ firstName: "", lastName: "", email: "" })
    setDialogOpen(true)
  }

  const openEdit = (a: Advisor) => {
    setEditing(a)
    setForm({ firstName: a.firstName ?? "", lastName: a.lastName ?? "", email: a.email ?? "" })
    setDialogOpen(true)
  }

  const save = async () => {
    const email = form.email.trim().toLowerCase()
    if (!email || !form.firstName.trim()) {
      toast.error("First name and email are required.")
      return
    }
    // The email is the sign-in identity, so a duplicate would collide.
    const clash = advisors.find(
      (a) => a.email?.toLowerCase() === email && a.id !== editing?.id
    )
    if (clash) {
      toast.error(`${advisorName(clash)} already uses that email.`)
      return
    }
    setSaving(true)
    try {
      if (editing) {
        const ok = await updateAdvisor(editing.id, {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email,
        })
        if (!ok) throw new Error()
        setAdvisors((prev) =>
          prev.map((a) =>
            a.id === editing.id
              ? { ...a, firstName: form.firstName.trim(), lastName: form.lastName.trim(), email }
              : a
          )
        )
        toast.success("Advisor updated")
      } else {
        const created = await createAdvisor({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email,
        })
        if (!created) throw new Error()
        setAdvisors((prev) => [...prev, created])

        // Welcome email goes through our server route (the Resend key can't
        // live in the browser). The advisor exists either way, so a mail
        // failure downgrades the toast instead of rolling anything back.
        try {
          const res = await fetch("/api/advisors/welcome", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: created.email,
              firstName: created.firstName,
            }),
          })
          if (res.ok) {
            toast.success(`${advisorName(created)} added — welcome email sent`)
          } else {
            toast.warning(
              `${advisorName(created)} added, but the welcome email didn't send.`
            )
          }
        } catch {
          toast.warning(
            `${advisorName(created)} added, but the welcome email didn't send.`
          )
        }
      }
      setDialogOpen(false)
    } catch {
      toast.error("Couldn't save the advisor — please try again.")
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (a: Advisor) => {
    const next = !(a.isActive ?? true)
    setAdvisors((prev) => prev.map((x) => (x.id === a.id ? { ...x, isActive: next } : x)))
    const ok = await updateAdvisor(a.id, { isActive: next })
    if (!ok) {
      setAdvisors((prev) => prev.map((x) => (x.id === a.id ? { ...x, isActive: !next } : x)))
      toast.error("Couldn't update — please try again.")
      return
    }
    toast.success(next ? `${advisorName(a)} reactivated` : `${advisorName(a)} deactivated`)
  }

  const confirmDelete = async () => {
    if (!deleting) return
    setDeleteBusy(true)
    const error = await deleteAdvisor(deleting.id)
    setDeleteBusy(false)
    if (error) {
      toast.error(error)
      return
    }
    setAdvisors((prev) => prev.filter((x) => x.id !== deleting.id))
    setAssignments((prev) => prev.filter((x) => x.advisors_id !== deleting.id))
    toast.success(`${advisorName(deleting)} deleted — their sign-in access is revoked.`)
    setDeleting(null)
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Thesis Advisors</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Outside advisors who can view and comment on an assigned student&apos;s work. Assign
            them to students from the Business Thesis or Life Map roster.
          </p>
        </div>
        <Button size="sm" className="shrink-0 gap-2" onClick={openAdd}>
          <HugeiconsIcon icon={UserAdd01Icon} strokeWidth={2} className="size-4" />
          Add advisor
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : advisors.length === 0 ? (
        <div className="rounded-md border py-16 text-center">
          <p className="text-muted-foreground text-sm">No advisors yet.</p>
          <Button variant="outline" size="sm" className="mt-3 gap-2" onClick={openAdd}>
            <HugeiconsIcon icon={UserAdd01Icon} strokeWidth={2} className="size-4" />
            Add your first advisor
          </Button>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {/* Proportional widths: with a fixed pixel width only on the
                    actions, the email column used to absorb every bit of slack
                    on a wide screen and strand the rest at the far right. */}
                <TableHead className="w-[28%]">Advisor</TableHead>
                <TableHead className="w-[30%]">Email</TableHead>
                <TableHead className="w-[27%]">Assigned</TableHead>
                <TableHead className="w-[15%] text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {advisors.map((a) => {
                const active = a.isActive ?? true
                const mine = countsByAdvisor.get(a.id) ?? []
                return (
                  <TableRow key={a.id} className={active ? "" : "opacity-50"}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8">
                          <AvatarFallback className="text-xs">{advisorInitials(a)}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{advisorName(a)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-0 truncate" title={a.email}>
                      {a.email}
                    </TableCell>
                    <TableCell>
                      {mine.length === 0 ? (
                        <span className="text-muted-foreground text-sm">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {mine.map((m) => {
                            const student = studentsById.get(String(m.students_id))
                            return (
                              <Badge
                                key={m.id}
                                variant="secondary"
                                className="max-w-44 font-normal"
                                title={`${PRODUCT_LABEL[m.type] ?? m.type}`}
                              >
                                <span className="truncate">
                                  {student ? studentName(student) : `#${m.students_id}`}
                                </span>
                                <span className="text-muted-foreground ml-1 shrink-0">
                                  · {m.type === "business-thesis" ? "BT" : "LM"}
                                </span>
                              </Badge>
                            )
                          })}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="text-muted-foreground size-8"
                          title="Manage assigned students"
                          onClick={() => setManaging(a)}
                        >
                          <HugeiconsIcon icon={UserGroupIcon} strokeWidth={2} className="size-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="text-muted-foreground size-8"
                          title="Edit advisor"
                          onClick={() => openEdit(a)}
                        >
                          <HugeiconsIcon icon={PencilEdit02Icon} strokeWidth={2} className="size-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="bg-white"
                          onClick={() => toggleActive(a)}
                        >
                          {active ? "Deactivate" : "Activate"}
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="text-destructive hover:text-destructive size-8"
                          title="Delete advisor"
                          onClick={() => setDeleting(a)}
                        >
                          <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {managing && (
        <AdvisorStudentsDialog
          advisor={managing}
          assignments={assignments}
          students={students}
          open
          onOpenChange={(o) => { if (!o) setManaging(null) }}
          onAssigned={(a) => setAssignments((prev) => [...prev, a])}
          onUnassigned={(id) => setAssignments((prev) => prev.filter((x) => x.id !== id))}
        />
      )}

      <AlertDialog
        open={deleting != null}
        onOpenChange={(open) => {
          if (!open && !deleteBusy) setDeleting(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {deleting ? advisorName(deleting) : "this advisor"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the advisor, their student assignments, and their
              sign-in account — they will be signed out and can no longer access the
              dashboard. Their past comments keep their name but lose their author link.
              If they might return, use Deactivate instead. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteBusy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                // Keep the dialog open while the server route runs, so a
                // failure can be retried in place.
                e.preventDefault()
                confirmDelete()
              }}
            >
              {deleteBusy ? "Deleting…" : "Delete advisor"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!saving) setDialogOpen(o) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit advisor" : "Add advisor"}</DialogTitle>
            <DialogDescription>
              The email must match the account they&apos;ll sign in with.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="adv-first">First name</Label>
                <Input
                  id="adv-first"
                  value={form.firstName}
                  onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="adv-last">Last name</Label>
                <Input
                  id="adv-last"
                  value={form.lastName}
                  onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="adv-email">Email</Label>
              <Input
                id="adv-email"
                type="email"
                placeholder="advisor@gmail.com"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={saving} onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button disabled={saving} onClick={save}>
              {saving ? "Saving…" : editing ? "Save changes" : "Add advisor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
