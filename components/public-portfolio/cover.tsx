"use client"

import { motion, stagger, useReducedMotion, type Variants } from "motion/react"
import { inkFor, useBrandTheme } from "@/components/brand-display"
import { ContourField } from "./contours"
import { EASE, WordReveal } from "./motion"
import { Eyebrow } from "./sections"
import { goToChapter, type ChapterLink } from "./shell"
import { heroGradient, heroPhotoWash } from "./theme"

const NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"]

/** Children that rise in one after another as the cover first renders. */
function useCoverVariants(): { container: Variants; item: Variants } {
  const reduce = useReducedMotion()
  return {
    container: { hidden: {}, shown: { transition: { delayChildren: stagger(0.09, { startDelay: 0.1 }) } } },
    item: {
      hidden: { opacity: 0, transform: `translateY(${reduce ? 0 : 16}px)` },
      shown: { opacity: 1, transform: "translateY(0px)", transition: { duration: 0.7, ease: EASE } },
    },
  }
}

const COVER_HEIGHT = "min-h-[calc(100svh-8rem)] xl:min-h-[calc(100svh-5.5rem)]"

/**
 * The Life Map's cover: the student's name as the headline, and the plan's
 * sections laid out as waypoints on one course line, each a link to its
 * section.
 */
export function LifeMapCover({
  studentName,
  studentImage,
  classLabel,
  chapters,
  seed,
}: {
  studentName: string
  studentImage?: string
  classLabel?: string
  chapters: ChapterLink[]
  seed: string
}) {
  const { container, item } = useCoverVariants()
  const firstName = studentName.split(/\s+/)[0] ?? ""
  const parts = chapters.length
  const partsText = parts > 0 ? `, in ${NUMBER_WORDS[parts] ?? parts} ${parts === 1 ? "part" : "parts"}.` : "."

  return (
    <section id="cover" className="scroll-mt-28 xl:scroll-mt-20">
      <div className="relative isolate overflow-hidden rounded-3xl text-white" style={{ background: heroGradient(128) }}>
        <ContourField seed={seed} onMount />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(1100px circle at 92% -8%, color-mix(in oklab, var(--pf-glow) 17%, transparent), transparent 55%), radial-gradient(800px circle at -5% 105%, color-mix(in oklab, var(--pf-hero-b) 70%, transparent), transparent 60%)",
          }}
        />
        <motion.div
          className={`relative z-10 flex flex-col justify-between gap-14 p-6 sm:p-10 lg:p-14 ${COVER_HEIGHT}`}
          variants={container}
          initial="hidden"
          animate="shown"
        >
          <motion.div variants={item} data-reveal className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
            <Eyebrow onMount>
              <span className="hidden sm:inline">SailFuture Academy · </span>Life Map
            </Eyebrow>
            {classLabel && (
              <span className="text-[11px] font-semibold tracking-[0.24em] text-white/55 uppercase">{classLabel}</span>
            )}
          </motion.div>

          <div>
            {studentImage && (
              <motion.img
                variants={item} data-reveal
                src={studentImage}
                alt=""
                className="size-20 rounded-full object-cover ring-2 ring-white/25 sm:size-24"
              />
            )}
            <h1 className="mt-6 font-(family-name:--pf-display) text-[clamp(3rem,10vw,7.75rem)] leading-[0.92] font-semibold tracking-[-0.035em] text-balance">
              <WordReveal text={studentName || "Life Map"} onMount delay={0.2} />
            </h1>
            <motion.p variants={item} data-reveal className="mt-6 max-w-xl text-lg leading-relaxed text-pretty text-white/75 sm:text-xl">
              {firstName ? `${firstName}’s plan for life after graduation` : "A plan for life after graduation"}
              {partsText}
            </motion.p>
          </div>

          {parts > 0 && <CourseLine chapters={chapters} />}
        </motion.div>
      </div>
    </section>
  )
}

