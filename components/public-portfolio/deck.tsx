"use client"

import type { CSSProperties, ReactNode } from "react"
import { ArrowRight } from "lucide-react"
import { inkFor, useBrandTheme } from "@/components/brand-display"
import { StatusBadge, statusOf, type FieldStatus } from "@/components/field-status"
import { LazyRichTextDisplay } from "@/components/form/rich-text-display-lazy"
import { looksLikeRichTextDoc } from "@/lib/rich-text"
import { cn } from "@/lib/utils"
import { AlignEssaysStart, Answer, SourceFooter } from "./answers"
import { sameTitle } from "./format"
import { Reveal } from "./motion"
import { familyOf, isReadingGroup, isReadingSet, splitReading } from "./reading"
import {
  GroupBody,
  QuestionsBody,
  SectionHero,
  SourcesInFooter,
  UNIT_SPAN,
  groupAction,
  groupStatus,
  groupUnits,
} from "./sections"
import { goToChapter } from "./shell"
import type { PortfolioGroupModel, PortfolioQuestion, PortfolioSectionModel, ResponseMap } from "./types"

/**
 * A deck slide: a white 16:9 page (taller when its content needs it) with
 * the brand across the top and the slide number at the bottom.
 */
const SLIDE =
  "@container flex w-full flex-col rounded-2xl bg-white p-6 shadow-[0_1px_2px_rgb(15_23_42/0.04),0_18px_44px_-20px_rgb(15_23_42/0.22)] ring-1 ring-[#e6eaf2] sm:p-10 md:aspect-[16/9] lg:p-12"

const pad = (n: number) => String(n).padStart(2, "0")

interface SlideGroups {
  groups: PortfolioGroupModel[]
  /** Long writing: a rail beside text in columns, one row per group. */
  reading: boolean
}

/** At most this many reading groups stack on one slide. */
const READING_ROWS = 3

/**
 * A section's groups as slides, laid out by their template widths: a
 * full-width group fills a slide, and halves and thirds share one as columns.
 * A group with real writing in it gets a reading slide of its own instead,
 * and sibling reading groups (the three "Messaging Locations") stack on one.
 */
function packSlides(groups: PortfolioGroupModel[], responseMap: ResponseMap): SlideGroups[] {
  const slides: SlideGroups[] = []
  let row: PortfolioGroupModel[] = []
  let used = 0
  const flush = () => {
    if (row.length > 0) slides.push({ groups: row, reading: false })
    row = []
    used = 0
  }
  for (let i = 0; i < groups.length; i++) {
    const group = groups[i]
    if (isReadingGroup(group, responseMap)) {
      flush()
      const family = familyOf(group.name)
      const run = [group]
      while (
        i + 1 < groups.length &&
        run.length < READING_ROWS &&
        isReadingGroup(groups[i + 1], responseMap) &&
        familyOf(groups[i + 1].name) === family
      ) {
        run.push(groups[++i])
      }
      slides.push({ groups: run, reading: true })
      continue
    }
    const units = groupUnits(group)
    if (row.length > 0 && used + units > 6) flush()
    row.push(group)
    used += units
    if (used >= 6) flush()
  }
  flush()
  return slides
}

/**
 * The Business Thesis as a single-page deck: a contents slide, then each
 * section as a divider slide followed by its content slides. Slide numbers
 * run through the whole deck, with the cover as slide 1.
 */
