"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const markerVariants = cva("flex items-center gap-2 text-xs text-muted-foreground", {
  variants: {
    variant: {
      default: "py-1",
      border: "border-b pb-3 pt-1",
      separator:
        "py-1 before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border",
    },
  },
  defaultVariants: {
    variant: "default",
  },
})

function Marker({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"div"> &
  VariantProps<typeof markerVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "div"
  return (
    <Comp
      data-slot="marker"
      className={cn(markerVariants({ variant }), className)}
      {...props}
    />
  )
}

function MarkerIcon({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="marker-icon"
      aria-hidden="true"
      className={cn("flex shrink-0 items-center justify-center [&>svg]:size-3.5", className)}
      {...props}
    />
  )
}

function MarkerContent({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="marker-content"
      className={cn("min-w-0", className)}
      {...props}
    />
  )
}

export { Marker, MarkerIcon, MarkerContent, markerVariants }
