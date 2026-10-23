import { redirect } from "next/navigation"
import { SessionProvider } from "@/components/session-provider"
import { getAppSession } from "@/lib/clerk-session"

/**
 * Signed-in pages meant for paper: the same roster gate as the app shell,
 * but no sidebar, header or dock, so the browser's print dialog gets a clean
 * document. Routes here sit under /life-map and /business-thesis, which the
 * middleware already protects.
 */
export default async function PrintLayout({ children }: { children: React.ReactNode }) {
  const session = await getAppSession()
  if (!session) {
    redirect("/?error=not_authorized")
  }
  return <SessionProvider session={session}>{children}</SessionProvider>
}
