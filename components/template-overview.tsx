"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"

const XANO_BASE =
  process.env.NEXT_PUBLIC_XANO_API_BASE ??
  "https://xsc3-mvx7-r86m.n7e.xano.io/api:o2_UyOKn"

const TEMPLATE_ENDPOINT = `${XANO_BASE}/lifeplan_template`
const SECTIONS_ENDPOINT = `${XANO_BASE}/lifemap_sections`
const PUBLISH_ENDPOINT = `${XANO_BASE}/publish_questions`

interface LifeMapSection {
  id: number
  section_title: string
  section_description?: string
  isLocked: boolean
}

interface TemplateQuestion {
  id: number
  lifemap_sections_id: number
  isArchived: boolean
  isPublished: boolean
}

interface SectionSummary {
  section: LifeMapSection
  slug: string
  total: number
  published: number
  draft: number
}

const sectionSlugMap: Record<string, string> = {
  "Overview": "overview",
  "Selected Pathway": "pathway",
  "Personal Profile": "profile",
  "Career": "career",
  "Education": "education",
  "Housing": "housing",
  "Transportation": "transportation",
  "Finance": "finance",
  "Contact": "contact",
}

export function TemplateOverview() {
  const router = useRouter()
  const [summaries, setSummaries] = useState<SectionSummary[]>([])
  const [allQuestions, setAllQuestions] = useState<TemplateQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [publishing, setPublishing] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const [sectionsRes, templateRes] = await Promise.all([
          fetch(SECTIONS_ENDPOINT),
          fetch(TEMPLATE_ENDPOINT),
        ])

        const sections: LifeMapSection[] = sectionsRes.ok ? await sectionsRes.json() : []
        const questions: TemplateQuestion[] = templateRes.ok ? await templateRes.json() : []
        const active = questions.filter((q) => !q.isArchived)
        setAllQuestions(active)

        const result: SectionSummary[] = sections.map((s) => {
          const sectionQs = active.filter((q) => q.lifemap_sections_id === s.id)
          return {
            section: s,
            slug: sectionSlugMap[s.section_title] ?? s.section_title.toLowerCase(),
            total: sectionQs.length,
            published: sectionQs.filter((q) => q.isPublished).length,
            draft: sectionQs.filter((q) => !q.isPublished).length,
          }
        })

        setSummaries(result)
      } catch {
        // Silently fail
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  const totalDrafts = allQuestions.filter((q) => !q.isPublished).length

  const handlePublishAll = async () => {
    const drafts = allQuestions.filter((q) => !q.isPublished)
    if (drafts.length === 0) {
      toast("All questions are already published", { duration: 2000 })
      return
    }

    setPublishing(true)
    try {
      await Promise.all(
        drafts.map((q) =>
          fetch(`${TEMPLATE_ENDPOINT}/${q.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isPublished: true }),
          })
        )
      )

      await fetch(PUBLISH_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }).catch(() => {})

      setAllQuestions((prev) => prev.map((q) => ({ ...q, isPublished: true })))
      setSummaries((prev) =>
        prev.map((s) => ({ ...s, published: s.total, draft: 0 }))
      )
      toast(`${drafts.length} question${drafts.length > 1 ? "s" : ""} published`, { duration: 2000 })
    } catch {
      toast("Failed to publish some questions", { duration: 3000 })
    } finally {
      setPublishing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        <Skeleton className="h-8 w-64" />
        <div className="space-y-2">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Life Map Template</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Configure the questions students must complete for each section.
          </p>
        </div>
        {totalDrafts > 0 && (
          <Button
            variant="outline"
            onClick={handlePublishAll}
            disabled={publishing}
            className="gap-2"
          >
            {publishing ? "Publishing..." : `Publish All Drafts (${totalDrafts})`}
          </Button>
        )}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs font-medium uppercase tracking-wide">Section</TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wide">Description</TableHead>
              <TableHead className="w-[100px] text-center text-xs font-medium uppercase tracking-wide">Questions</TableHead>
              <TableHead className="w-[100px] text-center text-xs font-medium uppercase tracking-wide">Published</TableHead>
              <TableHead className="w-[100px] text-center text-xs font-medium uppercase tracking-wide">Drafts</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {summaries.map((s) => (
              <TableRow
                key={s.section.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => router.push(`/admin/life-map-template/${s.slug}`)}
              >
                <TableCell>
                  <span className="text-sm font-medium">{s.section.section_title}</span>
                </TableCell>
                <TableCell>
                  <span className="text-muted-foreground text-sm">
                    {s.section.section_description || "—"}
                  </span>
                </TableCell>
                <TableCell className="text-center">
                  <span className="text-sm">{s.total}</span>
                </TableCell>
                <TableCell className="text-center">
                  {s.published > 0 ? (
                    <Badge variant="default" className="bg-green-600 text-xs">
                      {s.published}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-sm">0</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {s.draft > 0 ? (
                    <Badge variant="outline" className="text-muted-foreground text-xs">
                      {s.draft}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-sm">0</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
