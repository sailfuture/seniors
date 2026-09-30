import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, spellCheck = true, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      spellCheck={spellCheck}
      className={cn(
        "border-input dark:bg-input/30 focus-visible:border-ring aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 disabled:bg-input/50 dark:disabled:bg-input/80 rounded-lg border bg-background px-3 py-2 text-base transition-colors aria-invalid:ring-3 md:text-sm placeholder:text-muted-foreground flex field-sizing-content min-h-16 w-full outline-none disabled:cursor-not-allowed disabled:opacity-75 break-words overflow-x-hidden",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
