"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowLeft02Icon,
  BookOpen01Icon,
  PrinterIcon,
  SquareLock02Icon,
} from "@hugeicons/core-free-icons"
import { Markdown } from "@/components/markdown"
import { markdownToPlainText } from "@/lib/markdown-text"
import { cachedFetch } from "@/lib/cached-fetch"
import type { FormApiConfig } from "@/lib/form-api-config"
import { cn } from "@/lib/utils"
import {
  buildRubric,
  describeRubricSection,
  rubricCounts,
  type RubricComponent,
  type RubricSection,
} from "@/lib/rubric"

/** Which product a rubric belongs to: its API, name, routes and slug rule. */
export interface RubricProduct {
  apiConfig: FormApiConfig
  /** "Business Thesis" or "Life Map". */
  name: string
  /** Student route base, e.g. "/business-thesis". */
  basePath: string
  slug: (title: string) => string
}

export function rubricHref(product: Pick<RubricProduct, "basePath">, slug?: string): string {
  return slug ? `${product.basePath}/rubric/${slug}` : `${product.basePath}/rubric`
}

export function rubricPrintHref(product: Pick<RubricProduct, "basePath">): string {
  return `${product.basePath}/rubric/print`
}

interface SectionRecord {
  id: number
  section_title: string
  description?: string
  section_description?: string
  isLocked?: boolean
  order?: number
}

interface GroupRecord {
  id: number
  group_name: string
  group_description?: string
  instructions?: string
  order?: number
  [key: string]: unknown
}

interface QuestionRecord {
  id: number
  field_label: string
  field_name: string
  isArchived: boolean
  isPublished: boolean
  sortOrder: number
  min_words?: number
  detailed_instructions?: string
  question_types_id?: number | null
  _question_types?: { id: number; type: string }
  [key: string]: unknown
}

/** Loads a product's template (sections, groups, questions) and shapes it into the rubric. */
export function useRubric(product: RubricProduct): { sections: RubricSection[]; loading: boolean } {
  const { apiConfig, slug } = product
  const [sections, setSections] = useState<SectionRecord[]>([])
  const [groups, setGroups] = useState<GroupRecord[]>([])
  const [questions, setQuestions] = useState<QuestionRecord[]>([])
  const [questionTypes, setQuestionTypes] = useState<{ id: number; type: string }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [sRes, gRes, qRes, tRes] = await Promise.all([
          cachedFetch(apiConfig.sectionsEndpoint),
          cachedFetch(apiConfig.customGroupEndpoint),
          cachedFetch(apiConfig.templateEndpoint),
          cachedFetch(apiConfig.questionTypesEndpoint),
        ])
        if (cancelled) return
        if (sRes.ok) {
          const data: SectionRecord[] = await sRes.json()
          setSections([...data].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)))
        }
        if (gRes.ok) setGroups(await gRes.json())
        if (qRes.ok) {
          const data: QuestionRecord[] = await qRes.json()
          setQuestions(data.filter((q) => !q.isArchived && q.isPublished))
        }
        if (tRes.ok) {
          const data = await tRes.json()
          if (Array.isArray(data)) setQuestionTypes(data)
        }
      } catch {
        /* the empty state covers it */
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [apiConfig])

  const F = apiConfig.fields
  const rubric = useMemo(() => {
    const rows = sections.map((section) => ({
      section,
      groups: groups
        .filter((g) => Number(g[F.sectionId]) === section.id)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    }))
    return buildRubric(rows, questions, {
      sectionId: (q) => Number(q[F.sectionId] ?? 0),
      groupId: (q) => {
        const v = q[F.customGroupId]
        return v != null ? Number(v) || null : null
      },
      typeId: (q) => q.question_types_id ?? q._question_types?.id,
      sectionDescription: (s) => s.section_description || s.description,
      typeName: (q) =>
        q._question_types?.type ??
        (q.question_types_id ? questionTypes.find((t) => t.id === q.question_types_id)?.type : undefined),
      slug,
    })
  }, [sections, groups, questions, questionTypes, F.sectionId, F.customGroupId, slug])

  return { sections: rubric, loading }
}

