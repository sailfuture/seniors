"use client"

import { useMemo, useRef, useState } from "react"
import { InputGroup, InputGroupInput } from "@/components/ui/input-group"
import { useGoogleFont } from "@/components/brand-display"

// Curated Google Fonts catalog — names must match fonts.google.com exactly.
// Students can still type any font name freely; this list only powers the
// suggestions (and everything in it is guaranteed to load on the public page).
export const GOOGLE_FONTS: string[] = [
  // Sans-serif
  "Inter", "Roboto", "Open Sans", "Lato", "Montserrat", "Poppins", "Raleway",
  "Nunito", "Work Sans", "Rubik", "DM Sans", "Manrope", "Karla", "Mulish",
  "Barlow", "Kanit", "Heebo", "Outfit", "Sora", "Figtree", "Plus Jakarta Sans",
  "Urbanist", "Lexend", "Quicksand", "Josefin Sans", "Cabin", "Assistant",
  "Archivo", "Oxygen", "PT Sans", "Noto Sans", "Source Sans 3", "Fira Sans",
  "Titillium Web", "Dosis", "Exo 2", "Chivo", "Red Hat Display", "Public Sans",
  "Space Grotesk", "Albert Sans", "Hanken Grotesk", "Instrument Sans",
  // Serif
  "Playfair Display", "Merriweather", "Lora", "PT Serif", "Noto Serif",
  "Libre Baskerville", "Crimson Text", "EB Garamond", "Cormorant Garamond",
  "Bitter", "Domine", "Spectral", "Source Serif 4", "Zilla Slab", "Arvo",
  "Frank Ruhl Libre", "DM Serif Display", "Fraunces", "Literata", "Newsreader",
  // Display
  "Bebas Neue", "Oswald", "Anton", "Archivo Black", "Alfa Slab One",
  "Righteous", "Passion One", "Fjalla One", "Russo One", "Bungee", "Monoton",
  "Lobster", "Abril Fatface", "Luckiest Guy", "Bangers", "Black Ops One",
  "Titan One", "Shrikhand", "Secular One", "Staatliches", "Unbounded",
  "Audiowide", "Orbitron", "Press Start 2P", "Silkscreen", "Special Elite",
  "Creepster", "Rye",
  // Script & handwriting
  "Dancing Script", "Great Vibes", "Satisfy", "Caveat", "Kaushan Script",
  "Sacramento", "Courgette", "Amatic SC", "Shadows Into Light", "Indie Flower",
  "Patrick Hand", "Architects Daughter", "Gloria Hallelujah", "Pacifico",
  "Permanent Marker", "Comfortaa", "Fredoka", "Baloo 2", "Chewy",
  // Monospace
  "Roboto Mono", "JetBrains Mono", "Fira Code", "Space Mono", "IBM Plex Mono",
  "Source Code Pro", "Inconsolata", "Courier Prime",
]

const MAX_VISIBLE = 24

function FontOption({
  name,
  active,
  onPick,
}: {
  name: string
  active: boolean
  onPick: (name: string) => void
}) {
  // Fetch just the glyphs needed to draw the family's own name
  useGoogleFont(name, name)
  return (
    <button
      type="button"
      // preventDefault so the input doesn't blur before the pick registers
      onMouseDown={(e) => {
        e.preventDefault()
        onPick(name)
      }}
      className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors ${
        active ? "bg-accent" : "hover:bg-accent"
      }`}
    >
      <span style={{ fontFamily: `"${name}", sans-serif` }} className="truncate text-base leading-tight">
        {name}
      </span>
      <span className="text-muted-foreground ml-3 shrink-0 text-[10px] uppercase tracking-wide">Aa</span>
    </button>
  )
}

export function GoogleFontPicker({
  value,
  onChange,
  onBlur,
  disabled = false,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  disabled?: boolean
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  const wrapRef = useRef<HTMLDivElement>(null)

  const trimmed = value.trim()
  const exactMatch = useMemo(
    () => GOOGLE_FONTS.find((f) => f.toLowerCase() === trimmed.toLowerCase()) ?? "",
    [trimmed]
  )
  // Full load for the chosen font so the input itself renders in it
  useGoogleFont(exactMatch)

  const filtered = useMemo(() => {
    if (!trimmed || exactMatch) return GOOGLE_FONTS
    const q = trimmed.toLowerCase()
    return GOOGLE_FONTS.filter((f) => f.toLowerCase().includes(q))
  }, [trimmed, exactMatch])

  const visible = filtered.slice(0, MAX_VISIBLE)

  const pick = (name: string) => {
    onChange(name)
    setOpen(false)
    // persist through the same path a manual edit takes
    setTimeout(() => onBlur?.(), 0)
  }

  return (
    <div ref={wrapRef} className="relative">
      <InputGroup>
        <InputGroupInput
          className={disabled ? "" : "font-semibold"}
          style={exactMatch ? { fontFamily: `"${exactMatch}", sans-serif` } : undefined}
          placeholder={placeholder || "Search Google Fonts or type a font name..."}
          value={value}
          disabled={disabled}
          onChange={(e) => {
            onChange(e.target.value)
            setOpen(true)
            setActiveIdx(0)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            setOpen(false)
            onBlur?.()
          }}
          onKeyDown={(e) => {
            if (!open) return
            if (e.key === "ArrowDown") {
              e.preventDefault()
              setActiveIdx((i) => Math.min(i + 1, visible.length - 1))
            } else if (e.key === "ArrowUp") {
              e.preventDefault()
              setActiveIdx((i) => Math.max(i - 1, 0))
            } else if (e.key === "Enter") {
              if (visible[activeIdx]) {
                e.preventDefault()
                pick(visible[activeIdx])
              }
            } else if (e.key === "Escape") {
              setOpen(false)
            }
          }}
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
        />
      </InputGroup>

      {open && !disabled && visible.length > 0 && (
        <div className="bg-popover text-popover-foreground absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-md border shadow-md">
          {visible.map((name, i) => (
            <FontOption key={name} name={name} active={i === activeIdx} onPick={pick} />
          ))}
          {filtered.length > MAX_VISIBLE && (
            <p className="text-muted-foreground border-t px-3 py-1.5 text-[11px]">
              {filtered.length - MAX_VISIBLE} more — keep typing to narrow down
            </p>
          )}
        </div>
      )}
    </div>
  )
}
