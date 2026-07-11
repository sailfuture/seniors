"use client"

import { useMemo } from "react"
import { InputGroup, InputGroupInput } from "@/components/ui/input-group"
import { parseBrandColor } from "@/components/brand-display"

/** Normalize a parsed hex to the #rrggbb form the native color input needs. */
function toPickerHex(hex: string | null): string | null {
  if (!hex) return null
  let h = hex.replace("#", "")
  if (h.length === 3) h = h.split("").map((c) => c + c).join("")
  if (h.length === 8) h = h.slice(0, 6)
  if (h.length !== 6) return null
  return `#${h.toLowerCase()}`
}

/**
 * Text input for brand color questions with a live swatch that doubles as a
 * native color picker. Free text still works ("pink #ff66c4", "Magenta");
 * picking from the palette writes a clean hex value.
 */
export function BrandColorInput({
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
  const parsed = useMemo(() => (value.trim() ? parseBrandColor(value) : null), [value])
  const pickerHex = toPickerHex(parsed?.hex ?? null)

  return (
    <div className="relative">
      <InputGroup>
        <InputGroupInput
          className={`pl-10 ${disabled ? "" : "font-semibold"}`}
          placeholder={placeholder || "#1A2B3C or a color name..."}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          spellCheck={false}
        />
      </InputGroup>
      <label
        className={`absolute left-2 top-1/2 size-5.5 -translate-y-1/2 overflow-hidden rounded-md border border-gray-300 shadow-sm ${
          disabled ? "opacity-50" : "cursor-pointer"
        }`}
        style={{
          background: parsed?.css ?? "#ffffff",
          backgroundImage: parsed
            ? undefined
            : "linear-gradient(135deg, #f87171 0%, #facc15 25%, #4ade80 50%, #60a5fa 75%, #c084fc 100%)",
        }}
        title="Pick a color"
      >
        <input
          type="color"
          value={pickerHex ?? "#888888"}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          onBlur={onBlur}
          className="absolute inset-0 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
          aria-label="Pick a color"
        />
      </label>
    </div>
  )
}
