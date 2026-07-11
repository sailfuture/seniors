"use client"

import { createContext, useContext, useEffect } from "react"

// ── Color parsing ──────────────────────────────────────────────────────────

export interface ParsedColor {
  css: string
  hex: string | null
}

const CSS_COLOR_KEYWORD_BLOCKLIST = new Set([
  "unset",
  "inherit",
  "initial",
  "revert",
  "currentcolor",
  "transparent",
  "none",
])

/** The whole response is a hex code (with or without #). */
export function parseExactHex(raw: string): ParsedColor | null {
  const match = raw.trim().match(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/)
  if (!match) return null
  const hex = `#${match[1].toUpperCase()}`
  return { css: hex, hex }
}

/**
 * Best-effort color extraction for answers to color questions, which arrive
 * in mixed formats: "#b100ff", "pink #ff66c4", "vivid green-00bf08",
 * "Name: Warm beige Code:#9d886a", "Magenta". Tries, in order: a #-prefixed
 * hex anywhere, a bare 6-digit hex (must contain a digit so English words
 * like "decade" don't match), an rgb()/hsl() function, then CSS named
 * colors (joining up to three words, longest first, so "light sea green"
 * finds "lightseagreen").
 */
export function parseBrandColor(raw: string): ParsedColor | null {
  const text = raw.trim()
  if (!text) return null

  const hashMatch = text.match(/#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/)
  if (hashMatch) {
    const hex = `#${hashMatch[1].toUpperCase()}`
    return { css: hex, hex }
  }

  const bareMatch = text.match(/\b(?=[0-9a-fA-F]*\d)[0-9a-fA-F]{6}\b/)
  if (bareMatch) {
    const hex = `#${bareMatch[0].toUpperCase()}`
    return { css: hex, hex }
  }

  if (typeof CSS === "undefined" || !CSS.supports) return null

  const fnMatch = text.match(/(?:rgb|hsl)a?\([^)]+\)/i)
  if (fnMatch && CSS.supports("color", fnMatch[0])) {
    return { css: fnMatch[0], hex: null }
  }

  const words = text
    .toLowerCase()
    .replace(/[^a-z ]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
  for (let span = 3; span >= 1; span--) {
    for (let i = 0; i + span <= words.length; i++) {
      const candidate = words.slice(i, i + span).join("")
      if (CSS_COLOR_KEYWORD_BLOCKLIST.has(candidate)) continue
      if (CSS.supports("color", candidate)) return { css: candidate, hex: null }
    }
  }
  return null
}

/** Human-readable remainder of a color answer once the code is stripped out. */
function colorNameFrom(raw: string, hex: string | null): string {
  let s = raw
  if (hex) s = s.replace(new RegExp(`#?${hex.slice(1)}`, "gi"), " ")
  s = s.replace(/\b(name|code|hex|colou?r)\b\s*:?/gi, " ")
  s = s.replace(/[#:;,\-–—]+/g, " ").replace(/\s+/g, " ").trim()
  return s
}

export function ColorSwatch({ color, rawText }: { color: ParsedColor; rawText: string }) {
  const name = colorNameFrom(rawText, color.hex)
  const code = color.hex ?? (name.toLowerCase() === color.css ? "" : color.css)
  return (
    <div className="flex flex-col gap-2">
      <div
        className="aspect-[3/2] w-full rounded-lg border border-gray-200 shadow-sm"
        style={{ backgroundColor: color.css }}
      />
      <div>
        <p className="text-foreground text-sm font-bold tracking-wider uppercase">
          {code || name}
        </p>
        {code && name && (
          <p className="text-muted-foreground text-xs capitalize">{name}</p>
        )}
      </div>
    </div>
  )
}

// ── Font previews ──────────────────────────────────────────────────────────

const FONT_NOISE_WORDS = new Set([
  // weights & styles
  "thin",
  "hairline",
  "extralight",
  "ultralight",
  "light",
  "regular",
  "normal",
  "book",
  "medium",
  "semibold",
  "demibold",
  "bold",
  "extrabold",
  "ultrabold",
  "black",
  "heavy",
  "italic",
  "oblique",
  "outline",
  "outlined",
  // colors that students mix into font answers
  "dark",
  "navy",
  "blue",
  "red",
  "green",
  "pink",
  "purple",
  "violet",
  "white",
  "gray",
  "grey",
  "yellow",
  "orange",
  "brown",
  "beige",
  "teal",
  "cyan",
  "magenta",
  // filler
  "font",
  "typeface",
  "name",
])

/**
 * Pull a plausible font family out of a free-text answer, e.g.
 * "dark navy blue cooper Hewitt, stretched like star wars intro"
 * → "Cooper Hewitt". Only the part before the first comma/slash/newline is
 * considered; weight, style, and color words are dropped; the remainder is
 * title-cased for the Google Fonts URL.
 */
export function extractFontFamily(raw: string): string {
  const first = raw.split(/[,/\n]/)[0]
  const words = first
    .replace(/[^a-zA-Z0-9 '-]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => !FONT_NOISE_WORDS.has(w.toLowerCase()))
  const name = words.join(" ").trim()
  if (name.length < 2 || name.length > 40) return ""
  return name.replace(/\S+/g, (t) => t.charAt(0).toUpperCase() + t.slice(1))
}

const requestedFonts = new Set<string>()

/**
 * Load a font family from Google Fonts once per session. Families Google
 * doesn't host simply 404 and the preview keeps its generic fallback stack.
 * Pass `previewText` to fetch only the glyphs needed to render that string —
 * used by pickers that show many families at once.
 */
export function useGoogleFont(family: string, previewText?: string) {
  useEffect(() => {
    if (!family) return
    const key = previewText ? `${family}|preview` : family
    if (requestedFonts.has(key)) return
    // a full load supersedes any subset need
    if (previewText && requestedFonts.has(family)) return
    requestedFonts.add(key)
    const link = document.createElement("link")
    link.rel = "stylesheet"
    const base = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, "+")}`
    link.href = previewText
      ? `${base}&text=${encodeURIComponent(previewText)}&display=swap`
      : `${base}&display=swap`
    document.head.appendChild(link)
  }, [family, previewText])
}

export function parseFontStyle(value: string, family?: string): React.CSSProperties {
  const lower = value.toLowerCase()
  const style: React.CSSProperties = {}

  let fallback = "sans-serif"
  if (/(^|\s|-)mono(space)?(\s|-|$)/.test(lower)) fallback = "ui-monospace, monospace"
  else if (/(^|\s|-)serif(\s|-|$)/.test(lower) && !/sans[\s-]?serif/.test(lower)) fallback = "serif"
  else if (/(script|cursive|handwritten)/.test(lower)) fallback = "cursive"
  style.fontFamily = family ? `"${family}", ${fallback}` : `${value}, ${fallback}`

  if (/black|heavy|extra[-\s]?bold/.test(lower)) style.fontWeight = 800
  else if (/semi[-\s]?bold|demi[-\s]?bold/.test(lower)) style.fontWeight = 600
  else if (/bold/.test(lower)) style.fontWeight = 700
  else if (/extra[-\s]?light|ultra[-\s]?light/.test(lower)) style.fontWeight = 200
  else if (/light/.test(lower)) style.fontWeight = 300
  else if (/thin/.test(lower)) style.fontWeight = 100
  else if (/medium/.test(lower)) style.fontWeight = 500

  if (/italic|oblique/.test(lower)) style.fontStyle = "italic"

  if (/outline/.test(lower)) {
    style.WebkitTextStroke = "1.5px currentColor"
    style.color = "transparent"
  }

  return style
}

// ── Brand theme derivation ─────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] | null {
  const m = hex.replace("#", "").match(/^([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/)
  if (!m) return null
  let h = m[1]
  if (h.length === 3) h = h.split("").map((c) => c + c).join("")
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase()
}

/** Blend a toward b; t=0 → a, t=1 → b. */
export function mixHex(a: string, b: string, t: number): string {
  const ra = hexToRgb(a)
  const rb = hexToRgb(b)
  if (!ra || !rb) return a
  return rgbToHex(ra[0] + (rb[0] - ra[0]) * t, ra[1] + (rb[1] - ra[1]) * t, ra[2] + (rb[2] - ra[2]) * t)
}

export function luminance(hex: string): number {
  const rgb = hexToRgb(hex)
  if (!rgb) return 0
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Darken a color until it reads as text on white (WCAG ≥ 4.5:1). */
export function inkOnWhite(hex: string): string {
  let c = hex
  for (let i = 0; i < 12; i++) {
    const contrast = 1.05 / (luminance(c) + 0.05)
    if (contrast >= 4.5) return c
    c = mixHex(c, "#000000", 0.14)
  }
  return c
}

/** Near-black or white text — whichever contrasts more with the background. */
export function inkFor(bgHex: string): string {
  const L = luminance(bgHex)
  const contrastWhite = 1.05 / (L + 0.05)
  const contrastDark = (L + 0.05) / (luminance("#10131A") + 0.05)
  return contrastDark >= contrastWhite ? "#10131A" : "#FFFFFF"
}

/** Normalize any CSS color (names, rgb()) to hex via the canvas parser. */
function cssColorToHex(css: string): string | null {
  if (typeof document === "undefined") return null
  const ctx = document.createElement("canvas").getContext("2d")
  if (!ctx) return null
  ctx.fillStyle = "#000"
  ctx.fillStyle = css
  const out = ctx.fillStyle
  return out.startsWith("#") ? out.toUpperCase() : null
}

function brandResolveImageUrl(path: string | undefined): string {
  if (!path) return ""
  if (path.startsWith("http")) return path
  return `https://xsc3-mvx7-r86m.n7e.xano.io${path}`
}

interface ThemeSourceQuestion {
  id: number
  field_name: string
}

interface ThemeSourceResponse {
  student_response?: string
  image_response?: { path?: string; url?: string } | null
}

export interface BrandTheme {
  hasBrand: boolean
  /** Raw brand primary (hex). */
  primary: string | null
  /** Brand primary darkened for text/borders on white. */
  primaryInk: string
  /** Badge/highlight color. */
  accent: string | null
  /** Text color that reads on `accent`. */
  accentInk: string
  /** Dark-anchored gradient stops for section heroes: [edge, mid, edge]. */
  heroStops: [string, string, string]
  /** Full parsed palette, for keylines and swatch strips. */
  palette: string[]
  logoUrl: string
  companyName: string
  tagline: string
  coverImageUrl: string
  primaryFont: string
  secondaryFont: string
}

const DEFAULT_HERO: [string, string, string] = ["#040810", "#0f1f52", "#040810"]

export const DEFAULT_BRAND_THEME: BrandTheme = {
  hasBrand: false,
  primary: null,
  primaryInk: "#111827",
  accent: null,
  accentInk: "#FFFFFF",
  heroStops: DEFAULT_HERO,
  palette: [],
  logoUrl: "",
  companyName: "",
  tagline: "",
  coverImageUrl: "",
  primaryFont: "",
  secondaryFont: "",
}

/**
 * Derive a per-student theme from the Branding group's answers (plus company
 * name/tagline). Everything is keyed by stable field names; any missing or
 * unparseable answer leaves the corresponding default in place, so a thesis
 * with no branding renders exactly like today's design.
 */
export function deriveBrandTheme(
  questions: ThemeSourceQuestion[],
  responseMap: Map<number, ThemeSourceResponse>
): BrandTheme {
  const byField = (field: string) => {
    const q = questions.find((q) => q.field_name === field)
    return q ? responseMap.get(q.id) : undefined
  }
  const text = (field: string) => (byField(field)?.student_response ?? "").trim()
  const image = (field: string) => {
    const img = byField(field)?.image_response
    return brandResolveImageUrl(img?.path || img?.url)
  }
  const color = (field: string): string | null => {
    const raw = text(field)
    if (!raw) return null
    const parsed = parseBrandColor(raw)
    if (!parsed) return null
    return parsed.hex ?? cssColorToHex(parsed.css)
  }

  const primary = color("primary_color")
  const secondary = color("secondary_color")
  const accent1 = color("accent_color_1")
  const accent2 = color("accent_color_2")
  const palette = [primary, secondary, accent1, accent2].filter((c): c is string => !!c)

  const accent = accent1 ?? secondary ?? primary

  const darkAnchor = "#05070D"
  const heroStops: [string, string, string] = primary
    ? [mixHex(primary, darkAnchor, 0.84), mixHex(primary, darkAnchor, 0.42), mixHex(primary, darkAnchor, 0.87)]
    : DEFAULT_HERO

  return {
    hasBrand: !!primary,
    primary,
    primaryInk: primary ? inkOnWhite(primary) : DEFAULT_BRAND_THEME.primaryInk,
    accent,
    accentInk: accent ? inkFor(accent) : "#FFFFFF",
    heroStops,
    palette,
    logoUrl: image("logo_image_url_light_background") || image("my_company_logo"),
    companyName: text("company_name") || text("my_company"),
    tagline: text("company_tagline"),
    coverImageUrl: image("background_image"),
    primaryFont: extractFontFamily(text("primary_font_name")),
    secondaryFont: extractFontFamily(text("secondary_font_name")),
  }
}

const BrandThemeContext = createContext<BrandTheme>(DEFAULT_BRAND_THEME)

export function BrandThemeProvider({ theme, children }: { theme: BrandTheme; children: React.ReactNode }) {
  return <BrandThemeContext.Provider value={theme}>{children}</BrandThemeContext.Provider>
}

export function useBrandTheme(): BrandTheme {
  return useContext(BrandThemeContext)
}

export function FontPreview({ text, fieldLabel }: { text: string; fieldLabel: string }) {
  const family = extractFontFamily(text)
  useGoogleFont(family)
  const fontStyle = parseFontStyle(text, family || undefined)
  const isPrimary = /primary/i.test(fieldLabel)

  return (
    <div className="space-y-3">
      {isPrimary ? (
        <>
          <p className="text-foreground text-4xl leading-tight" style={fontStyle}>Header 1</p>
          <p className="text-foreground text-2xl leading-tight" style={fontStyle}>Header 2</p>
        </>
      ) : (
        <>
          <p className="text-muted-foreground text-xs uppercase tracking-wide" style={fontStyle}>Sub-Text</p>
          <p className="text-foreground text-base leading-relaxed" style={fontStyle}>
            Body — The quick brown fox jumps over the lazy dog.
          </p>
        </>
      )}
      <p className="text-muted-foreground/70 mt-2 border-t border-gray-100 pt-2 text-xs italic">{text}</p>
    </div>
  )
}
