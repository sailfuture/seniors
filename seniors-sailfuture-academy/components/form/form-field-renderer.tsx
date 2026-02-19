"use client"

import { useRef, useState } from "react"
import { useFormContext, Controller } from "react-hook-form"
import { toast } from "sonner"
import type { FieldConfig, Comment } from "@/lib/form-types"
import { Label } from "@/components/ui/label"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
  InputGroupTextarea,
} from "@/components/ui/input-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { HugeiconsIcon } from "@hugeicons/react"
import { ImageUploadIcon } from "@hugeicons/core-free-icons"
import { WordCount } from "./word-count"
import { CommentBadge } from "./comment-badge"

interface FormFieldRendererProps {
  field: FieldConfig
  comments: Comment[]
  onMarkRead?: (ids: number[]) => void
}

export function FormFieldRenderer({
  field,
  comments,
  onMarkRead,
}: FormFieldRendererProps) {
  const { register, control, setValue, watch } = useFormContext()

  if (field.type === "hidden") return null

  const fieldComments = comments.filter(
    (c) => c.field_name === field.name && !c.isComplete
  )
  const hasComments = fieldComments.length > 0
  const rawValue = watch(field.name)
  const displayValue =
    rawValue != null && rawValue !== "" ? String(rawValue) : ""

  return (
    <div className="relative space-y-2">
      {field.label && (
        <div className="flex items-center justify-between">
          <Label htmlFor={field.name}>{field.label}</Label>
          {hasComments ? (
            <CommentBadge
              fieldName={field.name}
              fieldLabel={field.label ?? field.name}
              fieldValue={displayValue}
              minWords={field.minWords}
              comments={comments}
              onMarkRead={onMarkRead}
            />
          ) : (
            <span className="inline-block size-6" />
          )}
        </div>
      )}

      {field.type === "textarea" && (
        <TextareaField field={field} comments={comments} onMarkRead={onMarkRead} />
      )}

      {field.type === "text" && (
        <InputGroup>
          <InputGroupInput
            id={field.name}
            placeholder={field.placeholder}
            {...register(field.name)}
          />
        </InputGroup>
      )}

      {field.type === "number" && (
        <CurrencyField field={field} />
      )}

      {field.type === "select" && (
        <Controller
          name={field.name}
          control={control}
          render={({ field: controllerField }) => (
            <Select
              value={controllerField.value as string}
              onValueChange={controllerField.onChange}
            >
              <SelectTrigger id={field.name} className="w-full">
                <SelectValue placeholder={field.placeholder ?? "Select..."} />
              </SelectTrigger>
              <SelectContent>
                {field.options?.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      )}

      {field.type === "date" && (
        <Input
          id={field.name}
          type="date"
          {...register(field.name)}
        />
      )}

      {field.type === "image" && (
        <ImageUploadField field={field} setValue={setValue} />
      )}
    </div>
  )
}

function TextareaField({
  field,
  comments,
  onMarkRead,
}: {
  field: FieldConfig
  comments: Comment[]
  onMarkRead?: (ids: number[]) => void
}) {
  const { register } = useFormContext()

  return (
    <InputGroup>
      <InputGroupTextarea
        id={field.name}
        placeholder={field.placeholder}
        rows={4}
        {...register(field.name)}
      />
      {field.minWords && (
        <InputGroupAddon align="block-end">
          <InputGroupText className="text-xs">
            <WordCountWatcher name={field.name} minWords={field.minWords} />
          </InputGroupText>
        </InputGroupAddon>
      )}
    </InputGroup>
  )
}

function formatWithCommas(n: number): string {
  return n.toLocaleString("en-US")
}

function stripNonNumeric(s: string): string {
  return s.replace(/[^0-9]/g, "")
}

function CurrencyField({ field }: { field: FieldConfig }) {
  const { setValue, watch } = useFormContext()
  const rawValue = watch(field.name)
  const [displayValue, setDisplayValue] = useState(() => {
    const num = typeof rawValue === "number" ? rawValue : 0
    return num > 0 ? formatWithCommas(num) : ""
  })
  const [isFocused, setIsFocused] = useState(false)

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true)
    const num = typeof rawValue === "number" ? rawValue : 0
    if (num === 0) {
      setDisplayValue("")
      e.target.value = ""
    }
    requestAnimationFrame(() => e.target.select())
  }

  const handleBlur = () => {
    setIsFocused(false)
    const digits = stripNonNumeric(displayValue)
    const num = digits ? parseInt(digits, 10) : 0
    setValue(field.name, num, { shouldDirty: true })
    setDisplayValue(num > 0 ? formatWithCommas(num) : "")
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value
    const digits = stripNonNumeric(input)
    const num = digits ? parseInt(digits, 10) : 0
    setValue(field.name, num, { shouldDirty: true })
    setDisplayValue(digits ? formatWithCommas(num) : "")
  }

  return (
    <InputGroup>
      <InputGroupAddon align="inline-start">
        <InputGroupText>$</InputGroupText>
      </InputGroupAddon>
      <InputGroupInput
        id={field.name}
        type="text"
        inputMode="numeric"
        placeholder="0"
        value={displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
      />
    </InputGroup>
  )
}

function getImageUrl(value: unknown): string | null {
  if (!value || typeof value !== "object" || value instanceof File) return null
  const obj = value as Record<string, unknown>
  if (typeof obj.url === "string" && obj.url) return obj.url
  if (typeof obj.path === "string" && obj.path) {
    return `https://xsc3-mvx7-r86m.n7e.xano.io${obj.path}`
  }
  return null
}

function ImageUploadField({
  field,
  setValue,
}: {
  field: FieldConfig
  setValue: (name: string, value: unknown) => void
}) {
  const { watch } = useFormContext()
  const inputRef = useRef<HTMLInputElement>(null)
  const [localPreview, setLocalPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const formValue = watch(field.name)
  const savedUrl = getImageUrl(formValue)
  const preview = localPreview ?? savedUrl

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (ev) => setLocalPreview(ev.target?.result as string)
    reader.readAsDataURL(file)

    setUploading(true)
    setError(null)

    try {
      const { uploadImageToXano } = await import("@/lib/xano")
      const result = await uploadImageToXano(file)
      setValue(field.name, { ...result, meta: result.meta ?? {} })
      toast("Image uploaded")
    } catch (err) {
      setError("Upload failed. Please try again.")
      setLocalPreview(null)
      setValue(field.name, null)
      toast("Image upload failed", {
        description: err instanceof Error ? err.message : "Please try again.",
        duration: 4000,
      })
    } finally {
      setUploading(false)
    }
  }

  const handleRemove = () => {
    setLocalPreview(null)
    setError(null)
    setValue(field.name, null)
    if (inputRef.current) inputRef.current.value = ""
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
          <img
            src={preview}
            alt={field.label ?? "Upload"}
            className="h-40 w-full object-cover"
          />
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
              <button
                type="button"
                className="rounded-md bg-red-500/90 px-3 py-1.5 text-xs font-medium text-white"
                onClick={handleRemove}
              >
                Remove
              </button>
            </div>
          )}
        </div>
      ) : (
        <div>
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
          {error && (
            <p className="text-destructive mt-1 text-xs">{error}</p>
          )}
        </div>
      )}
    </div>
  )
}

function WordCountWatcher({ name, minWords }: { name: string; minWords: number }) {
  const { watch } = useFormContext()
  const value = watch(name) ?? ""
  return <WordCount value={String(value)} minWords={minWords} />
}
