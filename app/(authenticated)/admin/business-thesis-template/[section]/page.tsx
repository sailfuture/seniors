"use client"

import { use, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { TemplateManager } from "@/components/template-manager"
import { Skeleton } from "@/components/ui/skeleton"
import { fetchBtSections, findBtSectionBySlug, btSlugToTitle, invalidateBtSectionsCache } from "@/lib/businessthesis-sections"
import { BUSINESSTHESIS_API_CONFIG } from "@/lib/form-api-config"
import type { XanoImageResponse } from "@/lib/xano"

export default function BusinessThesisTemplateSectionPage({
  params,
}: {
  params: Promise<{ section: string }>
}) {
  const { section } = use(params)
  const searchParams = useSearchParams()
  const editQuestionId = searchParams.get("editQuestion") ? Number(searchParams.get("editQuestion")) : null
  const newQuestion = searchParams.get("newQuestion") === "true"

  const [sectionId, setSectionId] = useState<number | null>(null)
  const [sectionLabel, setSectionLabel] = useState(btSlugToTitle(section))
  const [sectionDescription, setSectionDescription] = useState("")
  const [sectionLocked, setSectionLocked] = useState(false)
  const [sectionPhoto, setSectionPhoto] = useState<XanoImageResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const loadSections = async () => {
      try {
        const sections = await fetchBtSections()
        if (cancelled) return

        const match = findBtSectionBySlug(sections, section)
        if (match) {
          setSectionId(match.id)
          setSectionLabel(match.section_title)
          setSectionDescription(match.description ?? "")
          setSectionLocked(match.isLocked ?? false)
          setSectionPhoto((match.photo as XanoImageResponse | null) ?? null)
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
          Section not found. Make sure it exists in the businessthesis_sections database.
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
      apiConfig={BUSINESSTHESIS_API_CONFIG}
      templateBasePath="/admin/business-thesis-template"
      onSectionsInvalidated={invalidateBtSectionsCache}
      initialEditQuestionId={editQuestionId}
      openNewQuestion={newQuestion}
    />
  )
}
