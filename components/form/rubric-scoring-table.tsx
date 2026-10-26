"use client"

import { cn } from "@/lib/utils"
import { COMPLETE_AT, SCORE_LEVELS, type ScoringCriterion, type SectionScoring } from "@/lib/rubric-scoring"

const LABEL = "text-muted-foreground text-[11px] font-medium tracking-wide uppercase"

const completeLabel = SCORE_LEVELS.find((l) => l.score === COMPLETE_AT)?.label ?? ""

/**
 * A section's rubric: one row per key objective of the section, one column
 * per level (Not started to Exceeds expectations).
 *
 * - On the rubric page it is a table when there is room (@4xl and up) and a
 *   stack of cards below that.
 * - In print it is always one table; its header repeats on each page.
 * - With `levels` off (the section slide-over) it is just the overview: each
 *   objective and its "what success looks like" paragraph.
 */
export function RubricScoringTable({
  scoring,
  print = false,
  levels = true,
}: {
  scoring: SectionScoring
  print?: boolean
  levels?: boolean
}) {
  const intro = levels && (
    <p className={cn("mt-1", print ? "text-[9.5pt] text-gray-600" : "text-muted-foreground text-xs")}>
      Each row is a key part of this section, rated Not started, Needs improvement, Meets expectations or Exceeds
      expectations. The section is complete when every row reaches {completeLabel} or higher.
    </p>
  )

  if (print) {
    return (
      <div>
        <p className={cn(LABEL, "text-gray-500")}>Rubric</p>
        {intro}
        <table className="mt-2.5 w-full table-fixed border-collapse text-left text-[8.5pt] leading-snug">
          <thead>
            <tr>
              <th className="w-[28%] border border-gray-300 bg-gray-100 px-2 py-1.5 font-semibold">Criterion</th>
              {SCORE_LEVELS.map((l) => (
                <th key={l.score} className="border border-gray-300 bg-gray-100 px-2 py-1.5 font-semibold">
                  {l.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {scoring.criteria.map((c) => (
              <tr key={c.name} data-keep>
                <td className="border border-gray-300 px-2 py-1.5 align-top">
                  <p className="text-[9.5pt] font-semibold text-gray-900">{c.name}</p>
                  {c.covers && <p className="mt-0.5 text-[7.5pt] text-gray-500">{c.covers}</p>}
                  {c.expectations && <p className="mt-1 text-gray-700">{c.expectations}</p>}
                </td>
                {c.levels.map((text, i) => (
                  <td key={i} className="border border-gray-300 px-2 py-1.5 align-top text-gray-700">
                    {text}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (!levels) {
    return (
      <div>
        <p className={LABEL}>What success looks like</p>
        <ul className="mt-2 divide-y overflow-hidden rounded-lg border">
          {scoring.criteria.map((c) => (
            <li key={c.name} className="bg-card px-4 py-3">
              <h3 className="text-sm font-semibold">{c.name}</h3>
              {c.covers && <p className="text-muted-foreground mt-0.5 text-xs">{c.covers}</p>}
              {c.expectations && <p className="mt-1.5 text-sm leading-relaxed">{c.expectations}</p>}
            </li>
          ))}
        </ul>
      </div>
    )
  }

  return (
    <div className="@container">
      <p className={LABEL}>Rubric</p>
      {intro}

      {/* Wide: a real table, one row per objective. */}
      <div className="mt-3 hidden overflow-hidden rounded-lg border @4xl:block">
        <table className="w-full table-fixed border-collapse text-left text-xs leading-snug">
          <thead>
            <tr className="bg-muted/50">
              <th className="w-[28%] border-b px-3 py-2 font-semibold">Criterion</th>
              {SCORE_LEVELS.map((l) => (
                <th key={l.score} className="border-b border-l px-3 py-2 font-semibold">
                  {l.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {scoring.criteria.map((c) => (
              <tr key={c.name} className="border-b last:border-b-0">
                <td className="px-3 py-3 align-top">
                  <p className="text-sm font-semibold">{c.name}</p>
                  {c.covers && <p className="text-muted-foreground mt-0.5 text-[11px]">{c.covers}</p>}
                  {c.expectations && <p className="text-foreground/85 mt-1.5">{c.expectations}</p>}
                </td>
                {c.levels.map((text, i) => (
                  <td key={i} className="text-foreground/85 border-l px-3 py-3 align-top">
                    {text}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Narrow: each objective as a card with its levels stacked. */}
      <ol className="mt-3 space-y-3 @4xl:hidden">
        {scoring.criteria.map((c) => (
          <NarrowCriterion key={c.name} criterion={c} />
        ))}
      </ol>
    </div>
  )
}

function NarrowCriterion({ criterion: c }: { criterion: ScoringCriterion }) {
  return (
    <li className="bg-card overflow-hidden rounded-lg border">
      <div className="px-4 py-3">
        <h3 className="text-sm font-semibold">{c.name}</h3>
        {c.covers && <p className="text-muted-foreground mt-0.5 text-xs">{c.covers}</p>}
        {c.expectations && <p className="mt-1.5 text-sm leading-relaxed">{c.expectations}</p>}
      </div>
      <div className="divide-y border-t">
        {c.levels.map((text, i) => (
          <div key={SCORE_LEVELS[i].score} className="px-4 py-2">
            <h4 className="text-xs font-semibold">{SCORE_LEVELS[i].label}</h4>
            <p className="text-foreground/85 mt-0.5 text-xs leading-snug">{text}</p>
          </div>
        ))}
      </div>
    </li>
  )
}
