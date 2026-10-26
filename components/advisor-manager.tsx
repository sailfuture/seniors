"use client"

import { useMemo, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { useSession } from "@/components/session-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  UserAdd01Icon,
  PencilEdit02Icon,
  UserGroupIcon,
  Delete02Icon,
  MoreHorizontalIcon,
  MailSend01Icon,
  MailRemove01Icon,
} from "@hugeicons/core-free-icons"
import {
  ADVISOR_PRODUCTS,
  PRODUCT_LABEL,
  PRODUCT_SHORT,
  advisorAllowsProduct,
  advisorInitials,
  advisorName,
  advisorProduct,
  createAdvisor,
  deleteAdvisor,
  isAdvisorProduct,
  updateAdvisor,
  type Advisor,
  type AdvisorAssignment,
  type AdvisorProduct,
} from "@/lib/advisors"
import {
  accessByEmail,
  cancelAdvisorInvitation,
  sendAdvisorInvitation,
  type AdvisorAccess,
  type AdvisorAccessResponse,
} from "@/lib/advisor-invitations"
import { canAccessLifeMap, canManageStaff } from "@/lib/roles"
import { studentName, type RosterStudent } from "@/lib/students"
import {
  queryKeys,
  useAdvisorAccess,
  useAdvisorCacheActions,
  useAdvisorAssignments,
  useAdvisors,
  useAllStudents,
} from "@/lib/queries"
import { AdvisorStudentsDialog } from "@/components/advisor-students-dialog"
import { cn } from "@/lib/utils"

const PRODUCT_BADGE: Record<AdvisorProduct, string> = {
  "business-thesis": "border-sky-200 bg-sky-50 text-sky-900",
  "life-map": "border-emerald-200 bg-emerald-50 text-emerald-900",
}

/** The advisor's type as a chip; legacy rows without one get a nudge. */
function ProductBadge({ advisor }: { advisor: Advisor }) {
  const product = advisorProduct(advisor)
  if (!product) {
    return (
      <Badge
        variant="outline"
        className="border-amber-200 bg-amber-50 font-normal text-amber-800"
        title="Added before advisor types existed — edit the advisor to set one."
      >
        Type not set
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className={cn("font-normal", PRODUCT_BADGE[product])}>
      {PRODUCT_LABEL[product]}
    </Badge>
  )
}

const STACK_LIMIT = 5

/**
 * The advisor's students as an overlapping avatar row with a count, and the
 * full list (with product when it isn't implied by the advisor's type) on
 * hover. Clicking opens the manage dialog.
 */
function StudentStack({
  advisor,
  assignments,
  studentsById,
  onClick,
}: {
  advisor: Advisor
  assignments: AdvisorAssignment[]
  studentsById: Map<string, RosterStudent>
  onClick: () => void
}) {
  const product = advisorProduct(advisor)
  const rows = useMemo(
    () =>
      [...assignments]
        .map((m) => ({ m, student: studentsById.get(String(m.students_id)) }))
        .sort((a, b) =>
          (a.student ? studentName(a.student) : "").localeCompare(
            b.student ? studentName(b.student) : ""
          )
        ),
    [assignments, studentsById]
  )

  if (rows.length === 0) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="text-muted-foreground hover:text-foreground -mx-2 rounded-md px-2 py-1 text-sm underline-offset-4 hover:underline"
      >
        No students yet
      </button>
    )
  }

  const shown = rows.slice(0, STACK_LIMIT)
  const extra = rows.length - shown.length

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          aria-label={`Manage ${advisorName(advisor)}'s students`}
          className="hover:bg-muted/60 -mx-2 flex items-center gap-2.5 rounded-md px-2 py-1 text-left"
        >
          <span className="flex -space-x-2">
            {shown.map(({ m, student }) => (
              <Avatar key={m.id} className="ring-background size-7 ring-2">
                <AvatarImage src={student?.profileImage || undefined} />
                <AvatarFallback className="text-[10px]">
                  {student
                    ? `${student.firstName.charAt(0)}${student.lastName.charAt(0)}`.toUpperCase()
                    : "?"}
                </AvatarFallback>
              </Avatar>
            ))}
            {extra > 0 && (
              <span className="bg-muted text-muted-foreground ring-background flex size-7 items-center justify-center rounded-full text-[10px] font-medium ring-2">
                +{extra}
              </span>
            )}
          </span>
          <span className="text-sm tabular-nums">
            {rows.length} {rows.length === 1 ? "student" : "students"}
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="start" className="max-w-xs">
        <ul className="grid gap-0.5">
          {rows.map(({ m, student }) => (
            <li key={m.id} className="flex items-baseline gap-2">
              <span>{student ? studentName(student) : `Student #${m.students_id}`}</span>
              {(product === null || m.type !== product) && isAdvisorProduct(m.type) && (
                <span className="opacity-70">{PRODUCT_SHORT[m.type]}</span>
              )}
            </li>
          ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  )
}

/** "Oct 23" this year, "Oct 23, 2025" otherwise. */
function shortDate(ms: number): string {
  const d = new Date(ms)
  const thisYear = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(thisYear ? {} : { year: "numeric" }),
  })
}

