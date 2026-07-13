"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const bubbleContentVariants = cva(
  "relative rounded-lg px-3 py-2 text-sm leading-relaxed break-words whitespace-pre-wrap focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-2",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        secondary: "bg-secondary text-secondary-foreground",
        muted: "bg-muted text-foreground",
        tinted: "bg-primary/10 text-foreground",
        outline: "border bg-background text-foreground",
        ghost: "px-0 py-0",
        destructive: "bg-destructive/10 text-destructive dark:bg-destructive/20",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

type BubbleVariant = VariantProps<typeof bubbleContentVariants>["variant"]

const BubbleVariantContext = React.createContext<BubbleVariant>("default")

function Bubble({
  className,
  variant = "default",
  align = "start",
  ...props
}: React.ComponentProps<"div"> & {
  variant?: BubbleVariant
  align?: "start" | "end"
}) {
  return (
    <BubbleVariantContext.Provider value={variant}>
      <div
        data-slot="bubble"
        data-align={align}
        className={cn(
          "relative flex w-fit flex-col",
          variant === "ghost" ? "max-w-full" : "max-w-[80%]",
          align === "end" ? "ml-auto items-end" : "mr-auto items-start",
          className
        )}
        {...props}
      />
    </BubbleVariantContext.Provider>
  )
}

function BubbleContent({
  className,
  asChild = false,
  ...props
}: React.ComponentProps<"div"> & {
  asChild?: boolean
}) {
  const variant = React.useContext(BubbleVariantContext)
  const Comp = asChild ? Slot.Root : "div"
  return (
    <Comp
      data-slot="bubble-content"
      className={cn(bubbleContentVariants({ variant }), className)}
      {...props}
    />
  )
}

function BubbleReactions({
  className,
  side = "bottom",
  align = "end",
  ...props
}: React.ComponentProps<"div"> & {
  side?: "top" | "bottom"
  align?: "start" | "end"
}) {
  return (
    <div
      data-slot="bubble-reactions"
      className={cn(
        "bg-background absolute z-10 flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-xs shadow-sm",
        side === "bottom" ? "-bottom-2.5" : "-top-2.5",
        align === "end" ? "right-2" : "left-2",
        className
      )}
      {...props}
    />
  )
}

function BubbleGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="bubble-group"
      className={cn("flex flex-col gap-1", className)}
      {...props}
    />
  )
}

export { Bubble, BubbleContent, BubbleReactions, BubbleGroup, bubbleContentVariants }
