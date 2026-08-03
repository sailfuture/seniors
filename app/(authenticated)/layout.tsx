import { redirect } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SessionProvider } from "@/components/session-provider"
import { SaveProvider } from "@/lib/save-context"
import { RefreshProvider } from "@/lib/refresh-context"
import { getAppSession } from "@/lib/clerk-session"
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
    redirect("/login?error=not_authorized")
  }

  return (
    <SessionProvider session={session}>
      <SaveProvider>
        <RefreshProvider>
          <div className="[--header-height:calc(--spacing(14))]">
            <SidebarProvider className="flex flex-col">
              <SiteHeader />
              <div className="flex flex-1">
                <AppSidebar />
                <SidebarInset>{children}</SidebarInset>
              </div>
            </SidebarProvider>
          </div>
        </RefreshProvider>
      </SaveProvider>
    </SessionProvider>
  )
}
