"use client"

import { use, useEffect, useState } from "react"
import { DynamicFormPage } from "@/components/form/dynamic-form-page"
import { Skeleton } from "@/components/ui/skeleton"
import { fetchSections, findSectionBySlug, slugToTitle } from "@/lib/lifemap-sections"

export default function LifeMapDynamicSectionPage({
  params,
}: {
  params: Promise<{ section: string }>
}) {
  const { section } = use(params)
  const [sectionId, setSectionId] = useState<number | null>(null)
  const [title, setTitle] = useState(slugToTitle(section))
  const [description, setDescription] = useState<string | undefined>(undefined)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetchSections().then((sections) => {
      if (cancelled) return
      const match = findSectionBySlug(sections, section)
      if (match) {
        setSectionId(match.id)
        setTitle(match.section_title)
        setDescription(match.section_description || match.description || undefined)
      }
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [section])

  if (loading) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        <Skeleton className="h-8 w-64" />
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    )
  }

  if (!sectionId) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-muted-foreground">
          This section was not found. It may have been removed.
        </p>
      </div>
    )
  }

  return <DynamicFormPage title={title} subtitle={description} sectionId={sectionId} />
}
