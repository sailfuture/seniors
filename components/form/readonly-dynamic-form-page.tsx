"use client"

import { useCallback, useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { TeacherComment } from "./teacher-comment"
import type { Comment } from "@/lib/form-types"

const XANO_BASE =
  process.env.NEXT_PUBLIC_XANO_API_BASE ??
  "https://xsc3-mvx7-r86m.n7e.xano.io/api:o2_UyOKn"

const TEMPLATE_ENDPOINT = `${XANO_BASE}/lifeplan_template`
const RESPONSES_ENDPOINT = `${XANO_BASE}/lifemap_responses_by_student`
const CUSTOM_GROUP_ENDPOINT = `${XANO_BASE}/lifemap_custom_group`
const COMMENTS_ENDPOINT = `${XANO_BASE}/lifemap_comments`

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

interface ReadOnlyDynamicFormPageProps {
  title: string
  sectionId: number
  studentId: string
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

function getWordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

export function ReadOnlyDynamicFormPage({ title, sectionId, studentId }: ReadOnlyDynamicFormPageProps) {
  const { data: session } = useSession()
  const [questions, setQuestions] = useState<TemplateQuestion[]>([])
  const [customGroups, setCustomGroups] = useState<CustomGroup[]>([])
  const [responses, setResponses] = useState<Map<number, StudentResponse>>(new Map())
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      try {
        const [templateRes, responsesRes, groupsRes, commentsRes] = await Promise.all([
          fetch(TEMPLATE_ENDPOINT),
          fetch(`${RESPONSES_ENDPOINT}?students_id=${studentId}`),
          fetch(CUSTOM_GROUP_ENDPOINT),
          fetch(`${COMMENTS_ENDPOINT}?students_id=${studentId}`),
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
          for (const r of data) map.set(r.lifemap_template_id, r)
          setResponses(map)
        }

        if (groupsRes.ok) {
          const allGroups = (await groupsRes.json()) as CustomGroup[]
          setCustomGroups(allGroups.filter((g) => g.lifemap_sections_id === sectionId))
        }

        if (commentsRes.ok) {
          const data = await commentsRes.json()
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
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [studentId, sectionId])

  const handlePostComment = useCallback(
    async (fieldName: string, note: string) => {
      const teacherName = session?.user?.name ?? "Teacher"
      const teachersId = (session?.user as Record<string, unknown>)?.teachers_id ?? null

      const payload = {
        students_id: studentId,
        teachers_id: teachersId,
        field_name: fieldName,
        note,
        isOld: false,
        isComplete: false,
        teacher_name: teacherName,
      }

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
    [studentId, session]
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
        <Card>
          <CardContent className="p-6 space-y-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-5 w-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    )
  }

  const ungroupedQuestions = questions.filter((q) => !q.lifemap_custom_group_id)
  const groupedSections = customGroups
    .map((group) => ({
      group,
      questions: questions.filter((q) => q.lifemap_custom_group_id === group.id),
    }))
    .filter((gs) => gs.questions.length > 0)

  const renderQuestionList = (qs: TemplateQuestion[]) => (
    <div className="grid gap-3 md:grid-cols-6">
      {qs.map((q) => {
        const response = responses.get(q.id)
        const value = response?.student_response ?? ""
        const imageValue = response?.image_response ?? null
        const typeId = q.question_types_id
        const isLong = typeId === QUESTION_TYPE.LONG_RESPONSE
        const isImage = typeId === QUESTION_TYPE.IMAGE_UPLOAD
        const isCurrency = typeId === QUESTION_TYPE.CURRENCY
        const colSpan = isLong || isImage ? "md:col-span-6" : "md:col-span-3"

        let displayValue: React.ReactNode
        if (isImage) {
          const url = getImageUrl(imageValue)
          displayValue = url ? (
            <img src={url} alt={q.field_label} className="h-40 w-full rounded-lg border object-cover" />
          ) : (
            <div className="text-muted-foreground flex h-32 items-center justify-center rounded-lg border border-dashed text-sm">
              No image uploaded
            </div>
          )
        } else if (isCurrency) {
          const num = parseFloat(value) || 0
          displayValue = <p className="text-sm font-semibold">${num.toLocaleString("en-US")}</p>
        } else {
          displayValue = (
            <div>
              <p className={`text-sm font-semibold ${isLong ? "whitespace-pre-wrap" : ""}`}>
                {value || "—"}
              </p>
              {isLong && q.min_words > 0 && (
                <p className="text-muted-foreground/60 mt-1 text-xs">
                  {getWordCount(value)} / {q.min_words} words
                </p>
              )}
            </div>
          )
        }

        return (
          <div
            key={q.id}
            className={`rounded-lg bg-gray-50 p-3 dark:bg-muted/30 ${colSpan}`}
          >
            <div className="mb-1.5 flex items-center justify-between">
              <Label className="text-muted-foreground text-xs font-medium">
                {q.field_label}
              </Label>
              <TeacherComment
                fieldName={q.field_name}
                fieldLabel={q.field_label}
                fieldValue={value || "—"}
                minWords={q.min_words > 0 ? q.min_words : undefined}
                comments={comments}
                onSubmit={handlePostComment}
                onMarkComplete={handleMarkComplete}
                onDelete={handleDelete}
              />
            </div>
            {displayValue}
          </div>
        )
      })}
    </div>
  )

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <h1 className="text-2xl font-bold">{title}</h1>

      {questions.length === 0 ? (
        <p className="text-muted-foreground">No data submitted yet for this section.</p>
      ) : (
        <div className="space-y-6">
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
      )}
    </div>
  )
}
