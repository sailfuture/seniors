import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { auth } from "@clerk/nextjs/server"
import { AcceptInvitationCard } from "@/components/accept-invitation-card"

export const metadata: Metadata = {
  title: "Accept your invitation",
  robots: { index: false, follow: false },
}

/**
 * Where a thesis advisor's invitation link lands. Clerk's sign-up card reads
 * the `__clerk_ticket` from the URL, pre-fills the (already verified) email,
 * and asks for the rest — a password, with the methods enabled on the Clerk
 * instance. On success Clerk redirects to the dashboard, where the roster
 * check in the authenticated layout grants the advisor role.
 *
 * Deliberately outside middleware's protected routes: visitors arrive signed
 * out, and the link itself is the credential.
 */
export default async function AcceptInvitationPage() {
  const { userId } = await auth()
  // Already signed in (e.g. they clicked the link twice): nothing to accept.
  if (userId) redirect("/dashboard")

  return (
    <div className="relative min-h-svh bg-[#111a2e] text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-svh bg-[radial-gradient(120%_80%_at_50%_-10%,#1d3160_0%,#16223f_40%,transparent_75%)]"
      />
      <main className="relative flex min-h-svh flex-col items-center justify-center p-6 md:p-10">
        <div className="flex w-full max-w-md flex-col items-center gap-6 text-center">
          <img
            src="/images/sailfuture-square.webp"
            alt="SailFuture Academy"
            className="size-16 rounded-full border-2 border-gray-300 shadow-lg"
          />
          <div className="flex flex-col gap-2">
            <h1 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
              Welcome, Thesis Advisor
            </h1>
            <p className="text-balance text-sm text-white/70">
              Create your account for the SailFuture Academy Senior Dashboard.
              Your email is already confirmed by your invitation.
            </p>
          </div>
          <AcceptInvitationCard />
          <p className="text-xs text-white/55">
            Already have an account?{" "}
            <Link href="/" className="underline underline-offset-2 hover:text-white">
              Sign in instead
            </Link>
            . Invitation not working? Contact{" "}
            <a
              href="mailto:hthompson@sailfuture.org"
              className="underline underline-offset-2 hover:text-white"
            >
              hthompson@sailfuture.org
            </a>{" "}
            for a new one.
          </p>
        </div>
      </main>
    </div>
  )
}
