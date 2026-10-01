"use client"

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { animate, motion, MotionConfig, useMotionValue, useScroll, useSpring } from "motion/react"
import { Printer } from "lucide-react"
import { cn } from "@/lib/utils"
import { portfolioDisplay } from "./fonts"
import { portfolioThemeStyle, type PortfolioTheme } from "./theme"
import { initials } from "./format"
import { EASE } from "./motion"

export interface ChapterLink {
  /** The element id the link scrolls to (`cover`, `section-12`). */
  id: string
  title: string
  /** Section number shown beside the title; none for the cover. */
  number?: number
}

/** While the portfolio's data loads. */
export function PortfolioLoading({ kind }: { kind: string }) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-[#f5f7fb]">
      <img
        src="/images/sailfuture-square.webp"
        alt=""
        className="size-10 rounded-full outline outline-1 -outline-offset-1 outline-black/10 motion-safe:animate-pulse"
      />
      <p className="text-sm text-muted-foreground">Loading {kind}…</p>
    </div>
  )
}

/** A note in place of the sections when there are none to show. */
export function PortfolioEmpty({ children }: { children: ReactNode }) {
  return (
    <div className="mt-6 rounded-3xl bg-white px-6 py-20 text-center text-muted-foreground ring-1 ring-[#e6eaf2]">
      {children}
    </div>
  )
}

/**
 * Scrolls to a chapter, smoothly unless the reader asked for less motion.
 * The address stays as it is, so reopening or sharing the page starts at the
 * cover rather than wherever the reader last clicked.
 */
export function goToChapter(id: string) {
  const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
  if (id === "cover") {
    window.scrollTo({ top: 0, behavior })
    return
  }
  document.getElementById(id)?.scrollIntoView({ behavior, block: "start" })
}

/** The chapter the reader is in: whichever one crosses the upper third of the screen. */
function useActiveChapter(ids: string[]): string {
  const key = ids.join("|")
  const [active, setActive] = useState(ids[0] ?? "")
  useEffect(() => {
    const els = key
      .split("|")
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => !!el)
    if (els.length === 0) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) if (entry.isIntersecting) setActive(entry.target.id)
      },
      { rootMargin: "-32% 0px -62% 0px" }
    )
    for (const el of els) observer.observe(el)
    return () => observer.disconnect()
  }, [key])
  return active
}

/**
 * The public portfolio page: a slim top bar with reading progress, the cover
 * as a full-screen title page, then the course rail beside the content on
 * wide screens (a chapter bar under the top bar on narrower ones), and a
 * footer. Also opens a deep link (#section-12) once the content has rendered.
 */
