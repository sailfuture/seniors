"use client"

import { cn } from "@/lib/utils"
import { COMPLETE_AT, SCORE_LEVELS, type SectionScoring } from "@/lib/rubric-scoring"

const LABEL = "text-muted-foreground text-[11px] font-medium tracking-wide uppercase"

/** One color per level, used for the dot and the column tint. */
const LEVEL_TONE: Record<number, { dot: string; tint: string; printTint: string }> = {
  1: { dot: "bg-gray-400", tint: "", printTint: "" },
  2: { dot: "bg-amber-500", tint: "", printTint: "" },
  3: { dot: "bg-green-600", tint: "bg-green-50/70 dark:bg-green-500/5", printTint: "bg-green-50" },
  4: { dot: "bg-blue-600", tint: "", printTint: "" },
}

const completeLabel = SCORE_LEVELS.find((l) => l.score === COMPLETE_AT)?.label ?? ""

/**
 * A section's 1–4 scoring rubric. On screen each criterion is a card whose
 * four levels sit side by side when there is room and stack when there
 * isn't (the slide-over). In print it is a single table, one row per
 * criterion. The "Meets expectations" column is tinted: it is the bar for
 * a section to count as complete.
 */
export function RubricScoringTable({
  scoring,
  print = false,
}: {
  scoring: SectionScoring
  print?: boolean
}) {
  const intro = (
    <p className={cn("mt-1", print ? "text-[9.5pt] text-gray-600" : "text-muted-foreground text-xs")}>
      Score each criterion from 1 to 4. The section is complete when every criterion scores{" "}
      <span className={cn("font-medium", print ? "text-gray-800" : "text-foreground")}>
        {COMPLETE_AT} ({completeLabel})
      </span>{" "}
      or higher.
    </p>
  )

  if (print) {
    return (
      <div>
        <p className={cn(LABEL, "text-gray-500")}>Scoring rubric</p>
        {intro}
        <table className="mt-2.5 w-full table-fixed border-collapse text-left text-[9pt] leading-snug">
          <thead>
            <tr>
              <th className="w-[22%] border border-gray-300 bg-gray-100 px-2 py-1.5 font-semibold">Criterion</th>
              {SCORE_LEVELS.map((l) => (
                <th
                  key={l.score}
                  className={cn(
                    "border border-gray-300 px-2 py-1.5 font-semibold",
                    LEVEL_TONE[l.score].printTint || "bg-gray-100"
                  )}
                >
                  {l.score} · {l.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {scoring.criteria.map((c) => (
              <tr key={c.name} data-keep>
                <td className="border border-gray-300 px-2 py-1.5 align-top">
                  <p className="font-semibold text-gray-900">{c.name}</p>
                  {c.covers && <p className="mt-0.5 text-[8pt] text-gray-500">{c.covers}</p>}
                </td>
                {c.levels.map((text, i) => (
                  <td
                    key={i}
                    className={cn("border border-gray-300 px-2 py-1.5 align-top text-gray-700", LEVEL_TONE[i + 1].printTint)}
                  >
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

  return (
    <div className="@container">
      <p className={LABEL}>Scoring rubric</p>
      {intro}
      <ol className="mt-2.5 space-y-3">
        {scoring.criteria.map((c, ci) => (
          <li key={c.name} className="bg-card overflow-hidden rounded-lg border">
            <div className="flex items-baseline justify-between gap-3 border-b px-4 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-snug">
                  <span className="text-muted-foreground mr-1.5 tabular-nums">{ci + 1}.</span>
                  {c.name}
                </p>
                {c.covers && <p className="text-muted-foreground mt-0.5 text-[11px]">{c.covers}</p>}
              </div>
            </div>
            <div className="grid divide-y @2xl:grid-cols-4 @2xl:divide-x @2xl:divide-y-0">
              {c.levels.map((text, i) => {
                const level = SCORE_LEVELS[i]
                const tone = LEVEL_TONE[level.score]
                return (
                  <div key={level.score} className={cn("px-4 py-2.5", tone.tint)}>
                    <p className="flex items-center gap-1.5 text-[11px] font-semibold">
                      <span aria-hidden className={cn("inline-block size-1.5 rounded-full", tone.dot)} />
                      <span className="tabular-nums">{level.score}</span>
                      <span className="text-muted-foreground font-medium">{level.label}</span>
                    </p>
                    <p className="text-foreground/85 mt-1 text-xs leading-snug">{text}</p>
                  </div>
                )
              })}
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
