"use client"

import { useMemo, useRef } from "react"
import { motion, stagger, useInView, useReducedMotion } from "motion/react"
import { cn } from "@/lib/utils"
import { EASE } from "./motion"

const W = 1200
const H = 640

/**
 * The chart textures behind the dark heroes, each drawn from a nautical
 * chart: depth contours, the rhumb lines of a compass, a latitude/longitude
 * grid, and the swell of open water.
 */
export type ChartPatternKind = "contours" | "rhumbs" | "graticule" | "swell"

/** Section heroes cycle through these, so neighboring sections never match. */
export const SECTION_PATTERNS: ChartPatternKind[] = ["rhumbs", "graticule", "swell", "contours"]

interface Line {
  d: string
  /** "strong" lines read a little brighter; "accent" and "course" use the highlight color. */
  tone?: "strong" | "accent" | "course"
}

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

const f = (v: number) => v.toFixed(1)

/** A smooth curve through the points (Catmull-Rom as cubic Béziers). */
function curve(pts: [number, number][], closed: boolean): string {
  const n = pts.length
  const at = (i: number) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))])
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`
  const segments = closed ? n : n - 1
  for (let i = 0; i < segments; i++) {
    const p0 = at(i - 1)
    const p1 = at(i)
    const p2 = at(i + 1)
    const p3 = at(i + 2)
    d +=
      `C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ` +
      `${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`
  }
  return closed ? `${d}Z` : d
}

function circle(cx: number, cy: number, r: number): string {
  return `M${f(cx - r)} ${f(cy)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0`
}

/** Depth contours around two or three seamounts; each peak's rings share a wobble so they nest. */
function contours(rand: () => number): Line[] {
  const lines: Line[] = []
  const peaks = [
    { x: 0.62 + rand() * 0.3, y: 0.18 + rand() * 0.35 },
    { x: 0.06 + rand() * 0.3, y: 0.7 + rand() * 0.3 },
    ...(rand() > 0.45 ? [{ x: 0.35 + rand() * 0.25, y: 0.05 + rand() * 0.2 }] : []),
  ]
  peaks.forEach((peak, p) => {
    const cx = W * peak.x
    const cy = H * peak.y
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
      for (let i = 0; i < 36; i++) {
        const t = (i / 36) * Math.PI * 2
        const wobble =
          1 +
          drift *
            (amps[0] * Math.sin(2 * t + phases[0]) +
              amps[1] * Math.sin(3 * t + phases[1] + k * 0.18) +
              amps[2] * Math.sin(5 * t + phases[2]))
        const x0 = Math.cos(t) * r * wobble
        const y0 = Math.sin(t) * r * wobble * stretch
        pts.push([cx + x0 * Math.cos(tilt) - y0 * Math.sin(tilt), cy + x0 * Math.sin(tilt) + y0 * Math.cos(tilt)])
      }
      lines.push({ d: curve(pts, true), tone: k === course ? "course" : undefined })
    }
  })
  return lines
}

/**
 * Rhumb lines, as on a portolan chart: thirty-two bearings fanning out from a
 * compass rose, crossed by a fainter second fan.
 */
function rhumbs(rand: () => number): Line[] {
  const lines: Line[] = []
  const reach = Math.hypot(W, H) * 1.2
  const hubs = [
    { x: W * (0.66 + rand() * 0.2), y: H * (0.22 + rand() * 0.3), rays: 32 },
    { x: W * (0.06 + rand() * 0.22), y: H * (0.78 + rand() * 0.2), rays: 16 },
  ]
  const turn = rand() * (Math.PI / 16)
  hubs.forEach((hub, h) => {
    for (let i = 0; i < hub.rays; i++) {
      const a = turn + (i / hub.rays) * Math.PI * 2
      // Rays start just off the hub, so the rose sits in clear water.
      const r0 = h === 0 ? 58 : 0
      lines.push({
        d: `M${f(hub.x + Math.cos(a) * r0)} ${f(hub.y + Math.sin(a) * r0)}L${f(hub.x + Math.cos(a) * reach)} ${f(hub.y + Math.sin(a) * reach)}`,
        tone: h === 0 && i % 4 === 0 ? "strong" : undefined,
      })
    }
  })
  // The compass rose on the main hub: two rings and an eight-point star.
  const { x, y } = hubs[0]
  lines.push({ d: circle(x, y, 44), tone: "accent" })
  lines.push({ d: circle(x, y, 50), tone: "accent" })
  const star: [number, number][] = []
  for (let k = 0; k < 16; k++) {
    const a = turn - Math.PI / 2 + (k / 16) * Math.PI * 2
    const r = k % 4 === 0 ? 40 : k % 2 === 0 ? 26 : 9
    star.push([x + Math.cos(a) * r, y + Math.sin(a) * r])
  }
  lines.push({ d: `M${star.map(([px, py]) => `${f(px)} ${f(py)}`).join("L")}Z`, tone: "accent" })
  return lines
}

/**
 * A latitude/longitude grid, curved like a conic projection, with a plotted
 * course and its waypoints crossing it.
 */
function graticule(rand: () => number): Line[] {
  const lines: Line[] = []
  const pole = { x: W * (0.45 + rand() * 0.2), y: -1700 }
  // Parallels: arcs around a pole far above the frame.
  for (let r = 1760; r < 1700 + H + 260; r += 74) {
    const span = Math.asin(Math.min(1, (W * 0.75) / r))
    const pts: [number, number][] = []
    for (let i = 0; i <= 12; i++) {
      const a = Math.PI / 2 - span + (i / 12) * span * 2
      pts.push([pole.x + Math.cos(a) * r, pole.y + Math.sin(a) * r])
    }
    lines.push({ d: curve(pts, false), tone: (r - 1760) % (74 * 4) === 0 ? "strong" : undefined })
  }
  // Meridians: straight lines converging on the pole.
  for (let i = -9; i <= 9; i++) {
    const a = Math.PI / 2 + i * 0.045
    const r0 = 1700 - 40
    const r1 = 1700 + H + 120
    lines.push({
      d: `M${f(pole.x + Math.cos(a) * r0)} ${f(pole.y + Math.sin(a) * r0)}L${f(pole.x + Math.cos(a) * r1)} ${f(pole.y + Math.sin(a) * r1)}`,
      tone: i % 3 === 0 ? "strong" : undefined,
    })
  }
  // A course from the lower left toward the upper right, with waypoints.
  const waypoints: [number, number][] = [
    [W * 0.04, H * (0.82 + rand() * 0.1)],
    [W * (0.3 + rand() * 0.08), H * (0.6 + rand() * 0.12)],
    [W * (0.58 + rand() * 0.08), H * (0.42 + rand() * 0.12)],
    [W * (0.86 + rand() * 0.08), H * (0.14 + rand() * 0.12)],
  ]
  lines.push({ d: curve(waypoints, false), tone: "course" })
  for (const [px, py] of waypoints.slice(1)) lines.push({ d: circle(px, py, 7), tone: "accent" })
  return lines
}

/** The swell of open water, widening toward the viewer, with one line picked out. */
function swell(rand: () => number): Line[] {
  const lines: Line[] = []
  const count = 13
  const course = 5 + Math.floor(rand() * 4)
  for (let k = 0; k < count; k++) {
    const depth = k / (count - 1)
    const baseY = H * (0.08 + 0.95 * Math.pow(depth, 1.5))
    const amp = 3 + 22 * Math.pow(depth, 1.4)
    const wave = 220 + 260 * depth
    const phase = rand() * Math.PI * 2
    const chop = 0.25 + rand() * 0.2
    const pts: [number, number][] = []
    for (let x = -60; x <= W + 60; x += 30) {
      pts.push([
        x,
        baseY +
          amp * Math.sin((x / wave) * Math.PI * 2 + phase) +
          amp * chop * Math.sin((x / (wave * 0.43)) * Math.PI * 2 + phase * 1.7),
      ])
    }
    lines.push({ d: curve(pts, false), tone: k === course ? "course" : k % 4 === 0 ? "strong" : undefined })
  }
  return lines
}

const BUILDERS: Record<ChartPatternKind, (rand: () => number) => Line[]> = {
  contours,
  rhumbs,
  graticule,
  swell,
}

/**
 * A chart texture for a dark hero, surveyed in line by line the first time
 * it's seen; the highlighted course and markings fade in after the lines.
 */
export function ChartPattern({
  kind,
  seed,
  className,
  onMount = false,
}: {
  kind: ChartPatternKind
  seed: string | number
  className?: string
  /** Draw on first render rather than when scrolled into view (for covers). */
  onMount?: boolean
}) {
  const reduce = useReducedMotion()
  const lines = useMemo(() => BUILDERS[kind](mulberry32(hashSeed(`${kind}:${seed}`))), [kind, seed])
  // Watch the frame, not the drawing: rhumb lines run far past the edges, so
  // the drawing itself is never a quarter on screen.
  const frameRef = useRef<SVGSVGElement>(null)
  const inView = useInView(frameRef, { once: true, amount: 0.25 })

  return (
    <svg
      ref={frameRef}
      aria-hidden
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      className={cn("pointer-events-none absolute inset-0 size-full", className)}
    >
      <motion.g
        initial="hidden"
        animate={onMount || inView ? "shown" : "hidden"}
        variants={{ hidden: {}, shown: { transition: { delayChildren: stagger(0.03) } } }}
      >
        {lines.map((line, i) =>
          line.tone === "course" || line.tone === "accent" ? (
            <motion.path
              key={i}
              d={line.d}
              fill="none"
              stroke="var(--pf-glow)"
              strokeOpacity={line.tone === "course" ? 0.6 : 0.45}
              strokeWidth={line.tone === "course" ? 1.8 : 1.3}
              strokeDasharray={line.tone === "course" ? "1 8" : undefined}
              strokeLinecap="round"
              strokeLinejoin="round"
              variants={{ hidden: { opacity: 0 }, shown: { opacity: 1 } }}
              transition={{ duration: 1.2, ease: EASE, delay: reduce ? 0 : 0.9 }}
            />
          ) : (
            <motion.path
              key={i}
              d={line.d}
              fill="none"
              stroke="#ffffff"
              strokeOpacity={line.tone === "strong" ? 0.17 : 0.1}
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
