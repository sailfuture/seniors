"use client"

import { cn } from "@/lib/utils"
import { COMPLETE_AT, SCORE_LEVELS, type ScoringCriterion, type SectionScoring } from "@/lib/rubric-scoring"

const LABEL = "text-muted-foreground text-[11px] font-medium tracking-wide uppercase"

const completeLabel = SCORE_LEVELS.find((l) => l.score === COMPLETE_AT)?.label ?? ""

/**
 * A section's 1–4 scoring rubric. Each criterion shows what it covers, a
 * short paragraph on what success looks like (written for anyone reading:
 * student, teacher or advisor), and the four levels. On screen the levels
 * sit side by side when there is room; in print each criterion is a block
 * with a four-column level table. With `levels` off (the section
 * slide-over) it is just the overview: each criterion and its paragraph.
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
  return (
    <div className={cn(!print && "@container")}>
      <p className={cn(LABEL, print && "text-gray-500")}>{levels ? "Scoring rubric" : "What success looks like"}</p>
      {levels && (
        <p className={cn("mt-1", print ? "text-[9.5pt] text-gray-600" : "text-muted-foreground text-xs")}>
          Score each criterion from 1 to 4. The section is complete when every criterion scores {COMPLETE_AT} (
          {completeLabel}) or higher.
        </p>
      )}
      <ol className={cn("mt-3", print ? "space-y-5" : "space-y-4")}>
        {scoring.criteria.map((c, i) =>
          print ? (
            <PrintCriterion key={c.name} criterion={c} index={i} />
          ) : (
            <ScreenCriterion key={c.name} criterion={c} index={i} levels={levels} />
          )
        )}
      </ol>
    </div>
  )
}

function ScreenCriterion({
  criterion: c,
  index,
  levels,
}: {
  criterion: ScoringCriterion
  index: number
  levels: boolean
}) {
  return (
    <li className="bg-card overflow-hidden rounded-lg border">
      <div className="px-4 py-3.5">
        <p className="text-sm leading-snug font-semibold">
          <span className="text-muted-foreground mr-1.5 tabular-nums">{index + 1}.</span>
          {c.name}
        </p>
        {c.covers && <p className="text-muted-foreground mt-0.5 text-xs">{c.covers}</p>}
        {c.expectations && <p className="mt-2.5 text-sm leading-relaxed">{c.expectations}</p>}
      </div>

      {levels && (
      <div className="grid divide-y border-t @2xl:grid-cols-4 @2xl:divide-x @2xl:divide-y-0">
        {c.levels.map((text, li) => {
          const level = SCORE_LEVELS[li]
          return (
            <div key={level.score} className="px-4 py-2.5">
              <p className="text-[11px] font-semibold">
                <span className="tabular-nums">{level.score}</span>
                <span className="text-muted-foreground ml-1.5 font-medium">{level.label}</span>
              </p>
              <p className="text-foreground/85 mt-1 text-xs leading-snug">{text}</p>
            </div>
          )
        })}
      </div>
      )}
    </li>
  )
}

function PrintCriterion({ criterion: c, index }: { criterion: ScoringCriterion; index: number }) {
  return (
    <li data-keep className="rounded border border-gray-300">
      <div className="px-3 py-2.5">
        <p className="text-[11pt] leading-snug font-semibold text-gray-900">
          <span className="mr-1.5 tabular-nums text-gray-400">{index + 1}.</span>
          {c.name}
        </p>
        {c.covers && <p className="mt-0.5 text-[9pt] text-gray-500">{c.covers}</p>}
        {c.expectations && (
          <p className="mt-1.5 text-[9.5pt] leading-relaxed text-gray-800">{c.expectations}</p>
        )}
      </div>
      <table className="w-full table-fixed border-collapse border-t border-gray-300 text-left text-[8.5pt] leading-snug">
        <thead>
          <tr>
            {SCORE_LEVELS.map((l) => (
              <th
                key={l.score}
                className="border-r border-gray-300 bg-gray-100 px-2 py-1 font-semibold last:border-r-0"
              >
                {l.score} · {l.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {c.levels.map((text, i) => (
              <td key={i} className="border-r border-gray-300 px-2 py-1.5 align-top text-gray-700 last:border-r-0">
                {text}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </li>
  )
}
