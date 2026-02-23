"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd"
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
import { Badge } from "@/components/ui/badge"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  Delete02Icon,
  PencilEdit02Icon,
  DragDropIcon,
  Alert02Icon,
  CheckmarkCircle02Icon,
  ArrowLeft02Icon,
  SquareLock02Icon,
  SquareUnlock02Icon,
  Settings02Icon,
  EyeIcon,
  ViewOffIcon,
  Archive02Icon,
  ArrowTurnBackwardIcon,
  SentIcon,
} from "@hugeicons/core-free-icons"
import { toast } from "sonner"
import { invalidateSectionsCache } from "@/lib/lifemap-sections"
import { uploadImageToXano, type XanoImageResponse } from "@/lib/xano"
import { LIFEMAP_API_CONFIG, type FormApiConfig } from "@/lib/form-api-config"
import { useBumpSidebar } from "@/lib/refresh-context"

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
  isArchived: boolean
  isPublished: boolean
  isDraft: boolean
  question_types_id: number | null
  dropdownOptions: string[]
  sortOrder: number
  teacher_guideline?: string
  public_display_title?: string
  public_display_description?: string
  width?: number | null
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
  order?: number
  width?: number | null
}

function field<T>(obj: T, key: string): unknown {
  return (obj as unknown as Record<string, unknown>)[key]
}

function numField<T>(obj: T, key: string): number {
  return Number((obj as unknown as Record<string, unknown>)[key])
}

interface GroupDisplayType {
  id: number
  display_type: string
  columns?: number
}

function makeEmptyQuestion(F: FormApiConfig["fields"]): Omit<TemplateQuestion, "id"> {
  return {
    field_name: "",
    field_label: "",
    min_words: 0,
    placeholder: "",
    detailed_instructions: "",
    resources: [],
    examples: [],
    sentence_starters: [],
    [F.sectionId]: null,
    isArchived: false,
    isPublished: false,
    isDraft: true,
    question_types_id: null,
    [F.customGroupId]: null,
    dropdownOptions: [],
    sortOrder: 0,
    teacher_guideline: "",
    public_display_title: "",
    public_display_description: "",
    width: null,
  }
}

function makeEmptyGroup(F: FormApiConfig["fields"]): Omit<CustomGroup, "id"> {
  return {
    group_name: "",
    group_description: "",
    instructions: "",
    resources: [],
    width: null,
    [F.sectionId]: 0,
    [F.displayTypesId]: null,
  }
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
  sectionPhoto?: XanoImageResponse | null
  apiConfig?: FormApiConfig
  templateBasePath?: string
  onSectionsInvalidated?: () => void
  initialEditQuestionId?: number | null
  openNewQuestion?: boolean
}