/**
 * Where the advisor's sign-in stands, from Clerk: they have an account, an
 * invitation is out (and when it expires), it expired, or nothing was ever
 * sent. Expired and never-invited rows get a one-click send right here; the
 * row menu has the same actions plus cancel.
 */
function AccessCell({
  access,
  busy,
  canSend,
  onSend,
}: {
  access: AdvisorAccess | undefined
  busy: boolean
  /** False for deactivated advisors: reactivate first, then invite. */
  canSend: boolean
  onSend: () => void
}) {
  if (!access) {
    return <span className="text-muted-foreground text-sm">&mdash;</span>
  }
  switch (access.state) {
    case "accepted":
      return (
        <div className="leading-tight">
          <span className="inline-flex items-center gap-1.5 text-sm">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            Has account
          </span>
          <p className="text-muted-foreground text-xs">
            {access.lastSignInAt
              ? `Last signed in ${shortDate(access.lastSignInAt)}`
              : "Hasn’t signed in yet"}
          </p>
        </div>
      )
    case "pending":
      return (
        <div className="leading-tight">
          <span className="inline-flex items-center gap-1.5 text-sm">
            <span className="size-1.5 rounded-full bg-amber-500" />
            Invited{access.invitedAt ? ` ${shortDate(access.invitedAt)}` : ""}
          </span>
          {access.expiresAt && (
            <p className="text-muted-foreground text-xs">
              Link expires {shortDate(access.expiresAt)}
            </p>
          )}
        </div>
      )
    case "expired":
      return (
        <div className="leading-tight">
          <span className="inline-flex items-center gap-1.5 text-sm">
            <span className="size-1.5 rounded-full bg-red-500" />
            Invitation expired
          </span>
          {canSend && (
            <button
              type="button"
              disabled={busy}
              onClick={onSend}
              className="text-muted-foreground hover:text-foreground block text-xs underline underline-offset-4 disabled:opacity-50"
            >
              {busy ? "Sending…" : "Resend invitation"}
            </button>
          )}
        </div>
      )
    default:
      return (
        <div className="leading-tight">
          <span className="inline-flex items-center gap-1.5 text-sm">
            <span className="bg-muted-foreground/40 size-1.5 rounded-full" />
            Not invited
          </span>
          {canSend && (
            <button
              type="button"
              disabled={busy}
              onClick={onSend}
              className="text-muted-foreground hover:text-foreground block text-xs underline underline-offset-4 disabled:opacity-50"
            >
              {busy ? "Sending…" : "Send invitation"}
            </button>
          )}
        </div>
      )
  }
}

interface AdvisorForm {
  firstName: string
  lastName: string
  email: string
  product: AdvisorProduct | ""
}

const EMPTY_FORM: AdvisorForm = { firstName: "", lastName: "", email: "", product: "" }

/**
 * Advisor directory: add outside thesis advisors (each a business thesis or a
 * life map advisor), edit their details, deactivate them without deleting (so
 * their past feedback keeps its author), or delete them outright — which also
 * removes their Clerk sign-in account. Students are assigned from here or
 * from each product's roster.
 */
