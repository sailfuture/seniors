"use client"

import { useState } from "react"
import { Textarea } from "@/components/ui/textarea"
import { Markdown } from "@/components/markdown"
import { cn } from "@/lib/utils"

/**
 * Textarea for Markdown-formatted text with a Write / Preview switch, so the
 * author sees the instructions exactly as the student will.
 */
export function MarkdownTextarea({
  value,
  onChange,
  placeholder,
  rows = 6,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
}) {
  const [preview, setPreview] = useState(false)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="bg-muted inline-flex rounded-md p-0.5 text-xs font-medium">
          {(["Write", "Preview"] as const).map((tab) => {
            const active = (tab === "Preview") === preview
            return (
              <button
                key={tab}
                type="button"
                aria-pressed={active}
                onClick={() => setPreview(tab === "Preview")}
                className={cn(
                  "rounded px-2.5 py-1 transition-colors",
                  active ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab}
              </button>
            )
          })}
        </div>
        <span className="text-muted-foreground text-xs">Supports Markdown</span>
      </div>
      {preview ? (
        <div className="min-h-24 rounded-md border px-3 py-2">
          {value.trim() ? (
            <Markdown text={value} />
          ) : (
            <p className="text-muted-foreground text-sm">Nothing to preview yet.</p>
          )}
        </div>
      ) : (
        <Textarea
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
        />
      )}
      <p className="text-muted-foreground text-xs leading-relaxed">
        <code># Heading</code> · <code>**bold**</code> · <code>*italic*</code> · <code>- bullet</code> ·{" "}
        <code>1. step</code> · <code>&gt; quote</code> · <code>[link text](https://…)</code>
      </p>
    </div>
  )
}
