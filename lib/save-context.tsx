"use client"

import { createContext, useCallback, useContext, useState } from "react"
import type { SaveStatus } from "@/lib/form-types"

interface SaveState {
  saveStatus: SaveStatus
  saveNow: () => void
  lastSavedAt: Date | null
  hasDirty: boolean
}

interface SaveContextValue {
  state: SaveState | null
  register: (state: SaveState) => void
  unregister: () => void
}

const SaveContext = createContext<SaveContextValue | null>(null)

export function SaveProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SaveState | null>(null)

  const register = useCallback((s: SaveState) => {
    setState(s)
  }, [])

  const unregister = useCallback(() => {
    setState(null)
  }, [])

  return (
    <SaveContext.Provider value={{ state, register, unregister }}>
      {children}
    </SaveContext.Provider>
  )
}

export function useSaveContext() {
  const ctx = useContext(SaveContext)
  return ctx?.state ?? null
}

export function useSaveRegister() {
  const ctx = useContext(SaveContext)
  return {
    register: ctx?.register ?? (() => {}),
    unregister: ctx?.unregister ?? (() => {}),
  }
}
