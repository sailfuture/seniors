"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
  InputGroupTextarea,
} from "@/components/ui/input-group"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { HugeiconsIcon } from "@hugeicons/react"
import { ImageUploadIcon, HelpCircleIcon, InformationCircleIcon } from "@hugeicons/core-free-icons"
import { WordCount } from "./word-count"
import { useSaveRegister } from "@/lib/save-context"
import type { SaveStatus } from "@/lib/form-types"

const XANO_BASE =
  process.env.NEXT_PUBLIC_XANO_API_BASE ??
  "https://xsc3-mvx7-r86m.n7e.xano.io/api:o2_UyOKn"

const TEMPLATE_ENDPOINT = `${XANO_BASE}/lifeplan_template`
const RESPONSES_ENDPOINT = `${XANO_BASE}/lifemap_responses_by_student`
const RESPONSE_PATCH_BASE = `${XANO_BASE}/lifemap_responses`
const CUSTOM_GROUP_ENDPOINT = `${XANO_BASE}/lifemap_custom_group`

interface TemplateQuestion {
  id: number
  field_name: string
  field_label: string
  min_words: number
  placeholder: string
  additional_information: string
  detailed_instructions: string
  lifemap_sections_id: number
  isPublished: boolean
  isArchived: boolean
  question_types_id: number
  lifemap_custom_group_id: number | null
  dropdownOptions: string[]
  sortOrder: number
}

interface CustomGroup {
  id: number
  group_name: string
  group_description: string
  lifemap_sections_id: number
}

interface StudentResponse {
  id: number
  lifemap_template_id: number
  student_response: string
  date_response: string | null
  image_response: Record<string, unknown> | null
  students_id: string
}

const QUESTION_TYPE = {
  LONG_RESPONSE: 1,
  SHORT_RESPONSE: 2,
  CURRENCY: 3,
  IMAGE_UPLOAD: 4,
  DROPDOWN: 5,
  URL: 6,
  DATE: 7,
} as const

interface DynamicFormPageProps {
  title: string
  sectionId: number
}

