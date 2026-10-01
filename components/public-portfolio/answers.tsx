"use client"

import { DynamicIcon, iconNames } from "lucide-react/dynamic"
import { ArrowUpRight } from "lucide-react"
import { ColorSwatch, FontPreview, parseBrandColor, parseExactHex } from "@/components/brand-display"
import { StatusBadge, statusOf } from "@/components/field-status"
import { ZoomableImage } from "@/components/zoomable-image"
import { LineItemsTable } from "@/components/line-items-table"
import { LazyRichTextDisplay } from "@/components/form/rich-text-display-lazy"
import { LINE_ITEMS_TYPE_ID } from "@/lib/line-items"
import { RICH_TEXT_TYPE_ID, looksLikeRichTextDoc } from "@/lib/rich-text"
import { aspectRatioCss } from "@/lib/image-ratio"
import { cn } from "@/lib/utils"
import { RollingAmount } from "./motion-plus"
import {
  citation,
  formatDate,
  hrefOf,
  parseAmount,
  prettyUrl,
  sameTitle,
  type SourceFields,
} from "./format"
import {
  QUESTION_TYPE,
  isShortType,
  resolveImageUrl,
  typeOf,
  type PortfolioQuestion,
  type PortfolioResponse,
} from "./types"

const LABEL = "text-[13px] leading-snug font-medium text-muted-foreground"
const DESCRIPTION = "mt-1 text-xs leading-relaxed text-muted-foreground/75"
/** Short answers sit on a hairline, so a group of them reads like a spec sheet. */
const FACT_RULE = "border-t border-[#e6eaf2] pt-3.5"

type Kind = "fact" | "prose" | "rich" | "table" | "link" | "date" | "figure" | "choice" | "color" | "font"

function kindOf(typeId: number | null, text: string, label: string): Kind {
  if (typeId === LINE_ITEMS_TYPE_ID) return "table"
  // The doc-shape check keeps stored TipTap JSON from ever rendering raw,
  // even if a question's type changes under it.
  if (typeId === RICH_TEXT_TYPE_ID || looksLikeRichTextDoc(text)) return "rich"
  if (typeId === QUESTION_TYPE.URL) return "link"
  if (typeId === QUESTION_TYPE.DATE) return "date"
  if (typeId === QUESTION_TYPE.CURRENCY && parseAmount(text) != null) return "figure"
  if (typeId === QUESTION_TYPE.DROPDOWN) return "choice"
  if (/colou?r/i.test(label) ? parseBrandColor(text) : parseExactHex(text)) return "color"
  if (/font/i.test(label)) return "font"
  // A "short" answer that runs to sentences reads better as prose.
  if (isShortType(typeId) && text.length <= 140 && !text.includes("\n")) return "fact"
  return "prose"
}

const FACT_KINDS: Kind[] = ["fact", "link", "date", "figure", "choice"]

/**
 * One answer on the public page, laid out by what it is: a fact, a figure, a
 * choice, a link, an essay, a table, an image. Unfinished answers show only
 * their label and review status; an approved answer that's empty shows
 * nothing at all.
 */
