export interface FieldConfig {
  name: string
  type: "text" | "textarea" | "number" | "select" | "date" | "image" | "hidden"
  label?: string
  placeholder?: string
  options?: string[]
  minWords?: number
  required?: boolean
  section: string
  columns?: 2 | 3
}

export interface FormSection {
  title: string
  fields: string[]
}

export interface FormPageConfig {
  xanoEndpoint: string
  xanoLoadEndpoint?: string
  fields: FieldConfig[]
  sections: FormSection[]
  defaultValues: Record<string, unknown>
}

export type SaveStatus = "idle" | "saving" | "saved" | "error"

export interface Comment {
  id?: number
  teachers_id: number | null
  students_id: number | null
  field_name: string
  lifemap_sections_id?: number | null
  lifemap_custom_group_id?: number | null
  isOld: boolean
  isComplete?: boolean
  isRevisionFeedback?: boolean
  isRead?: string | number | null
  note: string
  teacher_name?: string
  created_at?: string
}

export type SectionStatus = "empty" | "in-progress" | "complete"

export function getWordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

export function isFieldComplete(
  field: FieldConfig,
  value: unknown
): boolean {
  if (field.type === "hidden") return true

  if (field.type === "textarea" && field.minWords) {
    return getWordCount(String(value ?? "")) >= field.minWords
  }

  if (field.type === "number") {
    return typeof value === "number" && value > 0
  }

  if (field.type === "image") {
    return value != null && typeof value === "object" && Object.keys(value as object).length > 0
  }

  if (field.required) {
    return value != null && String(value).trim() !== ""
  }

  return value != null && String(value).trim() !== ""
}

export function getSectionStatus(
  section: FormSection,
  fields: FieldConfig[],
  values: Record<string, unknown>
): SectionStatus {
  const sectionFields = fields.filter((f) =>
    section.fields.includes(f.name) && f.type !== "hidden"
  )

  if (sectionFields.length === 0) return "complete"

  const completionResults = sectionFields.map((f) =>
    isFieldComplete(f, values[f.name])
  )

  const hasAnyValue = sectionFields.some((f) => {
    const v = values[f.name]
    if (v == null) return false
    if (typeof v === "number") return v > 0
    return String(v).trim() !== ""
  })

  if (!hasAnyValue) return "empty"
  if (completionResults.every(Boolean)) return "complete"
  return "in-progress"
}
