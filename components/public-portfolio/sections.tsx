"use client"

import type { ComponentProps, ReactNode } from "react"
import { motion } from "motion/react"
import {
  DISPLAY_TYPE,
  GoogleSheetOpenButton,
  GroupDisplayRenderer,
  getGoogleSheetUrl,
  isGroupDisplayType,
} from "@/components/group-display-types"
import { StatusBadge, groupStatusOf, type FieldStatus } from "@/components/field-status"
import { aspectRatioCss } from "@/lib/image-ratio"
import { cn } from "@/lib/utils"
import { Answer, GroupIcon, SourceList } from "./answers"
import { ContourField } from "./contours"
import { hasSource, sameTitle } from "./format"
import { EASE, GhostNumeral, HeroPhoto, Reveal, WordReveal } from "./motion"
import { ImageStrip } from "./motion-plus"
import { heroAngle, heroGradient, heroPhotoWash } from "./theme"
import {
  QUESTION_TYPE,
  isShortType,
  resolveImageUrl,
  typeOf,
  widthOf,
  type PortfolioGroupModel,
  type PortfolioQuestion,
  type PortfolioResponse,
  type PortfolioSectionModel,
  type ResponseMap,
} from "./types"

type DisplayQuestions = ComponentProps<typeof GroupDisplayRenderer>["questions"]
type DisplayResponses = ComponentProps<typeof GroupDisplayRenderer>["responseMap"]

interface SectionSource {
  id: number
  section_title: string
  photo?: { path?: string } | null
}

interface GroupSource {
  id: number
  group_name: string
  group_description?: string | null
  order?: number
  icon_name?: string | null
}

/**
 * Sections in reading order, each with its hero photo resolved, its answers
 * sorted, and its groups filled. Life Map and Business Thesis store the same
 * shapes under different column names; the accessors say which.
 */
export function buildPortfolioSections<S extends SectionSource, Q extends PortfolioQuestion, G extends GroupSource>({
  sections,
  questions,
  groups,
  responseMap,
  sectionOf,
  groupOf,
  groupSectionOf,
  displayTypeOf,
  descriptionOf,
  isBackdrop,
  isHidden,
}: {
  sections: S[]
  questions: Q[]
  groups: G[]
  responseMap: ResponseMap
  sectionOf: (q: Q) => number
  groupOf: (q: Q) => number | null
  groupSectionOf: (g: G) => number
  displayTypeOf: (g: G) => number | null
  descriptionOf: (s: S) => string
  /** The image question whose approved upload replaces a section's photo. */
  isBackdrop: (q: Q) => boolean
  /** Questions that feed something else (the cover) and never render. */
  isHidden?: (q: Q) => boolean
}): PortfolioSectionModel[] {
  return sections.map((section, i) => {
    const all = questions
      .filter((q) => sectionOf(q) === section.id)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    const backdrop = all.find(isBackdrop)
    const backdropResp = backdrop ? responseMap.get(backdrop.id) : undefined
    // A student's own section photo shows once a teacher has approved it.
    const studentPhoto = backdropResp?.isComplete
      ? backdropResp.image_response?.path || backdropResp.image_response?.url
      : undefined
    const content = all.filter((q) => q !== backdrop && !isHidden?.(q))
    const byGroup = new Map<number, Q[]>()
    for (const q of content) {
      const gid = groupOf(q)
      if (gid) byGroup.set(gid, [...(byGroup.get(gid) ?? []), q])
    }
    return {
      id: section.id,
      anchor: `section-${section.id}`,
      number: i + 1,
      title: section.section_title,
      description: descriptionOf(section),
      photoUrl: studentPhoto
        ? resolveImageUrl(studentPhoto)
        : section.photo?.path
          ? resolveImageUrl(section.photo.path)
          : null,
      ungrouped: content.filter((q) => !groupOf(q)),
      groups: groups
        .filter((g) => groupSectionOf(g) === section.id)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((g) => ({
          id: g.id,
          name: g.group_name,
          description: g.group_description?.trim() ?? "",
          displayTypeId: displayTypeOf(g),
          iconName: g.icon_name?.trim() || null,
          width: widthOf(g),
          questions: byGroup.get(g.id) ?? [],
        }))
        .filter((g) => g.questions.length > 0),
    }
  })
}

/**
 * Panels are white sheets lifted off the page by shadow, with a faint ring for
 * an edge. Each is a container, so its answers lay out by the panel's own
 * width: a third-width panel stacks what a full-width one sets side by side.
 */
