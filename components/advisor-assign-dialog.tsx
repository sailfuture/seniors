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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Thesis advisors — {studentName}</DialogTitle>
          <DialogDescription>
            Advisors assigned here can view and comment on this student&apos;s {productLabel}.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div>
            <p className="text-muted-foreground mb-2 text-xs font-semibold uppercase tracking-wide">
              Assigned ({assigned.length})
            </p>
            {assigned.length === 0 ? (
              <p className="text-muted-foreground rounded-md border border-dashed py-6 text-center text-sm">
                No advisor assigned yet.
              </p>
            ) : (
              <div className="space-y-2">
                {assigned.map((asg) => {
                  const a = advisorById.get(asg.advisors_id)
                  return (
                    <div
                      key={asg.id}
                      className="flex items-center gap-3 rounded-md border px-3 py-2"
                    >
                      <Avatar className="size-7">
                        <AvatarFallback className="text-[10px]">
                          {a ? advisorInitials(a) : "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {a ? advisorName(a) : `Advisor #${asg.advisors_id}`}
                        </p>
                        {a?.email && (
                          <p className="text-muted-foreground truncate text-xs">{a.email}</p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground size-7 shrink-0 hover:text-red-600"
                        title="Remove advisor"
                        disabled={busy}
                        onClick={() => onUnassign(asg.id)}
                      >
                        <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} className="size-4" />
                      </Button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div>
            <p className="text-muted-foreground mb-2 text-xs font-semibold uppercase tracking-wide">
              Add an advisor
            </p>
            {available.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                {advisors.length === 0
                  ? "No advisors in the directory yet — add one from Thesis Advisors."
                  : "Every active advisor is already assigned."}
              </p>
            ) : (
              <div className="flex gap-2">
                <Select value={picked} onValueChange={setPicked} disabled={busy}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Choose an advisor…" />
                  </SelectTrigger>
                  <SelectContent>
                    {available.map((a) => (
                      <SelectItem key={a.id} value={String(a.id)}>
                        {advisorName(a)} — {a.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button disabled={!picked || busy} onClick={add}>
                  Assign
                </Button>
              </div>
            )}
          </div>
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
