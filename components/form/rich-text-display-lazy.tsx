"use client"

import dynamic from "next/dynamic"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * RichTextDisplay, loaded on first use. Rendering TipTap JSON pulls in TipTap
 * and ProseMirror (~120 KB gzipped), and most screens that *can* show an essay
 * (dashboard status cards, review sheets, public pages) usually don't — so they
 * shouldn't download the editor stack up front.
 */
export const LazyRichTextDisplay = dynamic(
  () => import("./rich-text-display").then((m) => m.RichTextDisplay),
  { loading: () => <Skeleton className="h-16 w-full" /> }
)
