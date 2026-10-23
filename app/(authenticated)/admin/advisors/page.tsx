"use client"

import { UsersPage } from "@/components/users-page"

/** Old address of the advisor directory; it now lives on the Users page. */
export default function AdminAdvisorsPage() {
  return <UsersPage defaultTab="advisors" />
}
