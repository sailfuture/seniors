"use client"

import { Suspense } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useSession } from "@/components/session-provider"
import { canManageStaff } from "@/lib/roles"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AdvisorManager } from "@/components/advisor-manager"
import { StaffManager } from "@/components/staff-manager"
import { ThesisSchedule } from "@/components/thesis-schedule"

type UsersTab = "staff" | "advisors" | "schedule"

/**
 * One place for everyone who signs in as something other than a student.
 * Admins get the Users page: staff tiers, the outside thesis advisors, and
 * the meeting schedule. Thesis supervisors get the same page without staff,
 * named Advisors. The current tab lives in the URL (?tab=) so links can open
 * any of them directly.
 */
export function UsersPage({ defaultTab = "staff" }: { defaultTab?: UsersTab }) {
  const { data: session } = useSession()
  const role = (session?.user as Record<string, unknown> | undefined)?.role
  const showStaff = canManageStaff(role)

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">{showStaff ? "Users" : "Advisors"}</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {showStaff
            ? "Who can sign in to the Senior Dashboard, what each person can do, and when thesis meetings happen."
            : "The outside thesis advisors, the students each one advises, and when thesis meetings happen."}
        </p>
      </div>
      <Suspense fallback={null}>
        <UsersTabs defaultTab={defaultTab} showStaff={showStaff} />
      </Suspense>
    </div>
  )
}

function UsersTabs({ defaultTab, showStaff }: { defaultTab: UsersTab; showStaff: boolean }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const tabs: UsersTab[] = showStaff ? ["staff", "advisors", "schedule"] : ["advisors", "schedule"]
  const fromUrl = params.get("tab") as UsersTab | null
  const fallback = tabs.includes(defaultTab) ? defaultTab : tabs[0]
  const tab: UsersTab = fromUrl && tabs.includes(fromUrl) ? fromUrl : fallback

  return (
    <Tabs
      value={tab}
      onValueChange={(v) => router.replace(`${pathname}?tab=${v}`, { scroll: false })}
      className="gap-5"
    >
      <TabsList>
        {showStaff && <TabsTrigger value="staff">Staff</TabsTrigger>}
        <TabsTrigger value="advisors">{showStaff ? "Thesis advisors" : "Advisors"}</TabsTrigger>
        <TabsTrigger value="schedule">Schedule</TabsTrigger>
      </TabsList>
      {showStaff && (
        <TabsContent value="staff">
          <StaffManager />
        </TabsContent>
      )}
      <TabsContent value="advisors">
        <AdvisorManager />
      </TabsContent>
      <TabsContent value="schedule">
        <ThesisSchedule />
      </TabsContent>
    </Tabs>
  )
}
