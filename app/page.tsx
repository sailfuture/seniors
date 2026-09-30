import type { Metadata } from "next"
import { Suspense } from "react"
import Link from "next/link"
import localFont from "next/font/local"
import { redirect } from "next/navigation"
import { auth } from "@clerk/nextjs/server"
import { LoginForm } from "@/components/login-form"

// Self-hosted so the headline never flashes a fallback face, and declared
// here so only this page preloads it. Only the Medium (500) cut is loaded —
// style it with font-medium, never font-bold, or the browser synthesizes a
// faux bold from this file.
const switzer = localFont({
  src: "./fonts/Switzer-Medium.woff2",
  weight: "500",
  style: "normal",
  variable: "--font-switzer",
  display: "swap",
})

export const metadata: Metadata = {
  title: { absolute: "SailFuture Academy Senior Dashboard" },
  description:
    "The SailFuture Academy Senior Dashboard is the private academic platform SailFuture Academy seniors and staff use to plan, submit, and track the senior projects required for graduation.",
}

const FEATURES = [
  {
    title: "Life Map",
    description:
      "Seniors plan their personal path after graduation — career, education, housing, transportation, and finances — one section at a time.",
  },
  {
    title: "Business Thesis",
    description:
      "Seniors build a complete business plan, including executive summary, market analysis, operations, and financial projections.",
  },
  {
    title: "Progress and Feedback",
    description:
      "Students see which sections are complete, which are pending review, and read teacher comments left directly on their work.",
  },
  {
    title: "Teacher Review",
    description:
      "SailFuture Academy staff review submissions, leave inline feedback, approve sections, and track each senior toward graduation.",
  },
]

/**
 * The public home page is the sign-in page: the navy login screen with the
 * sign-in card in the middle of the first screen. Below it, in the same navy,
 * sits what Google's OAuth reviewers require an anonymous visitor to be able
 * to read (purpose, Google data use, privacy policy, operator) — an earlier
 * review was rejected when the home page was only a redirect. Keep the name
 * identical to the Google consent screen.
 */
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>
}) {
  const { userId } = await auth()
  const { error } = await searchParams

  // Signed-in students and staff go straight to their dashboard — except an
  // account the roster turned away, which gets the sign-in card again.
  if (userId && error !== "not_authorized") {
    redirect("/dashboard")
  }

  const link = "underline underline-offset-2 hover:text-white"

  return (
    <div className={`${switzer.variable} relative min-h-svh bg-[#111a2e] text-white`}>
      {/* Soft blue glow falling from the top, fading into the navy base. */}
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
            <h1 className="text-balance font-[family-name:var(--font-switzer)] text-4xl font-medium tracking-tight md:text-5xl">
              SailFuture Academy Senior Dashboard
            </h1>
            <p className="text-balance text-sm text-white/70">
              Where SailFuture Academy seniors plan, submit, and track the
              senior projects required for graduation.
            </p>
          </div>
          <p className="text-sm text-white/60">
            Students and teachers continue with Google.
            <br />
            Thesis advisors sign in with email or phone.
          </p>
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </main>

      <section
        aria-label="About the dashboard"
        className="relative mx-auto w-full max-w-3xl border-t border-white/10 px-6 pt-10 pb-12 text-sm leading-relaxed text-white/60"
      >
        <p className="text-base text-white/75">
          The SailFuture Academy Senior Dashboard is the private academic
          platform that SailFuture Academy seniors and staff use to plan,
          submit, and track the senior projects required for graduation.
        </p>

        <h2 className="mt-8 text-xs font-semibold tracking-wide text-white/80 uppercase">
          What the dashboard is used for
        </h2>
        <dl className="mt-3 grid gap-x-8 gap-y-4 sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <div key={feature.title}>
              <dt className="font-medium text-white/85">{feature.title}</dt>
              <dd className="mt-1">{feature.description}</dd>
            </div>
          ))}
        </dl>

        <h2 className="mt-8 text-xs font-semibold tracking-wide text-white/80 uppercase">
          Who can sign in
        </h2>
        <p className="mt-2">
          Access is limited to currently enrolled SailFuture Academy students
          and authorized SailFuture Academy staff. Signing in requires an
          active SailFuture Google Workspace account, and accounts that are not
          on the school roster are not granted access. The dashboard is not
          open to the general public.
        </p>

        <h2 className="mt-8 text-xs font-semibold tracking-wide text-white/80 uppercase">
          How we use your Google account
        </h2>
        <p className="mt-2">
          Google sign-in is used only to verify who you are and to connect you
          to your school records. We receive your name, school email address,
          Google account identifier, and profile photo. The dashboard does not
          request or access your Gmail messages, Google Drive files, Google
          Calendar, or Google Contacts, and it never receives your password.
        </p>
        <p className="mt-2">
          SailFuture Academy&rsquo;s use and transfer of information received
          from Google APIs adheres to the{" "}
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy"
            target="_blank"
            rel="noopener noreferrer"
            className={link}
          >
            Google API Services User Data Policy
          </a>
          , including its Limited Use requirements. Full details are in our{" "}
          <Link href="/privacy" className={link}>
            Privacy Policy
          </Link>
          .
        </p>

        <h2 className="mt-8 text-xs font-semibold tracking-wide text-white/80 uppercase">
          Who operates this dashboard
        </h2>
        <p className="mt-2">
          The SailFuture Academy Senior Dashboard is operated by SailFuture,
          Inc., a nonprofit organization in St. Petersburg, Florida, that runs
          SailFuture Academy. Questions about the dashboard can be sent to{" "}
          <a href="mailto:hthompson@sailfuture.org" className={link}>
            hthompson@sailfuture.org
          </a>
          .
        </p>

        <p className="mt-10 text-center text-xs text-white/55">
          &copy; 2025 SailFuture Academy &middot; St. Petersburg, FL &middot;{" "}
          <Link href="/privacy" className={link}>
            Privacy Policy
          </Link>{" "}
          &middot;{" "}
          <Link href="/terms" className={link}>
            Terms of Use
          </Link>{" "}
          &middot;{" "}
          <a
            href="https://www.sailfutureacademy.org"
            target="_blank"
            rel="noopener noreferrer"
            className={link}
          >
            sailfutureacademy.org
          </a>
        </p>
      </section>
    </div>
  )
}
