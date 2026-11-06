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

/**
 * The public home page is the sign-in page: the navy login screen with the
 * sign-in card centered in a single viewport, and a one-line footer with the
 * Privacy Policy and Terms links pinned beneath it. Keep the name identical
 * to the Google consent screen. The purpose and Google data-use copy that
 * OAuth reviewers read lives on /privacy, linked from the footer.
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
    <div
      className={`${switzer.variable} relative flex min-h-svh flex-col bg-[#111a2e] text-white`}
    >
      {/* Soft blue glow falling from the top, fading into the navy base. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-svh bg-[radial-gradient(120%_80%_at_50%_-10%,#1d3160_0%,#16223f_40%,transparent_75%)]"
      />

      <main className="relative flex flex-1 flex-col items-center justify-center p-6 md:p-10">
        <div className="flex w-full max-w-md flex-col items-center gap-6 text-center">
          <img
            src="/images/sailfuture-square.webp"
            alt="SailFuture Academy"
            className="size-16 rounded-full border-2 border-gray-300 shadow-lg"
          />
          <h1 className="text-balance font-[family-name:var(--font-switzer)] text-4xl font-medium tracking-tight md:text-5xl">
            SailFuture Academy Senior Dashboard
          </h1>
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

      <footer className="relative px-6 pb-5 text-center text-xs text-white/55">
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
      </footer>
    </div>
  )
}
