"use client"

import { useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { SignIn, useAuth, useClerk } from "@clerk/nextjs"
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
  const { isLoaded, isSignedIn } = useAuth()
  const { signOut } = useClerk()

  // An account the roster turned away is still signed in to Clerk, and the
  // card won't render for a signed-in user (Clerk sends them on to the
  // dashboard, which sends them back here). Sign it out so the student can
  // choose their school account.
  useEffect(() => {
    if (notAuthorized && isSignedIn) void signOut({ redirectUrl: "/?error=not_authorized" })
  }, [notAuthorized, isSignedIn, signOut])

  return (
    <div className={cn("flex w-full flex-col items-center gap-5", className)} {...props}>
      {notAuthorized && (
        <p className="max-w-xs text-center text-xs text-red-300">
          That account is not on the SailFuture Academy roster. Sign in with
          your school Google account, or contact your teacher if you believe
          this is an error.
        </p>
      )}
      {!(isLoaded && isSignedIn) && (
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
              // Fill the column (Clerk's own card is a fixed 25rem): in Inter
              // the "Students & Teachers — Continue with Google" label needs
              // the extra room, and on a phone it wraps instead of truncating.
              rootBox: { width: "100%" },
              cardBox: {
                width: "100%",
                maxWidth: "28rem",
                boxShadow: "0 25px 50px -12px rgb(0 0 0 / 0.25)", // shadow-2xl
              },
              socialButtonsBlockButtonText: { whiteSpace: "normal", textOverflow: "clip" },
            },
          }}
        />
      )}
    </div>
  )
}
