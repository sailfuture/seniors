"use client"

import { useMemo } from "react"
import { renderToReactElement } from "@tiptap/static-renderer/pm/react"
import StarterKit from "@tiptap/starter-kit"
import { parseRichText } from "@/lib/rich-text"
import { cn } from "@/lib/utils"

/**
 * Read-only renderer for stored rich-text (TipTap JSON) responses. Renders
 * schema-constrained React elements — no editor instance, no innerHTML — so
 * it is safe on unauthenticated public pages. Legacy plain-text values are
 * wrapped into paragraphs by parseRichText.
 */
export function RichTextDisplay({ raw, className }: { raw: string; className?: string }) {
  const rendered = useMemo(() => {
    const doc = parseRichText(raw)
    if (!doc || !doc.content?.length) return null
    try {
      return renderToReactElement({ content: doc, extensions: [StarterKit] })
    } catch {
      return null
    }
  }, [raw])

  if (!rendered) {
    return <p className="text-muted-foreground text-sm italic">—</p>
  }

  return (
    <div className={cn("prose prose-sm dark:prose-invert max-w-none", className)}>
      {rendered}
    </div>
  )
}