export function DeckSections({
  sections,
  responseMap,
  studentName,
}: {
  sections: PortfolioSectionModel[]
  responseMap: ResponseMap
  studentName: string
}) {
  let next = 3
  const plan = sections.map((section) => {
    const divider = next++
    const slides: { key: string; number: number; groups: PortfolioGroupModel[] | null; reading: boolean }[] = []
    if (section.ungrouped.length > 0) {
      slides.push({ key: "ungrouped", number: next++, groups: null, reading: isReadingSet(section.ungrouped, responseMap) })
    }
    for (const { groups, reading } of packSlides(section.groups, responseMap)) {
      slides.push({ key: groups.map((g) => g.id).join("-"), number: next++, groups, reading })
    }
    return { section, divider, slides }
  })

  // The section's answers outside any group, treated as one group titled by
  // the section (the Executive Summary is one long essay).
  const ungroupedAs = (section: PortfolioSectionModel): PortfolioGroupModel => ({
    id: -section.id,
    name: section.title,
    description: "",
    displayTypeId: null,
    iconName: null,
    width: null,
    questions: section.ungrouped,
  })

  return (
    <AlignEssaysStart.Provider value>
      <SourcesInFooter.Provider value>
      {sections.length > 0 && <ContentsSlide sections={sections} studentName={studentName} />}
      {plan.map(({ section, divider, slides }) => (
        <section
          key={section.id}
          id={section.anchor}
          className="scroll-mt-28 space-y-6 pt-12 md:space-y-8 md:pt-16 xl:scroll-mt-20"
        >
          <SectionHero
            section={section}
            total={sections.length}
            deck
            chrome={<SlideHeader label={pad(divider)} studentName={studentName} light />}
          />
          {slides.map((slide) => {
            const groups = slide.groups ?? [ungroupedAs(section)]
            const questions = groups.flatMap((g) => g.questions)
            return (
              <Slide
                key={slide.key}
                header={<SlideHeader label={`${pad(section.number)} · ${section.title}`} studentName={studentName} />}
                sources={<SourceFooter questions={questions} responseMap={responseMap} />}
                footer={<SlideFooter number={slide.number} studentName={studentName} />}
              >
                {slide.reading ? (
                  <ReadingSlideBody groups={groups} sectionTitle={section.title} responseMap={responseMap} />
                ) : slide.groups ? (
                  <GroupsSlideBody groups={slide.groups} sectionTitle={section.title} responseMap={responseMap} />
                ) : (
                  <>
                    <SlideTitle title={section.title} />
                    <div className="mt-8">
                      <QuestionsBody
                        questions={section.ungrouped}
                        responseMap={responseMap}
                        sectionTitle={section.title}
                        compactColors
                      />
                    </div>
                  </>
                )}
              </Slide>
            )
          })}
          {slides.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">Nothing in this section yet.</p>
          )}
        </section>
      ))}
      </SourcesInFooter.Provider>
    </AlignEssaysStart.Provider>
  )
}

function Slide({
  header,
  sources,
  footer,
  children,
}: {
  header: ReactNode
  /** The slide's citations, pinned above the footer. */
  sources?: ReactNode
  footer: ReactNode
  children: ReactNode
}) {
  return (
    <Reveal>
      <article className={SLIDE}>
        {header}
        <div className="mt-8 flex flex-1 flex-col md:mt-10">
          <div>{children}</div>
          {sources && <div className="mt-auto pt-10 empty:hidden">{sources}</div>}
        </div>
        {footer}
      </article>
    </Reveal>
  )
}

/** Logo (or monogram) and company name, as on every slide of a company deck. */
function BrandMark({ studentName, light = false }: { studentName: string; light?: boolean }) {
  const brand = useBrandTheme()
  const name = brand.companyName || studentName || "Business Thesis"
  const markBg = brand.accent ?? "#0f1f52"
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      {brand.logoUrl ? (
        <img src={brand.logoUrl} alt="" className="size-7 shrink-0 rounded-full bg-white object-cover ring-1 ring-black/10" />
      ) : (
        <span
          aria-hidden
          className="flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
          style={{ background: markBg, color: inkFor(markBg) }}
        >
          {name.charAt(0).toUpperCase()}
        </span>
      )}
      <span className={cn("truncate text-[13px] font-semibold tracking-tight", light ? "text-white/90" : "text-foreground")}>
        {name}
      </span>
    </span>
  )
}

function SlideHeader({ label, studentName, light = false }: { label: string; studentName: string; light?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <BrandMark studentName={studentName} light={light} />
      <span
        className={cn(
          "min-w-0 truncate text-[11px] font-semibold tracking-[0.18em] uppercase tabular-nums",
          light ? "text-white/70" : "text-muted-foreground"
        )}
      >
        {label}
      </span>
    </div>
  )
}

