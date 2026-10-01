"use client"

import { useMemo } from "react"
import { motion, stagger, useReducedMotion } from "motion/react"
import { cn } from "@/lib/utils"
import { EASE } from "./motion"

const WIDTH = 1200
const HEIGHT = 640

function hashSeed(value: string | number): number {
  const s = String(value)
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Small seeded PRNG, so a section always draws the same chart. */
function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A smooth closed curve through the points (Catmull-Rom as cubic Béziers). */
function closedCurve(pts: [number, number][]): string {
  const n = pts.length
  const f = (v: number) => v.toFixed(1)
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n]
    const p1 = pts[i]
    const p2 = pts[(i + 1) % n]
    const p3 = pts[(i + 2) % n]
    d +=
      `C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ` +
      `${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`
  }
  return `${d}Z`
}

interface Contour {
  d: string
  /** The one line picked out in the highlight color, dotted like a plotted course. */
  course: boolean
}

/**
 * Depth contours around two or three seamounts, like the soundings on a
 * nautical chart. Each ring of a peak shares its wobble so the rings nest.
 */
function buildContours(seed: number): Contour[] {
  const rand = mulberry32(seed)
  const contours: Contour[] = []
  // One peak on the right, behind the section number; others low and left.
  const peaks = [
    { x: 0.62 + rand() * 0.3, y: 0.18 + rand() * 0.35 },
    { x: 0.06 + rand() * 0.3, y: 0.7 + rand() * 0.3 },
    ...(rand() > 0.45 ? [{ x: 0.35 + rand() * 0.25, y: 0.05 + rand() * 0.2 }] : []),
  ]
  peaks.forEach((peak, p) => {
    const cx = WIDTH * peak.x
    const cy = HEIGHT * peak.y
    const count = p === 0 ? 9 : 5 + Math.floor(rand() * 3)
    const base = 22 + rand() * 26
    const step = 24 + rand() * 16
    const phases = [rand() * Math.PI * 2, rand() * Math.PI * 2, rand() * Math.PI * 2]
    const amps = [0.1 + rand() * 0.08, 0.05 + rand() * 0.05, 0.025 + rand() * 0.02]
    const stretch = 0.62 + rand() * 0.5
    const tilt = rand() * Math.PI
    const course = p === 0 ? 3 + Math.floor(rand() * 4) : -1
    for (let k = 0; k < count; k++) {
      const r = base + k * step
      const drift = 1 + k * 0.09
      const pts: [number, number][] = []
      const steps = 36
      for (let i = 0; i < steps; i++) {
        const t = (i / steps) * Math.PI * 2
        const wobble =
          1 +
          drift *
            (amps[0] * Math.sin(2 * t + phases[0]) +
              amps[1] * Math.sin(3 * t + phases[1] + k * 0.18) +
              amps[2] * Math.sin(5 * t + phases[2]))
        const x0 = Math.cos(t) * r * wobble
        const y0 = Math.sin(t) * r * wobble * stretch
        pts.push([
          cx + x0 * Math.cos(tilt) - y0 * Math.sin(tilt),
          cy + x0 * Math.sin(tilt) + y0 * Math.cos(tilt),
        ])
      }
      contours.push({ d: closedCurve(pts), course: k === course })
    }
  })
  return contours
}

/**
 * The portfolio's chart texture: faint depth contours behind a dark hero,
 * surveyed in line by line the first time the hero is seen.
 */
export function ContourField({
  seed,
  className,
  onMount = false,
}: {
  seed: string | number
  className?: string
  /** Draw on first render rather than on scroll into view (for the cover). */
  onMount?: boolean
}) {
  const reduce = useReducedMotion()
  const contours = useMemo(() => buildContours(hashSeed(seed)), [seed])
  const trigger = onMount
    ? { initial: "hidden", animate: "shown" }
    : { initial: "hidden", whileInView: "shown", viewport: { once: true, amount: 0.25 } }

  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="xMidYMid slice"
      className={cn("pointer-events-none absolute inset-0 size-full", className)}
    >
      <motion.g
        {...trigger}
        variants={{ hidden: {}, shown: { transition: { delayChildren: stagger(0.04) } } }}
      >
        {contours.map((c, i) =>
          c.course ? (
            <motion.path
              key={i}
              d={c.d}
              fill="none"
              stroke="var(--pf-glow)"
              strokeOpacity={0.6}
              strokeWidth={1.8}
              strokeDasharray="1 8"
              strokeLinecap="round"
              variants={{ hidden: { opacity: 0 }, shown: { opacity: 1 } }}
              transition={{ duration: 1.2, ease: EASE, delay: reduce ? 0 : 0.9 }}
            />
          ) : (
            <motion.path
              key={i}
              d={c.d}
              fill="none"
              stroke="#ffffff"
              strokeOpacity={0.11}
              strokeWidth={1.3}
              variants={
                reduce
                  ? { hidden: { opacity: 0 }, shown: { opacity: 1 } }
                  : { hidden: { pathLength: 0, opacity: 0 }, shown: { pathLength: 1, opacity: 1 } }
              }
              transition={{ duration: 2.2, ease: EASE }}
            />
          )
        )}
      </motion.g>
    </svg>
  )
}
