import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, spellCheck, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      // Text fields ask for the browser's spell check explicitly — Firefox
      // skips single-line inputs otherwise. Names, searches, URLs and codes
      // pass spellCheck={false}; email/url/date/number types are left alone.
      spellCheck={spellCheck ?? (!type || type === "text" ? true : undefined)}
      className={cn(
        "dark:bg-input/30 border-input focus-visible:border-ring focus-visible:ring-ring/20 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 disabled:bg-input/50 dark:disabled:bg-input/80 h-9 rounded-lg border bg-transparent px-3 py-1.5 text-base transition-colors file:h-6 file:text-sm file:font-medium focus-visible:ring-3 aria-invalid:ring-3 md:text-sm file:text-foreground placeholder:text-muted-foreground w-full min-w-0 outline-none file:inline-flex file:border-0 file:bg-transparent disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-75",
        className
      )}
      {...props}
    />
  )
}

export { Input }
