"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowLeft02Icon,
  BookOpen01Icon,
  CheckListIcon,
  GridViewIcon,
  PrinterIcon,
  SquareLock02Icon,
} from "@hugeicons/core-free-icons"
import { Markdown } from "@/components/markdown"
import type { SectionScoring } from "@/lib/rubric-scoring"
import { criteriaForGroup } from "@/lib/rubric-groups"
import { RubricScoringTable } from "@/components/form/rubric-scoring-table"
import { cachedFetch } from "@/lib/cached-fetch"
import type { FormApiConfig } from "@/lib/form-api-config"
import { cn } from "@/lib/utils"
import {
  buildRubric,
  describeRubricSection,
  rubricCounts,
  type RubricSection,
} from "@/lib/rubric"

/** Which product a rubric belongs to: its API, name, routes and slug rule. */
export interface RubricProduct {
  apiConfig: FormApiConfig
  /** "Business Thesis" or "Life Map". */
  name: string
  /** What the whole rubric is called: "Thesis Rubric" or "Life Map Rubric".
      One section's part of it is its Section Rubric, and one group's rows
      within that are its Criteria. */
  rubricName: string
  /** Student route base, e.g. "/business-thesis". */
  basePath: string
  slug: (title: string) => string
  /** 1–4 scoring rubrics keyed by section slug (see lib/rubric-scoring.ts). */
  scoring?: Record<string, SectionScoring>
}

export function rubricHref(product: Pick<RubricProduct, "basePath">, slug?: string): string {
  return slug ? `${product.basePath}/rubric/${slug}` : `${product.basePath}/rubric`
}

export function rubricPrintHref(product: Pick<RubricProduct, "basePath">, slug?: string): string {
  const base = `${product.basePath}/rubric/print`
  return slug ? `${base}?section=${encodeURIComponent(slug)}` : base
}

/** Which section's rubric a form page should offer. */
export interface SectionRubricRef {
  product: RubricProduct
  slug: string
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
  const { apiConfig, slug, scoring } = product
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
    }).map((s) => (scoring?.[s.slug] ? { ...s, scoring: scoring[s.slug] } : s))
  }, [sections, groups, questions, questionTypes, F.sectionId, F.customGroupId, slug, scoring])

  return { sections: rubric, loading }
}

/** Small outline button that opens a section's Section Rubric page. */
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
      <Link href={href} title="Section Rubric: what this section must cover">
        <HugeiconsIcon icon={BookOpen01Icon} strokeWidth={2} className="size-3.5" />
        Section Rubric
      </Link>
    </Button>
  )
}

const LABEL = "text-muted-foreground text-[11px] font-medium tracking-wide uppercase"

/**
 * Toolbar button on a section page: opens that section's rubric in a
 * slide-over, with a print link for just this section and a link to the
 * full rubric page.
 */
export function SectionRubricButton({ rubric, className }: { rubric: SectionRubricRef; className?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className={cn("gap-2", className)}
        onClick={() => setOpen(true)}
        title="Section Rubric: what this section must cover"
      >
        <HugeiconsIcon icon={BookOpen01Icon} strokeWidth={2} className="size-4" />
        Section Rubric
      </Button>
      {open && <SectionRubricSheet rubric={rubric} open onOpenChange={setOpen} />}
    </>
  )
}

