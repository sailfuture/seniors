"use client"

import { useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  useComboboxAnchor,
} from "@/components/ui/combobox"
import { InputGroupAddon } from "@/components/ui/input-group"
import { HugeiconsIcon } from "@hugeicons/react"
import { Delete02Icon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import {
  ADVISOR_PRODUCTS,
  PRODUCT_LABEL,
  advisorName,
  advisorProduct,
  assignAdvisor,
  unassignAdvisor,
  type Advisor,
  type AdvisorAssignment,
  type AdvisorProduct,
} from "@/lib/advisors"
import { currentClassYear, studentName, type RosterStudent } from "@/lib/students"

interface StudentGroup {
  value: string
  items: RosterStudent[]
}

function initials(s?: RosterStudent): string {
  if (!s) return "?"
  return `${s.firstName?.charAt(0) ?? ""}${s.lastName?.charAt(0) ?? ""}`.toUpperCase() || "?"
}

function StudentAvatar({
  student,
  className,
}: {
  student?: RosterStudent
  className?: string
}) {
  return (
    <Avatar className={cn("size-7 shrink-0", className)}>
      <AvatarImage src={student?.profileImage || undefined} />
      <AvatarFallback className="text-[0.7em] font-medium">{initials(student)}</AvatarFallback>
    </Avatar>
  )
}

/** Xano stores the year as "Batch of 2026"; the UI calls it "Class of 2026". */
function classLabel(s: RosterStudent): string {
  const raw = (s.yearGroup ?? "").trim()
  if (!raw) return "No class year"
  return raw.replace(/^batch of\b/i, "Class of")
}

/**
 * Group order: the current class first, future classes ascending, year-less
 * students next, and already-graduated classes last (most recent first) —
 * past classes stay pickable but never crowd out the classes still enrolled.
 */
function compareGroups(a: string, b: string, current: number): number {
  const rank = (label: string): [number, number] => {
    const year = Number(label.match(/\d{4}/)?.[0] ?? NaN)
    if (Number.isNaN(year)) return [2, 0]
    if (year === current) return [0, 0]
    if (year > current) return [1, year] // future: ascending
    return [3, -year] // graduated: most recent first
  }
  const [ra, ka] = rank(a)
  const [rb, kb] = rank(b)
  return ra - rb || ka - kb || a.localeCompare(b)
}

/**
 * Per-advisor view of assignments: shows every student this advisor covers
 * and lets an admin add or remove assignments without leaving the advisor
 * directory. (The per-student direction lives on each product's roster.)
 */
export function AdvisorStudentsDialog({
  advisor,
  assignments,
  students,
  open,
  onOpenChange,
  onAssigned,
  onUnassigned,
}: {
  advisor: Advisor
  assignments: AdvisorAssignment[]
  students: RosterStudent[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onAssigned: (a: AdvisorAssignment) => void
  onUnassigned: (assignmentId: number) => void
}) {
  // A typed advisor (business thesis or life map) can only be assigned to
  // their own product; the product picker shows only for legacy advisors
  // whose type was never set.
  const fixedProduct = advisorProduct(advisor)
  // The student list drops down from the whole picker row, not just the
  // search field, so it spans the dialog.
  const pickerAnchor = useComboboxAnchor()
  // The list mounts inside the dialog itself (see ComboboxContent's
  // `container`), so the modal dialog's scroll and pointer locks don't
  // apply to it.
  const dialogRef = useRef<HTMLDivElement>(null)
  const [pickedStudent, setPickedStudent] = useState<RosterStudent | null>(null)
  const [pickedProduct, setPickedProduct] = useState<AdvisorProduct>(
    fixedProduct ?? "business-thesis"
  )
  const [busy, setBusy] = useState(false)
  // Removal is confirmed in a warning dialog rather than firing off the icon.
  const [confirmRemove, setConfirmRemove] = useState<AdvisorAssignment | null>(null)

  const studentsById = useMemo(
    () => new Map(students.map((s) => [String(s.id), s])),
    [students]
  )

  const mine = useMemo(
    () =>
      assignments
        .filter((a) => a.advisors_id === advisor.id)
        .sort((x, y) => {
          const sx = studentsById.get(String(x.students_id))
          const sy = studentsById.get(String(y.students_id))
          return (sx ? studentName(sx) : "").localeCompare(sy ? studentName(sy) : "")
        }),
    [assignments, advisor.id, studentsById]
  )

  // A student can be picked again for the other product, just not duplicated.
  const alreadyAssigned = useMemo(
    () =>
      new Set(mine.map((a) => `${String(a.students_id)}:${a.type}`)),
    [mine]
  )

  const addable = useMemo(
    () =>
      [...students]
        .sort((x, y) => studentName(x).localeCompare(studentName(y)))
        .filter((s) => !alreadyAssigned.has(`${String(s.id)}:${pickedProduct}`)),
    [students, alreadyAssigned, pickedProduct]
  )

  // Combobox groups: one per class year — current class first, then future
  // classes, with graduated classes separated out at the bottom.
  const studentGroups = useMemo<StudentGroup[]>(() => {
    const current = currentClassYear()
    const byLabel = new Map<string, RosterStudent[]>()
    for (const s of addable) {
      const label = classLabel(s)
      byLabel.set(label, [...(byLabel.get(label) ?? []), s])
    }
    return [...byLabel.entries()]
      .sort(([a], [b]) => compareGroups(a, b, current))
      .map(([value, items]) => {
        const year = Number(value.match(/\d{4}/)?.[0] ?? NaN)
        return {
          value: !Number.isNaN(year) && year < current ? `${value} · Graduated` : value,
          items,
        }
      })
  }, [addable])

  const add = async () => {
    const student = pickedStudent
    if (!student) return
    setBusy(true)
    try {
      const created = await assignAdvisor(String(student.id), advisor.id, pickedProduct)
      if (!created) throw new Error()
      onAssigned(created)
      setPickedStudent(null)
      toast.success(
        `${studentName(student)} assigned for ${PRODUCT_LABEL[pickedProduct]}`
      )
    } catch {
      toast.error("Couldn't assign — please try again.")
    } finally {
      setBusy(false)
    }
  }

  const remove = async (a: AdvisorAssignment) => {
    setBusy(true)
    try {
      const ok = await unassignAdvisor(a.id)
      if (!ok) throw new Error()
      onUnassigned(a.id)
      setConfirmRemove(null)
      const student = studentsById.get(String(a.students_id))
      toast.success(
        `${student ? studentName(student) : "Student"} unassigned from ${
          PRODUCT_LABEL[a.type as AdvisorProduct] ?? a.type
        }`
      )
    } catch {
      toast.error("Couldn't unassign — please try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o) }}>
      <DialogContent ref={dialogRef} className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{advisorName(advisor)}&rsquo;s students</DialogTitle>
          <DialogDescription>
            {fixedProduct
              ? `Assign or remove students whose ${PRODUCT_LABEL[fixedProduct]} this advisor can view.`
              : "Assign or remove students this advisor can view."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          {mine.length === 0 ? (
            <p className="text-muted-foreground rounded-md border py-6 text-center text-sm">
              No students assigned yet.
            </p>
          ) : (
            <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border p-2">
              {mine.map((a) => {
                const student = studentsById.get(String(a.students_id))
                return (
                  <div
                    key={a.id}
                    className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50"
                  >
                    <StudentAvatar student={student} />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {student ? studentName(student) : `Student #${a.students_id}`}
                    </span>
                    <Badge variant="secondary" className="shrink-0 font-normal">
                      {PRODUCT_LABEL[a.type as AdvisorProduct] ?? a.type}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive size-7 shrink-0"
                      title="Remove assignment"
                      disabled={busy}
                      onClick={() => setConfirmRemove(a)}
                    >
                      <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} className="size-4" />
                    </Button>
                  </div>
                )
              })}
            </div>
          )}

          <div ref={pickerAnchor} className="flex flex-wrap items-center gap-2">
            {!fixedProduct && (
              <Select
                value={pickedProduct}
                onValueChange={(v) => {
                  setPickedProduct(v as AdvisorProduct)
                  setPickedStudent(null)
                }}
                disabled={busy}
              >
                <SelectTrigger className="w-[150px] shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ADVISOR_PRODUCTS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {PRODUCT_LABEL[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Combobox
              items={studentGroups}
              value={pickedStudent}
              onValueChange={(s) => setPickedStudent((s as RosterStudent | null) ?? null)}
              itemToStringLabel={(s: RosterStudent) => studentName(s)}
              disabled={busy}
            >
              <ComboboxInput
                placeholder="Search students…"
                className="min-w-0 flex-1"
                disabled={busy}
              >
                {/* The picked student's photo sits in the field so the choice reads at a glance. */}
                {pickedStudent && (
                  <InputGroupAddon align="inline-start" className="pl-1.5">
                    <StudentAvatar student={pickedStudent} className="size-6" />
                  </InputGroupAddon>
                )}
              </ComboboxInput>
              <ComboboxContent anchor={pickerAnchor} container={dialogRef} sideOffset={8}>
                <ComboboxEmpty className="py-6">No students found.</ComboboxEmpty>
                <ComboboxList className="max-h-[min(24rem,calc(var(--available-height)-1rem))] p-0">
                  {(group: StudentGroup) => (
                    <ComboboxGroup key={group.value} items={group.items} className="pb-1.5">
                      {/* Sticky so the class year stays visible while its students scroll. */}
                      <ComboboxLabel className="bg-popover sticky top-0 z-10 flex items-center justify-between gap-2 px-4 pt-2.5 pb-1.5 text-[0.6875rem] font-medium tracking-wide uppercase">
                        <span className="truncate">{group.value}</span>
                        <span className="tabular-nums">{group.items.length}</span>
                      </ComboboxLabel>
                      <ComboboxCollection>
                        {(s: RosterStudent) => (
                          <ComboboxItem
                            key={s.id}
                            value={s}
                            className="mx-1.5 w-auto cursor-pointer gap-3 py-2 pr-10 pl-2.5"
                          >
                            <StudentAvatar student={s} className="size-9" />
                            <span className="flex min-w-0 flex-1 flex-col gap-0.5 leading-tight">
                              <span className="truncate font-medium">{studentName(s)}</span>
                              <span className="text-muted-foreground truncate text-xs">
                                {s.studentEmail}
                              </span>
                            </span>
                          </ComboboxItem>
                        )}
                      </ComboboxCollection>
                    </ComboboxGroup>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
            <Button disabled={busy || !pickedStudent} onClick={add}>
              Assign
            </Button>
          </div>
        </div>

        <AlertDialog
          open={confirmRemove != null}
          onOpenChange={(open) => {
            if (!open && !busy) setConfirmRemove(null)
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Remove{" "}
                {(() => {
                  const s = confirmRemove && studentsById.get(String(confirmRemove.students_id))
                  return s ? studentName(s) : "this student"
                })()}
                ?
              </AlertDialogTitle>
              <AlertDialogDescription>
                {advisorName(advisor)} will lose access to this student&apos;s{" "}
                {confirmRemove
                  ? (PRODUCT_LABEL[confirmRemove.type as AdvisorProduct] ?? confirmRemove.type)
                  : "work"}{" "}
                and can no longer view or comment on it. Their existing comments stay. You can
                re-assign the student at any time.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={busy}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={(e) => {
                  // Keep the dialog open while the request runs so a failure
                  // can be retried in place.
                  e.preventDefault()
                  if (confirmRemove) remove(confirmRemove)
                }}
              >
                {busy ? "Removing…" : "Remove student"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  )
}