const PANEL =
  "@container w-full rounded-2xl bg-white p-6 shadow-[0_1px_2px_rgb(15_23_42/0.04),0_14px_36px_-18px_rgb(15_23_42/0.18)] ring-1 ring-[#e6eaf2] sm:p-8"

function groupColSpan(width: number | null): string {
  if (width === 1) return "md:col-span-6"
  if (width === 3) return "md:col-span-2"
  return "md:col-span-3"
}

const FULL_SPAN = "@sm:col-span-6"

function questionColSpan(q: PortfolioQuestion, text: string, compactColors: boolean): string {
  const width = widthOf(q)
  if (width === 1) return FULL_SPAN
  if (width === 2) return "@sm:col-span-3"
  if (width === 3) return "@sm:col-span-2"
  const typeId = typeOf(q)
  if (typeId === QUESTION_TYPE.SHORT_RESPONSE) {
    // Brand colors sit six to a row, like a palette.
    if (compactColors && /colou?r/i.test(q.field_label)) return "@sm:col-span-1"
    // A "short" answer that runs to paragraphs gets the whole row.
    if (text.length > 140 || text.includes("\n")) return FULL_SPAN
  }
  return isShortType(typeId) ? "@sm:col-span-3" : FULL_SPAN
}

export function PortfolioSections({
  sections,
  responseMap,
  compactColors = false,
}: {
  sections: PortfolioSectionModel[]
  responseMap: ResponseMap
  /** Lay brand-color answers out as a palette (the Business Thesis branding group). */
  compactColors?: boolean
}) {
  return (
    <>
      {sections.map((section) => (
        <PortfolioSection
          key={section.id}
          section={section}
          total={sections.length}
          responseMap={responseMap}
          compactColors={compactColors}
        />
      ))}
    </>
  )
}

function PortfolioSection({
  section,
  total,
  responseMap,
  compactColors,
}: {
  section: PortfolioSectionModel
  total: number
  responseMap: ResponseMap
  compactColors: boolean
}) {
  const answers = section.ungrouped.filter((q) => typeOf(q) !== QUESTION_TYPE.SOURCE)
  const sources = section.ungrouped
    .filter((q) => typeOf(q) === QUESTION_TYPE.SOURCE)
    .map((q) => responseMap.get(q.id))
    .filter((r): r is NonNullable<typeof r> => !!r?.isComplete && hasSource(r))
  const empty = section.ungrouped.length === 0 && section.groups.length === 0

  return (
    <section id={section.anchor} className="scroll-mt-28 pt-14 first:pt-0 md:pt-20 md:first:pt-0 xl:scroll-mt-20">
      <SectionHero section={section} total={total} />
      <div className="mt-5 grid gap-5 md:mt-6 md:grid-cols-6 md:gap-6">
        {(answers.length > 0 || sources.length > 0) && (
          <Reveal className="flex md:col-span-6">
            <article className={PANEL}>
              <AnswerGrid
                questions={answers}
                responseMap={responseMap}
                sectionTitle={section.title}
                compactColors={compactColors}
              />
              <SourceList entries={sources} className={answers.length > 0 ? "mt-8" : undefined} />
            </article>
          </Reveal>
        )}
        {section.groups.map((group, i) =>
          isGroupDisplayType(group.displayTypeId) ? (
            <DisplayGroupPanel
              key={group.id}
              group={group}
              sectionTitle={section.title}
              responseMap={responseMap}
              index={i}
            />
          ) : (
            <GroupPanel
              key={group.id}
              group={group}
              sectionTitle={section.title}
              responseMap={responseMap}
              index={i}
              compactColors={compactColors}
            />
          )
        )}
      </div>
      {empty && (
        <p className="py-10 text-center text-sm text-muted-foreground">Nothing in this section yet.</p>
      )}
    </section>
  )
}

/**
 * A section's opening: its photo (drifting slightly against the scroll) or
 * the theme gradient under chart contours, the section number, and the title
 * rising in word by word.
 */
