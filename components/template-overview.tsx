"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
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
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  SquareLock02Icon,
  SquareUnlock02Icon,
  CheckmarkCircle02Icon,
  CircleIcon,
  DragDropIcon,
  Add01Icon,
  Settings02Icon,
} from "@hugeicons/core-free-icons"
import { Switch } from "@/components/ui/switch"
import {
  titleToSlug,
  invalidateSectionsCache,
  type LifeMapSection,
} from "@/lib/lifemap-sections"

const XANO_BASE =
  process.env.NEXT_PUBLIC_XANO_API_BASE ??
  "https://xsc3-mvx7-r86m.n7e.xano.io/api:o2_UyOKn"

const TEMPLATE_ENDPOINT = `${XANO_BASE}/lifeplan_template`
const SECTIONS_ENDPOINT = `${XANO_BASE}/lifemap_sections`
const GROUPS_ENDPOINT = `${XANO_BASE}/lifemap_custom_group`
const TYPES_ENDPOINT = `${XANO_BASE}/question_types`
const PUBLISH_ENDPOINT = `${XANO_BASE}/publish_questions`
const REVIEW_ENDPOINT = `${XANO_BASE}/lifemap_review`

interface TemplateQuestion {
  id: number
  field_label: string
  field_name: string
  lifemap_sections_id: number
  lifemap_custom_group_id: number | null
  question_types_id: number | null
  isArchived: boolean
  isPublished: boolean
  sortOrder: number
}

interface CustomGroup {
  id: number
  group_name: string
  group_description: string
  lifemap_sections_id: number
}

interface QuestionType {
  id: number
  type: string
}

interface SectionSummary {
  section: LifeMapSection
  slug: string
  total: number
  published: number
  draft: number
}