export function AdvisorManager() {
  const { data: session } = useSession()
  const myRole = (session?.user as Record<string, unknown> | undefined)?.role
  // Deleting also removes a sign-in account; supervisors can do everything else.
  const canDelete = canManageStaff(myRole)
  // Thesis supervisors only work with business thesis advisors: Life Map
  // advisors and Life Map assignments stay out of their directory.
  const lifeMapOk = canAccessLifeMap(myRole)
  const products = useMemo<AdvisorProduct[]>(
    () => (lifeMapOk ? ADVISOR_PRODUCTS : ["business-thesis"]),
    [lifeMapOk]
  )
  const emptyForm: AdvisorForm = lifeMapOk ? EMPTY_FORM : { ...EMPTY_FORM, product: "business-thesis" }

  // Shared caches: the same three tables the rosters and dialogs read, fetched
  // once app-wide instead of once per surface.
  const advisorsQuery = useAdvisors()
  const assignmentsQuery = useAdvisorAssignments()
  // Active and graduated: assignments can outlive a student's graduation.
  const studentsQuery = useAllStudents()
  const advisors = useMemo(
    () =>
      (advisorsQuery.data ?? []).filter((a) =>
        products.some((p) => advisorAllowsProduct(a, p))
      ),
    [advisorsQuery.data, products]
  )
  const assignments = useMemo(
    () =>
      (assignmentsQuery.data ?? []).filter((a) =>
        products.includes(a.type as AdvisorProduct)
      ),
    [assignmentsQuery.data, products]
  )
  const students = studentsQuery.data ?? []
  const loading =
    advisorsQuery.isPending || assignmentsQuery.isPending || studentsQuery.isPending
  const cache = useAdvisorCacheActions()
  const qc = useQueryClient()

  // Clerk's view of each advisor's sign-in: account, invited, expired, none.
  // The column disappears when Clerk can't be reached rather than lying.
  const accessQuery = useAdvisorAccess(true)
  const accessOk = accessQuery.data?.ok !== false
  const access = useMemo(
    () => accessByEmail(accessQuery.data?.access ?? []),
    [accessQuery.data]
  )
  const setAccess = (next: AdvisorAccess) =>
    qc.setQueryData<AdvisorAccessResponse>(queryKeys.advisorAccess, (prev) => ({
      ok: true,
      access: [...(prev?.access ?? []).filter((a) => a.email !== next.email), next],
    }))
  const [inviteBusy, setInviteBusy] = useState<number | null>(null)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Advisor | null>(null)
  const [managing, setManaging] = useState<Advisor | null>(null)
  const [form, setForm] = useState<AdvisorForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<Advisor | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)

  // Assignments per advisor, so the table can show who they cover.
  const byAdvisor = useMemo(() => {
    const m = new Map<number, AdvisorAssignment[]>()
    for (const a of assignments) {
      m.set(a.advisors_id, [...(m.get(a.advisors_id) ?? []), a])
    }
    return m
  }, [assignments])

  const studentsById = useMemo(
    () => new Map((studentsQuery.data ?? []).map((s) => [String(s.id), s])),
    [studentsQuery.data]
  )

  const sorted = useMemo(
    () =>
      [...advisors].sort((a, b) => {
        // Active first, then by name.
        const aa = a.isActive ?? true
        const ba = b.isActive ?? true
        if (aa !== ba) return aa ? -1 : 1
        return advisorName(a).localeCompare(advisorName(b))
      }),
    [advisors]
  )

  const openAdd = () => {
    setEditing(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  const openEdit = (a: Advisor) => {
    setEditing(a)
    setForm({
      firstName: a.firstName ?? "",
      lastName: a.lastName ?? "",
      email: a.email ?? "",
      product: advisorProduct(a) ?? (products.length === 1 ? products[0] : ""),
    })
    setDialogOpen(true)
  }

  const save = async () => {
    const email = form.email.trim().toLowerCase()
    if (!email || !form.firstName.trim()) {
      toast.error("First name and email are required.")
      return
    }
    if (!form.product) {
      toast.error("Choose whether this is a business thesis or a life map advisor.")
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
    const patch = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email,
      role: form.product,
    }
    setSaving(true)
    try {
      if (editing) {
        const ok = await updateAdvisor(editing.id, patch)
        if (!ok) throw new Error()
        cache.advisorUpdated(editing.id, patch)
        toast.success("Advisor updated")
      } else {
        const created = await createAdvisor({ ...patch, product: form.product })
        if (!created) throw new Error()
        cache.advisorCreated(created)

        // The invitation (Clerk link + branded email) goes through our server
        // route. The advisor exists either way, so a failure downgrades the
        // toast, and the Access column offers a resend.
        const result = await sendAdvisorInvitation(created.id)
        if (result.access) setAccess(result.access)
        if (result.error) {
          toast.warning(
            `${advisorName(created)} added, but the invitation didn't send: ${result.error}`
          )
        } else if (result.emailError) {
          toast.warning(
            `${advisorName(created)} added, but the invitation email didn't send: ${result.emailError}`
          )
        } else {
          toast.success(`${advisorName(created)} added — invitation sent to ${created.email}`)
        }
      }
      setDialogOpen(false)
    } catch {
      toast.error("Couldn't save the advisor — please try again.")
    } finally {
      setSaving(false)
    }
  }

  const sendInvite = async (a: Advisor) => {
    setInviteBusy(a.id)
    const result = await sendAdvisorInvitation(a.id)
    setInviteBusy(null)
    if (result.access) setAccess(result.access)
    if (result.error) {
      toast.error(result.error)
    } else if (result.emailError) {
      toast.warning(`Invitation created, but the email didn't send: ${result.emailError}`)
    } else {
      toast.success(`Invitation sent to ${a.email}`)
    }
  }

  const cancelInvite = async (a: Advisor) => {
    setInviteBusy(a.id)
    const error = await cancelAdvisorInvitation(a.id)
    setInviteBusy(null)
    if (error) {
      toast.error(error)
      return
    }
    setAccess({ email: a.email.trim().toLowerCase(), state: "none" })
    toast.success(`Invitation for ${advisorName(a)} canceled`)
  }

  // Optimistic toggle: the row flips instantly, and onError puts it back if
  // Xano rejects the PATCH.
  const toggleMutation = useMutation({
    mutationFn: async (a: Advisor) => {
      const next = !(a.isActive ?? true)
      const ok = await updateAdvisor(a.id, { isActive: next })
      if (!ok) throw new Error("update failed")
      return { a, next }
    },
    onMutate: (a) => {
      const previous = a.isActive ?? true
      cache.advisorUpdated(a.id, { isActive: !previous })
      return { previous }
    },
    onError: (_err, a, ctx) => {
      cache.advisorUpdated(a.id, { isActive: ctx?.previous ?? true })
      toast.error("Couldn't update — please try again.")
    },
    onSuccess: ({ a, next }) => {
      toast.success(next ? `${advisorName(a)} reactivated` : `${advisorName(a)} deactivated`)
    },
  })
  const toggleActive = (a: Advisor) => toggleMutation.mutate(a)

  const confirmDelete = async () => {
    if (!deleting) return
    setDeleteBusy(true)
    const error = await deleteAdvisor(deleting.id)
    setDeleteBusy(false)
    if (error) {
      toast.error(error)
      return
    }
    cache.advisorDeleted(deleting.id)
    toast.success(`${advisorName(deleting)} deleted — their sign-in access is revoked.`)
    setDeleting(null)
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-muted-foreground max-w-2xl text-sm">
          Outside advisors who can view and comment on their assigned students&apos; work.
          {lifeMapOk
            ? " A business thesis advisor only ever sees business theses; a life map advisor only life maps."
            : " Each one sees only the business theses of the students assigned to them."}{" "}
          New advisors are emailed an invitation link to create their account; Access shows
          whether they&apos;ve accepted it.
        </p>
        <Button size="sm" className="shrink-0 gap-2" onClick={openAdd}>
          <HugeiconsIcon icon={UserAdd01Icon} strokeWidth={2} className="size-4" />
          Add advisor
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
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
                <TableHead className="w-[28%]">Advisor</TableHead>
                <TableHead className="w-[14%]">Type</TableHead>
                <TableHead className="w-[22%]">Students</TableHead>
                {accessOk && <TableHead className="w-[18%]">Access</TableHead>}
                <TableHead className="w-[10%]">Status</TableHead>
                <TableHead className="w-[8%]">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((a) => {
                const active = a.isActive ?? true
                const mine = byAdvisor.get(a.id) ?? []
                const acc = access.get(a.email?.trim().toLowerCase() ?? "")
                const busy = inviteBusy === a.id
                return (
                  <TableRow key={a.id} className={active ? "" : "text-muted-foreground"}>
                    <TableCell>
                      <div className={cn("flex items-center gap-3", !active && "opacity-60")}>
                        <Avatar className="size-9">
                          <AvatarImage src={a.profileImage || undefined} />
                          <AvatarFallback className="text-xs">{advisorInitials(a)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 leading-tight">
                          <p className="text-foreground truncate font-medium">{advisorName(a)}</p>
                          <p className="text-muted-foreground truncate text-xs" title={a.email}>
                            {a.email}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className={cn(!active && "opacity-60")}>
                      <ProductBadge advisor={a} />
                    </TableCell>
                    <TableCell className={cn(!active && "opacity-60")}>
                      <StudentStack
                        advisor={a}
                        assignments={mine}
                        studentsById={studentsById}
                        onClick={() => setManaging(a)}
                      />
                    </TableCell>
                    {accessOk && (
                      <TableCell className={cn(!active && "opacity-60")}>
                        {accessQuery.isPending ? (
                          <Skeleton className="h-4 w-24" />
                        ) : (
                          <AccessCell
                            access={acc}
                            busy={busy}
                            canSend={active}
                            onSend={() => sendInvite(a)}
                          />
                        )}
                      </TableCell>
                    )}
                    <TableCell>
                      {active ? (
                        <span className="inline-flex items-center gap-1.5 text-sm">
                          <span className="size-1.5 rounded-full bg-emerald-500" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-sm">
                          <span className="bg-muted-foreground/40 size-1.5 rounded-full" />
                          Inactive
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="text-muted-foreground size-8"
                          title="Manage students"
                          onClick={() => setManaging(a)}
                        >
                          <HugeiconsIcon icon={UserGroupIcon} strokeWidth={2} className="size-4" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              size="icon"
                              className="text-muted-foreground size-8"
                              title="More"
                            >
                              <HugeiconsIcon icon={MoreHorizontalIcon} strokeWidth={2} className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="min-w-44">
                            <DropdownMenuItem onClick={() => openEdit(a)}>
                              <HugeiconsIcon icon={PencilEdit02Icon} strokeWidth={2} />
                              Edit details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toggleActive(a)}>
                              <HugeiconsIcon icon={UserGroupIcon} strokeWidth={2} />
                              {active ? "Deactivate" : "Reactivate"}
                            </DropdownMenuItem>
                            {accessOk && acc && acc.state !== "accepted" && active && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem disabled={busy} onClick={() => sendInvite(a)}>
                                  <HugeiconsIcon icon={MailSend01Icon} strokeWidth={2} />
                                  {acc.state === "none" ? "Send invitation" : "Resend invitation"}
                                </DropdownMenuItem>
                                {acc.state === "pending" && (
                                  <DropdownMenuItem disabled={busy} onClick={() => cancelInvite(a)}>
                                    <HugeiconsIcon icon={MailRemove01Icon} strokeWidth={2} />
                                    Cancel invitation
                                  </DropdownMenuItem>
                                )}
                              </>
                            )}
                            {canDelete && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  variant="destructive"
                                  onClick={() => setDeleting(a)}
                                >
                                  <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
                                  Delete advisor
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
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
          onAssigned={cache.assignmentCreated}
          onUnassigned={cache.assignmentRemoved}
          products={products}
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
              {editing
                ? "The email must match the account they sign in with."
                : "They’ll be emailed a link to create their account and set a password."}
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
                  spellCheck={false}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="adv-last">Last name</Label>
                <Input
                  id="adv-last"
                  value={form.lastName}
                  onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                  spellCheck={false}
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
            <div className="grid gap-1.5">
              <Label htmlFor="adv-type">Advisor type</Label>
              <Select
                value={form.product}
                onValueChange={(v) => setForm((f) => ({ ...f, product: v as AdvisorProduct }))}
              >
                <SelectTrigger id="adv-type" className="w-full">
                  <SelectValue placeholder="Choose a type…" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p} value={p}>
                      {PRODUCT_LABEL[p]} advisor
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">
                {editing && !advisorProduct(editing)
                  ? "This advisor was added before types existed — pick the product they advise on."
                  : "Decides which product they can be assigned to and see."}
              </p>
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
