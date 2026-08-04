"use client"

import { useState } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

/**
 * App-wide TanStack Query client. Xano ignores query filters, so this app
 * fetches whole tables and narrows client-side — the cache exists to make
 * sure each of those tables is fetched once per staleTime, not once per
 * component that happens to need it.
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  // useState so the client is created once per browser session, not per render
  // (and never shared across users during SSR).
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Roster-ish data changes on human timescales; a minute of reuse
            // eliminates the repeated full-table fetches without ever showing
            // meaningfully stale data.
            staleTime: 60_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  )

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
