import { redirect } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SessionProvider } from "@/components/session-provider"
import { SaveProvider } from "@/lib/save-context"
import { RefreshProvider } from "@/lib/refresh-context"
import { getAppSession } from "@/lib/clerk-session"
import { SideDockColumn, SideDockProvider } from "@/components/side-dock"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Replaces the old NextAuth `signIn` callback: a Clerk account alone is not
  // enough, the email also has to be on the SailFuture roster.
  const session = await getAppSession()
  if (!session) {
    redirect("/?error=not_authorized")
  }

  return (
    <SessionProvider session={session}>
      <SaveProvider>
        <RefreshProvider>
          <SideDockProvider>
            <div className="[--header-height:calc(--spacing(14))]">
              {/* The window itself doesn't scroll: the page content scrolls in
                  its own column, so a docked side panel (the writing check)
                  gets its own scroll beside it instead of a second scrollbar
                  stacked against the page's. Printing lets it all flow. */}
              <SidebarProvider className="flex h-svh flex-col overflow-hidden print:h-auto print:overflow-visible">
                <SiteHeader />
                <div className="flex min-h-0 flex-1">
                  <AppSidebar />
                  <SidebarInset className="min-h-0 overflow-y-auto print:overflow-visible">
                    {children}
                  </SidebarInset>
                  <SideDockColumn />
                </div>
              </SidebarProvider>
            </div>
          </SideDockProvider>
        </RefreshProvider>
      </SaveProvider>
    </SessionProvider>
  )
}
