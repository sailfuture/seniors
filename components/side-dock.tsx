"use client"

import { createContext, useCallback, useContext, useEffect, useId, useState } from "react"
import { cn } from "@/lib/utils"

/**
 * A column docked to the right of the page content, for panels a student
 * works beside rather than over (the writing checklist). The page content
 * narrows to make room and keeps its own scroll, so each column scrolls on
 * its own. One panel at a time: the latest to open takes the column.
 */
interface SideDockValue {
  node: HTMLElement | null
  setNode: (node: HTMLElement | null) => void
  owner: string | null
  setOwner: React.Dispatch<React.SetStateAction<string | null>>
}

const SideDockContext = createContext<SideDockValue | null>(null)

export function SideDockProvider({ children }: { children: React.ReactNode }) {
  const [node, setNode] = useState<HTMLElement | null>(null)
  const [owner, setOwner] = useState<string | null>(null)
  return (
    <SideDockContext.Provider value={{ node, setNode, owner, setOwner }}>
      {children}
    </SideDockContext.Provider>
  )
}

/** Where docked panels render: beside the content on wide screens, over it on phones. */
export function SideDockColumn() {
  const dock = useContext(SideDockContext)
  return (
    <aside
      ref={dock?.setNode}
      className={cn(
        "bg-background flex-col border-l print:hidden",
        dock?.owner ? "flex" : "hidden",
        "fixed inset-x-0 top-(--header-height) bottom-0 z-40 md:static md:z-auto md:w-[380px] md:shrink-0 2xl:w-[420px]"
      )}
    />
  )
}

/**
 * A panel's handle on the dock. `available` is false outside the signed-in
 * layout (no dock to render into).
 */
export function useSideDock() {
  const dock = useContext(SideDockContext)
  const id = useId()
  const setOwner = dock?.setOwner

  const setOpen = useCallback(
    (open: boolean) => {
      setOwner?.((current) => (open ? id : current === id ? null : current))
    },
    [setOwner, id]
  )

  // Give the column back when the panel's page unmounts (navigating away).
  useEffect(() => {
    return () => setOwner?.((current) => (current === id ? null : current))
  }, [setOwner, id])

  return {
    available: !!dock,
    open: !!dock && dock.owner === id,
    setOpen,
    node: dock?.node ?? null,
  }
}
