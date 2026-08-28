"use client"

import { useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useSignIn } from "@clerk/nextjs"
import { cn } from "@/lib/utils"

function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.81Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3.01c-1.07.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.72-4.95H1.27v3.11A11.99 11.99 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.28A7.2 7.2 0 0 1 4.9 12c0-.79.14-1.56.38-2.28V6.61H1.27a11.99 11.99 0 0 0 0 10.78l4.01-3.11Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.27 6.61l4.01 3.11C6.22 6.88 8.87 4.77 12 4.77Z"
      />
    </svg>
  )
}

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const { signIn, fetchStatus } = useSignIn()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)

  const notAuthorized = searchParams.get("error") === "not_authorized"
  const busy = fetchStatus === "fetching"

  async function handleSignIn() {
    if (!signIn) return
    setError(null)
    try {
      const { error: ssoError } = await signIn.sso({
        strategy: "oauth_google",
        redirectUrl: "/dashboard",
        redirectCallbackUrl: "/sso-callback",
      })
      if (ssoError) {
        setError("Sign in could not be started. Please try again.")
      }
    } catch {
      setError("Sign in could not be started. Please try again.")
    }
  }

  return (
    <div className={cn("flex flex-col items-center gap-4", className)} {...props}>
      <button
        type="button"
        disabled={busy}
        onClick={handleSignIn}
        className="inline-flex h-11 items-center gap-2.5 rounded-lg bg-white px-6 text-sm font-medium text-gray-800 shadow-lg transition-colors hover:bg-gray-100 disabled:pointer-events-none disabled:opacity-60"
      >
        <GoogleLogo className="size-4.5" />
        Sign in with Google
      </button>
      {notAuthorized && (
        <p className="max-w-xs text-center text-xs text-red-300">
          That account is not on the SailFuture Academy roster. Sign in with
          your school Google account, or contact your teacher if you believe
          this is an error.
        </p>
      )}
      {error && (
        <p className="max-w-xs text-center text-xs text-red-300">{error}</p>
      )}
      <p className="mt-6 text-center text-xs text-white/40">
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