/** The cover's contents: one line from section to section, drawn in as the page opens. */
function CourseLine({ chapters }: { chapters: ChapterLink[] }) {
  const reduce = useReducedMotion()
  return (
    <nav aria-label="Contents">
      <ol
        className="relative grid gap-4 sm:grid-cols-[repeat(var(--parts),minmax(0,1fr))] sm:gap-0"
        style={{ "--parts": chapters.length } as React.CSSProperties}
      >
        {/* Across on wide screens, down on phones. */}
        <motion.span
          aria-hidden
          data-reveal
          className="absolute top-[7px] right-0 left-0 hidden h-px origin-left bg-white/25 sm:block"
          initial={{ transform: reduce ? "scaleX(1)" : "scaleX(0)" }}
          animate={{ transform: "scaleX(1)" }}
          transition={{ duration: 1.2, ease: EASE, delay: 0.55 }}
        />
        <span aria-hidden className="absolute top-2 bottom-2 left-[7px] w-px bg-white/20 sm:hidden" />
        {chapters.map((c, i) => (
          <motion.li
            key={c.id}
            data-reveal
            initial={{ opacity: 0, transform: `translateY(${reduce ? 0 : 10}px)` }}
            animate={{ opacity: 1, transform: "translateY(0px)" }}
            transition={{ duration: 0.6, ease: EASE, delay: 0.7 + i * 0.09 }}
          >
            <a
              href={`#${c.id}`}
              onClick={(e) => {
                e.preventDefault()
                goToChapter(c.id)
              }}
              className="group relative flex items-start gap-3 sm:flex-col sm:pr-5"
            >
              <span
                aria-hidden
                className="relative z-10 mt-px size-[15px] shrink-0 rounded-full border-2 border-[var(--pf-glow)] bg-[var(--pf-hero-a)] transition-colors duration-150 group-hover:bg-[var(--pf-glow)] sm:mt-0"
              />
              {/* Number and title share a line on phones, stack under the waypoint on wider screens. */}
              <span className="min-w-0 leading-snug">
                {c.number != null && (
                  <span className="mr-2 text-[11px] font-semibold tracking-[0.2em] text-white/45 tabular-nums sm:mr-0 sm:block">
                    {String(c.number).padStart(2, "0")}
                  </span>
                )}
                <span className="text-[15px] font-medium text-white/85 transition-colors duration-150 group-hover:text-white sm:mt-0.5 sm:block">
                  {c.title}
                </span>
              </span>
            </a>
          </motion.li>
        ))}
      </ol>
    </nav>
  )
}

/**
 * The Business Thesis cover, in the student's brand: their company name in
 * their headline font, logo, tagline and contact details, over their cover
 * photo or brand gradient, with the palette as a strip along the bottom.
 */
