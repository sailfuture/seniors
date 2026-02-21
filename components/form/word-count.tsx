"use client"

import { getWordCount } from "@/lib/form-types"
import { cn } from "@/lib/utils"

export function WordCount({ value, minWords }: { value: string; minWords: number }) {
  const count = getWordCount(value)
  const met = count >= minWords

  return (
    <span
      className={cn(
        "text-xs font-normal",
        met ? "text-muted-foreground/60" : "text-muted-foreground/50"
      )}
    >
      {count} / {minWords} min words
    </span>
  )
}
