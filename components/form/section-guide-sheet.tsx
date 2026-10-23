"use client"

import { useEffect, useMemo, useRef } from "react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { HugeiconsIcon } from "@hugeicons/react"
import { BookOpen01Icon, PrinterIcon, SquareLock02Icon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { Markdown } from "@/components/markdown"
import { cn } from "@/lib/utils"

const LABEL = "text-muted-foreground text-[11px] font-medium tracking-wide uppercase"

export interface GuideQuestion {
  id: number
  label: string
  typeName?: string | null
  minWords?: number | null
  instructions?: string | null
  /** Shown to teachers only. */
  teacherGuideline?: string | null
}

export interface GuideGroup {
  id: number | null
  name: string
  description?: string | null
  instructions?: string | null
  questions: GuideQuestion[]
}

export interface GuideSection {
  id: number
  title: string
  description?: string | null
  locked: boolean
  groups: GuideGroup[]
}

/** The fields the guide reads off a template question, whichever product. */
export interface GuideQuestionSource {
  id: number
  field_label: string
  field_name: string
  min_words?: number | null
  detailed_instructions?: string | null
  teacher_guideline?: string | null
  sortOrder?: number
}

/**
 * Builds the guide's outline from the overview page's data: every section in
 * order, each group inside it with its questions, and an "Ungrouped" entry for
 * questions that sit directly in a section. Accessors isolate the Life Map and
 * Business Thesis column names.
 */
export function buildSectionGuide<
  S extends { id: number; section_title: string; isLocked?: boolean },
  G extends { id: number; group_name: string; group_description?: string | null; instructions?: string | null },
  Q extends GuideQuestionSource,
>(
  rows: { section: S; groups: G[] }[],
  questions: Q[],
  accessors: {
    sectionId: (q: Q) => number
    groupId: (q: Q) => number | null
    sectionDescription: (s: S) => string | null | undefined
    typeName: (q: Q) => string | null | undefined
  }
): GuideSection[] {
  const toGuideQuestion = (q: Q): GuideQuestion => ({
    id: q.id,
    label: q.field_label || q.field_name,
    typeName: accessors.typeName(q),
    minWords: q.min_words,
    instructions: q.detailed_instructions,
    teacherGuideline: q.teacher_guideline,
  })

  return rows.map(({ section, groups }) => {
    const sectionQs = questions
      .filter((q) => accessors.sectionId(q) === section.id)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    const guideGroups: GuideGroup[] = groups.map((g) => ({
      id: g.id,
      name: g.group_name,
      description: g.group_description,
      instructions: g.instructions,
      questions: sectionQs.filter((q) => accessors.groupId(q) === g.id).map(toGuideQuestion),
    }))
    const ungrouped = sectionQs.filter((q) => !accessors.groupId(q))
    if (ungrouped.length > 0) {
      guideGroups.push({
        id: null,
        name: groups.length > 0 ? "Ungrouped" : section.section_title,
        questions: ungrouped.map(toGuideQuestion),
      })
    }
    return {
      id: section.id,
      title: section.section_title,
      description: accessors.sectionDescription(section),
      locked: section.isLocked ?? false,
      groups: guideGroups,
    }
  })
}

function sectionAnchor(id: number) {
  return `guide-section-${id}`
}

/**
 * One scrolling guide to the whole project: every section, the groups that
 * make it up, and what each question asks for (type, length, instructions).
 * Opening it from a section row scrolls that section into view; a jump list
 * at the top reaches the rest.
 */
export function SectionGuideSheet({
  open,
  onOpenChange,
  projectName,
  sections,
  focusSectionId,
  viewer,
  printHref,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** "Business Thesis" or "Life Map". */
  projectName: string
  sections: GuideSection[]
  /** Section to scroll to on open; null starts at the top. */
  focusSectionId: number | null
  viewer: "student" | "teacher"
  /** The printable, paginated version of this guide (opens in a new tab). */
  printHref?: string
}) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const totals = useMemo(() => {
    const groups = sections.reduce((n, s) => n + s.groups.filter((g) => g.id !== null).length, 0)
    const questions = sections.reduce(
      (n, s) => n + s.groups.reduce((m, g) => m + g.questions.length, 0),
      0
    )
    return { sections: sections.length, groups, questions }
  }, [sections])

  // Scroll the focused section to the top once the sheet's content is in the
  // DOM. The open animation runs alongside; instant scroll avoids fighting it.
  useEffect(() => {
    if (!open) return
    const frame = requestAnimationFrame(() => {
      const container = scrollRef.current
      if (!container) return
      if (focusSectionId === null) {
        container.scrollTop = 0
        return
      }
      const el = container.querySelector<HTMLElement>(`#${sectionAnchor(focusSectionId)}`)
      if (el) container.scrollTop = el.offsetTop
    })
    return () => cancelAnimationFrame(frame)
  }, [open, focusSectionId])

  const jumpTo = (id: number) => {
    const container = scrollRef.current
    const el = container?.querySelector<HTMLElement>(`#${sectionAnchor(id)}`)
    if (container && el) container.scrollTo({ top: el.offsetTop, behavior: "smooth" })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="shrink-0 gap-1.5 border-b px-6 py-5 pr-12">
          <div className="flex items-center justify-between gap-3">
            <p className={LABEL}>{projectName} guide</p>
            {printHref && (
              <Button variant="outline" size="sm" className="h-7 gap-1.5 px-2 text-xs" asChild>
                <a href={printHref} target="_blank" rel="noopener noreferrer" title="Open a printable version to print or save as PDF">
                  <HugeiconsIcon icon={PrinterIcon} strokeWidth={2} className="size-3.5" />
                  Print / PDF
                </a>
              </Button>
            )}
          </div>
          <SheetTitle className="text-lg leading-snug font-semibold">
            Sections, groups, and what each one asks for
          </SheetTitle>
          <SheetDescription className="text-sm">
            Your {projectName} is built from {totals.sections} sections. Each section is a
            major component of the finished work, made up of smaller groups of questions.
            Work through a section group by group; a section is done when every group in
            it is complete.
          </SheetDescription>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {sections.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => jumpTo(s.id)}
                className={cn(
                  "hover:bg-accent hover:text-foreground inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
                  s.locked ? "text-muted-foreground/60" : "text-muted-foreground"
                )}
              >
                {s.locked && <HugeiconsIcon icon={SquareLock02Icon} strokeWidth={1.5} className="size-3" />}
                {s.title}
              </button>
            ))}
          </div>
        </SheetHeader>

        <div ref={scrollRef} className="relative flex-1 overflow-y-auto">
          {sections.length === 0 ? (
            <p className="text-muted-foreground px-6 py-10 text-center text-sm">
              No sections have been published yet.
            </p>
          ) : (
            sections.map((section, index) => (
              <section
                key={section.id}
                id={sectionAnchor(section.id)}
                className={cn("scroll-mt-0", index > 0 && "border-t-4 border-border/60")}
              >
                {/* Sticky section header: readers always know which major
                    component the groups below belong to. */}
                <div className="bg-background/95 supports-backdrop-filter:bg-background/80 sticky top-0 z-10 border-b px-6 py-4 backdrop-blur">
                  <div className="flex items-start gap-3">
                    <span className="bg-primary/10 text-primary mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-md text-xs font-semibold tabular-nums">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className={LABEL}>Section {index + 1} of {sections.length}</p>
                        {section.locked && (
                          <span className="text-muted-foreground inline-flex items-center gap-1 text-[11px]">
                            <HugeiconsIcon icon={SquareLock02Icon} strokeWidth={1.5} className="size-3" />
                            Locked
                          </span>
                        )}
                      </div>
                      <h3 className="text-base leading-snug font-semibold">{section.title}</h3>
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        {describeCounts(section)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-6 px-6 py-5">
                  {section.description?.trim() && (
                    <div className="space-y-1.5">
                      <p className={LABEL}>What this section covers</p>
                      <Markdown text={section.description} className="text-sm" />
                    </div>
                  )}

                  {section.groups.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No questions published in this section yet.</p>
                  ) : (
                    <div className="space-y-5">
                      {section.groups.map((group, gi) => (
                        <GroupGuide
                          key={group.id ?? `ungrouped-${section.id}`}
                          group={group}
                          index={gi}
                          viewer={viewer}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </section>
            ))
          )}
          <div className="text-muted-foreground flex items-center justify-center gap-2 border-t px-6 py-6 text-xs">
            <HugeiconsIcon icon={BookOpen01Icon} strokeWidth={1.5} className="size-3.5" />
            {totals.sections} sections · {totals.groups} groups · {totals.questions} questions
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function describeCounts(section: GuideSection): string {
  const groups = section.groups.filter((g) => g.id !== null).length
  const questions = section.groups.reduce((n, g) => n + g.questions.length, 0)
  const parts: string[] = []
  if (groups > 0) parts.push(`${groups} group${groups === 1 ? "" : "s"}`)
  parts.push(`${questions} question${questions === 1 ? "" : "s"}`)
  return parts.join(" · ")
}

function GroupGuide({
  group,
  index,
  viewer,
}: {
  group: GuideGroup
  index: number
  viewer: "student" | "teacher"
}) {
  const wordTotal = group.questions.reduce((n, q) => n + (q.minWords ?? 0), 0)

  return (
    <div className="border-primary/20 border-l-2 pl-4">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <p className={LABEL}>{group.id === null ? "Also in this section" : `Group ${index + 1}`}</p>
        <h4 className="text-sm font-semibold">{group.name}</h4>
      </div>
      <p className="text-muted-foreground mt-0.5 text-xs">
        {group.questions.length} question{group.questions.length === 1 ? "" : "s"}
        {wordTotal > 0 && ` · at least ${wordTotal.toLocaleString()} words in total`}
      </p>

      {group.description?.trim() && (
        <Markdown
          text={group.description}
          className="mt-2 text-sm [--tw-prose-body:var(--muted-foreground)]"
        />
      )}

      {group.instructions?.trim() && (
        <div className="bg-muted/50 mt-3 rounded-md px-3.5 py-3">
          <p className={cn(LABEL, "mb-1.5")}>Group instructions</p>
          <Markdown text={group.instructions} className="text-sm" />
        </div>
      )}

      {group.questions.length > 0 && (
        <ol className="mt-3 space-y-2.5">
          {group.questions.map((q, qi) => (
            <li key={q.id} className="rounded-md border px-3.5 py-3">
              <div className="flex items-start gap-2.5">
                <span className="text-muted-foreground mt-px shrink-0 text-xs tabular-nums">{qi + 1}.</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-snug">{q.label}</p>
                  {(q.typeName || (q.minWords ?? 0) > 0) && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {q.typeName && (
                        <span className="bg-muted rounded-full px-2 py-0.5 text-[11px] font-medium">
                          {q.typeName}
                        </span>
                      )}
                      {(q.minWords ?? 0) > 0 && (
                        <span className="bg-muted rounded-full px-2 py-0.5 text-[11px] font-medium">
                          {q.minWords} words minimum
                        </span>
                      )}
                    </div>
                  )}
                  {q.instructions?.trim() && (
                    <Markdown
                      text={q.instructions}
                      className="mt-2 text-xs [--tw-prose-body:var(--muted-foreground)]"
                    />
                  )}
                  {viewer === "teacher" && q.teacherGuideline?.trim() && (
                    <div className="mt-2 rounded-md border border-dashed border-amber-300/70 bg-amber-50/60 px-3 py-2 dark:border-amber-500/30 dark:bg-amber-500/5">
                      <p className={cn(LABEL, "mb-1 text-amber-700 dark:text-amber-400")}>Teacher guideline</p>
                      <Markdown text={q.teacherGuideline} className="text-xs" />
                    </div>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