function SectionHero({ section, total }: { section: PortfolioSectionModel; total: number }) {
  const angle = heroAngle(section.number - 1)
  const num = String(section.number).padStart(2, "0")
  const photo = section.photoUrl
  return (
    <header
      className={cn(
        "relative isolate flex items-end overflow-hidden rounded-3xl text-white",
        photo ? "min-h-[320px] sm:min-h-[420px]" : "min-h-[260px] sm:min-h-[340px]"
      )}
      style={photo ? { background: "var(--pf-hero-a)" } : { background: heroGradient(angle) }}
    >
      {photo ? (
        <>
          <HeroPhoto src={photo} />
          <div aria-hidden className="absolute inset-0" style={{ background: heroPhotoWash(angle) }} />
        </>
      ) : (
        <ContourField seed={section.anchor} />
      )}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(900px circle at 88% -12%, color-mix(in oklab, var(--pf-glow) 16%, transparent), transparent 58%)",
        }}
      />
      {/* Vignettes under the title keep it legible over a bright photo. */}
      <div
        aria-hidden
        className={cn(
          "absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t to-transparent",
          photo ? "from-black/80 via-black/30" : "from-black/45 via-black/10"
        )}
      />
      <div
        aria-hidden
        className={cn(
          "absolute inset-y-0 left-0 w-3/4 bg-gradient-to-r to-transparent",
          photo ? "from-black/45 via-black/10" : "from-black/20"
        )}
      />
      <GhostNumeral style={{ fontFamily: "var(--pf-display)" }}>{num}</GhostNumeral>

      <div className="relative z-10 w-full px-6 pt-24 pb-8 sm:px-10 sm:pb-10 lg:px-12 lg:pb-12">
        <Eyebrow>
          Section {num}
          <span className="text-white/40"> / {String(total).padStart(2, "0")}</span>
        </Eyebrow>
        <h2 className="mt-4 max-w-3xl font-(family-name:--pf-display) text-[clamp(2.25rem,5vw,3.75rem)] leading-[1.02] font-semibold tracking-[-0.025em] text-balance">
          <WordReveal text={section.title} />
        </h2>
        {section.description && (
          <Reveal delay={0.35} distance={12}>
            <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-pretty text-white/75 sm:text-base">
              {section.description}
            </p>
          </Reveal>
        )}
      </div>
    </header>
  )
}

/** Small caps label on the dark heroes, led by a rule that draws itself in. */
export function Eyebrow({ children, onMount = false }: { children: ReactNode; onMount?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <motion.span
        aria-hidden
        data-reveal
        className="h-px w-10 shrink-0 origin-left bg-[var(--pf-glow)]"
        initial={{ transform: "scaleX(0)" }}
        {...(onMount
          ? { animate: { transform: "scaleX(1)" } }
          : { whileInView: { transform: "scaleX(1)" }, viewport: { once: true } })}
        transition={{ duration: 0.8, ease: EASE }}
      />
      <span className="text-[11px] font-semibold tracking-[0.24em] text-white/75 uppercase tabular-nums">
        {children}
      </span>
    </div>
  )
}

