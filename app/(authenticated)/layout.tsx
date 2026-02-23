import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SaveProvider } from "@/lib/save-context"
import { RefreshProvider } from "@/lib/refresh-context"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
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
  )
}
