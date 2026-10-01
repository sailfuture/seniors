"use client"

import { useRef, type ReactNode } from "react"
import { useInView } from "motion/react"
import { AnimateNumber, Carousel, useCarousel } from "motion-plus/react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { ZoomableImage } from "@/components/zoomable-image"
import { cn } from "@/lib/utils"
import { formatAmount } from "./format"

/**
 * A dollar figure whose digits roll up from zero, odometer style (Motion+
 * AnimateNumber), the first time it's seen. Screen readers and print get the
 * plain final amount.
 */
export function RollingAmount({ value, className }: { value: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.6 })
  const cents = !Number.isInteger(value)
  return (
    <span ref={ref} className={cn("inline-block tabular-nums", className)}>
      <span className="sr-only">{formatAmount(value, cents)}</span>
      <span aria-hidden data-count-final className="hidden">
        {formatAmount(value, cents)}
      </span>
      <span aria-hidden data-count-live>
        <AnimateNumber
          locales="en-US"
          format={{
            style: "currency",
            currency: "USD",
            minimumFractionDigits: cents ? 2 : 0,
            maximumFractionDigits: cents ? 2 : 0,
          }}
          trend={1}
          transition={{ type: "spring", visualDuration: 0.9, bounce: 0 }}
        >
          {inView ? value : 0}
        </AnimateNumber>
      </span>
    </span>
  )
}

export interface StripImage {
  key: number
  src: string
  /** CSS aspect-ratio from the template's crop; 4:3 when it's free. */
  ratio: string | null
  title: string
  description: string
}

/**
 * Three or more photos in a row as one draggable strip (Motion+ Carousel):
 * swipe, scroll or use the arrows; each photo still opens full screen.
 */
export function ImageStrip({ images }: { images: StripImage[] }) {
  const items = images.map((img) => (
    <figure key={img.key} className="flex flex-col items-start">
      <div
        className="h-48 overflow-hidden rounded-xl bg-[#eef1f7] outline outline-1 -outline-offset-1 outline-black/10 sm:h-60"
        style={{ aspectRatio: img.ratio ?? "4 / 3" }}
      >
        <ZoomableImage
          src={img.src}
          alt={img.title || img.description || "Student upload"}
          imgClassName="h-full w-full object-cover"
          caption={img.title || img.description}
          draggable={false}
        />
      </div>
      {(img.title || img.description) && (
        // w-0 min-w-full: the caption wraps to the photo's width instead of widening it.
        <figcaption className="mt-2.5 w-0 min-w-full">
          {img.title && (
            <span className="block text-[13px] leading-snug font-medium text-muted-foreground">{img.title}</span>
          )}
          {img.description && (
            <span className="mt-1 block text-xs leading-relaxed text-muted-foreground/75">{img.description}</span>
          )}
        </figcaption>
      )}
    </figure>
  ))

  return (
    <Carousel items={items} gap={16} align="start" snap="page" loop={false} fade={32} className="relative w-full">
      <StripControls />
    </Carousel>
  )
}

/** Page dots and arrows under the strip; hidden when everything already fits. */
function StripControls() {
  const { currentPage, totalPages, gotoPage, prevPage, nextPage, isPrevActive, isNextActive } = useCarousel()
  if (totalPages <= 1) return null
  return (
    <div className="mt-4 flex items-center justify-between gap-4">
      <div className="-ml-2 flex items-center">
        {Array.from({ length: totalPages }, (_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Page ${i + 1} of ${totalPages}`}
            aria-current={i === currentPage ? "true" : undefined}
            onClick={() => gotoPage(i)}
            className="group flex h-6 items-center px-1"
          >
            <span
              className={cn(
                "block h-1.5 rounded-full transition-[width,background-color] duration-200",
                i === currentPage
                  ? "w-5 bg-[var(--pf-ink)]"
                  : "w-1.5 bg-[#cfd6e3] group-hover:bg-[#9aa6bb]"
              )}
            />
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <StripButton label="Previous photos" onClick={prevPage} disabled={!isPrevActive}>
          <ChevronLeft className="size-4" strokeWidth={2} />
        </StripButton>
        <StripButton label="Next photos" onClick={nextPage} disabled={!isNextActive}>
          <ChevronRight className="size-4" strokeWidth={2} />
        </StripButton>
      </div>
    </div>
  )
}

function StripButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  disabled: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="flex size-9 items-center justify-center rounded-full bg-white text-foreground ring-1 ring-[#e3e8f1] transition-[background-color,opacity,scale] duration-150 hover:bg-[#f5f7fb] active:scale-[0.96] disabled:pointer-events-none disabled:opacity-40"
    >
      {children}
    </button>
  )
}