export function TemplateManager({
  section,
  sectionId,
  sectionLabel,
  sectionDescription: initialDescription,
  sectionLocked: initialLocked,
  sectionPhoto: initialPhoto,
  apiConfig = LIFEMAP_API_CONFIG,
  templateBasePath = "/admin/life-map-template",
  onSectionsInvalidated = invalidateSectionsCache,
  initialEditQuestionId,
  openNewQuestion,
}: TemplateManagerProps) {
  const cfg = apiConfig
  const F = cfg.fields
  const router = useRouter()
  const bumpSidebar = useBumpSidebar()
  const [questions, setQuestions] = useState<TemplateQuestion[]>([])
  const [questionTypes, setQuestionTypes] = useState<QuestionType[]>([])
  const [customGroups, setCustomGroups] = useState<CustomGroup[]>([])
  const [groupDisplayTypes, setGroupDisplayTypes] = useState<GroupDisplayType[]>([])
  const [loading, setLoading] = useState(true)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<TemplateQuestion | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TemplateQuestion | null>(null)
  const [deletingQuestion, setDeletingQuestion] = useState(false)
  const [archiveTarget, setArchiveTarget] = useState<TemplateQuestion | null>(null)
  const [saving, setSaving] = useState(false)

  const [groupSheetOpen, setGroupSheetOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<CustomGroup | null>(null)
  const [savingGroup, setSavingGroup] = useState(false)
  const [deletingGroupOverlay, setDeletingGroupOverlay] = useState(false)
  
  const [hideArchived, setHideArchived] = useState(true)
  const [publishing, setPublishing] = useState(false)
  const [deleteSectionOpen, setDeleteSectionOpen] = useState(false)
  const [deletingSection, setDeletingSection] = useState(false)
  const [lockConfirmOpen, setLockConfirmOpen] = useState(false)
  

  const [localDescription, setLocalDescription] = useState(initialDescription ?? "")
  const [isLocked, setIsLocked] = useState(initialLocked ?? false)
  const [savingSection, setSavingSection] = useState(false)
  const [sectionSettingsOpen, setSectionSettingsOpen] = useState(false)
  const [localPhoto, setLocalPhoto] = useState<XanoImageResponse | null>(initialPhoto ?? null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const savedDescription = useRef(initialDescription ?? "")
  const savedLocked = useRef(initialLocked ?? false)
  const savedPhoto = useRef<XanoImageResponse | null>(initialPhoto ?? null)
  const photoInputRef = useRef<HTMLInputElement>(null)

  const loadData = useCallback(async () => {
    try {
      const [templateRes, typesRes, groupsRes, displayTypesRes] = await Promise.all([
        fetch(cfg.templateEndpoint),
        fetch(cfg.questionTypesEndpoint),
        fetch(cfg.customGroupEndpoint),
        fetch(cfg.groupDisplayTypesEndpoint),
      ])

      if (templateRes.ok) {
        const all = (await templateRes.json()) as TemplateQuestion[]
        const sectionQuestions = all.filter((q) => numField(q, F.sectionId) === sectionId)
        setQuestions(sectionQuestions.sort((a, b) => a.sortOrder - b.sortOrder))
      }

      if (typesRes.ok) {
        setQuestionTypes(await typesRes.json())
      }

      if (groupsRes.ok) {
        const allGroups = (await groupsRes.json()) as CustomGroup[]
        setCustomGroups(allGroups.filter((g) => numField(g, F.sectionId) === sectionId))
      }

      if (displayTypesRes.ok) {
        setGroupDisplayTypes(await displayTypesRes.json())
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false)
    }
  }, [sectionId, cfg, F])

  useEffect(() => {
    loadData()
  }, [loadData])

  const autoOpenedRef = useRef(false)
  useEffect(() => {
    if (autoOpenedRef.current) return
    if (loading) return
    if (initialEditQuestionId && questions.length > 0) {
      const q = questions.find((q) => q.id === initialEditQuestionId)
      if (q) {
        autoOpenedRef.current = true
        setEditingQuestion(q)
        setSheetOpen(true)
      }
    } else if (openNewQuestion) {
      autoOpenedRef.current = true
      setEditingQuestion(null)
      setDefaultGroupId(null)
      setSheetOpen(true)
    }
  }, [initialEditQuestionId, openNewQuestion, loading, questions])

  const [defaultGroupId, setDefaultGroupId] = useState<number | null>(null)

  const handleAdd = (groupId?: number | null) => {
    setEditingQuestion(null)
    setDefaultGroupId(groupId ?? null)
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
      const url = isEdit ? `${cfg.templateEndpoint}/${data.id}` : cfg.templateEndpoint
      const method = isEdit ? "PATCH" : "POST"

      const { _question_types, ...rest } = data as TemplateQuestion & { id?: number }
      const payload = {
        ...rest,
        [F.sectionId]: sectionId,
        sortOrder: isEdit ? data.sortOrder : questions.length + 1,
        ...(!isEdit && { isDraft: true, isPublished: false }),
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        if (isEdit && data.id) {
          try {
            const respRes = await fetch(cfg.responsePatchBase)
            if (respRes.ok) {
              const allResponses = await respRes.json()
              if (Array.isArray(allResponses)) {
                const related = allResponses.filter(
                  (r: Record<string, unknown>) => Number(r[F.templateId]) === data.id
                )
                await Promise.all(
                  related.map((r: { id: number }) =>
                    fetch(`${cfg.responsePatchBase}/${r.id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        [F.customGroupId]: (field(data, F.customGroupId) as number | null) || null,
                        [F.sectionId]: sectionId,
                      }),
                    })
                  )
                )
              }
            }
          } catch { /* ignore response sync errors */ }
        }
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
    setDeletingQuestion(true)
    try {
      const [responsesRes, commentsRes] = await Promise.all([
        fetch(cfg.responsePatchBase),
        fetch(cfg.commentsEndpoint),
      ])

      if (commentsRes.ok) {
        const allComments = await commentsRes.json()
        if (Array.isArray(allComments)) {
          const related = allComments.filter(
            (c: Record<string, unknown>) => Number(c[F.templateId]) === deleteTarget.id
          )
          await Promise.all(
            related.map((c: { id: number }) =>
              fetch(`${cfg.commentsEndpoint}/${c.id}`, { method: "DELETE" })
            )
          )
        }
      }

      if (responsesRes.ok) {
        const allResponses = await responsesRes.json()
        if (Array.isArray(allResponses)) {
          const related = allResponses.filter(
            (r: Record<string, unknown>) => Number(r[F.templateId]) === deleteTarget.id
          )
          await Promise.all(
            related.map((r: { id: number }) =>
              fetch(`${cfg.responsePatchBase}/${r.id}`, { method: "DELETE" })
            )
          )
        }
      }

      const res = await fetch(`${cfg.templateEndpoint}/${deleteTarget.id}`, { method: "DELETE" })
      if (res.ok) {
        toast("Question deleted", { duration: 2000 })
        setQuestions((prev) => prev.filter((q) => q.id !== deleteTarget.id))
      }
    } catch {
      toast("Failed to delete question", { duration: 3000 })
    } finally {
      setDeletingQuestion(false)
      setDeleteTarget(null)
    }
  }

  const handleArchive = async () => {
    if (!archiveTarget?.id) return
    try {
      const res = await fetch(`${cfg.templateEndpoint}/${archiveTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isArchived: true, isPublished: false }),
      })
      if (res.ok) {
        setQuestions((prev) =>
          prev.map((q) => (q.id === archiveTarget.id ? { ...q, isArchived: true, isPublished: false } : q))
        )
        toast("Question archived", { duration: 2000 })
      }
    } catch {
      toast("Failed to archive question", { duration: 3000 })
    } finally {
      setArchiveTarget(null)
    }
  }

  const handleUnarchive = async (q: TemplateQuestion) => {
    if (!q.id) return
    try {
      const res = await fetch(`${cfg.templateEndpoint}/${q.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isArchived: false, isDraft: true }),
      })
      if (res.ok) {
        setQuestions((prev) =>
          prev.map((existing) => (existing.id === q.id ? { ...existing, isArchived: false, isDraft: true } : existing))
        )
        toast("Question unarchived", { duration: 2000 })
      }
    } catch {
      toast("Failed to unarchive question", { duration: 3000 })
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
      const url = isEdit ? `${cfg.customGroupEndpoint}/${data.id}` : cfg.customGroupEndpoint
      const method = isEdit ? "PATCH" : "POST"

      const payload = {
        ...data,
        [F.sectionId]: sectionId,
        ...(!isEdit && { order: customGroups.length + 1 }),
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        const displayTypesIdVal = field(data, F.displayTypesId)
        if (!isEdit && displayTypesIdVal) {
          const created = await res.json()
          const newGroupId = created?.id
          if (newGroupId) {
            const params = new URLSearchParams({
              [F.displayTypesId]: displayTypesIdVal.toString(),
              [F.sectionId]: sectionId.toString(),
              [F.customGroupId]: newGroupId.toString(),
            })
            await fetch(`${cfg.addGroupDisplayTemplateEndpoint}?${params.toString()}`)
          }
        }
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
    setGroupSheetOpen(false)
    setDeletingGroupOverlay(true)
    try {
      const commentsRes = await fetch(cfg.commentsEndpoint)
      if (commentsRes.ok) {
        const allComments = await commentsRes.json()
        if (Array.isArray(allComments)) {
          const groupComments = allComments.filter(
            (c: Record<string, unknown>) =>
              numField(c, F.customGroupId) === editingGroup.id && !field(c, F.templateId)
          )
          await Promise.all(
            groupComments.map((c: { id: number }) =>
              fetch(`${cfg.commentsEndpoint}/${c.id}`, { method: "DELETE" })
            )
          )
        }
      }

      const groupQuestions = questions.filter(
        (q) => numField(q, F.customGroupId) === editingGroup.id
      )
      if (groupQuestions.length > 0) {
        await Promise.all(
          groupQuestions.map((q) =>
            fetch(`${cfg.templateEndpoint}/${q.id}`, { method: "DELETE" })
          )
        )
      }

      const res = await fetch(`${cfg.customGroupEndpoint}/${editingGroup.id}`, {
        method: "DELETE",
      })
      if (res.ok) {
        toast("Group deleted", { duration: 2000 })
        setCustomGroups((prev) => prev.filter((g) => g.id !== editingGroup.id))
        setQuestions((prev) =>
          prev.filter((q) => numField(q, F.customGroupId) !== editingGroup.id)
        )
      }
    } catch {
      toast("Failed to delete group", { duration: 3000 })
    } finally {
      setDeletingGroupOverlay(false)
    }
  }

  const handlePublishDrafts = async () => {
    const drafts = questions.filter((q) => q.isDraft && !q.isArchived)
    if (drafts.length === 0) {
      toast("No drafts to publish", { duration: 2000 })
      return
    }
    setPublishing(true)
    try {
      const res = await fetch(cfg.publishQuestionsEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [F.sectionId]: sectionId }),
      })
      if (!res.ok) throw new Error("Publish failed")
      setQuestions((prev) =>
        prev.map((q) => (q.isDraft && !q.isArchived ? { ...q, isDraft: false, isPublished: true } : q))
      )
      toast.success(`${drafts.length} question${drafts.length > 1 ? "s" : ""} published`, { duration: 2000 })
    } catch {
      toast.error("Failed to publish drafts", { duration: 3000 })
    } finally {
      setPublishing(false)
    }
  }

  const handleSaveSectionSettings = async () => {
    setSavingSection(true)
    try {
      const res = await fetch(`${cfg.sectionsEndpoint}/${sectionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section_description: localDescription, description: localDescription, isLocked, photo: localPhoto }),
      })
      if (!res.ok) throw new Error()

      savedDescription.current = localDescription
      savedLocked.current = isLocked
      savedPhoto.current = localPhoto
      onSectionsInvalidated()
      bumpSidebar()
      toast.success("Section settings saved")
      setSectionSettingsOpen(false)
    } catch {
      toast.error("Failed to save section settings")
    } finally {
      setSavingSection(false)
    }
  }

  const handleDeleteSection = async () => {
    setDeletingSection(true)
    try {
      const [allTemplateRes, allGroupsRes, allCommentsRes, allResponsesRes] = await Promise.all([
        fetch(cfg.templateEndpoint),
        fetch(cfg.customGroupEndpoint),
        fetch(`${cfg.commentsEndpoint}?${F.sectionId}=${sectionId}`),
        fetch(cfg.responsePatchBase),
      ])

      const deleteAll = async (endpoint: string, items: { id: number }[]) => {
        await Promise.all(items.map((item) => fetch(`${endpoint}/${item.id}`, { method: "DELETE" })))
      }

      if (allCommentsRes.ok) {
        const comments = await allCommentsRes.json()
        if (Array.isArray(comments)) {
          const sectionComments = comments.filter((c: Record<string, unknown>) => Number(c[F.sectionId] as number) === sectionId)
          await deleteAll(cfg.commentsEndpoint, sectionComments)
        }
      }

      if (allResponsesRes.ok && allTemplateRes.ok) {
        const allTemplate = await allTemplateRes.json()
        const templateIds = new Set(
          (allTemplate as TemplateQuestion[])
            .filter((q) => numField(q, F.sectionId) === sectionId)
            .map((q) => q.id)
            .filter(Boolean)
        )
        const responses = await allResponsesRes.json()
        if (Array.isArray(responses)) {
          const sectionResponses = responses.filter((r: Record<string, unknown>) => templateIds.has(Number(r[F.templateId] as number)))
          await deleteAll(cfg.responsePatchBase, sectionResponses)
        }

        const sectionQuestions = (allTemplate as TemplateQuestion[]).filter((q) => numField(q, F.sectionId) === sectionId && q.id)
        await deleteAll(cfg.templateEndpoint, sectionQuestions as { id: number }[])
      }

      if (allGroupsRes.ok) {
        const allGroups = await allGroupsRes.json()
        if (Array.isArray(allGroups)) {
          const sectionGroups = allGroups.filter((g: Record<string, unknown>) => Number(g[F.sectionId] as number) === sectionId)
          await deleteAll(cfg.customGroupEndpoint, sectionGroups)
        }
      }

      await fetch(`${cfg.sectionsEndpoint}/${sectionId}`, { method: "DELETE" })

      onSectionsInvalidated()
      bumpSidebar()
      toast.success("Section deleted")
      router.push(templateBasePath)
    } catch {
      toast.error("Failed to delete section")
    } finally {
      setDeletingSection(false)
      setDeleteSectionOpen(false)
    }
  }

  /* ── Drag-and-drop reorder + group assignment ── */

  type FlatItem =
    | { kind: "question"; q: TemplateQuestion; groupId: number | null }
    | { kind: "group"; g: CustomGroup }

  const draftCount = questions.filter((q) => q.isDraft && !q.isArchived).length
  const archivedCount = questions.filter((q) => q.isArchived).length

  const sortPublishedFirst = (a: TemplateQuestion, b: TemplateQuestion) => {
    if (a.isArchived !== b.isArchived) return a.isArchived ? 1 : -1
    return a.sortOrder - b.sortOrder
  }

  const buildFlatList = useCallback((): FlatItem[] => {
    const list: FlatItem[] = []
    const visible = hideArchived ? questions.filter((q) => !q.isArchived) : questions
    const ungrouped = visible.filter((q) => !field(q, F.customGroupId)).sort(sortPublishedFirst)
    for (const q of ungrouped) list.push({ kind: "question", q, groupId: null })
    const sortedGroups = [...customGroups].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    for (const g of sortedGroups) {
      if (!g.id) continue
      list.push({ kind: "group", g })
      const gq = visible.filter((q) => numField(q, F.customGroupId) === g.id).sort(sortPublishedFirst)
      for (const q of gq) list.push({ kind: "question", q, groupId: g.id })
    }
    return list
  }, [questions, customGroups, hideArchived])

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return
    const srcIdx = result.source.index
    const destIdx = result.destination.index
    if (srcIdx === destIdx) return

    const flat = buildFlatList()
    const reordered = Array.from(flat)
    const [removed] = reordered.splice(srcIdx, 1)

    if (removed.kind === "group") {
      const groupId = removed.g.id!
      const children = reordered.filter(
        (item) => item.kind === "question" && numField(item.q, F.customGroupId) === groupId
      )
      const withoutChildren = reordered.filter(
        (item) => !(item.kind === "question" && numField(item.q, F.customGroupId) === groupId)
      )

      const adjustedDest = Math.min(destIdx > srcIdx ? destIdx - children.length : destIdx, withoutChildren.length)
      withoutChildren.splice(adjustedDest, 0, removed, ...children)

      const newGroups: CustomGroup[] = []
      const newQuestions: TemplateQuestion[] = []
      let currentGroupId: number | null = null
      let groupOrder = 0
      for (const item of withoutChildren) {
        if (item.kind === "group") {
          groupOrder++
          currentGroupId = item.g.id!
          newGroups.push({ ...item.g, order: groupOrder })
        } else {
          newQuestions.push({
            ...item.q,
            [F.customGroupId]: currentGroupId,
            sortOrder: newQuestions.length + 1,
          })
        }
      }

      setCustomGroups(newGroups)
      setQuestions(newQuestions)

      try {
        await Promise.all([
          ...newGroups
            .filter((ng) => {
              const orig = customGroups.find((og) => og.id === ng.id)
              return !orig || orig.order !== ng.order
            })
            .filter((ng) => ng.id)
            .map((ng) =>
              fetch(`${cfg.customGroupEndpoint}/${ng.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ order: ng.order }),
              })
            ),
          ...newQuestions
            .filter((nq) => {
              const orig = questions.find((oq) => oq.id === nq.id)
              return !orig || orig.sortOrder !== nq.sortOrder || field(orig, F.customGroupId) !== field(nq, F.customGroupId)
            })
            .filter((nq) => nq.id)
            .map(async (nq) => {
              const payload = { sortOrder: nq.sortOrder, [F.customGroupId]: (field(nq, F.customGroupId) as number | null) || null, [F.sectionId]: sectionId }
              const res = await fetch(`${cfg.templateEndpoint}/${nq.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              })
              if (!res.ok) {
                const errText = await res.text().catch(() => "")
                console.error(`PATCH template/${nq.id} failed (${res.status}):`, errText, "Payload:", payload)
              }
            }),
        ])
      } catch { /* local state already updated */ }
      return
    }

    reordered.splice(destIdx, 0, removed)

    let currentGroupId: number | null = null
    const newQuestions: TemplateQuestion[] = []
    for (const item of reordered) {
      if (item.kind === "group") {
        currentGroupId = item.g.id!
      } else {
        newQuestions.push({
          ...item.q,
          [F.customGroupId]: currentGroupId,
          sortOrder: newQuestions.length + 1,
        })
      }
    }

    setQuestions(newQuestions)

    const patches: { id: number; sortOrder: number; cgId: number | null }[] = []
    for (const nq of newQuestions) {
      const orig = questions.find((oq) => oq.id === nq.id)
      if (!orig || orig.sortOrder !== nq.sortOrder || field(orig, F.customGroupId) !== field(nq, F.customGroupId)) {
        if (nq.id) patches.push({ id: nq.id, sortOrder: nq.sortOrder, cgId: (field(nq, F.customGroupId) as number | null) || null })
      }
    }

    if (patches.length > 0) {
      try {
        await Promise.all(
          patches.map(async (p) => {
            const payload = { sortOrder: p.sortOrder, [F.customGroupId]: p.cgId, [F.sectionId]: sectionId }
            const res = await fetch(`${cfg.templateEndpoint}/${p.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            })
            if (!res.ok) {
              const errText = await res.text().catch(() => "")
              console.error(`PATCH template/${p.id} failed (${res.status}):`, errText, "Payload:", payload)
            }
          })
        )
      } catch { /* local state already updated */ }
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
      {(publishing || deletingGroupOverlay || saving || savingGroup) && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="size-8 animate-spin rounded-full border-4 border-muted-foreground/30 border-t-foreground" />
            <p className="text-sm font-medium">
              {publishing ? "Publishing questions..." : deletingGroupOverlay ? "Deleting group..." : "Saving..."}
            </p>
          </div>
        </div>,
        document.body
      )}
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
          <Link href={templateBasePath}>
            <HugeiconsIcon icon={ArrowLeft02Icon} strokeWidth={2} className="size-4" />
            Back
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="text-muted-foreground hover:text-red-500"
            onClick={() => setDeleteSectionOpen(true)}
            title="Delete Section"
          >
            <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} className="size-4" />
          </Button>
          {archivedCount > 0 && (
            <Button
              variant={hideArchived ? "secondary" : "outline"}
              size="icon"
              onClick={() => setHideArchived(!hideArchived)}
              title={hideArchived ? "Show archived questions" : "Hide archived questions"}
            >
              <HugeiconsIcon icon={hideArchived ? ViewOffIcon : EyeIcon} strokeWidth={2} className="size-4" />
            </Button>
          )}
          {draftCount > 0 && (
            <Button
              variant="outline"
              onClick={handlePublishDrafts}
              disabled={publishing}
              className="gap-2"
            >
              <HugeiconsIcon icon={SentIcon} strokeWidth={2} className="size-4" />
              {publishing ? "Publishing..." : `Publish (${draftCount})`}
            </Button>
          )}
          <Button variant="outline" onClick={handleAddGroup} className="gap-2">
            <HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="size-4" />
            Add Group
          </Button>
          <Button onClick={() => handleAdd()} className="gap-2">
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
          <Button variant="outline" size="sm" onClick={() => handleAdd()} className="mt-2 gap-2">
            <HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="size-4" />
            Add First Question
          </Button>
        </div>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="template-list">
            {(droppableProvided) => (
              <div className="rounded-md border" ref={droppableProvided.innerRef} {...droppableProvided.droppableProps}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Label</TableHead>
                      <TableHead className="text-muted-foreground w-[90px] text-xs font-medium uppercase tracking-wide">Status</TableHead>
                      <TableHead className="text-muted-foreground w-[150px] text-xs font-medium uppercase tracking-wide">Type</TableHead>
                      <TableHead className="text-muted-foreground w-[100px] text-right text-xs font-medium uppercase tracking-wide">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {flatList.map((item, flatIdx) => {
                      const draggableId = item.kind === "group" ? `group-${item.g.id}` : `question-${item.q.id}`
                      return (
                        <Draggable key={draggableId} draggableId={draggableId} index={flatIdx}>
                          {(provided, snapshot) => {
                            if (item.kind === "group") {
                              return (
                                <TableRow
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  className={`bg-muted/40 hover:bg-muted/40 ${snapshot.isDragging ? "opacity-70 shadow-lg" : ""}`}
                                >
                                  <TableCell colSpan={COL_COUNT}>
                                    <div className="flex items-center gap-2">
                                      <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing">
                                        <HugeiconsIcon icon={DragDropIcon} strokeWidth={1.5} className="text-muted-foreground/40 size-3.5 shrink-0" />
                                      </div>
                                      <span className="text-xs font-semibold uppercase tracking-wide">{item.g.group_name}</span>
                                      {!!field(item.g, F.displayTypesId) && (() => {
                                        const dt = groupDisplayTypes.find((t) => t.id === numField(item.g, F.displayTypesId))
                                        return dt ? (
                                          <Badge variant="outline" className="gap-1 text-[10px] font-medium">
                                            <HugeiconsIcon icon={SquareLock02Icon} strokeWidth={2} className="size-3" />
                                            {dt.display_type}
                                          </Badge>
                                        ) : null
                                      })()}
                                      <div className="ml-auto flex items-center gap-1">
                                        {!field(item.g, F.displayTypesId) && (
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="size-7"
                                            onClick={() => handleAdd(item.g.id)}
                                            title="Add question to group"
                                          >
                                            <HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="size-3.5" />
                                          </Button>
                                        )}
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="size-7"
                                          onClick={() => handleEditGroup(item.g)}
                                          title="Edit group"
                                        >
                                          <HugeiconsIcon icon={PencilEdit02Icon} strokeWidth={2} className="size-3.5" />
                                        </Button>
                                      </div>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )
                            }

                            const q = item.q
                            return (
                              <TableRow
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                onClick={() => handleEdit(q)}
                                className={`cursor-pointer hover:bg-muted/50 [&>td]:py-3 ${
                                  q.isArchived ? "bg-muted/40 text-muted-foreground" : ""
                                } ${snapshot.isDragging ? "opacity-70 shadow-lg" : ""}`}
                              >
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing">
                                      <HugeiconsIcon icon={DragDropIcon} strokeWidth={1.5} className="text-muted-foreground/40 size-3.5 shrink-0" />
                                    </div>
                                    <span className="text-sm font-medium">{q.field_label || q.field_name}</span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="inline-flex size-7 items-center justify-center" title={q.isArchived ? "Archived" : q.isDraft ? "Draft" : q.isPublished ? "Published" : "Unpublished"}>
                                    {q.isArchived ? (
                                      <HugeiconsIcon icon={SquareLock02Icon} strokeWidth={1.5} className="text-muted-foreground/60 size-4" />
                                    ) : q.isDraft || !q.isPublished ? (
                                      <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} className="size-4 text-amber-500" />
                                    ) : (
                                      <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} className="size-4 text-green-600" />
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-muted-foreground text-sm">
                                  {getTypeName(q, questionTypes)}
                                </TableCell>
                                <TableCell className="text-right">
                                  {q.isArchived ? (
                                    <div className="flex items-center justify-end gap-1">
                                      <Button
                                        variant="outline"
                                        size="icon"
                                        className="size-7 text-muted-foreground hover:text-foreground"
                                        onClick={(e) => { e.stopPropagation(); handleUnarchive(q) }}
                                        title="Unarchive"
                                      >
                                        <HugeiconsIcon icon={ArrowTurnBackwardIcon} strokeWidth={2} className="size-3.5" />
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="icon"
                                        className="size-7 text-muted-foreground hover:text-red-500"
                                        onClick={(e) => { e.stopPropagation(); setDeleteTarget(q) }}
                                        title="Delete permanently"
                                      >
                                        <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} className="size-3.5" />
                                      </Button>
                                    </div>
                                  ) : (
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      className="size-7 text-muted-foreground hover:text-amber-500"
                                      onClick={(e) => { e.stopPropagation(); setArchiveTarget(q) }}
                                      title="Archive"
                                    >
                                      <HugeiconsIcon icon={Archive02Icon} strokeWidth={2} className="size-3.5" />
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>
                            )
                          }}
                        </Draggable>
                      )
                    })}
                    {droppableProvided.placeholder}
                  </TableBody>
                </Table>
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}

      <QuestionSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        question={editingQuestion}
        questionTypes={questionTypes}
        customGroups={customGroups}
        saving={saving}
        onSave={handleSave}
        defaultGroupId={defaultGroupId}
        fields={F}
      />

      <GroupSheet
        open={groupSheetOpen}
        onOpenChange={setGroupSheetOpen}
        group={editingGroup}
        saving={savingGroup}
        onSave={handleSaveGroup}
        onDelete={handleDeleteGroup}
        groupDisplayTypes={groupDisplayTypes}
        fields={F}
      />

      <AlertDialog open={!!archiveTarget} onOpenChange={(open) => !open && setArchiveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <HugeiconsIcon icon={Archive02Icon} strokeWidth={2} className="text-amber-500 size-5" />
              Archive question?
            </AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{archiveTarget?.field_label}&rdquo; will be archived and hidden from students.
              You can unarchive it later, or permanently delete it from the archive.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive}>
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!deletingQuestion && !open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} className="size-5 text-red-500" />
              Permanently delete question?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &ldquo;{deleteTarget?.field_label}&rdquo; along with
              all associated student responses and comments. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingQuestion}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deletingQuestion}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2"
            >
              {deletingQuestion && (
                <div className="size-4 animate-spin rounded-full border-2 border-destructive-foreground/30 border-t-destructive-foreground" />
              )}
              {deletingQuestion ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Sheet open={sectionSettingsOpen} onOpenChange={(open) => {
        if (!open) {
          setLocalDescription(savedDescription.current)
          setIsLocked(savedLocked.current)
          setLocalPhoto(savedPhoto.current)
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

            <div className="space-y-2">
              <Label>Section Photo</Label>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  setUploadingPhoto(true)
                  try {
                    const uploaded = await uploadImageToXano(file, cfg.uploadEndpoint)
                    setLocalPhoto(uploaded)
                    toast.success("Photo uploaded")
                  } catch {
                    toast.error("Failed to upload photo")
                  } finally {
                    setUploadingPhoto(false)
                    if (photoInputRef.current) photoInputRef.current.value = ""
                  }
                }}
              />
              {localPhoto?.path ? (
                <div className="space-y-2">
                  <div className="relative overflow-hidden rounded-md border">
                    <img
                      src={localPhoto.path.startsWith("http") ? localPhoto.path : `https://xsc3-mvx7-r86m.n7e.xano.io${localPhoto.path}`}
                      alt="Section photo"
                      className="h-40 w-full object-cover"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={uploadingPhoto}
                      onClick={() => photoInputRef.current?.click()}
                    >
                      {uploadingPhoto ? "Uploading..." : "Replace"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setLocalPhoto(null)}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  disabled={uploadingPhoto}
                  onClick={() => photoInputRef.current?.click()}
                >
                  {uploadingPhoto ? "Uploading..." : "Upload Photo"}
                </Button>
              )}
            </div>
          </div>

          <div className="border-t px-6 py-4">
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="icon"
                className={isLocked ? "text-muted-foreground" : "text-green-600"}
                onClick={() => setLockConfirmOpen(true)}
                title={isLocked ? "Section is locked — click to unlock" : "Section is unlocked — click to lock"}
              >
                <HugeiconsIcon icon={isLocked ? SquareLock02Icon : SquareUnlock02Icon} strokeWidth={2} className="size-4" />
              </Button>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => setSectionSettingsOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveSectionSettings} disabled={savingSection}>
                  {savingSection ? "Saving..." : "Save Settings"}
                </Button>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={lockConfirmOpen} onOpenChange={setLockConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isLocked ? "Unlock" : "Lock"} {sectionLabel}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isLocked
                ? "Unlocking this section will allow students to edit their responses."
                : "Locking this section will prevent students from editing their responses."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setIsLocked(!isLocked); setLockConfirmOpen(false) }}>
              {isLocked ? "Unlock Section" : "Lock Section"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteSectionOpen} onOpenChange={setDeleteSectionOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} className="size-5 text-red-500" />
              Delete &ldquo;{sectionLabel}&rdquo;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this section and all of its questions, student responses, groups, reviews, and comments. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingSection}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSection}
              disabled={deletingSection}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2"
            >
              {deletingSection && (
                <div className="size-4 animate-spin rounded-full border-2 border-destructive-foreground/30 border-t-destructive-foreground" />
              )}
              {deletingSection ? "Deleting..." : "Delete Section"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
  defaultGroupId,
  fields: F,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  question: TemplateQuestion | null
  questionTypes: QuestionType[]
  customGroups: CustomGroup[]
  saving: boolean
  onSave: (data: Omit<TemplateQuestion, "id"> & { id?: number }) => Promise<void>
  defaultGroupId?: number | null
  fields: FormApiConfig["fields"]
}) {
  const isEdit = !!question
  const [form, setForm] = useState<Omit<TemplateQuestion, "id"> & { id?: number }>(
    question ?? { ...makeEmptyQuestion(F) }
  )
  const [dropdownInput, setDropdownInput] = useState("")
  const [resourceInput, setResourceInput] = useState("")
  const [sentenceStarterInput, setSentenceStarterInput] = useState("")
  const [exampleInput, setExampleInput] = useState("")

  useEffect(() => {
    if (open) {
      const base = question ?? { ...makeEmptyQuestion(F) }
      if (!question && defaultGroupId) {
        ;(base as unknown as Record<string, unknown>)[F.customGroupId] = defaultGroupId
      }
      setForm(base)
      setDropdownInput("")
      setResourceInput("")
      setSentenceStarterInput("")
      setExampleInput("")
    }
  }, [open, question, defaultGroupId])

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
    if (typeName === "Long Response" && (!form.min_words || form.min_words < 1)) {
      toast("Minimum word count is required for long response questions", { duration: 2000 })
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
            <Textarea
              placeholder="e.g. Why did you choose this housing?"
              value={form.field_label}
              onChange={(e) => updateField("field_label", e.target.value)}
              rows={3}
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

          {customGroups.filter((g) => !field(g, F.displayTypesId)).length > 0 && (
            <div className="space-y-2">
              <Label>Group</Label>
              <Select
                value={(field(form, F.customGroupId) as number | null)?.toString() ?? "none"}
                onValueChange={(v) =>
                  setForm((prev) => ({ ...prev, [F.customGroupId]: v === "none" ? null : parseInt(v) }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="No group" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No group</SelectItem>
                  {customGroups.filter((g) => !field(g, F.displayTypesId)).map((g) => (
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
              <Label>Minimum Word Count {selectedTypeName === "Long Response" ? "*" : "(optional)"}</Label>
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
            <Label>Teacher Guideline</Label>
            <Textarea
              placeholder="Internal guideline visible only to teachers when reviewing this question..."
              value={form.teacher_guideline ?? ""}
              onChange={(e) => updateField("teacher_guideline", e.target.value)}
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label>Public Display Title</Label>
            <Input
              placeholder="Title shown on the public Life Map page..."
              value={form.public_display_title ?? ""}
              onChange={(e) => updateField("public_display_title", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Public Display Description</Label>
            <Textarea
              placeholder="Description shown on the public Life Map page..."
              value={form.public_display_description ?? ""}
              onChange={(e) => updateField("public_display_description", e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Display Width</Label>
            <Select
              value={form.width != null ? String(form.width) : "default"}
              onValueChange={(v) => updateField("width", v === "default" ? null : Number(v))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Default" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Default</SelectItem>
                <SelectItem value="6">Full width</SelectItem>
                <SelectItem value="3">Half width</SelectItem>
                <SelectItem value="2">Third width</SelectItem>
              </SelectContent>
            </Select>
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
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
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
  groupDisplayTypes,
  fields: F,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  group: CustomGroup | null
  saving: boolean
  onSave: (data: Omit<CustomGroup, "id"> & { id?: number }) => Promise<void>
  onDelete: () => Promise<void>
  groupDisplayTypes: GroupDisplayType[]
  fields: FormApiConfig["fields"]
}) {
  const isEdit = !!group
  const [form, setForm] = useState<Omit<CustomGroup, "id"> & { id?: number }>(
    group ?? { ...makeEmptyGroup(F) }
  )
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deletingGroup, setDeletingGroup] = useState(false)
  const [groupResourceInput, setGroupResourceInput] = useState("")

  useEffect(() => {
    if (open) {
      setForm(group ?? { ...makeEmptyGroup(F) })
      setConfirmingDelete(false)
      setDeletingGroup(false)
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
    setDeletingGroup(true)
    try {
      await onDelete()
      onOpenChange(false)
    } finally {
      setDeletingGroup(false)
    }
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

          {!isEdit && groupDisplayTypes.length > 0 && (
            <div className="space-y-2">
              <Label>Group Template</Label>
              <Select
                value={(field(form, F.displayTypesId) as number | null)?.toString() ?? "none"}
                onValueChange={(v) =>
                  setForm((prev) => ({
                    ...prev,
                    [F.displayTypesId]: v === "none" ? null : parseInt(v),
                  }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="No template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No template</SelectItem>
                  {groupDisplayTypes.map((dt) => (
                    <SelectItem key={dt.id} value={dt.id.toString()}>
                      {dt.display_type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">
                Selecting a template will auto-populate questions for this group.
              </p>
            </div>
          )}

          {isEdit && !!field(group, F.displayTypesId) && (() => {
            const dt = groupDisplayTypes.find((t) => t.id === numField(group!, F.displayTypesId))
            return dt ? (
              <div className="space-y-2">
                <Label>Group Template</Label>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <HugeiconsIcon icon={SquareLock02Icon} strokeWidth={2} className="size-3.5" />
                  {dt.display_type}
                </div>
              </div>
            ) : null
          })()}

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

          <div className="space-y-2">
            <Label>Public Page Width</Label>
            <Select
              value={form.width?.toString() ?? "default"}
              onValueChange={(v) =>
                setForm((prev) => ({
                  ...prev,
                  width: v === "default" ? null : parseInt(v),
                }))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Default (half width)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Default (half width)</SelectItem>
                <SelectItem value="1">Full width (100%)</SelectItem>
                <SelectItem value="2">Half width (50%)</SelectItem>
                <SelectItem value="3">Third width (33%)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">
              Controls the column width of this group on the public page. Desktop/tablet only.
            </p>
          </div>

        </div>

        <div className="border-t px-6 py-4">
          <div className="flex items-center justify-between">
            {isEdit ? (
              <Button
                variant="outline"
                size="icon"
                className="text-muted-foreground hover:text-red-500"
                onClick={() => setConfirmingDelete(true)}
                title="Delete Group"
              >
                <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} className="size-4" />
              </Button>
            ) : (
              <div />
            )}
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={saving}>
                {saving ? "Saving..." : isEdit ? "Update Group" : "Create Group"}
              </Button>
            </div>
          </div>
        </div>

        <AlertDialog open={confirmingDelete} onOpenChange={(v) => { if (!deletingGroup) setConfirmingDelete(v) }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete group?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete this group and all questions within it.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deletingGroup}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={deletingGroup}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2"
              >
                {deletingGroup && (
                  <div className="size-4 animate-spin rounded-full border-2 border-destructive-foreground/30 border-t-destructive-foreground" />
                )}
                {deletingGroup ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  )
}
