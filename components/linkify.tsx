import React from "react"

// Matches http(s) URLs and bare www. domains. Trailing punctuation that is
// almost never part of the URL (".", ",", ")", …) is trimmed after matching so
// "see https://example.com." links without the period.
const URL_RE = /(https?:\/\/[^\s<]+|www\.[^\s<]+\.[^\s<]+)/gi

function trimTrailing(url: string): { url: string; rest: string } {
  let end = url.length
  while (end > 0 && /[.,;:!?)\]}'"]/.test(url[end - 1])) end--
  return { url: url.slice(0, end), rest: url.slice(end) }
}

/**
 * Renders plain message text with URLs as clickable links that open in a new
 * tab. Everything else passes through untouched (no markdown, no HTML).
 */
export function Linkify({
  text,
  className,
}: {
  text: string | null | undefined
  className?: string
}) {
  if (!text) return null

  const parts: React.ReactNode[] = []
  let last = 0
  let key = 0

  for (const match of text.matchAll(URL_RE)) {
    const start = match.index ?? 0
    if (start > last) parts.push(text.slice(last, start))

    const { url, rest } = trimTrailing(match[0])
    const href = url.toLowerCase().startsWith("http") ? url : `https://${url}`
    parts.push(
      <a
        key={key++}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        // Stop the click from also triggering the bubble/row it sits inside.
        onClick={(e) => e.stopPropagation()}
        className={
          className ??
          "break-all underline underline-offset-2 hover:opacity-80"
        }
      >
        {url}
      </a>
    )
    if (rest) parts.push(rest)
    last = start + match[0].length
  }

  if (parts.length === 0) return <>{text}</>
  if (last < text.length) parts.push(text.slice(last))
  return <>{parts}</>
}
