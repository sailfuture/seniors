"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { HugeiconsIcon } from "@hugeicons/react"
import { Cancel01Icon } from "@hugeicons/core-free-icons"
import { advisorInitials, advisorName, type Advisor, type AdvisorAssignment } from "@/lib/advisors"

/**
 * Manage which advisors can view+comment on one student's product: shows the
 * current assignments with remove buttons and a picker to add more. Multiple
 * advisors per student are supported; swapping is remove + add.
 */
export function AdvisorAssignDialog({
  open,
  onOpenChange,
  studentName,
  productLabel,
  advisors,
  assigned,
  busy,
  onAssign,
  onUnassign,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  studentName: string
  productLabel: string
  /** Every advisor in the directory (inactive ones are filtered out here). */
  advisors: Advisor[]
  /** This student's assignments for this product. */
  assigned: AdvisorAssignment[]
  busy: boolean
  onAssign: (advisorId: number) => void
  onUnassign: (assignmentId: number) => void
}) {
  const [picked, setPicked] = useState<string>("")

  const advisorById = useMemo(() => new Map(advisors.map((a) => [a.id, a])), [advisors])
  const assignedIds = useMemo(() => new Set(assigned.map((a) => a.advisors_id)), [assigned])
  const available = useMemo(
    () => advisors.filter((a) => (a.isActive ?? true) && !assignedIds.has(a.id)),
    [advisors, assignedIds]
  )

  const add = () => {
    const id = Number(picked)
    if (!id) return
    onAssign(id)
    setPicked("")
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o) }}>
      <DialogContent
        className="sm:max-w-lg"
        // Enter assigns the picked advisor, or closes when there's nothing staged.
        onKeyDown={(e) => {
          if (e.key !== "Enter" || busy) return
          const target = e.target as HTMLElement
          if (target.getAttribute("role") === "combobox") return
          e.preventDefault()
          if (picked) add()
          else onOpenChange(false)
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-base">Thesis advisors</DialogTitle>
          <DialogDescription>
            {studentName} · {productLabel} — assigned advisors can view and comment on this
            student&apos;s work.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5">
          <section className="grid gap-2">
            <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wide">
              Assigned ({assigned.length})
            </p>
            {assigned.length === 0 ? (
              <p className="text-muted-foreground/70 rounded-lg border border-dashed px-3 py-4 text-center text-sm">
                No advisor assigned yet.
              </p>
            ) : (
              <ul className="divide-y rounded-lg border">
                {assigned.map((asg) => {
                  const a = advisorById.get(asg.advisors_id)
                  return (
                    <li key={asg.id} className="flex items-center gap-3 px-3 py-2.5">
                      <Avatar className="size-8 shrink-0">
                        <AvatarFallback className="text-[10px]">
                          {a ? advisorInitials(a) : "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium leading-tight">
                          {a ? advisorName(a) : `Advisor #${asg.advisors_id}`}
                        </p>
                        {a?.email && (
                          <p className="text-muted-foreground truncate text-xs leading-tight">
                            {a.email}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground/60 size-8 shrink-0 hover:bg-red-50 hover:text-red-600"
                        title="Remove advisor"
                        disabled={busy}
                        onClick={() => onUnassign(asg.id)}
                      >
                        <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} className="size-4" />
                      </Button>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <section className="grid gap-2">
            <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wide">
              Add an advisor
            </p>
            {available.length === 0 ? (
              <p className="text-muted-foreground rounded-lg border border-dashed px-3 py-4 text-center text-sm">
                {advisors.length === 0
                  ? "No advisors in the directory yet — add one from Thesis Advisors."
                  : "Every active advisor is already assigned."}
              </p>
            ) : (
              <div className="flex items-center gap-2">
                <Select value={picked} onValueChange={setPicked} disabled={busy}>
                  <SelectTrigger className="min-w-0 flex-1">
                    <SelectValue placeholder="Choose an advisor…" />
                  </SelectTrigger>
                  <SelectContent>
                    {available.map((a) => (
                      <SelectItem key={a.id} value={String(a.id)} textValue={advisorName(a)}>
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate font-medium">{advisorName(a)}</span>
                          <span className="text-muted-foreground truncate text-xs">{a.email}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button className="shrink-0" disabled={!picked || busy} onClick={add}>
                  Assign
                </Button>
              </div>
            )}
          </section>
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
