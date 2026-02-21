"use client"

import { use, useCallback, useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { ReadOnlyDynamicFormPage } from "@/components/form/readonly-dynamic-form-page"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowLeft02Icon,
  SquareLock02Icon,
  SquareUnlock02Icon,
  Settings02Icon,
} from "@hugeicons/core-free-icons"
import { fetchSections, findSectionBySlug, slugToTitle, type LifeMapSection } from "@/lib/lifemap-sections"
import { TeacherComment } from "@/components/form/teacher-comment"
import type { Comment } from "@/lib/form-types"

const XANO_BASE =
  process.env.NEXT_PUBLIC_XANO_API_BASE ??
  "https://xsc3-mvx7-r86m.n7e.xano.io/api:o2_UyOKn"

const COMMENTS_ENDPOINT = `${XANO_BASE}/lifemap_comments`

export default function AdminLifeMapSectionPage({
  params,
}: {
  params: Promise<{ studentId: string; section: string }>
}) {
  const { studentId, section } = use(params)
  const { data: session } = useSession()
  const [label, setLabel] = useState(slugToTitle(section))
  const [sectionDescription, setSectionDescription] = useState("")
  const [sectionId, setSectionId] = useState<number | null>(null)
  const [sectionLocked, setSectionLocked] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const [sectionComments, setSectionComments] = useState<Comment[]>([])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const sections = await fetchSections()
        if (cancelled) return
        const match = findSectionBySlug(sections, section)
        if (match) {
          setLabel(match.section_title)
          setSectionDescription(match.section_description ?? "")
          setSectionId(match.id)
          setSectionLocked(match.isLocked ?? false)

          try {
            const commentsRes = await fetch(`${COMMENTS_ENDPOINT}?students_id=${studentId}&lifemap_sections_id=${match.id}`)
            if (commentsRes.ok) {
              const data = await commentsRes.json()
              if (Array.isArray(data)) {
                setSectionComments(
                  data.filter((c: Comment) =>
                    c.field_name === "_section_comment" &&
                    Number(c.lifemap_sections_id) === match.id &&
                    !c.lifemap_custom_group_id
                  )
                )
              }
            }
          } catch { /* ignore */ }
        }
      } catch {
        // Silently fail
      } finally {
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
        lifemap_sections_id: sectionId,
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
      const res = await fetch(`${COMMENTS_ENDPOINT}/${commentId}`, {
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
        <Link href={`/admin/life-map/${studentId}`}>
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
        <div className="inline-flex size-8 items-center justify-center rounded-md border">
          <HugeiconsIcon
            icon={sectionLocked ? SquareLock02Icon : SquareUnlock02Icon}
            strokeWidth={1.5}
            className={`size-4 ${sectionLocked ? "text-muted-foreground" : "text-green-600"}`}
          />
        </div>
        <Button variant="outline" size="icon" className="size-8" asChild title="Edit section template">
          <Link href={`/admin/life-map-template/${section}`}>
            <HugeiconsIcon icon={Settings02Icon} strokeWidth={2} className="size-4" />
          </Link>
        </Button>
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
      />
    )
  }

  return (
    <>
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
    </>
  )
}