function GroupHeader({
  name,
  description,
  icon,
  status,
  action,
}: {
  name: string
  description: string
  icon: string | null
  status: FieldStatus | null
  action?: ReactNode
}) {
  const badge = status && status !== "complete" ? status : null
  if (!name && !description && !icon && !badge && !action) return null
  return (
    <header className="mb-6 flex items-start gap-3.5">
      {icon && <GroupIcon name={icon} />}
      <div className="min-w-0 flex-1">
        {name && (
          <h3 className="font-(family-name:--pf-heading) text-xl leading-tight font-semibold tracking-[-0.012em] text-balance sm:text-[1.375rem]">
            {name}
          </h3>
        )}
        {description && (
          <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-pretty text-muted-foreground">
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
    </header>
  )
}

function AnswerGrid({
  questions,
  responseMap,
  groupTitle,
  sectionTitle,
  compactColors,
}: {
  questions: PortfolioQuestion[]
  responseMap: ResponseMap
  groupTitle?: string
  sectionTitle: string
  compactColors: boolean
}) {
  if (questions.length === 0) return null

  const cell = (q: PortfolioQuestion) => {
    const response = responseMap.get(q.id)
    const span = questionColSpan(q, (response?.student_response ?? "").trim(), compactColors)
    return (
      // An approved answer with nothing in it renders nothing; empty:hidden
      // drops its cell so it doesn't leave a gap in the grid.
      <div key={q.id} className={cn(span, "flex flex-col empty:hidden")}>
        <Answer
          question={q}
          response={response}
          groupTitle={groupTitle}
          sectionTitle={sectionTitle}
          fullRow={span === FULL_SPAN}
        />
      </div>
    )
  }

  // Three or more approved photos in a row become one swipeable strip
  // instead of a wall of images.
  const cells: ReactNode[] = []
  let run: PortfolioQuestion[] = []
  const flush = () => {
    if (run.length >= 3) {
      cells.push(
        <div key={`strip-${run[0].id}`} className={FULL_SPAN}>
          <ImageStrip
            images={run.map((q) => {
              const title = (q.public_display_title || q.field_label || "").trim()
              const description = q.public_display_description?.trim() ?? ""
              return {
                key: q.id,
                src: approvedImage(q, responseMap.get(q.id)),
                ratio: aspectRatioCss(q.image_aspect_ratio),
                title: sameTitle(title, groupTitle) || sameTitle(title, sectionTitle) ? "" : title,
                description: sameTitle(description, title) ? "" : description,
              }
            })}
          />
        </div>
      )
    } else {
      for (const q of run) cells.push(cell(q))
    }
    run = []
  }
  for (const q of questions) {
    if (approvedImage(q, responseMap.get(q.id))) {
      run.push(q)
    } else {
      flush()
      cells.push(cell(q))
    }
  }
  flush()

  return <div className="grid gap-x-8 gap-y-7 @sm:grid-cols-6">{cells}</div>
}

/** An approved photo answer's URL, or "" when there's none to show. */
function approvedImage(q: PortfolioQuestion, r: PortfolioResponse | undefined): string {
  if (typeOf(q) !== QUESTION_TYPE.IMAGE_UPLOAD || !r?.isComplete) return ""
  const src = r.image_response?.path || r.image_response?.url
  return src ? resolveImageUrl(src) : ""
}

function GroupPanel({
  group,
  sectionTitle,
  responseMap,
  index,
  compactColors,
}: {
  group: PortfolioGroupModel
  sectionTitle: string
  responseMap: ResponseMap
  index: number
  compactColors: boolean
}) {
  const span = groupColSpan(group.width)
  const answers = group.questions.filter((q) => typeOf(q) !== QUESTION_TYPE.SOURCE)
  const sources = group.questions
    .filter((q) => typeOf(q) === QUESTION_TYPE.SOURCE)
    .map((q) => responseMap.get(q.id))
    .filter((r): r is NonNullable<typeof r> => !!r?.isComplete && hasSource(r))
  const status = groupStatusOf(group.questions.map((q) => responseMap.get(q.id)))

  return (
    <Reveal className={cn(span, "flex")} delay={(index % 3) * 0.08}>
      <article className={cn(PANEL, "flex flex-col")}>
        <GroupHeader
          name={sameTitle(group.name, sectionTitle) ? "" : group.name}
          description={group.description}
          icon={group.iconName}
          status={status}
        />
        <AnswerGrid
          questions={answers}
          responseMap={responseMap}
          groupTitle={group.name}
          sectionTitle={sectionTitle}
          compactColors={compactColors}
        />
        <SourceList entries={sources} className={answers.length > 0 ? "mt-8" : undefined} />
      </article>
    </Reveal>
  )
}

/** Groups with a purpose-built display: gallery, competitor map, budgets, unit economics. */
function DisplayGroupPanel({
  group,
  sectionTitle,
  responseMap,
  index,
}: {
  group: PortfolioGroupModel
  sectionTitle: string
  responseMap: ResponseMap
  index: number
}) {
  const questions = group.questions as DisplayQuestions
  const responses = responseMap as DisplayResponses
  const isGoogleBudget = group.displayTypeId === DISPLAY_TYPE.GOOGLE_BUDGET
  const isTransportBudget = group.displayTypeId === DISPLAY_TYPE.TRANSPORTATION_BUDGET
  const sheetUrl = isGoogleBudget ? getGoogleSheetUrl(questions, responses) : ""
  const span = group.width
    ? groupColSpan(group.width)
    : isTransportBudget
      ? "md:col-span-3"
      : "md:col-span-6"

  return (
    <Reveal className={cn(span, "flex")} delay={(index % 3) * 0.08}>
      <article className={cn(PANEL, "flex flex-col")}>
        <GroupHeader
          name={sameTitle(group.name, sectionTitle) ? "" : group.name}
          description={group.description}
          icon={group.iconName}
          status={groupStatusOf(group.questions.map((q) => responseMap.get(q.id)))}
          action={isGoogleBudget && sheetUrl ? <GoogleSheetOpenButton url={sheetUrl} /> : undefined}
        />
        <div className="flex-1">
          <GroupDisplayRenderer
            displayTypeId={group.displayTypeId!}
            questions={questions}
            responseMap={responses}
            mode="public"
          />
        </div>
      </article>
    </Reveal>
  )
}
