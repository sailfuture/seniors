"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  Delete02Icon,
  PencilEdit02Icon,
  DragDropIcon,
  Alert02Icon,
  CheckmarkCircle02Icon,
  CircleIcon,
  ArrowLeft02Icon,
  SquareLock02Icon,
  SquareUnlock02Icon,
  Settings02Icon,
} from "@hugeicons/core-free-icons"
import { toast } from "sonner"
import { invalidateSectionsCache } from "@/lib/lifemap-sections"

const XANO_BASE =
  process.env.NEXT_PUBLIC_XANO_API_BASE ??
  "https://xsc3-mvx7-r86m.n7e.xano.io/api:o2_UyOKn"

const TEMPLATE_ENDPOINT = `${XANO_BASE}/lifeplan_template`
const QUESTION_TYPES_ENDPOINT = `${XANO_BASE}/question_types`
const PUBLISH_ENDPOINT = `${XANO_BASE}/publish_questions`
const CUSTOM_GROUP_ENDPOINT = `${XANO_BASE}/lifemap_custom_group`
const SECTIONS_ENDPOINT = `${XANO_BASE}/lifemap_sections`
const REVIEW_ENDPOINT = `${XANO_BASE}/lifemap_review`

interface TemplateQuestion {
  id?: number
  field_name: string
  field_label: string
  min_words: number
  placeholder: string
  detailed_instructions: string
  resources: string[]
  examples: string[]
  sentence_starters: string[]
  lifemap_sections_id: number | null
  isArchived: boolean
  isPublished: boolean
  question_types_id: number | null
  lifemap_custom_group_id: number | null
  dropdownOptions: string[]
  sortOrder: number
  _question_types?: QuestionType
}

interface QuestionType {
  id: number
  type: string
}

interface CustomGroup {
  id?: number
  group_name: string
  group_description: string
  instructions: string
  resources: string[]
  lifemap_sections_id: number
}

const emptyQuestion: Omit<TemplateQuestion, "id"> = {
  field_name: "",
  field_label: "",
  min_words: 0,
  placeholder: "",
  detailed_instructions: "",
  resources: [],
  examples: [],
  sentence_starters: [],
  lifemap_sections_id: null,
  isArchived: false,
  isPublished: false,
  question_types_id: null,
  lifemap_custom_group_id: null,
  dropdownOptions: [],
  sortOrder: 0,
}

const emptyGroup: Omit<CustomGroup, "id"> = {
  group_name: "",
  group_description: "",
  instructions: "",
  resources: [],
  lifemap_sections_id: 0,
}

function getTypeName(q: TemplateQuestion, types: QuestionType[]): string {
  if (q._question_types?.type) return q._question_types.type
  if (q.question_types_id) {
    const found = types.find((t) => t.id === q.question_types_id)
    if (found) return found.type
  }
  return "—"
}

interface TemplateManagerProps {
  section: string
  sectionId: number
  sectionLabel: string
  sectionDescription?: string
  sectionLocked?: boolean
}

