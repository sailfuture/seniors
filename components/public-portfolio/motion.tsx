"use client"

import { useEffect, useRef, type ReactNode } from "react"
import {
  animate,
  motion,
  stagger,
  useInView,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useTransform,
} from "motion/react"
import { cn } from "@/lib/utils"

/** The portfolio's one easing curve: a quick start that settles softly. */
export const EASE = [0.2, 0, 0, 1] as const

/**
 * Content that rises into place the first time it scrolls into view. With
 * reduced motion it only fades.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  distance = 24,
}: {
  children: ReactNode
  className?: string
  delay?: number
  distance?: number
}) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      data-reveal
      className={className}
      initial={{ opacity: 0, transform: `translateY(${reduce ? 0 : distance}px)` }}
      whileInView={{ opacity: 1, transform: "translateY(0px)" }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: 0.7, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  )
}

/**
 * A headline whose words rise out of a soft blur one after another. Screen
 * readers get the plain text; the animated words are hidden from them.
 */
export function WordReveal({
  text,
  className,
  style,
  delay = 0,
  onMount = false,
}: {
  text: string
  className?: string
  style?: React.CSSProperties
  delay?: number
  /** Play on first render instead of when scrolled into view (for the cover). */
  onMount?: boolean
}) {
  const reduce = useReducedMotion()
  const words = text.split(/(\s+)/)
  const trigger = onMount
    ? { initial: "hidden", animate: "shown" }
    : { initial: "hidden", whileInView: "shown", viewport: { once: true, amount: 0.5 } }
  return (
    <motion.span
      className={className}
      style={style}
      {...trigger}
      variants={{
        hidden: {},
        shown: { transition: { delayChildren: stagger(0.06, { startDelay: delay }) } },
      }}
    >
      <span className="sr-only">{text}</span>
      <span aria-hidden>
        {words.map((word, i) =>
          /^\s+$/.test(word) ? (
            word
          ) : (
            <motion.span
              key={i}
              data-reveal
              className="inline-block"
              variants={{
                hidden: { opacity: 0, y: reduce ? 0 : "0.32em", filter: reduce ? "blur(0px)" : "blur(8px)" },
                shown: { opacity: 1, y: 0, filter: "blur(0px)" },
              }}
              transition={{ duration: 0.75, ease: EASE }}
            >
              {word}
            </motion.span>
          )
        )}
      </span>
    </motion.span>
  )
}

/**
 * A figure that counts up from zero the first time it's seen. The final value
 * sizes the box (so nothing shifts while it counts) and is what screen
 * readers hear.
 */
export function CountUp({
  value,
  format,
  className,
}: {
  value: number
  format: (n: number) => string
  className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.6 })
  const reduce = useReducedMotion()
  const count = useMotionValue(0)
  const text = useTransform(() => format(count.get()))

  useEffect(() => {
    if (!inView) return
    if (reduce) {
      count.set(value)
      return
    }
    const controls = animate(count, value, { duration: 1.4, ease: EASE })
    return () => controls.stop()
  }, [inView, reduce, value, count])

  return (
    <span ref={ref} className={cn("relative inline-block tabular-nums", className)}>
      <span className="sr-only">{format(value)}</span>
      <span aria-hidden data-count-final className="invisible">
        {format(value)}
      </span>
      <motion.span aria-hidden data-count-live className="absolute inset-y-0 left-0 whitespace-nowrap">
        {text}
      </motion.span>
    </span>
  )
}

/**
 * A hero photo that settles from a slight zoom when it first appears and
 * drifts against the scroll while its hero crosses the screen.
 */
export function HeroPhoto({ src }: { src: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] })
  const y = useTransform(scrollYProgress, [0, 1], reduce ? ["0%", "0%"] : ["-7%", "7%"])
  return (
    <div ref={ref} aria-hidden className="absolute inset-0 overflow-hidden">
      <motion.div className="absolute inset-x-0 inset-y-[-9%] will-change-transform" style={{ y }}>
        <motion.img
          src={src}
          alt=""
          className="size-full object-cover"
          initial={{ transform: reduce ? "scale(1)" : "scale(1.12)" }}
          whileInView={{ transform: "scale(1)" }}
          viewport={{ once: true }}
          transition={{ duration: 1.6, ease: EASE }}
        />
      </motion.div>
    </div>
  )
}

/**
 * The oversized section number behind a hero's title, drifting a little
 * slower than the page for depth.
 */
export function GhostNumeral({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  const ref = useRef<HTMLSpanElement>(null)
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] })
  const y = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [-36, 36])
  return (
    <motion.span
      ref={ref}
      aria-hidden
      style={{ ...style, y }}
      className="pointer-events-none absolute -top-6 right-4 select-none text-[8.5rem] leading-none font-extrabold tracking-[-0.06em] text-white/[0.07] tabular-nums sm:-top-10 sm:text-[13rem]"
    >
      {children}
    </motion.span>
  )
}
