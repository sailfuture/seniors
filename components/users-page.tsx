"use client"

import { Suspense } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useSession } from "@/components/session-provider"
import { canManageStaff } from "@/lib/roles"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AdvisorManager } from "@/components/advisor-manager"
import { StaffManager } from "@/components/staff-manager"

type UsersTab = "staff" | "advisors"

/**
 * One place for everyone who signs in as something other than a student:
 * staff tiers on one tab, the outside thesis advisors on the other. The
 * current tab lives in the URL (?tab=) so links can open either directly.
 */
export function UsersPage({ defaultTab = "staff" }: { defaultTab?: UsersTab }) {
  const { data: session } = useSession()
  const role = (session?.user as Record<string, unknown> | undefined)?.role

  // Only admins see staff. Thesis supervisors get the advisor directory on
  // its own, under its own name.
  if (!canManageStaff(role)) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        <div>
          <h1 className="text-2xl font-bold">Advisors</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            The outside thesis advisors, their sign-in access, and the students each one advises.
          </p>
        </div>
        <AdvisorManager />
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">Users</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Who can sign in to the Senior Dashboard, and what each person can do.
        </p>
      </div>
      <Suspense fallback={null}>
        <UsersTabs defaultTab={defaultTab} />
      </Suspense>
    </div>
  )
}

function UsersTabs({ defaultTab }: { defaultTab: UsersTab }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const fromUrl = params.get("tab")
  const tab: UsersTab = fromUrl === "advisors" || fromUrl === "staff" ? fromUrl : defaultTab

  return (
    <Tabs
      value={tab}
      onValueChange={(v) => router.replace(`${pathname}?tab=${v}`, { scroll: false })}
      className="gap-5"
    >
      <TabsList>
        <TabsTrigger value="staff">Staff</TabsTrigger>
        <TabsTrigger value="advisors">Thesis advisors</TabsTrigger>
      </TabsList>
      <TabsContent value="staff">
        <StaffManager />
      </TabsContent>
      <TabsContent value="advisors">
        <AdvisorManager />
      </TabsContent>
    </Tabs>
  )
}
