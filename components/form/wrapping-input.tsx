"use client"

import * as React from "react"
import { InputGroupTextarea } from "@/components/ui/input-group"
import { cn } from "@/lib/utils"

/**
 * A one-line answer field that wraps instead of scrolling sideways, so the
 * whole answer stays in view while it's typed and after it's locked. Enter
 * doesn't start a new line and pasted line breaks become spaces, so the saved
 * value is the same single line an input would give. Goes inside InputGroup;
 * at one line it's the same 36px tall as an input.
 */
export function WrappingInput({
  className,
  onChange,
  onKeyDown,
  ...props
}: React.ComponentProps<"textarea">) {
  return (
    <InputGroupTextarea
      rows={1}
      className={cn("min-h-0 py-1.25 md:text-base", className)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.nativeEvent.isComposing) e.preventDefault()
        onKeyDown?.(e)
      }}
      onChange={(e) => {
        const value = e.target.value
        if (/[\r\n]/.test(value)) e.target.value = value.replace(/\s*[\r\n]+\s*/g, " ")
        onChange?.(e)
      }}
      {...props}
    />
  )
}