/** Small outline button that opens a section's rubric (or the whole rubric). */
export function RubricButton({
  href,
  muted = false,
  className,
}: {
  href: string
  muted?: boolean
  className?: string
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      asChild
      className={cn(
        "h-7 gap-1.5 px-2 text-xs font-medium",
        muted ? "text-muted-foreground/60" : "text-muted-foreground hover:text-foreground",
        className
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <Link href={href} title="Rubric: what this section must cover">
        <HugeiconsIcon icon={BookOpen01Icon} strokeWidth={2} className="size-3.5" />
        Rubric
      </Link>
    </Button>
  )
}

const LABEL = "text-muted-foreground text-[11px] font-medium tracking-wide uppercase"

/**
 * One section's rubric, concise: the section's purpose, then each key
 * component with the questions it must answer. Shared by the page and the
 * printed version, which pass their own type scale through `tone`.
 */
export function RubricSectionBody({
  section,
  tone = "screen",
}: {
  section: RubricSection
  tone?: "screen" | "print"
}) {
  const print = tone === "print"
  return (
    <div className={cn("space-y-6", print && "space-y-5")}>
      {(section.description?.trim() || section.requirements.length > 0) && (
        <div className={cn("grid gap-4", !print && "md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]")} data-keep>
          {section.description?.trim() && (
            <div>
              <p className={cn(LABEL, print && "text-gray-500")}>Purpose</p>
              <Markdown
                text={section.description}
                className={cn("mt-1", print ? "text-[11pt] leading-relaxed" : "text-sm")}
              />
            </div>
          )}
          {section.requirements.length > 0 && (
            <div
              className={cn(
                "rounded-lg border px-4 py-3",
                print ? "border-gray-300 bg-gray-50" : "border-primary/15 bg-primary/5"
              )}
            >
              <p className={cn(LABEL, print && "text-gray-500")}>Requirements</p>
              <ul className={cn("mt-1.5 space-y-1", print ? "text-[10.5pt]" : "text-sm")}>
                {section.requirements.map((line) => (
                  <li key={line} className="flex items-baseline gap-2">
                    <span
                      aria-hidden
                      className={cn("inline-block size-1.5 shrink-0 translate-y-[-1px] rounded-full", print ? "bg-gray-500" : "bg-primary/60")}
                    />
                    <span className="leading-snug">{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {section.components.length === 0 ? (
        <p className={cn("text-muted-foreground text-sm", print && "text-gray-500")}>
          No questions have been published in this section yet.
        </p>
      ) : (
        <div>
          <p className={cn(LABEL, print && "text-gray-500")}>Key components</p>
          <ol className={cn("mt-2 grid gap-3", !print && "sm:grid-cols-2")}>
            {section.components.map((component, i) => (
              <RubricComponentCard key={component.id ?? "ungrouped"} component={component} index={i} print={print} />
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}

function RubricComponentCard({
  component,
  index,
  print,
}: {
  component: RubricComponent
  index: number
  print: boolean
}) {
  const words = component.questions.reduce((n, q) => n + (q.minWords ?? 0), 0)
  const description = component.description ? markdownToPlainText(component.description) : ""
  const total = component.questions.length + component.sources
  return (
    <li
      data-keep
      className={cn(
        "rounded-lg border",
        print ? "border-gray-300 px-4 py-3.5" : "bg-card px-4 py-3.5"
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-md text-xs font-semibold tabular-nums",
            print ? "bg-gray-100 text-gray-700" : "bg-primary/10 text-primary"
          )}
        >
          {component.id === null ? "+" : index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className={cn("leading-snug font-semibold", print ? "text-[12pt]" : "text-sm")}>{component.name}</h3>
          {description && (
            <p className={cn("mt-0.5 leading-snug", print ? "text-[10pt] text-gray-600" : "text-muted-foreground text-xs")}>
              {description}
            </p>
          )}
          <p className={cn("mt-1", print ? "text-[9pt] text-gray-500" : "text-muted-foreground/80 text-[11px]")}>
            {total} question{total === 1 ? "" : "s"}
            {words > 0 && ` · ${words.toLocaleString()} words minimum`}
            {component.sources > 0 && ` · ${component.sources} source${component.sources === 1 ? "" : "s"} to cite`}
          </p>
        </div>
      </div>

      {component.guidelines && (
        <div className={cn("mt-3 rounded-md px-3 py-2", print ? "bg-gray-50" : "bg-muted/60")}>
          <p className={cn(LABEL, print && "text-gray-500")}>Guidelines</p>
          <p className={cn("mt-0.5 leading-snug", print ? "text-[10pt] text-gray-700" : "text-xs")}>{component.guidelines}</p>
        </div>
      )}

      {component.questions.length > 0 && (
        <ul className={cn("mt-3 space-y-2 border-t pt-3", print ? "border-gray-200" : "border-border/60")}>
          {component.questions.map((q) => (
            <li key={q.id} className={cn("flex items-start gap-2", print ? "text-[10.5pt]" : "text-sm")}>
              <span
                aria-hidden
                className={cn("mt-2 inline-block size-1.5 shrink-0 rounded-full", print ? "bg-gray-400" : "bg-primary/40")}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="min-w-0 flex-1 leading-snug">{q.label}</span>
                  {(q.minWords ?? 0) > 0 && (
                    <span className={cn("shrink-0 tabular-nums", print ? "text-[9pt] text-gray-500" : "text-muted-foreground text-[11px]")}>
                      {q.minWords}+ words
                    </span>
                  )}
                </div>
                {q.requirement && (
                  <p className={cn("mt-0.5 leading-snug", print ? "text-[9.5pt] text-gray-600" : "text-muted-foreground text-xs")}>
                    {q.requirement}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

/**
 * The standalone rubric page: one section when `slug` is given, otherwise
 * every section in order. Chips switch sections; the print link opens the
 * paginated version.
 */
export function RubricPage({ product, slug }: { product: RubricProduct; slug?: string }) {
  const { sections, loading } = useRubric(product)
  const current = slug ? sections.find((s) => s.slug === slug) : undefined
  const shown = current ? [current] : sections
  const backHref = current ? `${product.basePath}/${current.slug}` : product.basePath

  if (loading) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-4 md:p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    )
  }

  if (slug && !current) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 p-4 md:p-6">
        <h1 className="text-2xl font-bold">Rubric</h1>
        <p className="text-muted-foreground">This section was not found. It may have been removed.</p>
        <div>
          <Button variant="outline" size="sm" asChild className="gap-2">
            <Link href={rubricHref(product)}>
              <HugeiconsIcon icon={ArrowLeft02Icon} strokeWidth={2} className="size-4" />
              Full rubric
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-4 md:p-6">
      <div>
        <p className={LABEL}>{product.name} rubric</p>
        <h1 className="mt-1 text-2xl font-bold">
          {current ? current.title : `${product.name} Rubric`}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {current
            ? `What this section must cover, and the questions that need answering. ${describeRubricSection(current)}.`
            : `Each section is a major component of the ${product.name}. For every section, the key components it must cover and the questions that need answering.`}
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <Button variant="outline" size="sm" asChild className="gap-2">
            <Link href={backHref}>
              <HugeiconsIcon icon={ArrowLeft02Icon} strokeWidth={2} className="size-4" />
              {current ? "Back to section" : "Back"}
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild className="gap-2">
            <a href={rubricPrintHref(product)} target="_blank" rel="noopener noreferrer">
              <HugeiconsIcon icon={PrinterIcon} strokeWidth={2} className="size-4" />
              Print / PDF
            </a>
          </Button>
        </div>
      </div>

      {/* Section switcher */}
      <nav aria-label="Sections" className="flex flex-wrap gap-1.5">
        <Link
          href={rubricHref(product)}
          className={cn(
            "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
            current ? "text-muted-foreground hover:bg-accent hover:text-foreground" : "bg-primary text-primary-foreground border-primary"
          )}
        >
          All sections
        </Link>
        {sections.map((s) => {
          const active = current?.id === s.id
          return (
            <Link
              key={s.id}
              href={rubricHref(product, s.slug)}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : s.locked
                    ? "text-muted-foreground/60 hover:bg-accent hover:text-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              {s.locked && <HugeiconsIcon icon={SquareLock02Icon} strokeWidth={1.5} className="size-3" />}
              {s.title}
            </Link>
          )
        })}
      </nav>

      {shown.length === 0 ? (
        <p className="text-muted-foreground text-sm">No sections have been published yet.</p>
      ) : (
        <div className="space-y-10">
          {shown.map((section, index) => (
            <section key={section.id} className="space-y-4">
              {!current && (
                <div className="flex items-start gap-3 border-b pb-3">
                  <span className="bg-primary/10 text-primary mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-md text-xs font-semibold tabular-nums">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg leading-snug font-semibold">{section.title}</h2>
                      {section.locked && (
                        <span className="text-muted-foreground inline-flex items-center gap-1 text-[11px]">
                          <HugeiconsIcon icon={SquareLock02Icon} strokeWidth={1.5} className="size-3" />
                          Locked
                        </span>
                      )}
                    </div>
                    <p className="text-muted-foreground text-xs">{describeRubricSection(section)}</p>
                  </div>
                  <Link
                    href={rubricHref(product, section.slug)}
                    className="text-muted-foreground hover:text-foreground shrink-0 text-xs underline-offset-4 hover:underline"
                  >
                    Open
                  </Link>
                </div>
              )}
              <RubricSectionBody section={section} />
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

export { rubricCounts }
