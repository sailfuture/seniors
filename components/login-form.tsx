"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { SignIn } from "@clerk/nextjs"
import { cn } from "@/lib/utils"

/**
 * Clerk's prebuilt sign-in card, wrapped in the SailFuture navy branding.
 * The prebuilt component shows every method enabled on the Clerk instance
 * (Google, email, ...), renders its own loading skeleton, and surfaces its
 * own errors — a custom button here once sat dead until Clerk's script
 * loaded, which read as "the sign in button doesn't work".
 */
export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const searchParams = useSearchParams()
  const notAuthorized = searchParams.get("error") === "not_authorized"

  return (
    <div className={cn("flex flex-col items-center gap-5", className)} {...props}>
      {notAuthorized && (
        <p className="max-w-xs text-center text-xs text-red-300">
          That account is not on the SailFuture Academy roster. Sign in with
          your school Google account, or contact your teacher if you believe
          this is an error.
        </p>
      )}
      <SignIn
        routing="hash"
        forceRedirectUrl="/dashboard"
        appearance={{
          variables: {
            colorPrimary: "#0f1f52",
            borderRadius: "0.5rem",
          },
          elements: {
            // The navy hero above the card already names the app. A style
            // object (not a class) — Clerk's own CSS outranks Tailwind's
            // layered `hidden` utility.
            header: { display: "none" },
            cardBox: "w-full shadow-2xl",
          },
        }}
      />
      <p className="mt-4 text-center text-xs text-white/40">
        &copy; 2025 SailFuture Academy &middot; St. Petersburg, FL &middot;{" "}
        <a href="mailto:hthompson@sailfuture.org" className="underline hover:text-white/70">Support</a>{" "}
        &middot;{" "}
        <a href="https://sailfuture.org" target="_blank" rel="noopener noreferrer" className="underline hover:text-white/70">sailfuture.org</a>
        <br />
        <Link href="/privacy" className="underline hover:text-white/70">Privacy Policy</Link>{" "}
        &middot;{" "}
        <Link href="/terms" className="underline hover:text-white/70">Terms of Use</Link>
      </p>
    </div>
  )
}
