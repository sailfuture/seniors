"use client"

import { use, useCallback, useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { ReadOnlyDynamicFormPage } from "@/components/form/readonly-dynamic-form-page"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowLeft02Icon } from "@hugeicons/core-free-icons"
import { fetchBtSections, findBtSectionBySlug, btSlugToTitle, type BusinessThesisSection } from "@/lib/businessthesis-sections"
import { BUSINESSTHESIS_API_CONFIG } from "@/lib/form-api-config"
import { TeacherComment } from "@/components/form/teacher-comment"
import type { Comment } from "@/lib/form-types"

const BT_COMMENTS_ENDPOINT = BUSINESSTHESIS_API_CONFIG.commentsEndpoint

export default function AdminBusinessThesisSectionPage({
  params,
}: {
  params: Promise<{ studentId: string; section: string }>
}) {
  const { studentId, section } = use(params)
  const { data: session } = useSession()
  const [label, setLabel] = useState(btSlugToTitle(section))
  const [sectionDescription, setSectionDescription] = useState("")
  const [sectionId, setSectionId] = useState<number | null>(null)
  const [loaded, setLoaded] = useState(false)

  const [sectionComments, setSectionComments] = useState<Comment[]>([])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const sections = await fetchBtSections()
        if (cancelled) return
        const match = findBtSectionBySlug(sections, section)
        if (match) {
          setLabel(match.section_title)
          setSectionDescription(match.description ?? "")
          setSectionId(match.id)

          try {
            const commentsRes = await fetch(`${BT_COMMENTS_ENDPOINT}?students_id=${studentId}&businessthesis_sections_id=${match.id}`)
            if (commentsRes.ok) {
              const data = await commentsRes.json()
              if (Array.isArray(data)) {
                setSectionComments(
                  data.filter((c: Comment) =>
                    c.field_name === "_section_comment" &&
                    Number(c.businessthesis_sections_id) === match.id &&
                    !c.businessthesis_custom_group_id
                  )
                )
              }
            }
          } catch { /* ignore */ }
        }
      } catch { /* ignore */ } finally {
        if (!cancelled) setLoaded(true)
      }
    }
    load()
    return () => { cancelled = true }
  }, [section, studentId])

  const handlePostSectionComment = useCallback(
    async (_fieldName: string, note: string) => {
      if (!sectionId) return
      const teacherName = session?.user?.name ?? "Teacher"
      const teachersId = (session?.user as Record<string, unknown>)?.teachers_id ?? null

      const payload = {
        students_id: studentId,
        teachers_id: teachersId,
        field_name: "_section_comment",
        businessthesis_sections_id: sectionId,
        note,
        isOld: false,
        isComplete: false,
        teacher_name: teacherName,
      }

      const res = await fetch(BT_COMMENTS_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        const newComment = await res.json()
        setSectionComments((prev) => [
          ...prev,
          { ...newComment, teacher_name: newComment.teacher_name || teacherName },
        ])
      }
    },
    [studentId, session, sectionId]
  )

  const handleDeleteComment = useCallback(
    async (commentId: number) => {
      const res = await fetch(`${BT_COMMENTS_ENDPOINT}/${commentId}`, {
        method: "DELETE",
      })
      if (res.ok) {
        setSectionComments((prev) => prev.filter((c) => c.id !== commentId))
      }
    },
    []
  )

  const actionBar = (
    <div className="flex items-center justify-between">
      <Button variant="outline" size="sm" asChild className="gap-2">
        <Link href={`/admin/business-thesis/${studentId}`}>
          <HugeiconsIcon icon={ArrowLeft02Icon} strokeWidth={2} className="size-4" />
          Back
        </Link>
      </Button>
      <div className="flex items-center gap-2">
        <TeacherComment
          fieldName="_section_comment"
          fieldLabel={label}
          comments={sectionComments}
          onSubmit={handlePostSectionComment}
          onDelete={handleDeleteComment}
          square
        />
      </div>
    </div>
  )

  if (!loaded) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>
    )
  }

  if (sectionId) {
    return (
      <ReadOnlyDynamicFormPage
        title={label}
        subtitle={sectionDescription}
        sectionId={sectionId}
        studentId={studentId}
        headerContent={actionBar}
        apiConfig={BUSINESSTHESIS_API_CONFIG}
      />
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">{label}</h1>
        {sectionDescription && (
          <p className="text-muted-foreground mt-1 text-sm">{sectionDescription}</p>
        )}
      </div>
      {actionBar}
      <p className="text-muted-foreground">
        This section is not yet available for review.
      </p>
    </div>
  )
}