export function DynamicFormPage({ title, sectionId }: DynamicFormPageProps) {
  const { data: session } = useSession()
  const { register: registerSave, unregister: unregisterSave } = useSaveRegister()
  const [questions, setQuestions] = useState<TemplateQuestion[]>([])
  const [customGroups, setCustomGroups] = useState<CustomGroup[]>([])
  const [responses, setResponses] = useState<Map<number, StudentResponse>>(new Map())
  const [localValues, setLocalValues] = useState<Map<number, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle")
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const dirtyRef = useRef(new Set<number>())

  const studentId = (session?.user as Record<string, unknown>)?.students_id as string | undefined

  const loadData = useCallback(async () => {
    if (!studentId) return

    try {
      const [templateRes, responsesRes, groupsRes] = await Promise.all([
        fetch(TEMPLATE_ENDPOINT),
        fetch(`${RESPONSES_ENDPOINT}?students_id=${studentId}`),
        fetch(CUSTOM_GROUP_ENDPOINT),
      ])

      if (templateRes.ok) {
        const all = (await templateRes.json()) as TemplateQuestion[]
        const filtered = all
          .filter((q) => q.lifemap_sections_id === sectionId && q.isPublished && !q.isArchived)
          .sort((a, b) => a.sortOrder - b.sortOrder)
        setQuestions(filtered)
      }

      if (responsesRes.ok) {
        const data = (await responsesRes.json()) as StudentResponse[]
        const map = new Map<number, StudentResponse>()
        const values = new Map<number, string>()
        for (const r of data) {
          map.set(r.lifemap_template_id, r)
          values.set(r.lifemap_template_id, r.student_response ?? "")
        }
        setResponses(map)
        setLocalValues(values)
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
  }, [studentId, sectionId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const saveAll = useCallback(async () => {
    const dirty = dirtyRef.current
    if (dirty.size === 0) return

    setSaveStatus("saving")
    try {
      const promises = Array.from(dirty).map(async (templateId) => {
        const response = responses.get(templateId)
        const value = localValues.get(templateId) ?? ""

        if (response) {
          await fetch(`${RESPONSE_PATCH_BASE}/${response.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ student_response: value }),
          })
        }
      })

      await Promise.all(promises)
      dirtyRef.current = new Set()
      setSaveStatus("saved")
      setLastSavedAt(new Date())
    } catch {
      setSaveStatus("error")
    }
  }, [responses, localValues])

  const saveNow = useCallback(() => {
    saveAll().then(() => {
      if (dirtyRef.current.size === 0) {
        toast("Changes saved", { duration: 2000 })
      }
    })
  }, [saveAll])

  useEffect(() => {
    registerSave({ saveStatus, saveNow, lastSavedAt })
  }, [saveStatus, saveNow, lastSavedAt, registerSave])

  useEffect(() => {
    return () => unregisterSave()
  }, [unregisterSave])

  useEffect(() => {
    const interval = setInterval(() => {
      if (dirtyRef.current.size > 0) {
        saveAll()
      }
    }, 3 * 60 * 1000)
    return () => clearInterval(interval)
  }, [saveAll])

  useEffect(() => {
    const handleSave = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault()
        saveNow()
      }
    }
    window.addEventListener("keydown", handleSave, true)
    return () => window.removeEventListener("keydown", handleSave, true)
  }, [saveNow])

  const handleChange = (templateId: number, value: string) => {
    setLocalValues((prev) => {
      const next = new Map(prev)
      next.set(templateId, value)
      return next
    })
    dirtyRef.current.add(templateId)
    setSaveStatus("idle")
  }

  const handleImageUpload = async (templateId: number, file: File) => {
    try {
      const { uploadImageToXano } = await import("@/lib/xano")
      const result = await uploadImageToXano(file)
      const imageData = { ...result, meta: result.meta ?? {} }

      const response = responses.get(templateId)
      if (response) {
        await fetch(`${RESPONSE_PATCH_BASE}/${response.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image_response: imageData }),
        })
        setResponses((prev) => {
          const next = new Map(prev)
          next.set(templateId, { ...response, image_response: imageData })
          return next
        })
      }
      toast("Image uploaded", { duration: 2000 })
    } catch {
      toast("Image upload failed", { duration: 3000 })
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        <Skeleton className="h-8 w-48" />
        <Card>
          <CardHeader><Skeleton className="h-5 w-40" /></CardHeader>
          <CardContent>
            <div className="space-y-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i}>
                  <Skeleton className="mb-2 h-4 w-32" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (questions.length === 0) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-muted-foreground">No questions have been published for this section yet.</p>
      </div>
    )
  }

  const ungroupedQuestions = questions.filter((q) => !q.lifemap_custom_group_id)
  const groupedSections = customGroups
    .filter((g) => g.id)
    .map((g) => ({
      group: g,
      questions: questions.filter((q) => q.lifemap_custom_group_id === g.id),
    }))
    .filter((gs) => gs.questions.length > 0)

  const renderQuestionList = (qs: TemplateQuestion[]) => (
    <div className="space-y-8">
      {qs.map((q) => (
        <DynamicField
          key={q.id}
          question={q}
          value={localValues.get(q.id) ?? ""}
          imageValue={responses.get(q.id)?.image_response ?? null}
          onChange={(v) => handleChange(q.id, v)}
          onImageUpload={(file) => handleImageUpload(q.id, file)}
        />
      ))}
    </div>
  )

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <h1 className="text-2xl font-bold">{title}</h1>

      {ungroupedQuestions.length > 0 && (
        <Card>
          <CardContent className="p-6">
            {renderQuestionList(ungroupedQuestions)}
          </CardContent>
        </Card>
      )}

      {groupedSections.map(({ group, questions: gQuestions }) => (
        <Card key={group.id} className="overflow-hidden !pt-0 !gap-0">
          <div className="border-b px-6 py-4">
            <CardTitle className="text-lg">{group.group_name}</CardTitle>
            {group.group_description && (
              <p className="text-muted-foreground mt-1 text-sm">{group.group_description}</p>
            )}
          </div>
          <CardContent className="p-6">
            {renderQuestionList(gQuestions)}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function DynamicField({
  question,
  value,
  imageValue,
  onChange,
  onImageUpload,
}: {
  question: TemplateQuestion
  value: string
  imageValue: Record<string, unknown> | null
  onChange: (value: string) => void
  onImageUpload: (file: File) => void
}) {
  const typeId = question.question_types_id
  const [detailedOpen, setDetailedOpen] = useState(false)

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <Label className="text-muted-foreground text-xs font-medium">{question.field_label}</Label>
        {question.additional_information && (
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" className="text-muted-foreground hover:text-foreground transition-colors">
                <HugeiconsIcon icon={HelpCircleIcon} strokeWidth={1.5} className="size-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent side="top" className="text-sm">
              {question.additional_information}
            </PopoverContent>
          </Popover>
        )}
        {question.detailed_instructions && (
          <>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setDetailedOpen(true)}
            >
              <HugeiconsIcon icon={InformationCircleIcon} strokeWidth={1.5} className="size-4" />
            </button>
            <Sheet open={detailedOpen} onOpenChange={setDetailedOpen}>
              <SheetContent>
                <SheetHeader className="border-b px-6 py-4">
                  <SheetTitle className="text-base">Question Instructions</SheetTitle>
                </SheetHeader>
                <div className="px-6 py-5 space-y-4">
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs uppercase tracking-wide">Question</Label>
                    <p className="text-sm font-medium">{question.field_label}</p>
                  </div>
                  <div className="text-sm whitespace-pre-wrap">{question.detailed_instructions}</div>
                </div>
              </SheetContent>
            </Sheet>
          </>
        )}
      </div>

      {typeId === QUESTION_TYPE.SHORT_RESPONSE && (
        <InputGroup>
          <InputGroupInput
            className="font-semibold"
            placeholder={question.placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        </InputGroup>
      )}

      {typeId === QUESTION_TYPE.LONG_RESPONSE && (
        <InputGroup>
          <InputGroupTextarea
            className="font-semibold"
            placeholder={question.placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={4}
          />
          {question.min_words > 0 && (
            <InputGroupAddon align="block-end">
              <InputGroupText className="text-xs">
                <WordCount value={value} minWords={question.min_words} />
              </InputGroupText>
            </InputGroupAddon>
          )}
        </InputGroup>
      )}

      {typeId === QUESTION_TYPE.CURRENCY && (
        <CurrencyInput value={value} onChange={onChange} />
      )}

      {typeId === QUESTION_TYPE.IMAGE_UPLOAD && (
        <ImageUpload
          imageValue={imageValue}
          onUpload={onImageUpload}
        />
      )}

      {typeId === QUESTION_TYPE.DROPDOWN && (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="w-full font-semibold">
            <SelectValue placeholder={question.placeholder || "Select..."} />
          </SelectTrigger>
          <SelectContent>
            {question.dropdownOptions.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {typeId === QUESTION_TYPE.URL && (
        <InputGroup>
          <InputGroupInput
            className="font-semibold"
            type="url"
            placeholder={question.placeholder || "https://..."}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        </InputGroup>
      )}

      {typeId === QUESTION_TYPE.DATE && (
        <InputGroup>
          <InputGroupInput
            className="font-semibold"
            type="date"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        </InputGroup>
      )}
    </div>
  )
}

function CurrencyInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const numValue = parseInt(value.replace(/[^0-9]/g, ""), 10) || 0
  const display = numValue > 0 ? numValue.toLocaleString("en-US") : ""

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/[^0-9]/g, "")
    const num = digits ? parseInt(digits, 10) : 0
    onChange(num.toString())
  }

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (numValue === 0) {
      e.target.value = ""
    }
    requestAnimationFrame(() => e.target.select())
  }

  return (
    <InputGroup>
      <InputGroupAddon align="inline-start">
        <InputGroupText>$</InputGroupText>
      </InputGroupAddon>
      <InputGroupInput
        className="font-semibold"
        type="text"
        inputMode="numeric"
        placeholder="0"
        value={display}
        onChange={handleChange}
        onFocus={handleFocus}
      />
    </InputGroup>
  )
}

function getImageUrl(value: Record<string, unknown> | null): string | null {
  if (!value || Object.keys(value).length === 0) return null
  if (typeof value.url === "string" && value.url) return value.url
  if (typeof value.path === "string" && value.path) {
    return `https://xsc3-mvx7-r86m.n7e.xano.io${value.path}`
  }
  return null
}

function ImageUpload({
  imageValue,
  onUpload,
}: {
  imageValue: Record<string, unknown> | null
  onUpload: (file: File) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [localPreview, setLocalPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  const savedUrl = getImageUrl(imageValue)
  const preview = localPreview ?? savedUrl

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (ev) => setLocalPreview(ev.target?.result as string)
    reader.readAsDataURL(file)

    setUploading(true)
    try {
      await onUpload(file)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleChange}
      />
      {preview ? (
        <div className="group relative overflow-hidden rounded-lg border">
          <img src={preview} alt="Upload" className="h-40 w-full object-cover" />
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <div className="flex items-center gap-2 rounded-md bg-white/90 px-3 py-1.5 text-xs font-medium text-black">
                <span className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Uploading...
              </div>
            </div>
          )}
          {!uploading && (
            <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                type="button"
                className="rounded-md bg-white/90 px-3 py-1.5 text-xs font-medium text-black"
                onClick={() => inputRef.current?.click()}
              >
                Replace
              </button>
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          className="border-input hover:bg-accent flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 transition-colors"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          <div className="bg-muted flex size-10 items-center justify-center rounded-full">
            <HugeiconsIcon icon={ImageUploadIcon} strokeWidth={1.5} className="text-muted-foreground size-5" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium">Click to upload</p>
            <p className="text-muted-foreground text-xs">PNG, JPG, GIF up to 10MB</p>
          </div>
        </button>
      )}
    </div>
  )
}
