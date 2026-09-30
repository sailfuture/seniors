import type { Metadata } from "next"
import { Suspense } from "react"
import Link from "next/link"
import localFont from "next/font/local"
import { redirect } from "next/navigation"
import { auth } from "@clerk/nextjs/server"
import { LoginForm } from "@/components/login-form"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

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
 * The public home page is also the sign-in page: the sign-in card up top, and
 * below it the description of the dashboard that Google's OAuth reviewers
 * require an anonymous visitor to see (purpose, Google data use, privacy
 * policy). Keep the name identical to the Google consent screen.
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

  return (
    <div className={`${switzer.variable} bg-muted min-h-svh`}>
      <section className="relative overflow-hidden bg-[#111a2e] px-6 py-12 md:py-16">
        {/* Soft blue glow falling from the top, fading into the navy base. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_-10%,#1d3160_0%,#16223f_40%,transparent_75%)]"
        />
        <div className="relative mx-auto flex w-full max-w-md flex-col items-center gap-6 text-center">
          <img
            src="/images/sailfuture-square.webp"
            alt="SailFuture Academy"
            className="size-16 rounded-full border-2 border-gray-300 shadow-lg"
          />
          <h1 className="text-balance font-[family-name:var(--font-switzer)] text-4xl font-medium tracking-tight text-white md:text-5xl">
            SailFuture Academy Senior Dashboard
          </h1>
          <p className="-mt-2 text-sm text-white/60">
            Students and teachers continue with Google.
            <br />
            Thesis advisors sign in with email or phone.
          </p>
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 py-10 md:py-14">
        <p className="text-muted-foreground mx-auto max-w-xl text-center text-base">
          The SailFuture Academy Senior Dashboard is the private academic
          platform that SailFuture Academy seniors and staff use to plan,
          submit, and track the senior projects required for graduation.
        </p>

        <section className="flex flex-col gap-4">
          <h2 className="text-center text-lg font-semibold tracking-tight">
            What the dashboard is used for
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {FEATURES.map((feature) => (
              <Card key={feature.title} className="border-2 border-gray-50">
                <CardHeader>
                  <CardTitle className="text-base">{feature.title}</CardTitle>
                  <CardDescription>{feature.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>

        <section className="bg-card rounded-xl border-2 border-gray-50 p-6 shadow-sm md:p-8">
          <h2 className="text-lg font-semibold tracking-tight">
            Who can sign in
          </h2>
          <p className="text-muted-foreground mt-2 text-sm">
            Access is limited to currently enrolled SailFuture Academy students
            and authorized SailFuture Academy staff. Signing in requires an
            active SailFuture Google Workspace account, and accounts that are not
            on the school roster are not granted access. The dashboard is not
            open to the general public.
          </p>

          <h2 className="mt-6 text-lg font-semibold tracking-tight">
            How we use your Google account
          </h2>
          <p className="text-muted-foreground mt-2 text-sm">
            Google sign-in is used only to verify who you are and to connect you
            to your school records. We receive your name, school email address,
            Google account identifier, and profile photo. The dashboard does not
            request or access your Gmail messages, Google Drive files, Google
            Calendar, or Google Contacts, and it never receives your password.
          </p>
          <p className="text-muted-foreground mt-2 text-sm">
            SailFuture Academy&rsquo;s use and transfer of information received
            from Google APIs adheres to the{" "}
            <a
              href="https://developers.google.com/terms/api-services-user-data-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              Google API Services User Data Policy
            </a>
            , including its Limited Use requirements. Full details are in our{" "}
            <Link href="/privacy" className="underline hover:text-foreground">
              Privacy Policy
            </Link>
            .
          </p>

          <h2 className="mt-6 text-lg font-semibold tracking-tight">
            Who operates this dashboard
          </h2>
          <p className="text-muted-foreground mt-2 text-sm">
            The SailFuture Academy Senior Dashboard is operated by SailFuture,
            Inc., a nonprofit organization in St. Petersburg, Florida, that runs
            SailFuture Academy. Questions about the dashboard can be sent to{" "}
            <a
              href="mailto:hthompson@sailfuture.org"
              className="underline hover:text-foreground"
            >
              hthompson@sailfuture.org
            </a>
            .
          </p>
        </section>

        <p className="text-muted-foreground text-center text-xs">
          &copy; 2025 SailFuture Academy &middot; St. Petersburg, FL &middot;{" "}
          <Link href="/privacy" className="underline hover:text-foreground">
            Privacy Policy
          </Link>{" "}
          &middot;{" "}
          <Link href="/terms" className="underline hover:text-foreground">
            Terms of Use
          </Link>{" "}
          &middot;{" "}
          <a
            href="https://www.sailfutureacademy.org"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            sailfutureacademy.org
          </a>
        </p>
      </div>
    </div>
  )
}