function SlideFooter({ number, studentName }: { number: number; studentName: string }) {
  return (
    <div className="mt-10 flex items-center justify-between gap-4 border-t border-[#eef1f6] pt-4 text-[11px] font-medium tracking-[0.16em] text-muted-foreground/80 uppercase">
      <span className="min-w-0 truncate">Business Thesis{studentName ? ` · ${studentName}` : ""}</span>
      <span className="shrink-0 tabular-nums">{pad(number)}</span>
    </div>
  )
}

/** A slide's headline: a short brand-color rule, then the title in the brand's headline face. */
function SlideTitle({
  title,
  description,
  status,
  action,
  size = "slide",
}: {
  title: string
  description?: string
  status?: FieldStatus | null
  action?: ReactNode
  /** "column" for one of several groups sharing a slide. */
  size?: "slide" | "column"
}) {
  const brand = useBrandTheme()
  const badge = status && status !== "complete" ? status : null
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <span
          aria-hidden
          className="mb-4 block h-1 w-10 rounded-full"
          style={{ background: brand.accent ?? "var(--pf-ink)" }}
        />
        <h3
          className={cn(
            "font-(family-name:--pf-display) leading-[1.05] font-bold tracking-[-0.02em] text-balance text-[var(--pf-ink)]",
            size === "slide" ? "text-[clamp(1.75rem,3.4vw,2.75rem)]" : "text-[clamp(1.375rem,2.2vw,1.875rem)]"
          )}
        >
          {title}
        </h3>
        {description && (
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-pretty text-muted-foreground sm:text-base">
            {description}
          </p>
        )}
      </div>
      {(badge || action) && (
        <div className="flex shrink-0 items-center gap-2">
          <StatusBadge status={badge} />
          {action}
        </div>
      )}
    </div>
  )
}

/**
 * Groups with real writing in them, one row each: the heading, images, and
 * facts in a rail on the left, the writing in two columns on the right.
 */