export function Answer({
  question,
  response,
  groupTitle,
  sectionTitle,
  fullRow = false,
}: {
  question: PortfolioQuestion
  response: PortfolioResponse | undefined
  groupTitle?: string
  sectionTitle?: string
  /** The answer spans its panel's whole row (in a wide panel, essays set their label beside the text). */
  fullRow?: boolean
}) {
  const typeId = typeOf(question)
  const title = (question.public_display_title || question.field_label || "").trim()
  // "Executive Summary" inside "Executive Summary" inside "Executive Summary"
  // says it once, in the heading above.
  const showTitle = !!title && !sameTitle(title, groupTitle) && !sameTitle(title, sectionTitle)
  const rawDescription = question.public_display_description?.trim() ?? ""
  const description = sameTitle(rawDescription, title) ? "" : rawDescription
  const raw = statusOf(response)
  const status = raw === "complete" ? null : raw
  const complete = response?.isComplete === true

  if (typeId === QUESTION_TYPE.IMAGE_UPLOAD) {
    const src = complete ? response?.image_response?.path || response?.image_response?.url : undefined
    return (
      <ImageAnswer
        src={src ? resolveImageUrl(src) : ""}
        ratio={aspectRatioCss(question.image_aspect_ratio)}
        title={showTitle ? title : ""}
        description={description}
        status={status}
      />
    )
  }

  const text = (response?.student_response ?? "").trim()
  const dateValue = typeId === QUESTION_TYPE.DATE ? response?.date_response || text : ""
  const hasValue = typeId === QUESTION_TYPE.DATE ? !!dateValue : !!text
  const kind = kindOf(typeId, text, question.field_label)
  const fact = FACT_KINDS.includes(kind)

  if (!complete || !hasValue) {
    if (!status) return null
    return (
      <div className={cn("flex items-start justify-between gap-3", fact && FACT_RULE)}>
        {showTitle ? <p className={cn(LABEL, "text-muted-foreground/70")}>{title}</p> : <span />}
        <StatusBadge status={status} />
      </div>
    )
  }

  const header =
    showTitle || description || status ? (
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {showTitle && <p className={LABEL}>{title}</p>}
          {description && <p className={DESCRIPTION}>{description}</p>}
        </div>
        <StatusBadge status={status} />
      </div>
    ) : null

  if (fact) {
    return (
      <div className={cn("flex h-full flex-col", FACT_RULE)}>
        {header}
        <div className={header ? "mt-1.5" : undefined}>
          <FactValue kind={kind} text={text} dateValue={dateValue} />
        </div>
      </div>
    )
  }

  // An essay that needs no label (it's titled by the heading above) and has
  // the full page width is set as a centered column, like an article.
  const centered = fullRow && !header
  const value =
    kind === "prose" ? (
      <Prose text={text} className={centered ? "mx-auto" : undefined} />
    ) : kind === "rich" ? (
      <LazyRichTextDisplay
        raw={text}
        fullSize
        className={cn("max-w-[68ch] text-foreground", centered && "mx-auto")}
      />
    ) : kind === "table" ? (
      <LineItemsTable raw={text} />
    ) : kind === "color" ? (
      <ColorSwatch
        color={(/colou?r/i.test(question.field_label) ? parseBrandColor(text) : parseExactHex(text))!}
        rawText={text}
      />
    ) : (
      <FontPreview text={text} fieldLabel={question.field_label} />
    )

  // Essays across a wide panel put the label in its own column, so the text
  // keeps a readable measure without leaving half the panel empty.
  if (fullRow && header && (kind === "prose" || kind === "rich")) {
    return (
      <div className="@2xl:grid @2xl:grid-cols-[minmax(0,13rem)_minmax(0,1fr)] @2xl:gap-x-12">
        <div className="@2xl:pt-1">{header}</div>
        <div className="mt-2 @2xl:mt-0">{value}</div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {header}
      <div className={header ? "mt-2" : undefined}>{value}</div>
    </div>
  )
}

function FactValue({ kind, text, dateValue }: { kind: Kind; text: string; dateValue: string }) {
  if (kind === "link") {
    return (
      <a
        href={hrefOf(text)}
        target="_blank"
        rel="noopener noreferrer"
        title={text}
        className="group inline-flex max-w-full items-center gap-1 text-base leading-snug font-medium text-[var(--pf-ink)] underline decoration-[color-mix(in_oklab,var(--pf-ink)_30%,transparent)] underline-offset-4 transition-[text-decoration-color] duration-150 hover:decoration-current"
      >
        <span className="min-w-0 truncate">{prettyUrl(text)}</span>
        <ArrowUpRight
          aria-hidden
          strokeWidth={2}
          className="size-4 shrink-0 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
        />
      </a>
    )
  }
  if (kind === "date") {
    return <p className="text-[17px] leading-snug font-medium">{formatDate(dateValue)}</p>
  }
  if (kind === "figure") {
    return (
      <p className="font-(family-name:--pf-heading) text-[2rem] leading-tight font-semibold tracking-[-0.02em] text-[var(--pf-ink)] sm:text-[2.25rem]">
        <RollingAmount value={parseAmount(text)!} />
      </p>
    )
  }
  if (kind === "choice") {
    return (
      <span className="mt-0.5 inline-flex max-w-full items-center rounded-full bg-[color-mix(in_oklab,var(--pf-ink)_7%,white)] px-3 py-1 text-sm font-semibold text-[var(--pf-ink)] ring-1 ring-[color-mix(in_oklab,var(--pf-ink)_16%,transparent)] ring-inset">
        {text}
      </span>
    )
  }
  return (
    <p className="text-[17px] leading-snug font-medium text-pretty [overflow-wrap:anywhere]">{text}</p>
  )
}

/** Plain answers as paragraphs (blank lines split them) at a comfortable measure. */
function Prose({ text, className }: { text: string; className?: string }) {
  return (
    <div className={cn("max-w-[68ch] space-y-4 text-base leading-[1.7] text-pretty text-foreground/90 sm:text-[17px]", className)}>
      {text.split(/\n\s*\n/).map((paragraph, i) => (
        <p key={i} className="whitespace-pre-line [overflow-wrap:anywhere]">
          {paragraph}
        </p>
      ))}
    </div>
  )
}

function ImageAnswer({
  src,
  ratio,
  title,
  description,
  status,
}: {
  src: string
  ratio: string | null
  title: string
  description: string
  status: ReturnType<typeof statusOf>
}) {
  if (!src) {
    if (!status) return null
    return (
      <figure>
        <div
          className="aspect-[4/3] w-full rounded-xl bg-[#eef1f7]"
          style={ratio ? { aspectRatio: ratio } : undefined}
        />
        <figcaption className="mt-2.5 flex items-start justify-between gap-3">
          {title ? <span className={cn(LABEL, "text-muted-foreground/70")}>{title}</span> : <span />}
          <StatusBadge status={status} />
        </figcaption>
      </figure>
    )
  }
  return (
    <figure className="flex h-full flex-col">
      {/* A hairline inside the edge gives every photo the same crisp border,
          light or dark. Crop ratios from the template are honored; a "free"
          crop shows at its natural shape. */}
      <div
        className="overflow-hidden rounded-xl bg-[#eef1f7] outline outline-1 -outline-offset-1 outline-black/10"
        style={ratio ? { aspectRatio: ratio } : undefined}
      >
        <ZoomableImage
          src={src}
          alt={title || description || "Student upload"}
          imgClassName={ratio ? "h-full w-full object-cover" : "h-auto w-full"}
          caption={title || description}
        />
      </div>
      {(title || description || status) && (
        <figcaption className="mt-2.5 flex items-start justify-between gap-3">
          <span className="min-w-0">
            {title && <span className="block text-[13px] leading-snug font-medium text-muted-foreground">{title}</span>}
            {description && <span className={cn("block", DESCRIPTION)}>{description}</span>}
          </span>
          <StatusBadge status={status} />
        </figcaption>
      )}
    </figure>
  )
}

/** Citations for a group's (or a section's) sources, MLA style. */
export function SourceList({ entries, className }: { entries: SourceFields[]; className?: string }) {
  if (entries.length === 0) return null
  return (
    <div className={cn("border-t border-[#e6eaf2] pt-4", className)}>
      <p className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">Sources</p>
      <ol className="mt-2.5 space-y-2">
        {entries.map((r, i) => {
          const { lead, link } = citation(r)
          return (
            <li key={i} className="text-[13px] leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
              {lead}
              {lead && link ? " " : ""}
              {link && (
                <>
                  <a
                    href={hrefOf(link)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--pf-ink)] underline decoration-[color-mix(in_oklab,var(--pf-ink)_30%,transparent)] underline-offset-2 transition-[text-decoration-color] duration-150 hover:decoration-current"
                  >
                    {prettyUrl(link)}
                  </a>
                  .
                </>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

/** A group's icon (a Lucide name from the template), loaded on demand. */
export function GroupIcon({ name }: { name: string }) {
  const iconName = name.trim().toLowerCase().split(/[-_ ]+/).join("-") as (typeof iconNames)[number]
  if (!iconNames.includes(iconName)) return null
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_oklab,var(--pf-ink)_7%,white)] text-[var(--pf-ink)]">
      <DynamicIcon name={iconName} className="size-5" strokeWidth={1.75} />
    </span>
  )
}
