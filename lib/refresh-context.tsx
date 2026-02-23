"use client"

import { createContext, useCallback, useContext, useState } from "react"

interface RefreshContextValue {
  refreshFn: (() => Promise<void>) | null
  refreshing: boolean
  refreshKey: number
  register: (fn: () => Promise<void>) => void
  unregister: () => void
  triggerRefresh: () => Promise<void>
  bumpSidebar: () => void
}

const RefreshContext = createContext<RefreshContextValue | null>(null)

export function RefreshProvider({ children }: { children: React.ReactNode }) {
  const [refreshFn, setRefreshFn] = useState<(() => Promise<void>) | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const register = useCallback((fn: () => Promise<void>) => {
    setRefreshFn(() => fn)
  }, [])

  const unregister = useCallback(() => {
    setRefreshFn(null)
  }, [])

  const triggerRefresh = useCallback(async () => {
    setRefreshing(true)
    setRefreshKey((k) => k + 1)
    try {
      if (refreshFn) await refreshFn()
    } finally {
      setRefreshing(false)
    }
  }, [refreshFn])

  const bumpSidebar = useCallback(() => {
    setRefreshKey((k) => k + 1)
  }, [])

  return (
    <RefreshContext.Provider value={{ refreshFn, refreshing, refreshKey, register, unregister, triggerRefresh, bumpSidebar }}>
      {children}
    </RefreshContext.Provider>
  )
}

export function useRefreshContext() {
  const ctx = useContext(RefreshContext)
  return ctx
}

export function useRefreshKey() {
  const ctx = useContext(RefreshContext)
  return ctx?.refreshKey ?? 0
}

export function useRefreshRegister() {
  const ctx = useContext(RefreshContext)
  return {
    register: ctx?.register ?? (() => {}),
    unregister: ctx?.unregister ?? (() => {}),
  }
}

export function useBumpSidebar() {
  const ctx = useContext(RefreshContext)
  return ctx?.bumpSidebar ?? (() => {})
}
