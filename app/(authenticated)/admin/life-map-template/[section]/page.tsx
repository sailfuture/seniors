"use client"

import { use, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { TemplateManager } from "@/components/template-manager"
import { Skeleton } from "@/components/ui/skeleton"
import { fetchSections, findSectionBySlug, slugToTitle } from "@/lib/lifemap-sections"
import type { XanoImageResponse } from "@/lib/xano"

export default function LifeMapTemplateSectionPage({
  params,
}: {
  params: Promise<{ section: string }>
}) {
  const { section } = use(params)
  const searchParams = useSearchParams()
  const editQuestionId = searchParams.get("editQuestion") ? Number(searchParams.get("editQuestion")) : null
  const newQuestion = searchParams.get("newQuestion") === "true"

  const [sectionId, setSectionId] = useState<number | null>(null)
  const [sectionLabel, setSectionLabel] = useState(slugToTitle(section))
  const [sectionDescription, setSectionDescription] = useState("")
  const [sectionLocked, setSectionLocked] = useState(false)
  const [sectionPhoto, setSectionPhoto] = useState<XanoImageResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const loadSections = async () => {
      try {
        const sections = await fetchSections()
        if (cancelled) return

        const match = findSectionBySlug(sections, section)
        if (match) {
          setSectionId(match.id)
          setSectionLabel(match.section_title)
          setSectionDescription(match.section_description ?? "")
          setSectionLocked(match.isLocked ?? false)
          setSectionPhoto(match.photo ?? null)
        }
      } catch {
        // Silently fail
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadSections()
    return () => { cancelled = true }
  }, [section])

  if (loading) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-10 w-40" />
      </div>
    )
  }

  if (sectionId === null) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        <h1 className="text-2xl font-bold">{sectionLabel}</h1>
        <p className="text-muted-foreground">
          Section not found. Make sure it exists in the lifemap_sections database.
        </p>
      </div>
    )
  }

  return (
    <TemplateManager
      section={section}
      sectionId={sectionId}
      sectionLabel={sectionLabel}
      sectionDescription={sectionDescription}
      sectionLocked={sectionLocked}
      sectionPhoto={sectionPhoto}
      initialEditQuestionId={editQuestionId}
      openNewQuestion={newQuestion}
    />
  )
}
