"use client"

import { useCallback, useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import type { FormPageConfig, Comment } from "@/lib/form-types"
import { getWordCount } from "@/lib/form-types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { TeacherComment } from "./teacher-comment"

const XANO_BASE =
  process.env.NEXT_PUBLIC_XANO_API_BASE ??
  "https://xsc3-mvx7-r86m.n7e.xano.io/api:o2_UyOKn"

const COMMENTS_ENDPOINT = `${XANO_BASE}/lifemap_comments`

interface ReadOnlyFormPageProps {
  title: string
  subtitle?: string
  config: FormPageConfig
  studentId: string
  sectionId?: number
  headerContent?: React.ReactNode
}

function getImageUrl(value: unknown): string | null {
  if (!value || typeof value !== "object") return null
  const obj = value as Record<string, unknown>
  if (typeof obj.url === "string" && obj.url) return obj.url
  if (typeof obj.path === "string" && obj.path) {
    return `https://xsc3-mvx7-r86m.n7e.xano.io${obj.path}`
  }
  return null
}

function formatCurrency(value: unknown): string {
  const num = typeof value === "number" ? value : 0
  return `$${num.toLocaleString("en-US")}`
}

function getDisplayValue(value: unknown, type: string): string {
  if (type === "image") return ""
  if (type === "number") return formatCurrency(value)
  return value != null && value !== "" ? String(value) : "—"
}

function ReadOnlyField({
  label,
  value,
  type,
  minWords,
}: {
  label: string
  value: unknown
  type: string
  minWords?: number
}) {
  if (type === "hidden") return null

  if (type === "image") {
    const url = getImageUrl(value)
    return (
      <div className="space-y-2">
        {url ? (
          <img
            src={url}
            alt={label}
            className="h-40 w-full rounded-lg border object-cover"
          />
        ) : (
          <div className="text-muted-foreground flex h-32 items-center justify-center rounded-lg border border-dashed text-sm">
            No image uploaded
          </div>
        )}
      </div>
    )
  }

  if (type === "number") {
    return (
      <p className="text-sm font-semibold">{formatCurrency(value)}</p>
    )
  }

  const displayValue = value != null && value !== "" ? String(value) : "—"
  const isLong = type === "textarea"
  const wordCount = isLong && minWords ? getWordCount(displayValue) : null

  return (
    <div>
      <p className={`text-sm font-semibold ${isLong ? "whitespace-pre-wrap" : ""}`}>
        {displayValue}
      </p>
      {wordCount !== null && minWords && (
        <p className="text-muted-foreground/60 mt-1 text-xs">
          {wordCount} / {minWords} words
        </p>
      )}
    </div>
  )
}

export function ReadOnlyFormPage({ title, subtitle, config, studentId, sectionId, headerContent }: ReadOnlyFormPageProps) {
  const { data: session } = useSession()
  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      try {
        const loadUrl = config.xanoLoadEndpoint ?? config.xanoEndpoint
        const url = new URL(loadUrl)
        url.searchParams.set("students_id", studentId)

        const res = await fetch(url.toString())
        if (res.ok) {
          const result = await res.json()
          let record: Record<string, unknown> | null = null
          if (Array.isArray(result)) {
            record = result.find(
              (r: Record<string, unknown>) => r.students_id === studentId
            ) ?? null
          } else {
            record = result
          }
          setData(record)
        }
      } catch {
        // Silently fail
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [config.xanoLoadEndpoint, config.xanoEndpoint, studentId])

  useEffect(() => {
    const loadComments = async () => {
      try {
        const url = sectionId
          ? `${COMMENTS_ENDPOINT}?students_id=${studentId}&lifemap_sections_id=${sectionId}`
          : `${COMMENTS_ENDPOINT}?students_id=${studentId}`
        const res = await fetch(url)
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data)) {
            const enriched = data.map((c: Record<string, unknown>) => {
              const teachers = c._teachers as { firstName?: string; lastName?: string }[] | undefined
              const teacher = teachers?.[0]
              const teacherName = teacher
                ? `${teacher.firstName ?? ""} ${teacher.lastName ?? ""}`.trim()
                : undefined
              return { ...c, teacher_name: teacherName } as Comment
            })
            setComments(enriched)
          }
        }
      } catch {
        // Silently fail
      }
    }

    loadComments()
  }, [studentId, sectionId])

  const handlePostComment = useCallback(
    async (fieldName: string, note: string) => {
      const teacherName = session?.user?.name ?? "Teacher"
      const teachersId = (session?.user as Record<string, unknown>)?.teachers_id ?? null

      const payload: Record<string, unknown> = {
        students_id: studentId,
        teachers_id: teachersId,
        field_name: fieldName,
        note,
        isOld: false,
        isComplete: false,
        teacher_name: teacherName,
      }
      if (sectionId) payload.lifemap_sections_id = sectionId

      const res = await fetch(COMMENTS_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        const newComment = await res.json()
        setComments((prev) => [
          ...prev,
          { ...newComment, teacher_name: newComment.teacher_name || teacherName },
        ])
      }
    },
    [studentId, session, sectionId]
  )

  const handleMarkComplete = useCallback(
    async (commentId: number, isComplete: boolean) => {
      const res = await fetch(`${COMMENTS_ENDPOINT}/${commentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isComplete }),
      })

      if (res.ok) {
        setComments((prev) =>
          prev.map((c) => (c.id === commentId ? { ...c, isComplete } : c))
        )
      }
    },
    []
  )

  const handleDelete = useCallback(
    async (commentId: number) => {
      const res = await fetch(`${COMMENTS_ENDPOINT}/${commentId}`, {
        method: "DELETE",
      })

      if (res.ok) {
        setComments((prev) => prev.filter((c) => c.id !== commentId))
      }
    },
    []
  )

  if (loading) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-6">
          {config.sections.map((section) => (
            <Card key={section.title}>
              <CardHeader>
                <Skeleton className="h-5 w-40" />
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-6">
                  {section.fields.map((fieldName) => {
                    const field = config.fields.find((f) => f.name === fieldName)
                    let colSpan = "md:col-span-3"
                    if (field?.columns === 3) {
                      colSpan = "md:col-span-2"
                    } else if (field?.columns === 2) {
                      colSpan = "md:col-span-3"
                    } else if (field?.type === "textarea" || field?.type === "image") {
                      colSpan = "md:col-span-6"
                    }
                    return (
                      <div key={fieldName} className={colSpan}>
                        <Skeleton className="mb-2 h-4 w-24" />
                        <Skeleton className={field?.type === "textarea" ? "h-20 w-full" : "h-5 w-full"} />
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          {subtitle && <p className="text-muted-foreground mt-1 text-sm">{subtitle}</p>}
        </div>
        {headerContent}
        <p className="text-muted-foreground">No data submitted yet for this section.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle && <p className="text-muted-foreground mt-1 text-sm">{subtitle}</p>}
      </div>

      {headerContent}

      <div className="space-y-6">
        {config.sections.map((section) => {
          const sectionFields = config.fields.filter((f) =>
            section.fields.includes(f.name)
          )

          return (
            <Card key={section.title}>
              <CardHeader>
                <CardTitle className="text-lg">{section.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-6">
                  {sectionFields.map((field) => {
                    if (field.type === "hidden") return null
                    let colSpan = "md:col-span-3"
                    if (field.columns === 3) {
                      colSpan = "md:col-span-2"
                    } else if (field.columns === 2) {
                      colSpan = "md:col-span-3"
                    } else if (field.type === "textarea" || field.type === "image") {
                      colSpan = "md:col-span-6"
                    }

                    return (
                      <div
                        key={field.name}
                        className={cn(
                          "rounded-lg bg-gray-50 p-3 dark:bg-muted/30",
                          colSpan
                        )}
                      >
                        <div className="mb-1.5 flex items-center justify-between">
                          <Label className="text-muted-foreground text-xs font-medium">
                            {field.label ?? field.name}
                          </Label>
                          <TeacherComment
                            fieldName={field.name}
                            fieldLabel={field.label ?? field.name}
                            fieldValue={getDisplayValue(data[field.name], field.type)}
                            minWords={field.minWords}
                            comments={comments}
                            onSubmit={handlePostComment}
                            onMarkComplete={handleMarkComplete}
                            onDelete={handleDelete}
                          />
                        </div>
                        <ReadOnlyField
                          label={field.label ?? field.name}
                          value={data[field.name]}
                          type={field.type}
                          minWords={field.minWords}
                        />
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
