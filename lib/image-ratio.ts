/**
 * Convert a stored image crop-ratio label ("16:9", "1:1", "3:4", "9:16", and
 * also "16/9") into a CSS `aspect-ratio` value ("16 / 9"). Returns null for a
 * blank/free ratio or anything unparseable, so callers can fall back to the
 * image's natural aspect.
 */
export function aspectRatioCss(raw: string | null | undefined): string | null {
  if (!raw) return null
  const m = raw.trim().match(/^(\d+(?:\.\d+)?)\s*[:/]\s*(\d+(?:\.\d+)?)$/)
  if (!m) return null
  const w = parseFloat(m[1])
  const h = parseFloat(m[2])
  if (!(w > 0 && h > 0)) return null
  return `${w} / ${h}`
}