export function ThesisCover({
  studentName,
  studentImage,
  lastEdited,
  firstChapter,
  seed,
}: {
  studentName: string
  studentImage?: string
  lastEdited?: Date | null
  /** Where the arrow under the byline scrolls to. */
  firstChapter?: string
  seed: string
}) {
  const brand = useBrandTheme()
  const { container, item } = useCoverVariants()
  const reduce = useReducedMotion()
  if (!brand.companyName && !brand.logoUrl) return null

  const taglineFont = brand.secondaryFont ? { fontFamily: `"${brand.secondaryFont}", inherit` } : undefined
  const monogramBg = brand.accent ?? "#1f2937"
  const contact = brand.contact
  const hasContact =
    !!(contact.email || contact.phone || contact.website || contact.location) || contact.socials.length > 0

  return (
    <section id="cover" className="scroll-mt-28 xl:scroll-mt-20">
      <div
        className={`relative isolate flex overflow-hidden rounded-3xl text-white ${COVER_HEIGHT}`}
        style={{ background: brand.coverImageUrl ? "var(--pf-hero-a)" : heroGradient(120) }}
      >
        {brand.coverImageUrl ? (
          <>
            <motion.img
              src={brand.coverImageUrl}
              alt=""
              aria-hidden
              className="absolute inset-0 h-full w-full object-cover"
              initial={{ transform: reduce ? "scale(1)" : "scale(1.08)" }}
              animate={{ transform: "scale(1)" }}
              transition={{ duration: 1.8, ease: EASE }}
            />
            <div aria-hidden className="absolute inset-0" style={{ background: heroPhotoWash(120) }} />
          </>
        ) : (
          <ContourField seed={seed} onMount />
        )}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(760px circle at 88% -12%, color-mix(in oklab, var(--pf-glow) 20%, transparent), transparent 62%)",
          }}
        />
        <div
          aria-hidden
          className={`absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t to-transparent ${
            brand.coverImageUrl ? "from-black/80 via-black/35" : "from-black/55 via-black/15"
          }`}
        />

        <motion.div
          className="relative z-10 flex w-full flex-col justify-between gap-14 p-6 sm:p-10 lg:p-14"
          variants={container}
          initial="hidden"
          animate="shown"
        >
          <motion.div variants={item} data-reveal className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
            <Eyebrow onMount>Senior Business Thesis</Eyebrow>
            {lastEdited && (
              <p className="text-[11px] font-medium tracking-[0.18em] text-white/50 uppercase">
                Last updated{" "}
                {lastEdited.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </p>
            )}
          </motion.div>

          <div>
            <motion.div variants={item} data-reveal>
              {brand.logoUrl ? (
                <div className="size-20 overflow-hidden rounded-full bg-white shadow-lg ring-1 ring-white/30 md:size-24">
                  <img src={brand.logoUrl} alt={brand.companyName || "Company logo"} className="size-full object-cover" />
                </div>
              ) : (
                <div
                  className="flex size-20 items-center justify-center rounded-full text-3xl font-bold shadow-lg ring-1 ring-white/30 md:size-24"
                  style={{ background: monogramBg, color: inkFor(monogramBg) }}
                >
                  {(brand.companyName || "?").charAt(0).toUpperCase()}
                </div>
              )}
            </motion.div>
            <h1 className="mt-6 max-w-4xl font-(family-name:--pf-display) text-[clamp(2.5rem,7vw,5.25rem)] leading-[0.98] font-bold tracking-[-0.025em] text-balance">
              <WordReveal text={brand.companyName || "Business Thesis"} onMount delay={0.25} />
            </h1>
            {brand.tagline && (
              <motion.p
                variants={item} data-reveal
                className="mt-4 max-w-2xl text-base leading-relaxed text-pretty text-white/80 sm:text-xl"
                style={taglineFont}
              >
                {brand.tagline}
              </motion.p>
            )}
            {studentName && (
              <motion.div variants={item} data-reveal className="mt-5 flex items-center gap-2.5">
                {studentImage && (
                  <img
                    src={studentImage}
                    alt=""
                    className="size-8 shrink-0 rounded-full object-cover shadow ring-1 ring-white/30"
                  />
                )}
                <p className="text-sm text-white/65">by {studentName}</p>
              </motion.div>
            )}

            {firstChapter && (
              <motion.div variants={item} data-reveal>
                <button
                  type="button"
                  onClick={() => goToChapter(firstChapter)}
                  aria-label="Scroll to the first section"
                  className="mt-7 flex size-11 items-center justify-center rounded-full border border-white/25 bg-white/10 text-white backdrop-blur-sm transition-colors duration-150 [animation-duration:2.5s] hover:bg-white/25 motion-safe:animate-bounce"
                >
                  <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>
              </motion.div>
            )}

            {hasContact && (
              <motion.div
                variants={item} data-reveal
                className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-white/15 pt-4 text-xs text-white/60"
              >
                {contact.email && (
                  <a href={`mailto:${contact.email}`} className="transition-colors duration-150 hover:text-white">
                    {contact.email}
                  </a>
                )}
                {contact.phone && <span>{contact.phone}</span>}
                {contact.location && <span>{contact.location}</span>}
                {contact.website && (
                  <a
                    href={contact.website.startsWith("http") ? contact.website : `https://${contact.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="transition-colors duration-150 hover:text-white"
                  >
                    {contact.website.replace(/^https?:\/\//, "")}
                  </a>
                )}
                {contact.socials.map((s) => (
                  <span key={s.label}>
                    {s.label} <span className="text-white/80">{s.value}</span>
                  </span>
                ))}
              </motion.div>
            )}
          </div>
        </motion.div>

        {brand.palette.length > 0 && (
          <div aria-hidden className="absolute inset-x-0 bottom-0 z-10 flex h-1.5">
            {brand.palette.map((c, i) => (
              <motion.span
                key={i}
                data-reveal
                className="flex-1 origin-left"
                style={{ background: c }}
                initial={{ transform: reduce ? "scaleX(1)" : "scaleX(0)" }}
                animate={{ transform: "scaleX(1)" }}
                transition={{ duration: 0.7, ease: EASE, delay: 0.8 + i * 0.1 }}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
