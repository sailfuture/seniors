"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"

/**
 * An image that zooms subtly with a dark overlay + magnifier on hover and
 * opens a full-screen lightbox on click. Self-contained — no provider needed.
 */
export function ZoomableImage({
  src,
  alt,
  imgClassName = "",
  imgStyle,
  className = "",
  caption,
  blurredFit = false,
}: {
  src: string
  alt: string
  imgClassName?: string
  imgStyle?: React.CSSProperties
  className?: string
  caption?: string
  /** Center the image (object-contain) over a blurred, blown-up copy of
   *  itself, so any empty space fills with the picture's own colors. */
  blurredFit?: boolean
}) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("keydown", onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={alt ? `View ${alt}` : "View image"}
        className={`group relative block h-full w-full cursor-zoom-in overflow-hidden ${className}`}
      >
        {blurredFit && (
          <img
            src={src}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-xl"
          />
        )}
        <img
          src={src}
          alt={alt}
          className={`${blurredFit ? "relative z-[1] mx-auto h-full w-auto max-w-full object-contain" : ""} ${imgClassName} transition-transform duration-500 ease-out motion-safe:group-hover:scale-[1.04]`}
          style={imgStyle}
        />
        <span className="pointer-events-none absolute inset-0 bg-black/0 transition-colors duration-300 group-hover:bg-black/30" />
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <span className="flex size-10 scale-90 items-center justify-center rounded-full bg-white/90 text-gray-900 shadow-lg backdrop-blur-sm transition-transform duration-300 group-hover:scale-100">
            <svg className="size-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
              <line x1="11" y1="8" x2="11" y2="14" />
              <line x1="8" y1="11" x2="14" y2="11" />
            </svg>
          </span>
        </span>
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="animate-in fade-in fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden p-4 duration-200 md:p-10"
            role="dialog"
            aria-modal="true"
            aria-label={alt || "Image preview"}
            onClick={() => setOpen(false)}
          >
            {/* A blurred, blown-up copy of the image tints the whole backdrop
                with the picture's own colors; a dark scrim keeps contrast. */}
            <img
              src={src}
              alt=""
              aria-hidden
              className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover opacity-70 blur-3xl"
            />
            <span className="pointer-events-none absolute inset-0 bg-black/70" />
            <button
              type="button"
              aria-label="Close preview"
              className="absolute right-4 top-4 z-10 flex size-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/25"
              onClick={() => setOpen(false)}
            >
              <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <img
              src={src}
              alt={alt}
              className="animate-in zoom-in-95 relative z-[1] max-h-full max-w-full rounded-lg object-contain shadow-2xl duration-200"
              onClick={(e) => e.stopPropagation()}
            />
            {caption && (
              <p className="relative z-[1] mt-4 max-w-2xl text-center text-sm text-white/80">{caption}</p>
            )}
          </div>,
          document.body
        )}
    </>
  )
}