/** The slide-over itself; mounted only while open so the template loads on demand. */
export function SectionRubricSheet({
  rubric,
  open,
  onOpenChange,
}: {
  rubric: SectionRubricRef
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { product, slug } = rubric
  const { sections, loading } = useRubric(product)
  const section = sections.find((s) => s.slug === slug)
  const index = section ? sections.indexOf(section) : -1

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col gap-0 p-0 sm:max-w-2xl">
        <SheetHeader className="shrink-0 gap-1 border-b px-6 py-5 pr-12">
          <p className={LABEL}>
            Section Rubric{index >= 0 && ` · Section ${index + 1} of ${sections.length}`}
          </p>
          <SheetTitle className="text-lg leading-snug font-semibold">
            {section?.title ?? (loading ? "Loading…" : "Rubric")}
          </SheetTitle>
          <SheetDescription className="text-sm">
            {section
              ? `What this section must cover and what success looks like. ${describeRubricSection(section)}.`
              : "What this section must cover and what success looks like."}
          </SheetDescription>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2" asChild>
              <a href={rubricPrintHref(product, slug)} target="_blank" rel="noopener noreferrer">
                <HugeiconsIcon icon={PrinterIcon} strokeWidth={2} className="size-4" />
                Print / PDF
              </a>
            </Button>
            <Button variant="outline" size="sm" className="gap-2" asChild>
              <Link href={rubricHref(product, slug)}>
                <HugeiconsIcon icon={BookOpen01Icon} strokeWidth={2} className="size-4" />
                Open {product.rubricName}
              </Link>
            </Button>
          </div>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : section ? (
            <RubricSectionBody section={section} levels={false} />
          ) : (
            <p className="text-muted-foreground text-sm">This section was not found in the template.</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

/**
 * Button on a group card: opens just that group's Criteria, the rows of
 * the Section Rubric that score this group. `groupId` null means the
 * section's ungrouped questions.
 */
export function GroupCriteriaButton({
  rubric,
  groupId,
  groupName,
  className,
}: {
  rubric: SectionRubricRef
  groupId: number | null
  groupName?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className={cn("gap-2", className)}
        onClick={(e) => {
          e.stopPropagation()
          setOpen(true)
        }}
        title="Criteria: how this group is scored"
      >
        <HugeiconsIcon icon={CheckListIcon} strokeWidth={2} className="size-4" />
        Criteria
      </Button>
      {open && (
        <GroupCriteriaSheet rubric={rubric} groupId={groupId} groupName={groupName} onOpenChange={setOpen} />
      )}
    </>
  )
}

function GroupCriteriaSheet({
  rubric,
  groupId,
  groupName,
  onOpenChange,
}: {
  rubric: SectionRubricRef
  groupId: number | null
  groupName?: string
  onOpenChange: (open: boolean) => void
}) {
  const { product, slug } = rubric
  const { sections, loading } = useRubric(product)
  const section = sections.find((s) => s.slug === slug)
  const criteria = section?.scoring ? criteriaForGroup(section.scoring, groupId) : null

  return (
    <Sheet open onOpenChange={onOpenChange}>
      <SheetContent
        className="flex flex-col gap-0 p-0 sm:max-w-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <SheetHeader className="shrink-0 gap-1 border-b px-6 py-5 pr-12">
          <p className={LABEL}>Criteria{section && ` · ${section.title}`}</p>
          <SheetTitle className="text-lg leading-snug font-semibold">
            {groupName ? `Criteria for ${groupName}` : section ? `Criteria for ${section.title}` : "Criteria"}
          </SheetTitle>
          <SheetDescription className="text-sm">
            The rows of the {section?.title ?? "section"} Section Rubric that score this group, and
            what each level looks like.
          </SheetDescription>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2" asChild>
              <Link href={rubricHref(product, slug)}>
                <HugeiconsIcon icon={BookOpen01Icon} strokeWidth={2} className="size-4" />
                Open Section Rubric
              </Link>
            </Button>
          </div>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : criteria && criteria.criteria.length > 0 ? (
            <RubricScoringTable scoring={criteria} />
          ) : (
            <p className="text-muted-foreground text-sm">
              No criteria are tied to this group yet. The Section Rubric has every row for the section.
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

/**
 * One section's rubric: what the section is for and how its parts fit
 * together, the requirements derived from the template, then the 1–4
 * scoring rubric. Shared by the page, the slide-over and the printed
 * version, which passes its type scale through `tone`.
 */
export function RubricSectionBody({
  section,
  tone = "screen",
  levels = true,
  card = false,
  header,
}: {
  section: RubricSection
  tone?: "screen" | "print"
  /** Off in the section slide-over: criteria and their overviews, no 1–4 levels. */
  levels?: boolean
  /** On the rubric page: the overview (and `header`) sit in a card. */
  card?: boolean
  /** The section's title block, shown as the card's header. */
  header?: React.ReactNode
}) {
  const print = tone === "print"
  const summary = section.scoring?.summary
  const hasAbout = !!section.description?.trim() || !!summary
  const overview = (
    <>
      {hasAbout && (
        <div data-keep>
          <p className={cn(LABEL, print && "text-gray-500")}>About this section</p>
          {section.description?.trim() && (
            <Markdown
              text={section.description}
              className={cn("mt-1 font-medium", print ? "text-[11pt] leading-relaxed" : "text-sm")}
            />
          )}
          {summary && (
            <p
              className={cn(
                "mt-2 leading-relaxed",
                print ? "text-[10.5pt] text-gray-700" : "text-muted-foreground text-sm"
              )}
            >
              {summary}
            </p>
          )}
        </div>
      )}

      {section.requirements.length > 0 && (
        <div
          data-keep
          className={cn("rounded-lg border px-4 py-3", print ? "border-gray-300 bg-gray-50" : "bg-muted/40")}
        >
          <p className={cn(LABEL, print && "text-gray-500")}>Requirements</p>
          <ul
            className={cn(
              "mt-1.5 list-disc space-y-1 pl-5 leading-snug",
              !print && "marker:text-muted-foreground",
              print ? "text-[10.5pt]" : "text-sm"
            )}
          >
            {section.requirements.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
  const hasOverview = hasAbout || section.requirements.length > 0
  const inCard = card && !print && (hasOverview || !!header)
  return (
    <div className={cn("space-y-6", print && "space-y-5")}>
      {inCard ? (
        <Card className="gap-0 py-0">
          {header && (
            <CardHeader className={cn("py-4", hasOverview && "border-b")}>{header}</CardHeader>
          )}
          {hasOverview && <CardContent className="space-y-4 py-4">{overview}</CardContent>}
        </Card>
      ) : (
        overview
      )}

      {section.scoring ? (
        <RubricScoringTable scoring={section.scoring} print={print} levels={levels} />
      ) : (
        section.components.length === 0 && (
          <p className={cn("text-muted-foreground text-sm", print && "text-gray-500")}>
            No questions have been published in this section yet.
          </p>
        )
      )}
    </div>
  )
}

/** The section a rubric URL points at: `<basePath>/rubric/<slug>`, or none for the full rubric. */
function activeRubricSlug(pathname: string | null, product: RubricProduct, fallback?: string): string | undefined {
  const prefix = `${product.basePath}/rubric`
  if (!pathname) return fallback
  if (pathname === prefix) return undefined
  if (pathname.startsWith(`${prefix}/`)) {
    const rest = pathname.slice(prefix.length + 1).split("/")[0]
    return rest ? decodeURIComponent(rest) : undefined
  }
  return fallback
}

/**
 * Chip click: rewrite the URL in place instead of a router navigation. Next
 * keeps usePathname in sync with history.pushState, so the page re-renders
 * on the new section from data it already holds, and Back/Forward walk the
 * visited sections. Modified clicks (new tab, etc.) behave as normal links.
 */
function switchSection(e: React.MouseEvent<HTMLAnchorElement>) {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
  e.preventDefault()
  const href = e.currentTarget.getAttribute("href")
  if (!href || href === window.location.pathname) return
  window.history.pushState(null, "", href)
  // Signed-in pages scroll inside the app shell's main column, not the window.
  document.querySelector('[data-slot="sidebar-inset"]')?.scrollTo({ top: 0 })
  window.scrollTo({ top: 0 })
}

/**
 * The standalone rubric page: one section when `slug` is given, otherwise
 * every section in order. Chips switch sections; the print link opens the
 * paginated version.
 */
export function RubricPage({ product, slug: routeSlug }: { product: RubricProduct; slug?: string }) {
  const { sections, loading } = useRubric(product)
  // The section comes from the address bar, not just the route params:
  // switching chips rewrites the URL in place (see switchSection), so every
  // section is reachable without a server round trip once the template has
  // loaded. Reloading or sharing the URL still lands on the same section.
  const pathname = usePathname()
  const slug = activeRubricSlug(pathname, product, routeSlug)
  const current = slug ? sections.find((s) => s.slug === slug) : undefined
  const shown = current ? [current] : sections
  const backHref = current ? `${product.basePath}/${current.slug}` : product.basePath

  if (loading) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-4 md:p-6">
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
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 p-4 md:p-6">
        <h1 className="text-2xl font-bold">{product.rubricName}</h1>
        <p className="text-muted-foreground">This section was not found. It may have been removed.</p>
        <div>
          <Button variant="outline" size="sm" asChild className="gap-2">
            <Link href={rubricHref(product)}>
              <HugeiconsIcon icon={ArrowLeft02Icon} strokeWidth={2} className="size-4" />
              {product.rubricName}
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-4 md:p-6">
      <div>
        <p className={LABEL}>{current ? `${product.rubricName} · Section Rubric` : product.name}</p>
        <h1 className="mt-1 text-2xl font-bold">
          {current ? current.title : product.rubricName}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {current
            ? `What this section must cover and how it is scored. ${describeRubricSection(current)}.`
            : `Each section is a major component of the ${product.name}. For every section, what it must cover and how it is scored from 1 to 4.`}
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
      <nav aria-label="Sections" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <SectionButton href={rubricHref(product)} active={!current} label="All sections" marker={
          <HugeiconsIcon icon={GridViewIcon} strokeWidth={2} className="size-4" />
        } />
        {sections.map((s, i) => (
          <SectionButton
            key={s.id}
            href={rubricHref(product, s.slug)}
            active={current?.id === s.id}
            label={s.title}
            marker={i + 1}
            locked={s.locked}
          />
        ))}
      </nav>

      {shown.length === 0 ? (
        <p className="text-muted-foreground text-sm">No sections have been published yet.</p>
      ) : (
        <div className="space-y-10">
          {shown.map((section, index) => (
            <section key={section.id}>
              <RubricSectionBody
                section={section}
                card
                header={
                  current ? undefined : (
                    <div className="flex items-start gap-3">
                      <span className="bg-primary/10 text-primary inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-sm font-semibold tabular-nums">
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
                    </div>
                  )
                }
              />
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * One section in the switcher: an outline button (filled when it's the one
 * showing) with the section's number, its title and a lock if it's locked.
 */
function SectionButton({
  href,
  active,
  label,
  marker,
  locked = false,
}: {
  href: string
  active: boolean
  label: string
  marker: React.ReactNode
  locked?: boolean
}) {
  return (
    <Button
      asChild
      variant={active ? "default" : "outline"}
      className={cn(
        "h-auto min-h-12 justify-start gap-3 px-3 py-2 text-left whitespace-normal",
        !active && locked && "text-muted-foreground"
      )}
    >
      <a href={href} onClick={switchSection} aria-current={active ? "page" : undefined}>
        <span
          className={cn(
            "inline-flex size-7 shrink-0 items-center justify-center rounded-md text-xs font-semibold tabular-nums",
            active ? "bg-primary-foreground/15" : "bg-primary/10 text-primary"
          )}
        >
          {marker}
        </span>
        <span className="min-w-0 flex-1 text-sm leading-snug font-medium">{label}</span>
        {locked && <HugeiconsIcon icon={SquareLock02Icon} strokeWidth={1.5} className="size-4 shrink-0 opacity-70" />}
      </a>
    </Button>
  )
}

export { rubricCounts }
