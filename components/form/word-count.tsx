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
        met ? "text-green-700 dark:text-green-400" : "text-muted-foreground"
      )}
    >
      {count} / {minWords} min words
    </span>
  )
}
