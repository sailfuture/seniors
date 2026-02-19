"use client"

import { use, useEffect, useState } from "react"
import { redirect } from "next/navigation"
import { TemplateManager } from "@/components/template-manager"
import { Skeleton } from "@/components/ui/skeleton"

const XANO_BASE =
  process.env.NEXT_PUBLIC_XANO_API_BASE ??
  "https://xsc3-mvx7-r86m.n7e.xano.io/api:o2_UyOKn"

const sectionLabels: Record<string, string> = {
  overview: "Overview",
  pathway: "Selected Pathway",
  profile: "Personal Profile",
  career: "Career",
  education: "Education",
  housing: "Housing",
  transportation: "Transportation",
  finance: "Finance",
  contact: "Contact",
}

const slugToSectionTitle: Record<string, string> = {
  overview: "Overview",
  pathway: "Selected Pathway",
  profile: "Personal Profile",
  career: "Career",
  education: "Education",
  housing: "Housing",
  transportation: "Transportation",
  finance: "Finance",
  contact: "Contact",
}

interface LifeMapSection {
  id: number
  section_title: string
}

let sectionsCache: LifeMapSection[] | null = null

export default function LifeMapTemplateSectionPage({
  params,
}: {
  params: Promise<{ section: string }>
}) {
  const { section } = use(params)

  if (section === "overview") {
    redirect("/admin/life-map-template")
  }

  const label = sectionLabels[section] ?? section
  const [sectionId, setSectionId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadSections = async () => {
      try {
        if (!sectionsCache) {
          const res = await fetch(`${XANO_BASE}/lifemap_sections`)
          if (res.ok) {
            sectionsCache = await res.json()
          }
        }

        if (sectionsCache) {
          const expectedTitle = slugToSectionTitle[section]
          const match = sectionsCache.find(
            (s) => s.section_title === expectedTitle
          )
          if (match) setSectionId(match.id)
        }
      } catch {
        // Silently fail
      } finally {
        setLoading(false)
      }
    }

    loadSections()
  }, [section, label])

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
        <h1 className="text-2xl font-bold">{label}</h1>
        <p className="text-muted-foreground">
          Section not found. Make sure it exists in the lifemap_sections database.
        </p>
      </div>
    )
  }

  return <TemplateManager section={section} sectionId={sectionId} sectionLabel={label} />
}