export function PortfolioShell({
  kind,
  detail,
  theme,
  chapters,
  studentName,
  studentImage,
  printHref,
  cover,
  children,
}: {
  /** "Life Map" or "Business Thesis". */
  kind: string
  /** Shown after the kind in the top bar, e.g. "Class of 2027". */
  detail?: string
  theme: PortfolioTheme
  chapters: ChapterLink[]
  studentName: string
  studentImage?: string
  printHref: string
  /** The title page, full width above the rail and content. */
  cover?: ReactNode
  children: ReactNode
}) {
  const active = useActiveChapter(chapters.map((c) => c.id))

  // Content loads after the page, so the browser's own jump to #hash misses.
  // Essays, photos and embeds above the target then load and push it down,
  // so it stays pinned until they settle or the reader scrolls on their own.
  const chaptersReady = chapters.length > 0
  useEffect(() => {
    if (!chaptersReady || !window.location.hash) return
    const target = document.getElementById(decodeURIComponent(window.location.hash.slice(1)))
    if (!target) return
    target.scrollIntoView({ block: "start" })
    const observer = new ResizeObserver(() => target.scrollIntoView({ block: "start" }))
    const release = () => observer.disconnect()
    observer.observe(document.body)
    const timer = window.setTimeout(release, 5000)
    const events = ["wheel", "touchstart", "keydown", "pointerdown"] as const
    for (const e of events) window.addEventListener(e, release, { passive: true, once: true })
    return () => {
      release()
      window.clearTimeout(timer)
      for (const e of events) window.removeEventListener(e, release)
    }
  }, [chaptersReady])

  return (
    <MotionConfig reducedMotion="user">
      <div
        className={cn(portfolioDisplay.variable, "min-h-svh bg-[#f5f7fb] text-foreground")}
        style={portfolioThemeStyle(theme)}
      >
        <TopBar kind={kind} detail={detail} studentName={studentName} studentImage={studentImage} printHref={printHref} />
        {cover}
        {/* After the cover, so it only sticks once the title page is scrolled past. */}
        <ChapterBar chapters={chapters} active={active} />
        <div className="mx-auto flex w-full max-w-[1440px] gap-10 px-4 md:px-6 lg:px-8">
          <CourseRail kind={kind} chapters={chapters} active={active} printHref={printHref} />
          <main className="min-w-0 flex-1 pt-6 pb-10 md:pt-10">{children}</main>
        </div>
        <footer className="border-t border-[#e3e8f1] bg-white/60">
          <div className="mx-auto flex max-w-[1440px] flex-col gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between md:px-6 lg:px-8">
            <span className="flex items-center gap-2.5">
              <img
                src="/images/sailfuture-square.webp"
                alt=""
                className="size-6 rounded-full outline outline-1 -outline-offset-1 outline-black/10"
              />
              SailFuture Academy · Senior {kind}
              {studentName && <span className="text-muted-foreground/70">· {studentName}</span>}
            </span>
            <a
              href={printHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 underline-offset-4 transition-colors hover:text-foreground hover:underline"
            >
              <Printer className="size-4" strokeWidth={1.75} />
              Print or save as PDF
            </a>
          </div>
        </footer>
      </div>
    </MotionConfig>
  )
}

function TopBar({
  kind,
  detail,
  studentName,
  studentImage,
  printHref,
}: {
  kind: string
  detail?: string
  studentName: string
  studentImage?: string
  printHref: string
}) {
  const { scrollYProgress } = useScroll()
  const progress = useSpring(scrollYProgress, { stiffness: 220, damping: 40, restDelta: 0.001 })

  return (
    <header className="sticky top-0 z-40 border-b border-[#e3e8f1] bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-3 px-4 md:px-6 lg:px-8">
        <img
          src="/images/sailfuture-square.webp"
          alt="SailFuture Academy"
          className="size-7 shrink-0 rounded-full outline outline-1 -outline-offset-1 outline-black/10"
        />
        <span className="hidden text-sm font-semibold tracking-tight sm:inline">SailFuture Academy</span>
        <span aria-hidden className="hidden text-muted-foreground/40 sm:inline">
          /
        </span>
        <span className="truncate text-sm text-muted-foreground">{kind}</span>
        {detail && <span className="hidden text-sm text-muted-foreground/70 lg:inline">· {detail}</span>}
        <div className="ml-auto flex items-center gap-3">
          {studentName && (
            <span className="hidden items-center gap-2 text-sm font-medium md:flex">
              {studentName}
              <Avatar name={studentName} src={studentImage} className="size-7 text-[10px]" />
            </span>
          )}
          <a
            href={printHref}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Print or save as PDF"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#e3e8f1] bg-white px-2.5 text-[13px] font-medium transition-[background-color,scale] duration-150 hover:bg-[#f5f7fb] active:scale-[0.96]"
          >
            <Printer className="size-4" strokeWidth={1.75} />
            <span className="hidden sm:inline">Print / PDF</span>
          </a>
        </div>
      </div>
      {/* Reading progress along the bottom edge of the bar. */}
      <motion.div
        aria-hidden
        className="absolute inset-x-0 -bottom-px h-[2px] origin-left bg-[var(--pf-ink)]"
        style={{ scaleX: progress }}
      />
    </header>
  )
}

export function Avatar({ name, src, className }: { name: string; src?: string; className?: string }) {
  return src ? (
    <img
      src={src}
      alt=""
      className={cn("shrink-0 rounded-full object-cover outline outline-1 -outline-offset-1 outline-black/10", className)}
    />
  ) : (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-[var(--pf-ink)] font-semibold text-white",
        className
      )}
    >
      {initials(name)}
    </span>
  )
}

