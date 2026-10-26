"use client"

import { UsersPage } from "@/components/users-page"

/** The advisor directory: a tab of the Users page for admins, the whole
    page for thesis supervisors. */
export default function AdminAdvisorsPage() {
  return <UsersPage defaultTab="advisors" />
}