function ReadingSlideBody({
  groups,
  sectionTitle,
  responseMap,
}: {
  groups: PortfolioGroupModel[]
  sectionTitle: string
  responseMap: ResponseMap
}) {
  const single = groups.length === 1
  return (
    <div className="divide-y divide-[#eef1f6]">
      {groups.map((group, i) => {
        const { rail, prose } = splitReading(group.questions)
        return (
          <div
            key={group.id}
            className={cn(
              "grid gap-x-12 gap-y-6 md:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] lg:gap-x-16",
              i > 0 && "pt-10",
              i < groups.length - 1 && "pb-10"
            )}
          >
            <div className="@container">
              <SlideTitle
                title={group.name}
                description={group.description}
                status={groupStatus(group, responseMap)}
                action={groupAction(group, responseMap)}
                size={single ? "slide" : "column"}
              />
              {rail.length > 0 && (
                <div className="mt-6 space-y-5">
                  {rail.map((q) => (
                    <div key={q.id} className="empty:hidden">
                      <Answer
                        question={q}
                        response={responseMap.get(q.id)}
                        groupTitle={group.name}
                        sectionTitle={sectionTitle}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="@container md:pt-1">
              <div className="space-y-8 @3xl:columns-2 @3xl:gap-x-10">
                {prose.map((q) => (
                  <ReadingPassage
                    key={q.id}
                    question={q}
                    responseMap={responseMap}
                    groupTitle={group.name}
                    sectionTitle={sectionTitle}
                  />
                ))}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/**
 * One passage of a reading row. It renders plain blocks (no flex) so the
 * text can flow across the row's columns; an unapproved passage shows only
 * its label and review status, as answers do elsewhere.
 */
function ReadingPassage({
  question,
  responseMap,
  groupTitle,
  sectionTitle,
}: {
  question: PortfolioQuestion
  responseMap: ResponseMap
  groupTitle: string
  sectionTitle: string
}) {
  const response = responseMap.get(question.id)
  const title = (question.public_display_title || question.field_label || "").trim()
  const showTitle = !!title && !sameTitle(title, groupTitle) && !sameTitle(title, sectionTitle)
  const raw = statusOf(response)
  const status = raw === "complete" ? null : raw
  const text = (response?.student_response ?? "").trim()
  const approved = response?.isComplete === true && !!text

  if (!approved) {
    if (!status) return null
    return (
      <div className="flex items-start justify-between gap-3 break-inside-avoid">
        {showTitle ? <p className="text-[13px] leading-snug font-medium text-muted-foreground/70">{title}</p> : <span />}
        <StatusBadge status={status} />
      </div>
    )
  }

  return (
    <div>
      {showTitle && (
        <p className="mb-3 text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">{title}</p>
      )}
      {looksLikeRichTextDoc(text) ? (
        <LazyRichTextDisplay raw={text} fullSize className="text-foreground" />
      ) : (
        <div className="space-y-4 text-base leading-[1.7] text-pretty text-foreground/90 sm:text-[17px]">
          {text.split(/\n\s*\n/).map((paragraph, i) => (
            <p key={i} className="whitespace-pre-line [overflow-wrap:anywhere]">
              {paragraph}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

/** One group across the slide, or several as columns, each with its own heading. */
function GroupsSlideBody({
  groups,
  sectionTitle,
  responseMap,
}: {
  groups: PortfolioGroupModel[]
  sectionTitle: string
  responseMap: ResponseMap
}) {
  if (groups.length === 1) {
    const group = groups[0]
    return (
      <>
        <SlideTitle
          title={group.name}
          description={group.description}
          status={groupStatus(group, responseMap)}
          action={groupAction(group, responseMap)}
        />
        <div className="mt-8">
          <GroupBody group={group} sectionTitle={sectionTitle} responseMap={responseMap} compactColors />
        </div>
      </>
    )
  }
  const units = groups.reduce((sum, g) => sum + groupUnits(g), 0)
  return (
    <div
      className="grid grid-cols-1 gap-12 md:grid-cols-[repeat(var(--units),minmax(0,1fr))] md:gap-10 lg:gap-14"
      style={{ "--units": units } as CSSProperties}
    >
      {groups.map((group) => (
        // Each column is its own container, so its answers lay out by the column's width.
        <div key={group.id} className={cn("@container min-w-0", UNIT_SPAN[groupUnits(group)])}>
          <SlideTitle
            title={group.name}
            description={group.description}
            status={groupStatus(group, responseMap)}
            action={groupAction(group, responseMap)}
            size="column"
          />
          <div className="mt-6">
            <GroupBody group={group} sectionTitle={sectionTitle} responseMap={responseMap} compactColors />
          </div>
        </div>
      ))}
    </div>
  )
}

/** The deck's second slide: every section, numbered, each a link. */
function ContentsSlide({ sections, studentName }: { sections: PortfolioSectionModel[]; studentName: string }) {
  return (
    <Slide
      header={<SlideHeader label="Contents" studentName={studentName} />}
      footer={<SlideFooter number={2} studentName={studentName} />}
    >
      <SlideTitle title="Contents" />
      <ol className="mt-8 grid grid-cols-1 gap-x-14 @3xl:grid-cols-2">
        {sections.map((s) => (
          <li key={s.id} className="border-t border-[#e6eaf2]">
            <a
              href={`#${s.anchor}`}
              onClick={(e) => {
                e.preventDefault()
                goToChapter(s.anchor)
              }}
              className="group flex items-center gap-5 py-4"
            >
              <span className="w-10 shrink-0 font-(family-name:--pf-heading) text-2xl font-semibold text-[var(--pf-ink)] tabular-nums">
                {pad(s.number)}
              </span>
              <span className="min-w-0 flex-1 text-lg font-medium transition-colors duration-150 group-hover:text-[var(--pf-ink)]">
                {s.title}
              </span>
              <ArrowRight
                aria-hidden
                strokeWidth={1.75}
                className="size-4 shrink-0 text-muted-foreground transition-[translate,color] duration-150 group-hover:translate-x-0.5 group-hover:text-[var(--pf-ink)]"
              />
            </a>
          </li>
        ))}
      </ol>
    </Slide>
  )
}