export function TemplateManager({ section, sectionId, sectionLabel, sectionDescription: initialDescription, sectionLocked: initialLocked }: TemplateManagerProps) {
  const [questions, setQuestions] = useState<TemplateQuestion[]>([])
  const [questionTypes, setQuestionTypes] = useState<QuestionType[]>([])
  const [customGroups, setCustomGroups] = useState<CustomGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<TemplateQuestion | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TemplateQuestion | null>(null)
  const [saving, setSaving] = useState(false)

  const [groupSheetOpen, setGroupSheetOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<CustomGroup | null>(null)
  const [savingGroup, setSavingGroup] = useState(false)
  const [unpublishTarget, setUnpublishTarget] = useState<TemplateQuestion | null>(null)

  const [localDescription, setLocalDescription] = useState(initialDescription ?? "")
  const [isLocked, setIsLocked] = useState(initialLocked ?? false)
  const [savingSection, setSavingSection] = useState(false)
  const [sectionSettingsOpen, setSectionSettingsOpen] = useState(false)
  const savedDescription = useRef(initialDescription ?? "")
  const savedLocked = useRef(initialLocked ?? false)

  const loadData = useCallback(async () => {
    try {
      const [templateRes, typesRes, groupsRes] = await Promise.all([
        fetch(TEMPLATE_ENDPOINT),
        fetch(QUESTION_TYPES_ENDPOINT),
        fetch(CUSTOM_GROUP_ENDPOINT),
      ])

      if (templateRes.ok) {
        const all = await templateRes.json()
        const filtered = (all as TemplateQuestion[])
          .filter((q) => q.lifemap_sections_id === sectionId && !q.isArchived)
          .sort((a, b) => a.sortOrder - b.sortOrder)
        setQuestions(filtered)
      }

      if (typesRes.ok) {
        setQuestionTypes(await typesRes.json())
      }

      if (groupsRes.ok) {
        const allGroups = (await groupsRes.json()) as CustomGroup[]
        setCustomGroups(allGroups.filter((g) => g.lifemap_sections_id === sectionId))
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false)
    }
  }, [sectionId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleAdd = () => {
    setEditingQuestion(null)
    setSheetOpen(true)
  }

  const handleEdit = (q: TemplateQuestion) => {
    setEditingQuestion(q)
    setSheetOpen(true)
  }

  const handleSave = async (data: Omit<TemplateQuestion, "id"> & { id?: number }) => {
    setSaving(true)
    try {
      const isEdit = !!data.id
      const url = isEdit ? `${TEMPLATE_ENDPOINT}/${data.id}` : TEMPLATE_ENDPOINT
      const method = isEdit ? "PATCH" : "POST"

      const payload = {
        ...data,
        lifemap_sections_id: sectionId,
        sortOrder: isEdit ? data.sortOrder : questions.length + 1,
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        toast(isEdit ? "Question updated" : "Question added", { duration: 2000 })
        setSheetOpen(false)
        await loadData()
      } else {
        toast("Failed to save question", { duration: 3000 })
      }
    } catch {
      toast("Failed to save question", { duration: 3000 })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget?.id) return
    try {
      const res = await fetch(`${TEMPLATE_ENDPOINT}/${deleteTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isArchived: true }),
      })
      if (res.ok) {
        toast("Question archived", { duration: 2000 })
        setQuestions((prev) => prev.filter((q) => q.id !== deleteTarget.id))
      }
    } catch {
      toast("Failed to archive question", { duration: 3000 })
    } finally {
      setDeleteTarget(null)
    }
  }

  /* ── Custom Group CRUD ── */

  const handleAddGroup = () => {
    setEditingGroup(null)
    setGroupSheetOpen(true)
  }

  const handleEditGroup = (g: CustomGroup) => {
    setEditingGroup(g)
    setGroupSheetOpen(true)
  }

  const handleSaveGroup = async (data: Omit<CustomGroup, "id"> & { id?: number }) => {
    setSavingGroup(true)
    try {
      const isEdit = !!data.id
      const url = isEdit ? `${CUSTOM_GROUP_ENDPOINT}/${data.id}` : CUSTOM_GROUP_ENDPOINT
      const method = isEdit ? "PATCH" : "POST"

      const payload = { ...data, lifemap_sections_id: sectionId }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        toast(isEdit ? "Group updated" : "Group created", { duration: 2000 })
        setGroupSheetOpen(false)
        await loadData()
      } else {
        toast("Failed to save group", { duration: 3000 })
      }
    } catch {
      toast("Failed to save group", { duration: 3000 })
    } finally {
      setSavingGroup(false)
    }
  }

  const handleDeleteGroup = async () => {
    if (!editingGroup?.id) return
    try {
      const res = await fetch(`${CUSTOM_GROUP_ENDPOINT}/${editingGroup.id}`, {
        method: "DELETE",
      })
      if (res.ok) {
        toast("Group deleted", { duration: 2000 })
        setCustomGroups((prev) => prev.filter((g) => g.id !== editingGroup.id))
        setQuestions((prev) =>
          prev.map((q) =>
            q.lifemap_custom_group_id === editingGroup.id
              ? { ...q, lifemap_custom_group_id: null }
              : q
          )
        )
      }
    } catch {
      toast("Failed to delete group", { duration: 3000 })
    }
  }

  const handleTogglePublish = async (q: TemplateQuestion, isPublished: boolean) => {
    if (!q.id) return
    if (!isPublished) {
      setUnpublishTarget(q)
      return
    }
    await doTogglePublish(q.id, true)
  }

  const doTogglePublish = async (questionId: number, isPublished: boolean) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === questionId ? { ...q, isPublished } : q))
    )
    try {
      const res = await fetch(`${TEMPLATE_ENDPOINT}/${questionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished }),
      })

      if (!res.ok) throw new Error("PATCH failed")

      if (isPublished) {
        await fetch(PUBLISH_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }).catch(() => {})
      }

      toast.success(isPublished ? "Question published" : "Question unpublished", { duration: 2000 })
    } catch {
      setQuestions((prev) =>
        prev.map((q) => (q.id === questionId ? { ...q, isPublished: !isPublished } : q))
      )
      toast.error("Failed to update question", { duration: 3000 })
    }
  }

  const handleConfirmUnpublish = async () => {
    if (!unpublishTarget?.id) return
    await doTogglePublish(unpublishTarget.id, false)
    setUnpublishTarget(null)
  }

  const handlePublishAll = async () => {
    const drafts = questions.filter((q) => !q.isPublished && q.id)
    if (drafts.length === 0) {
      toast("All questions are already published", { duration: 2000 })
      return
    }

    setQuestions((prev) => prev.map((q) => ({ ...q, isPublished: true })))
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

      toast(`${drafts.length} question${drafts.length > 1 ? "s" : ""} published`, { duration: 2000 })
    } catch {
      await loadData()
      toast("Failed to publish some questions", { duration: 3000 })
    }
  }

  const handleSaveSectionSettings = async () => {
    setSavingSection(true)
    try {
      const res = await fetch(`${SECTIONS_ENDPOINT}/${sectionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section_description: localDescription, description: localDescription, isLocked }),
      })
      if (!res.ok) throw new Error()

      const reviewRes = await fetch(REVIEW_ENDPOINT)
      if (reviewRes.ok) {
        const allReviews: { id: number; lifemap_sections_id: number }[] = await reviewRes.json()
        const sectionReviews = allReviews.filter((r) => r.lifemap_sections_id === sectionId)
        await Promise.all(
          sectionReviews.map((r) =>
            fetch(`${REVIEW_ENDPOINT}/${r.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ isLocked }),
            })
          )
        )
      }

      savedDescription.current = localDescription
      savedLocked.current = isLocked
      invalidateSectionsCache()
      toast.success("Section settings saved")
      setSectionSettingsOpen(false)
    } catch {
      toast.error("Failed to save section settings")
    } finally {
      setSavingSection(false)
    }
  }

  const draftCount = questions.filter((q) => !q.isPublished).length

  /* ── Drag-and-drop reorder + group assignment ── */

  type FlatItem =
    | { kind: "question"; q: TemplateQuestion; groupId: number | null }
    | { kind: "group"; g: CustomGroup }

  const [dragId, setDragId] = useState<number | null>(null)
  const [dropIndicator, setDropIndicator] = useState<{
    flatIdx: number
    pos: "above" | "below"
  } | null>(null)

  const buildFlatList = useCallback((): FlatItem[] => {
    const list: FlatItem[] = []
    const ungrouped = questions.filter((q) => !q.lifemap_custom_group_id)
    for (const q of ungrouped) list.push({ kind: "question", q, groupId: null })
    for (const g of customGroups) {
      if (!g.id) continue
      list.push({ kind: "group", g })
      const gq = questions.filter((q) => q.lifemap_custom_group_id === g.id)
      for (const q of gq) list.push({ kind: "question", q, groupId: g.id })
    }
    return list
  }, [questions, customGroups])

  const handleDragOver = (e: React.DragEvent, flatIdx: number) => {
    e.preventDefault()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const midY = rect.top + rect.height / 2
    const pos = e.clientY < midY ? "above" : "below"
    setDropIndicator({ flatIdx, pos })
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    if (dragId === null || !dropIndicator) {
      setDragId(null)
      setDropIndicator(null)
      return
    }

    const flat = buildFlatList()
    const draggedFlatIdx = flat.findIndex(
      (item) => item.kind === "question" && item.q.id === dragId
    )
    if (draggedFlatIdx === -1) { setDragId(null); setDropIndicator(null); return }

    const withoutDragged = flat.filter((_, i) => i !== draggedFlatIdx)
    const draggedItem = flat[draggedFlatIdx] as Extract<FlatItem, { kind: "question" }>

    let targetIdx = dropIndicator.flatIdx
    if (draggedFlatIdx < targetIdx) targetIdx -= 1
    const insertIdx = dropIndicator.pos === "below" ? targetIdx + 1 : targetIdx

    withoutDragged.splice(insertIdx, 0, draggedItem)

    let currentGroupId: number | null = null
    const newQuestions: TemplateQuestion[] = []
    for (const item of withoutDragged) {
      if (item.kind === "group") {
        currentGroupId = item.g.id!
      } else {
        newQuestions.push({
          ...item.q,
          lifemap_custom_group_id: currentGroupId,
          sortOrder: newQuestions.length + 1,
        })
      }
    }

    setQuestions(newQuestions)
    setDragId(null)
    setDropIndicator(null)

    const patches: { id: number; sortOrder: number; lifemap_custom_group_id: number | null }[] = []
    for (const nq of newQuestions) {
      const orig = questions.find((oq) => oq.id === nq.id)
      if (
        !orig ||
        orig.sortOrder !== nq.sortOrder ||
        orig.lifemap_custom_group_id !== nq.lifemap_custom_group_id
      ) {
        if (nq.id) patches.push({ id: nq.id, sortOrder: nq.sortOrder, lifemap_custom_group_id: nq.lifemap_custom_group_id })
      }
    }

    if (patches.length > 0) {
      try {
        await Promise.all(
          patches.map((p) =>
            fetch(`${TEMPLATE_ENDPOINT}/${p.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ sortOrder: p.sortOrder, lifemap_custom_group_id: p.lifemap_custom_group_id }),
            })
          )
        )
      } catch {
        // local state is already updated
      }
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-10 w-40" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    )
  }

  const flatList = buildFlatList()
  const COL_COUNT = 4

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">{sectionLabel}</h1>
          <div className="inline-flex size-7 items-center justify-center rounded-md border">
            <HugeiconsIcon
              icon={isLocked ? SquareLock02Icon : SquareUnlock02Icon}
              strokeWidth={2}
              className={`size-4 ${isLocked ? "text-muted-foreground" : "text-green-600"}`}
            />
          </div>
        </div>
        {localDescription && (
          <p className="text-muted-foreground mt-1 text-sm">{localDescription}</p>
        )}
      </div>

      <hr className="border-border -mb-3" />

      <div className="flex items-center justify-between">
        <Button variant="outline" asChild className="gap-2">
          <Link href="/admin/life-map-template">
            <HugeiconsIcon icon={ArrowLeft02Icon} strokeWidth={2} className="size-4" />
            Back
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          {draftCount > 0 && (
            <Button variant="outline" onClick={handlePublishAll} className="gap-2">
              Publish All ({draftCount})
            </Button>
          )}
          <Button variant="outline" onClick={handleAddGroup} className="gap-2">
            <HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="size-4" />
            Add Group
          </Button>
          <Button onClick={handleAdd} className="gap-2">
            <HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="size-4" />
            Add Question
          </Button>
          <Button variant="outline" size="icon" onClick={() => setSectionSettingsOpen(true)} title="Section Settings">
            <HugeiconsIcon icon={Settings02Icon} strokeWidth={2} className="size-4" />
          </Button>
        </div>
      </div>

      {questions.length === 0 && customGroups.length === 0 ? (
        <div className="text-muted-foreground flex flex-col items-center gap-2 py-16">
          <p className="text-sm">No questions configured for this section yet.</p>
          <Button variant="outline" size="sm" onClick={handleAdd} className="mt-2 gap-2">
            <HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="size-4" />
            Add First Question
          </Button>
        </div>
      ) : (
        <div className="rounded-md border" onDragOver={(e) => e.preventDefault()}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Label</TableHead>
                <TableHead className="text-muted-foreground w-[150px] text-xs font-medium uppercase tracking-wide">Type</TableHead>
                <TableHead className="text-muted-foreground w-[90px] text-xs font-medium uppercase tracking-wide">Status</TableHead>
                <TableHead className="text-muted-foreground w-[100px] text-right text-xs font-medium uppercase tracking-wide">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {flatList.map((item, flatIdx) => {
                if (item.kind === "group") {
                  return (
                    <TableRow
                      key={`group-${item.g.id}`}
                      className={`bg-muted/40 hover:bg-muted/40 ${
                        dropIndicator?.flatIdx === flatIdx
                          ? dropIndicator.pos === "above"
                            ? "border-t-primary border-t-2"
                            : "border-b-primary border-b-2"
                          : ""
                      }`}
                      onDragOver={(e) => handleDragOver(e, flatIdx)}
                      onDragLeave={() => setDropIndicator(null)}
                      onDrop={handleDrop}
                    >
                      <TableCell colSpan={COL_COUNT}>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold uppercase tracking-wide">{item.g.group_name}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="ml-auto size-7"
                            onClick={() => handleEditGroup(item.g)}
                            title="Edit group"
                          >
                            <HugeiconsIcon icon={PencilEdit02Icon} strokeWidth={2} className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                }

                const q = item.q
                return (
                  <TableRow
                    key={q.id}
                    onDragOver={(e) => handleDragOver(e, flatIdx)}
                    onDragLeave={() => setDropIndicator(null)}
                    onDrop={handleDrop}
                    onClick={() => handleEdit(q)}
                    className={`cursor-pointer hover:bg-muted/50 [&>td]:py-3 ${
                      dragId === q.id ? "opacity-40" : ""
                    } ${
                      dropIndicator?.flatIdx === flatIdx
                        ? dropIndicator.pos === "above"
                          ? "border-t-primary border-t-2"
                          : "border-b-primary border-b-2"
                        : ""
                    }`}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div
                          draggable
                          onDragStart={(e) => { e.stopPropagation(); q.id && setDragId(q.id) }}
                          onDragEnd={() => { setDragId(null); setDropIndicator(null) }}
                          className="cursor-grab active:cursor-grabbing"
                        >
                          <HugeiconsIcon icon={DragDropIcon} strokeWidth={1.5} className="text-muted-foreground/40 size-3.5 shrink-0" />
                        </div>
                        <span className="text-sm font-medium">{q.field_label || q.field_name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {getTypeName(q, questionTypes)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="icon"
                        className={`size-7 ${q.isPublished ? "border-green-500 text-green-600 hover:bg-green-50" : ""}`}
                        onClick={(e) => { e.stopPropagation(); handleTogglePublish(q, !q.isPublished) }}
                        title={q.isPublished ? "Published — click to unpublish" : "Draft — click to publish"}
                      >
                        {q.isPublished ? (
                          <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} className="size-4" />
                        ) : (
                          <HugeiconsIcon icon={CircleIcon} strokeWidth={1.5} className="text-muted-foreground/40 size-4" />
                        )}
                      </Button>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-7 text-muted-foreground hover:text-red-500"
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget(q) }}
                        title="Archive"
                      >
                        <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} className="size-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <QuestionSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        question={editingQuestion}
        questionTypes={questionTypes}
        customGroups={customGroups}
        saving={saving}
        onSave={handleSave}
      />

      <GroupSheet
        open={groupSheetOpen}
        onOpenChange={setGroupSheetOpen}
        group={editingGroup}
        saving={savingGroup}
        onSave={handleSaveGroup}
        onDelete={handleDeleteGroup}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive question?</AlertDialogTitle>
            <AlertDialogDescription>
              This will hide &ldquo;{deleteTarget?.field_label}&rdquo; from students.
              The question data will be preserved but no longer visible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!unpublishTarget} onOpenChange={(open) => !open && setUnpublishTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} className="text-amber-500 size-5" />
              Unpublish question?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Unpublishing &ldquo;{unpublishTarget?.field_label}&rdquo; will hide it from
              students. Any existing responses will be preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmUnpublish}>
              Unpublish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Sheet open={sectionSettingsOpen} onOpenChange={(open) => {
        if (!open) {
          setLocalDescription(savedDescription.current)
          setIsLocked(savedLocked.current)
        }
        setSectionSettingsOpen(open)
      }}>
        <SheetContent className="flex flex-col gap-0 p-0">
          <SheetHeader className="border-b px-6 py-4">
            <SheetTitle>{sectionLabel}</SheetTitle>
            <SheetDescription className="sr-only">Edit section description and lock status</SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
            <div className="space-y-2">
              <Label htmlFor="section-description">Description</Label>
              <Textarea
                id="section-description"
                value={localDescription}
                onChange={(e) => setLocalDescription(e.target.value)}
                placeholder="Add a description for this section..."
                rows={4}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="section-lock-toggle" className="text-sm font-medium">Lock Section</Label>
                <p className="text-muted-foreground text-xs">
                  Locked sections prevent students from editing responses.
                </p>
              </div>
              <Switch
                id="section-lock-toggle"
                checked={isLocked}
                onCheckedChange={setIsLocked}
              />
            </div>
          </div>

          <div className="border-t px-6 py-4">
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setSectionSettingsOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSaveSectionSettings} disabled={savingSection}>
                {savingSection ? "Saving..." : "Save Settings"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

function QuestionSheet({
  open,
  onOpenChange,
  question,
  questionTypes,
  customGroups,
  saving,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  question: TemplateQuestion | null
  questionTypes: QuestionType[]
  customGroups: CustomGroup[]
  saving: boolean
  onSave: (data: Omit<TemplateQuestion, "id"> & { id?: number }) => Promise<void>
}) {
  const isEdit = !!question
  const [form, setForm] = useState<Omit<TemplateQuestion, "id"> & { id?: number }>(
    question ?? { ...emptyQuestion }
  )
  const [dropdownInput, setDropdownInput] = useState("")
  const [resourceInput, setResourceInput] = useState("")
  const [sentenceStarterInput, setSentenceStarterInput] = useState("")
  const [exampleInput, setExampleInput] = useState("")

  useEffect(() => {
    if (open) {
      setForm(question ?? { ...emptyQuestion })
      setDropdownInput("")
      setResourceInput("")
      setSentenceStarterInput("")
      setExampleInput("")
    }
  }, [open, question])

  const updateField = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const addDropdownOption = () => {
    const trimmed = dropdownInput.trim()
    if (!trimmed || form.dropdownOptions.includes(trimmed)) return
    updateField("dropdownOptions", [...form.dropdownOptions, trimmed])
    setDropdownInput("")
  }

  const removeDropdownOption = (opt: string) => {
    updateField("dropdownOptions", form.dropdownOptions.filter((o) => o !== opt))
  }

  const selectedType = questionTypes.find((t) => t.id === form.question_types_id)
  const selectedTypeName = selectedType?.type ?? ""

  const handleSubmit = () => {
    if (!form.field_label.trim()) {
      toast("Field label is required", { duration: 2000 })
      return
    }
    if (!form.question_types_id) {
      toast("Question type is required", { duration: 2000 })
      return
    }
    const typeName = questionTypes.find((t) => t.id === form.question_types_id)?.type ?? ""
    if ((typeName === "Long Response" || typeName === "Short Response") && (!form.min_words || form.min_words < 1)) {
      toast("Minimum word count is required for response questions", { duration: 2000 })
      return
    }
    const fieldName = form.field_name.trim() || form.field_label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")
    onSave({ ...form, field_name: fieldName })
  }

  const showMinWords = selectedTypeName === "Long Response" || selectedTypeName === "Short Response"
  const showDropdown = selectedTypeName === "Dropdown"

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="shrink-0 border-b px-6 py-4">
          <SheetTitle className="text-base">
            {isEdit ? "Edit Question" : "Add Question"}
          </SheetTitle>
          <SheetDescription className="sr-only">Configure question details</SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <div className="space-y-2">
            <Label>Question Type *</Label>
            <Select
              value={form.question_types_id?.toString() ?? ""}
              onValueChange={(v) => updateField("question_types_id", parseInt(v))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select type..." />
              </SelectTrigger>
              <SelectContent>
                {questionTypes.map((qt) => (
                  <SelectItem key={qt.id} value={qt.id.toString()}>
                    {qt.type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Question Label *</Label>
            <Input
              placeholder="e.g. Why did you choose this housing?"
              value={form.field_label}
              onChange={(e) => updateField("field_label", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Placeholder Text</Label>
            <Input
              placeholder="e.g. Describe your housing situation..."
              value={form.placeholder}
              onChange={(e) => updateField("placeholder", e.target.value)}
            />
          </div>

          {customGroups.length > 0 && (
            <div className="space-y-2">
              <Label>Group</Label>
              <Select
                value={form.lifemap_custom_group_id?.toString() ?? "none"}
                onValueChange={(v) =>
                  updateField("lifemap_custom_group_id", v === "none" ? null : parseInt(v))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="No group" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No group</SelectItem>
                  {customGroups.map((g) => (
                    <SelectItem key={g.id} value={g.id!.toString()}>
                      {g.group_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {showMinWords && (
            <div className="space-y-2">
              <Label>Minimum Word Count *</Label>
              <Input
                type="number"
                min={1}
                value={form.min_words || ""}
                onChange={(e) => updateField("min_words", parseInt(e.target.value) || 0)}
                placeholder="e.g. 50"
              />
            </div>
          )}

          {showDropdown && (
            <div className="space-y-2">
              <Label>Dropdown Options</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Add an option..."
                  value={dropdownInput}
                  onChange={(e) => setDropdownInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      addDropdownOption()
                    }
                  }}
                />
                <Button type="button" variant="outline" size="sm" onClick={addDropdownOption}>
                  Add
                </Button>
              </div>
              {form.dropdownOptions.length > 0 && (
                <div className="space-y-1 pt-2">
                  {form.dropdownOptions.map((opt, idx) => (
                    <div
                      key={opt}
                      className="bg-muted/50 flex items-center justify-between rounded-md border px-3 py-2"
                    >
                      <span className="text-sm">
                        <span className="text-muted-foreground mr-2 text-xs">{idx + 1}.</span>
                        {opt}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeDropdownOption(opt)}
                        className="text-muted-foreground hover:text-destructive ml-2 text-sm transition-colors"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>Detailed Instructions</Label>
            <Textarea
              placeholder="In-depth instructions that open in a side panel for the student..."
              value={form.detailed_instructions}
              onChange={(e) => updateField("detailed_instructions", e.target.value)}
              rows={6}
            />
          </div>

          <div className="space-y-2">
            <Label>Sentence Starters</Label>
            <Textarea
              placeholder="Add a sentence starter..."
              value={sentenceStarterInput}
              onChange={(e) => setSentenceStarterInput(e.target.value)}
              rows={2}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => {
                const trimmed = sentenceStarterInput.trim()
                if (trimmed && !(form.sentence_starters ?? []).includes(trimmed)) {
                  updateField("sentence_starters", [...(form.sentence_starters ?? []), trimmed])
                  setSentenceStarterInput("")
                }
              }}
            >
              Add
            </Button>
            {(form.sentence_starters ?? []).length > 0 && (
              <div className="space-y-1 pt-2">
                {(form.sentence_starters ?? []).map((s, idx) => (
                  <div
                    key={idx}
                    className="bg-muted/50 flex items-center justify-between rounded-md border px-3 py-2"
                  >
                    <span className="text-sm">{s}</span>
                    <button
                      type="button"
                      onClick={() => updateField("sentence_starters", (form.sentence_starters ?? []).filter((_, i) => i !== idx))}
                      className="text-muted-foreground hover:text-destructive ml-2 shrink-0 text-sm transition-colors"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Examples</Label>
            <Textarea
              placeholder="Add an example response..."
              value={exampleInput}
              onChange={(e) => setExampleInput(e.target.value)}
              rows={3}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => {
                const trimmed = exampleInput.trim()
                if (trimmed && !(form.examples ?? []).includes(trimmed)) {
                  updateField("examples", [...(form.examples ?? []), trimmed])
                  setExampleInput("")
                }
              }}
            >
              Add
            </Button>
            {(form.examples ?? []).length > 0 && (
              <div className="space-y-1 pt-2">
                {(form.examples ?? []).map((ex, idx) => (
                  <div
                    key={idx}
                    className="bg-muted/50 flex items-center justify-between rounded-md border px-3 py-2"
                  >
                    <span className="text-sm">{ex}</span>
                    <button
                      type="button"
                      onClick={() => updateField("examples", (form.examples ?? []).filter((_, i) => i !== idx))}
                      className="text-muted-foreground hover:text-destructive ml-2 shrink-0 text-sm transition-colors"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Resources</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Add a URL..."
                value={resourceInput}
                onChange={(e) => setResourceInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    const trimmed = resourceInput.trim()
                    if (trimmed && !form.resources.includes(trimmed)) {
                      updateField("resources", [...form.resources, trimmed])
                      setResourceInput("")
                    }
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const trimmed = resourceInput.trim()
                  if (trimmed && !form.resources.includes(trimmed)) {
                    updateField("resources", [...form.resources, trimmed])
                    setResourceInput("")
                  }
                }}
              >
                Add
              </Button>
            </div>
            {form.resources.length > 0 && (
              <div className="space-y-1 pt-2">
                {form.resources.map((url, idx) => (
                  <div
                    key={idx}
                    className="bg-muted/50 flex items-center justify-between rounded-md border px-3 py-2"
                  >
                    <a href={url} target="_blank" rel="noopener noreferrer" className="truncate text-sm text-blue-600 underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">{url}</a>
                    <button
                      type="button"
                      onClick={() => updateField("resources", form.resources.filter((_, i) => i !== idx))}
                      className="text-muted-foreground hover:text-destructive ml-2 shrink-0 text-sm transition-colors"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Field Name</Label>
            <Input
              placeholder="Auto-generated from label if empty"
              value={form.field_name}
              onChange={(e) => updateField("field_name", e.target.value)}
            />
            <p className="text-muted-foreground text-xs">
              Database field name. Leave empty to auto-generate.
            </p>
          </div>
        </div>

        <div className="shrink-0 border-t px-6 py-4">
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSubmit} disabled={saving}>
              {saving ? "Saving..." : isEdit ? "Update Question" : "Add Question"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function GroupSheet({
  open,
  onOpenChange,
  group,
  saving,
  onSave,
  onDelete,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  group: CustomGroup | null
  saving: boolean
  onSave: (data: Omit<CustomGroup, "id"> & { id?: number }) => Promise<void>
  onDelete: () => Promise<void>
}) {
  const isEdit = !!group
  const [form, setForm] = useState<Omit<CustomGroup, "id"> & { id?: number }>(
    group ?? { ...emptyGroup }
  )
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [groupResourceInput, setGroupResourceInput] = useState("")

  useEffect(() => {
    if (open) {
      setForm(group ?? { ...emptyGroup })
      setConfirmingDelete(false)
      setGroupResourceInput("")
    }
  }, [open, group])

  const handleSubmit = () => {
    if (!form.group_name.trim()) {
      toast("Group name is required", { duration: 2000 })
      return
    }
    onSave(form)
  }

  const handleDelete = async () => {
    await onDelete()
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col gap-0 overflow-y-auto p-0 sm:max-w-md">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle className="text-base">
            {isEdit ? "Edit Group" : "Add Group"}
          </SheetTitle>
          <SheetDescription className="sr-only">Configure group details</SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 px-6 py-5">
          <div className="space-y-2">
            <Label>Group Name *</Label>
            <Input
              placeholder="e.g. Financial Planning"
              value={form.group_name}
              onChange={(e) => setForm((prev) => ({ ...prev, group_name: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              placeholder="Optional description shown to students..."
              value={form.group_description}
              onChange={(e) => setForm((prev) => ({ ...prev, group_description: e.target.value }))}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Instructions</Label>
            <Textarea
              placeholder="Detailed instructions shown in a side panel..."
              value={form.instructions}
              onChange={(e) => setForm((prev) => ({ ...prev, instructions: e.target.value }))}
              rows={5}
            />
          </div>

          <div className="space-y-2">
            <Label>Resources</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Add a URL..."
                value={groupResourceInput}
                onChange={(e) => setGroupResourceInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    const trimmed = groupResourceInput.trim()
                    if (trimmed && !form.resources.includes(trimmed)) {
                      setForm((prev) => ({ ...prev, resources: [...prev.resources, trimmed] }))
                      setGroupResourceInput("")
                    }
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const trimmed = groupResourceInput.trim()
                  if (trimmed && !form.resources.includes(trimmed)) {
                    setForm((prev) => ({ ...prev, resources: [...prev.resources, trimmed] }))
                    setGroupResourceInput("")
                  }
                }}
              >
                Add
              </Button>
            </div>
            {form.resources.length > 0 && (
              <div className="space-y-1 pt-2">
                {form.resources.map((url, idx) => (
                  <div
                    key={idx}
                    className="bg-muted/50 flex items-center justify-between rounded-md border px-3 py-2"
                  >
                    <a href={url} target="_blank" rel="noopener noreferrer" className="truncate text-sm text-blue-600 underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">{url}</a>
                    <button
                      type="button"
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          resources: prev.resources.filter((_, i) => i !== idx),
                        }))
                      }
                      className="text-muted-foreground hover:text-destructive ml-2 shrink-0 text-sm transition-colors"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className="text-muted-foreground text-xs">
              Links shown as clickable cards in the group instruction sheet.
            </p>
          </div>

          {isEdit && (
            <div className="rounded-lg border border-red-200 p-3 dark:border-red-900">
              {confirmingDelete ? (
                <div className="space-y-2">
                  <p className="text-sm text-red-600 dark:text-red-400">
                    Are you sure? Questions in this group will become ungrouped.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleDelete}
                    >
                      Confirm Delete
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setConfirmingDelete(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-red-600 dark:text-red-400">Delete Group</p>
                    <p className="text-muted-foreground text-xs">Remove this group permanently</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950"
                    onClick={() => setConfirmingDelete(true)}
                  >
                    Delete
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border-t px-6 py-4">
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSubmit} disabled={saving}>
              {saving ? "Saving..." : isEdit ? "Update Group" : "Create Group"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
