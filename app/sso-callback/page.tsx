import { AuthenticateWithRedirectCallback } from "@clerk/nextjs"

/**
 * Landing point for Clerk's Google OAuth redirect. Clerk finishes the handshake
 * client-side and then forwards to the dashboard.
 */
export default function SSOCallbackPage() {
  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center gap-4 p-6">
      <img
        src="/images/sailfuture-square.webp"
        alt="SailFuture Academy"
        className="size-16 rounded-full border-[3px] border-white shadow-md"
      />
      <p className="text-muted-foreground text-sm">Signing you in&hellip;</p>
      <AuthenticateWithRedirectCallback
        signInFallbackRedirectUrl="/dashboard"
        signUpFallbackRedirectUrl="/dashboard"
      />
    </div>
  )
}
