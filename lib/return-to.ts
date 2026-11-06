"use client"

import { usePathname, useSearchParams } from "next/navigation"

/**
 * A page that opens from several places (the essay review page opens from the
 * review queue, a section page, and the review sheet) carries the page it
 * came from in this query param, so its Back button returns there, scrolled
 * to the same question, instead of a fixed home.
 */
export const RETURN_PARAM = "from"

/** `href` with the page to come back to appended. */
export function withReturnTo(href: string, from: string): string {
  const sep = href.includes("?") ? "&" : "?"
  return `${href}${sep}${RETURN_PARAM}=${encodeURIComponent(from)}`
}

/**
 * The page to go back to, or `fallback` when none was given. Only an in-app
 * path (`/…`, never `//host` or a full URL) is honored, so a crafted link
 * can't send anyone off-site.
 */
export function readReturnTo(params: { get(name: string): string | null }, fallback: string): string {
  const from = params.get(RETURN_PARAM)
  if (!from || !from.startsWith("/") || from.startsWith("//") || from.includes("\\")) return fallback
  return from
}

/** The current page as a return target: its path plus query string. */
export function useCurrentHref(): string {
  const pathname = usePathname()
  const search = useSearchParams().toString()
  return search ? `${pathname}?${search}` : pathname
}
