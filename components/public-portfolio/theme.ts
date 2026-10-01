import type { CSSProperties } from "react"
import { luminance, mixHex, type BrandTheme } from "@/components/brand-display"

/** A portfolio's colors, applied as CSS variables on the page root. */
export interface PortfolioTheme {
  /** Accent that reads on white: links, chips, figures, the course rail. */
  ink: string
  /** Hero gradient stops, dark enough for white type. */
  hero: [string, string, string]
  /** Highlight on the dark heroes: rules, waypoints, the cover's course line. */
  glow: string
  /** Display face for the cover and section titles; defaults to Bricolage. */
  displayFont?: string
}

/** SailFuture navy, with sea-glass highlights on the dark heroes. */
export const SAILFUTURE_THEME: PortfolioTheme = {
  ink: "#0f1f52",
  hero: ["#06102e", "#17378c", "#08163f"],
  glow: "#7de2d5",
}

/**
 * A Business Thesis in the student's own brand: their primary color drives
 * the ink and the heroes, their accent the highlights, their primary font the
 * titles. Anything they haven't set falls back to SailFuture's.
 */
export function brandPortfolioTheme(brand: BrandTheme): PortfolioTheme {
  let glow = SAILFUTURE_THEME.glow
  if (brand.accent) {
    // Highlights sit on the dark heroes, so a dark accent is lifted toward white.
    glow = luminance(brand.accent) < 0.35 ? mixHex(brand.accent, "#ffffff", 0.55) : brand.accent
  }
  return {
    ink: brand.hasBrand ? brand.primaryInk : SAILFUTURE_THEME.ink,
    hero: brand.hasBrand ? brand.heroStops : SAILFUTURE_THEME.hero,
    glow,
    displayFont: brand.primaryFont || undefined,
  }
}

export function portfolioThemeStyle(theme: PortfolioTheme): CSSProperties {
  return {
    "--pf-ink": theme.ink,
    "--pf-hero-a": theme.hero[0],
    "--pf-hero-b": theme.hero[1],
    "--pf-hero-c": theme.hero[2],
    "--pf-glow": theme.glow,
    "--pf-display": theme.displayFont
      ? `"${theme.displayFont}", var(--font-pf-display), var(--font-sans), sans-serif`
      : "var(--font-pf-display), var(--font-sans), sans-serif",
    // Group titles and figures: the display face, unless a brand font has
    // taken the big titles, in which case they stay in the plainer body face.
    "--pf-heading": theme.displayFont
      ? "var(--font-sans), sans-serif"
      : "var(--font-pf-display), var(--font-sans), sans-serif",
  } as CSSProperties
}

/** The flat hero gradient, at an angle that varies by section. */
export function heroGradient(angle: number): string {
  return `linear-gradient(${angle}deg, var(--pf-hero-a) 0%, var(--pf-hero-b) 52%, var(--pf-hero-c) 100%)`
}

/**
 * A light wash of the hero colors over a photo, so the picture stays visible;
 * the title's legibility comes from the vignettes layered above it.
 */
export function heroPhotoWash(angle: number): string {
  return `linear-gradient(${angle}deg, color-mix(in oklab, var(--pf-hero-a) 55%, transparent) 0%, color-mix(in oklab, var(--pf-hero-b) 22%, transparent) 50%, color-mix(in oklab, var(--pf-hero-c) 60%, transparent) 100%)`
}

const HERO_ANGLES = [128, 160, 42, 200, 104, 320, 172]

export function heroAngle(index: number): number {
  return HERO_ANGLES[index % HERO_ANGLES.length]
}