/** Chapters as a scrollable row of chips under the top bar, below the xl breakpoint. */
function ChapterBar({ chapters, active }: { chapters: ChapterLink[]; active: string }) {
  const listRef = useRef<HTMLOListElement>(null)

  // Keep the current chapter's chip in view as the reader moves through.
  useEffect(() => {
    const list = listRef.current
    const chip = list?.querySelector<HTMLElement>(`[data-chapter="${CSS.escape(active)}"]`)
    if (!list || !chip) return
    const target = chip.offsetLeft - list.clientWidth / 2 + chip.offsetWidth / 2
    list.scrollTo({ left: Math.max(0, target), behavior: "smooth" })
  }, [active])

  if (chapters.length === 0) return null
  return (
    <nav
      aria-label="Sections"
      className="sticky top-14 z-30 border-b border-[#e3e8f1] bg-[#f5f7fb]/85 backdrop-blur-md xl:hidden"
    >
      <ol
        ref={listRef}
        className="relative mx-auto flex max-w-[1440px] gap-1.5 overflow-x-auto px-4 py-2 [scrollbar-width:none] md:px-6 lg:px-8 [&::-webkit-scrollbar]:hidden"
      >
        {chapters.map((c) => {
          const isActive = c.id === active
          return (
            <li key={c.id} className="shrink-0">
              <a
                href={`#${c.id}`}
                data-chapter={c.id}
                aria-current={isActive ? "location" : undefined}
                onClick={(e) => {
                  e.preventDefault()
                  goToChapter(c.id)
                }}
                className={cn(
                  "flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium whitespace-nowrap transition-[color,background-color,scale] duration-150 active:scale-[0.96]",
                  isActive
                    ? "bg-[var(--pf-ink)] text-white"
                    : "text-muted-foreground hover:bg-white hover:text-foreground"
                )}
              >
                {c.number != null && (
                  <span className={cn("tabular-nums", isActive ? "text-white/60" : "text-muted-foreground/60")}>
                    {String(c.number).padStart(2, "0")}
                  </span>
                )}
                {c.title}
              </a>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

/** Vertical center of an element within a scrolling list, in the list's content coordinates. */
function centerIn(list: HTMLElement, el: HTMLElement): number {
  const box = el.getBoundingClientRect()
  return box.top - list.getBoundingClientRect().top + list.scrollTop + box.height / 2
}

/**
 * The course rail: every chapter as a waypoint on one line, filled up to
 * where the reader is. Sticky beside the content on xl screens.
 */
function CourseRail({
  kind,
  chapters,
  active,
  printHref,
}: {
  kind: string
  chapters: ChapterLink[]
  active: string
  printHref: string
}) {
  const listRef = useRef<HTMLOListElement>(null)
  const fill = useMotionValue(0)
  const [track, setTrack] = useState<{ top: number; height: number } | null>(null)
  const activeIndex = Math.max(
    0,
    chapters.findIndex((c) => c.id === active)
  )

  // The line runs from the first waypoint to the last; measured once laid out
  // and whenever the list reflows.
  useLayoutEffect(() => {
    const list = listRef.current
    if (!list) return
    const measure = () => {
      const dots = list.querySelectorAll<HTMLElement>("[data-waypoint]")
      if (dots.length < 2) return setTrack(null)
      const first = centerIn(list, dots[0])
      setTrack({ top: first, height: centerIn(list, dots[dots.length - 1]) - first })
    }
    const observer = new ResizeObserver(measure)
    observer.observe(list)
    return () => observer.disconnect()
  }, [chapters.length])

  // Fill the line down to the current waypoint.
  useEffect(() => {
    const list = listRef.current
    if (!list || !track || track.height <= 0) return
    const dots = list.querySelectorAll<HTMLElement>("[data-waypoint]")
    const dot = dots[activeIndex]
    if (!dot) return
    const y = centerIn(list, dot) - track.top
    const controls = animate(fill, y / track.height, { duration: 0.5, ease: EASE })
    return () => controls.stop()
  }, [activeIndex, track, fill])

  if (chapters.length === 0) return null
  return (
    <nav aria-label="Sections" className="hidden w-52 shrink-0 xl:block">
      <div className="sticky top-14 flex max-h-[calc(100svh-3.5rem)] flex-col py-10">
        <p className="text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">{kind}</p>
        {/* -ml/pl: room for the current waypoint's halo, which the scrolling list would clip. */}
        <ol ref={listRef} className="relative mt-5 -ml-1.5 min-h-0 overflow-y-auto pr-2 pl-1.5 [scrollbar-width:thin]">
          {track && (
            <>
              <span
                aria-hidden
                className="absolute left-[11px] w-px bg-[#dfe4ee]"
                style={{ top: track.top, height: track.height }}
              />
              <motion.span
                aria-hidden
                className="absolute left-[11px] w-px origin-top bg-[var(--pf-ink)]"
                style={{ top: track.top, height: track.height, scaleY: fill }}
              />
            </>
          )}
          {chapters.map((c, i) => {
            const isActive = i === activeIndex
            const passed = i < activeIndex
            return (
              <li key={c.id}>
                <a
                  href={`#${c.id}`}
                  aria-current={isActive ? "location" : undefined}
                  onClick={(e) => {
                    e.preventDefault()
                    goToChapter(c.id)
                  }}
                  className="group flex items-start gap-3 py-2"
                >
                  <span
                    data-waypoint
                    aria-hidden
                    className={cn(
                      "relative z-10 mt-[5px] size-[11px] shrink-0 rounded-full border-2 transition-[background-color,border-color,box-shadow] duration-150",
                      isActive
                        ? "border-[var(--pf-ink)] bg-[var(--pf-ink)] shadow-[0_0_0_4px_color-mix(in_oklab,var(--pf-ink)_14%,transparent)]"
                        : passed
                          ? "border-[var(--pf-ink)] bg-[var(--pf-ink)]"
                          : "border-[#cfd6e3] bg-[#f5f7fb] group-hover:border-[var(--pf-ink)]"
                    )}
                  />
                  <span
                    className={cn(
                      "text-[13px] leading-snug transition-colors duration-150",
                      isActive ? "font-semibold text-foreground" : "text-muted-foreground group-hover:text-foreground"
                    )}
                  >
                    {c.number != null && (
                      <span className="mr-1.5 text-muted-foreground/60 tabular-nums">
                        {String(c.number).padStart(2, "0")}
                      </span>
                    )}
                    {c.title}
                  </span>
                </a>
              </li>
            )
          })}
        </ol>
        <a
          href={printHref}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex items-center gap-2 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <Printer className="size-4" strokeWidth={1.75} />
          Print / PDF
        </a>
      </div>
    </nav>
  )
}