export function TemplateOverview() {
  const router = useRouter()
  const [summaries, setSummaries] = useState<SectionSummary[]>([])
  const [allQuestions, setAllQuestions] = useState<TemplateQuestion[]>([])
  const [allGroups, setAllGroups] = useState<CustomGroup[]>([])
  const [questionTypes, setQuestionTypes] = useState<QuestionType[]>([])
  const [loading, setLoading] = useState(true)
  const [publishing, setPublishing] = useState(false)
  const [sheetSection, setSheetSection] = useState<SectionSummary | null>(null)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dropIdx, setDropIdx] = useState<number | null>(null)
  const [lockTarget, setLockTarget] = useState<SectionSummary | null>(null)
  const [addSectionOpen, setAddSectionOpen] = useState(false)
  const [newSectionTitle, setNewSectionTitle] = useState("")
  const [newSectionDescription, setNewSectionDescription] = useState("")
  const [addingSection, setAddingSection] = useState(false)
  const [editDescription, setEditDescription] = useState("")
  const [editLocked, setEditLocked] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const [sectionsRes, templateRes, groupsRes, typesRes] = await Promise.all([
          fetch(SECTIONS_ENDPOINT),
          fetch(TEMPLATE_ENDPOINT),
          fetch(GROUPS_ENDPOINT),
          fetch(TYPES_ENDPOINT),
        ])

        const rawSections: LifeMapSection[] = sectionsRes.ok ? await sectionsRes.json() : []
        const sections = rawSections.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        const questions: TemplateQuestion[] = templateRes.ok ? await templateRes.json() : []
        const groups: CustomGroup[] = groupsRes.ok ? await groupsRes.json() : []
        const types: QuestionType[] = typesRes.ok ? await typesRes.json() : []

        const active = questions.filter((q) => !q.isArchived)
        setAllQuestions(active)
        setAllGroups(groups)
        setQuestionTypes(types)

        const result: SectionSummary[] = sections.map((s) => {
          const sectionQs = active.filter((q) => q.lifemap_sections_id === s.id)
          return {
            section: s,
            slug: titleToSlug(s.section_title),
            total: sectionQs.length,
            published: sectionQs.filter((q) => q.isPublished).length,
            draft: sectionQs.filter((q) => !q.isPublished).length,
          }
        })

        setSummaries(result)
      } catch {
        // Silently fail
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  const totalDrafts = allQuestions.filter((q) => !q.isPublished).length

  const handlePublishAll = async () => {
    const drafts = allQuestions.filter((q) => !q.isPublished)
    if (drafts.length === 0) {
      toast("All questions are already published", { duration: 2000 })
      return
    }

    setPublishing(true)
    try {
      await Promise.all(
        drafts.map((q) =>
          fetch(`${TEMPLATE_ENDPOINT}/${q.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isPublished: true }),
          })
        )
      )

      await fetch(PUBLISH_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }).catch(() => {})

      setAllQuestions((prev) => prev.map((q) => ({ ...q, isPublished: true })))
      setSummaries((prev) =>
        prev.map((s) => ({ ...s, published: s.total, draft: 0 }))
      )
      toast.success(`${drafts.length} question${drafts.length > 1 ? "s" : ""} published`, { duration: 2000 })
    } catch {
      toast.error("Failed to publish some questions", { duration: 3000 })
    } finally {
      setPublishing(false)
    }
  }

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault()
    if (dragIdx === null || dragIdx === idx) return
    setDropIdx(idx)
  }

  const handleDrop = async () => {
    if (dragIdx === null || dropIdx === null || dragIdx === dropIdx) {
      setDragIdx(null)
      setDropIdx(null)
      return
    }

    const newSummaries = [...summaries]
    const [moved] = newSummaries.splice(dragIdx, 1)
    newSummaries.splice(dropIdx, 0, moved)
    setSummaries(newSummaries)
    setDragIdx(null)
    setDropIdx(null)

    try {
      await Promise.all(
        newSummaries.map((s, i) =>
          fetch(`${SECTIONS_ENDPOINT}/${s.section.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ order: i + 1 }),
          })
        )
      )
      invalidateSectionsCache()
    } catch {
      toast.error("Failed to reorder sections")
    }
  }

  const handleToggleLock = (s: SectionSummary) => {
    setLockTarget(s)
  }

  const confirmToggleLock = async () => {
    if (!lockTarget) return
    const s = lockTarget
    const newLocked = !s.section.isLocked
    setLockTarget(null)

    setSummaries((prev) =>
      prev.map((item) =>
        item.section.id === s.section.id
          ? { ...item, section: { ...item.section, isLocked: newLocked } }
          : item
      )
    )

    try {
      const res = await fetch(`${SECTIONS_ENDPOINT}/${s.section.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isLocked: newLocked }),
      })
      if (!res.ok) throw new Error()

      const reviewRes = await fetch(REVIEW_ENDPOINT)
      if (reviewRes.ok) {
        const allReviews: { id: number; lifemap_sections_id: number }[] = await reviewRes.json()
        const sectionReviews = allReviews.filter((r) => r.lifemap_sections_id === s.section.id)
        await Promise.all(
          sectionReviews.map((r) =>
            fetch(`${REVIEW_ENDPOINT}/${r.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ isLocked: newLocked }),
            })
          )
        )
      }

      toast.success(newLocked ? "Section locked" : "Section unlocked")
    } catch {
      setSummaries((prev) =>
        prev.map((item) =>
          item.section.id === s.section.id
            ? { ...item, section: { ...item.section, isLocked: !newLocked } }
            : item
        )
      )
      toast.error("Failed to update lock status")
    }
  }

  const handleSaveSheetSettings = async () => {
    if (!sheetSection) return
    setSavingSettings(true)
    try {
      const res = await fetch(`${SECTIONS_ENDPOINT}/${sheetSection.section.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section_description: editDescription, description: editDescription, isLocked: editLocked }),
      })
      if (!res.ok) throw new Error()

      if (editLocked !== sheetSection.section.isLocked) {
        const reviewRes = await fetch(REVIEW_ENDPOINT)
        if (reviewRes.ok) {
          const allReviews: { id: number; lifemap_sections_id: number }[] = await reviewRes.json()
          const sectionReviews = allReviews.filter((r) => r.lifemap_sections_id === sheetSection.section.id)
          await Promise.all(
            sectionReviews.map((r) =>
              fetch(`${REVIEW_ENDPOINT}/${r.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isLocked: editLocked }),
              })
            )
          )
        }
      }

      setSummaries((prev) =>
        prev.map((item) =>
          item.section.id === sheetSection.section.id
            ? {
                ...item,
                section: {
                  ...item.section,
                  section_description: editDescription,
                  isLocked: editLocked,
                },
              }
            : item
        )
      )
      setSheetSection((prev) =>
        prev
          ? {
              ...prev,
              section: {
                ...prev.section,
                section_description: editDescription,
                isLocked: editLocked,
              },
            }
          : null
      )
      invalidateSectionsCache()
      toast.success("Section settings saved")
    } catch {
      toast.error("Failed to save section settings")
    } finally {
      setSavingSettings(false)
    }
  }

  const handleAddSection = async () => {
    if (!newSectionTitle.trim()) {
      toast.error("Section name is required")
      return
    }
    setAddingSection(true)
    try {
      const order = summaries.length + 1
      const res = await fetch(SECTIONS_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section_title: newSectionTitle.trim(),
          section_description: newSectionDescription.trim(),
          description: newSectionDescription.trim(),
          isLocked: false,
          order,
        }),
      })
      if (!res.ok) throw new Error()
      const created: LifeMapSection = await res.json()
      invalidateSectionsCache()
      setSummaries((prev) => [
        ...prev,
        {
          section: created,
          slug: titleToSlug(created.section_title),
          total: 0,
          published: 0,
          draft: 0,
        },
      ])
      setNewSectionTitle("")
      setNewSectionDescription("")
      setAddSectionOpen(false)
      toast.success("Section created")
    } catch {
      toast.error("Failed to create section")
    } finally {
      setAddingSection(false)
    }
  }

  const getTypeName = (q: TemplateQuestion) =>
    questionTypes.find((t) => t.id === q.question_types_id)?.type ?? "—"

  const getSectionQuestions = (sectionId: number) => {
    const qs = allQuestions
      .filter((q) => q.lifemap_sections_id === sectionId)
      .sort((a, b) => a.sortOrder - b.sortOrder)
    const groups = allGroups.filter((g) => g.lifemap_sections_id === sectionId)

    type FlatItem =
      | { kind: "group"; g: CustomGroup }
      | { kind: "question"; q: TemplateQuestion }

    const flat: FlatItem[] = []
    const usedGroupIds = new Set<number>()

    const ungrouped = qs.filter((q) => !q.lifemap_custom_group_id || q.lifemap_custom_group_id === 0)
    ungrouped.forEach((q) => flat.push({ kind: "question", q }))

    for (const group of groups) {
      const groupQs = qs.filter((q) => q.lifemap_custom_group_id === group.id)
      if (groupQs.length > 0 || true) {
        flat.push({ kind: "group", g: group })
        usedGroupIds.add(group.id)
        groupQs.forEach((q) => flat.push({ kind: "question", q }))
      }
    }

    return flat
  }

  if (loading) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        <Skeleton className="h-8 w-64" />
        <div className="space-y-2">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Life Map Template</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Configure the questions students must complete for each section.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {totalDrafts > 0 && (
            <Button
              variant="outline"
              onClick={handlePublishAll}
              disabled={publishing}
              className="gap-2"
            >
              {publishing ? "Publishing..." : `Publish All Drafts (${totalDrafts})`}
            </Button>
          )}
          <Button onClick={() => setAddSectionOpen(true)} className="gap-2">
            <HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="size-4" />
            Add Section
          </Button>
        </div>
      </div>

      <div className="rounded-md border" onDragOver={(e) => e.preventDefault()}>
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="text-muted-foreground w-[180px] text-xs font-medium uppercase tracking-wide">Section</TableHead>
              <TableHead className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Description</TableHead>
              <TableHead className="text-muted-foreground w-[100px] text-center text-xs font-medium uppercase tracking-wide">Questions</TableHead>
              <TableHead className="text-muted-foreground w-[100px] text-center text-xs font-medium uppercase tracking-wide">Published</TableHead>
              <TableHead className="text-muted-foreground w-[100px] text-center text-xs font-medium uppercase tracking-wide">Drafts</TableHead>
              <TableHead className="text-muted-foreground w-[60px] text-xs font-medium uppercase tracking-wide" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {summaries.map((s, idx) => (
              <TableRow
                key={s.section.id}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDragLeave={() => setDropIdx(null)}
                onDrop={handleDrop}
                className={`cursor-pointer [&>td]:py-3.5 ${
                  s.section.isLocked ? "bg-gray-50 hover:bg-gray-100 dark:bg-gray-900/30 dark:hover:bg-gray-900/50" : "hover:bg-muted/50"
                } ${dragIdx === idx ? "opacity-40" : ""} ${
                  dropIdx === idx && dragIdx !== idx
                    ? (dragIdx ?? 0) < idx ? "border-b-primary border-b-2" : "border-t-primary border-t-2"
                    : ""
                }`}
                onClick={() => {
                  setEditDescription(s.section.section_description ?? "")
                  setEditLocked(s.section.isLocked ?? false)
                  setSheetSection(s)
                }}
              >
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div
                      draggable
                      onDragStart={(e) => { e.stopPropagation(); setDragIdx(idx) }}
                      onDragEnd={() => { setDragIdx(null); setDropIdx(null) }}
                      className="cursor-grab active:cursor-grabbing"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <HugeiconsIcon icon={DragDropIcon} strokeWidth={1.5} className="text-muted-foreground/40 size-3.5 shrink-0" />
                    </div>
                    <span className="text-sm font-medium">{s.section.section_title}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-muted-foreground block truncate text-sm">
                    {s.section.section_description || "—"}
                  </span>
                </TableCell>
                <TableCell className="text-center">
                  <span className="text-sm">{s.total}</span>
                </TableCell>
                <TableCell className="text-center">
                  <span className={`text-sm ${s.published > 0 ? "font-medium text-green-600" : "text-muted-foreground"}`}>
                    {s.published}
                  </span>
                </TableCell>
                <TableCell className="text-center">
                  <span className={`text-sm ${s.draft > 0 ? "text-muted-foreground font-medium" : "text-muted-foreground"}`}>
                    {s.draft}
                  </span>
                </TableCell>
                <TableCell>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-7"
                    onClick={(e) => { e.stopPropagation(); handleToggleLock(s) }}
                    title={s.section.isLocked ? "Locked — click to unlock" : "Unlocked — click to lock"}
                  >
                    <HugeiconsIcon
                      icon={s.section.isLocked ? SquareLock02Icon : SquareUnlock02Icon}
                      strokeWidth={1.5}
                      className={`size-4 ${s.section.isLocked ? "text-muted-foreground" : "text-green-600"}`}
                    />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Sheet open={!!sheetSection} onOpenChange={(open) => { if (!open) setSheetSection(null) }}>
        <SheetContent className="flex flex-col gap-0 p-0 sm:max-w-lg">
          <SheetHeader className="shrink-0 border-b px-6 py-4">
            <SheetTitle className="text-base">{sheetSection?.section.section_title}</SheetTitle>
            <SheetDescription className="sr-only">Overview and settings for this section</SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto">
            <div className="space-y-4 border-b px-6 py-5">
              <div className="space-y-2">
                <Label htmlFor="sheet-section-description">Description</Label>
                <Textarea
                  id="sheet-section-description"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Add a description for this section..."
                  rows={3}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label htmlFor="sheet-lock-toggle" className="text-sm font-medium">Lock Section</Label>
                  <p className="text-muted-foreground text-xs">
                    Prevent students from editing responses.
                  </p>
                </div>
                <Switch
                  id="sheet-lock-toggle"
                  checked={editLocked}
                  onCheckedChange={setEditLocked}
                />
              </div>
            </div>

            {sheetSection && (() => {
              const items = getSectionQuestions(sheetSection.section.id)
              if (items.length === 0) {
                return (
                  <div className="px-6 py-8 text-center">
                    <p className="text-muted-foreground text-sm">No questions added yet.</p>
                  </div>
                )
              }
              return (
                <div>
                  {items.map((item) => {
                    if (item.kind === "group") {
                      return (
                        <div key={`g-${item.g.id}`} className="border-b bg-muted/40 px-6 py-2.5">
                          <span className="text-xs font-semibold uppercase tracking-wide">{item.g.group_name}</span>
                        </div>
                      )
                    }
                    const q = item.q
                    return (
                      <div key={q.id} className="flex items-center gap-3 border-b px-6 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{q.field_label || q.field_name}</p>
                          <p className="text-muted-foreground text-xs">{getTypeName(q)}</p>
                        </div>
                        {q.isPublished ? (
                          <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} className="size-4 shrink-0 text-green-600" />
                        ) : (
                          <HugeiconsIcon icon={CircleIcon} strokeWidth={1.5} className="text-muted-foreground/40 size-4 shrink-0" />
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </div>

          {sheetSection && (
            <div className="flex shrink-0 gap-2 border-t px-6 py-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  router.push(`/admin/life-map-template/${sheetSection.slug}`)
                  setSheetSection(null)
                }}
              >
                Manage Questions
              </Button>
              <Button className="flex-1" onClick={handleSaveSheetSettings} disabled={savingSettings}>
                {savingSettings ? "Saving..." : "Save Settings"}
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!lockTarget} onOpenChange={(open) => { if (!open) setLockTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {lockTarget?.section.isLocked ? "Unlock" : "Lock"} {lockTarget?.section.section_title}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {lockTarget?.section.isLocked
                ? "Unlocking this section will allow students to edit their responses. All student review records for this section will be updated."
                : "Locking this section will prevent students from editing their responses. All student review records for this section will be updated."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmToggleLock}>
              {lockTarget?.section.isLocked ? "Unlock Section" : "Lock Section"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Sheet open={addSectionOpen} onOpenChange={(open) => {
        if (!open) {
          setNewSectionTitle("")
          setNewSectionDescription("")
        }
        setAddSectionOpen(open)
      }}>
        <SheetContent className="flex flex-col gap-0 p-0">
          <SheetHeader className="border-b px-6 py-4">
            <SheetTitle>Add Section</SheetTitle>
            <SheetDescription className="sr-only">Create a new life map section</SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-6">
            <div className="space-y-2">
              <Label htmlFor="new-section-title">Section Name</Label>
              <Input
                id="new-section-title"
                value={newSectionTitle}
                onChange={(e) => setNewSectionTitle(e.target.value)}
                placeholder="e.g. Health & Wellness"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-section-description">Description</Label>
              <Textarea
                id="new-section-description"
                value={newSectionDescription}
                onChange={(e) => setNewSectionDescription(e.target.value)}
                placeholder="Brief description of this section..."
                rows={3}
              />
            </div>
          </div>

          <div className="border-t px-6 py-4">
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setAddSectionOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleAddSection} disabled={addingSection}>
                {addingSection ? "Creating..." : "Create Section"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
