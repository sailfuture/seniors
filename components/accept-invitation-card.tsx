"use client"

import { useSearchParams } from "next/navigation"
import { SignUp } from "@clerk/nextjs"

/**
 * Clerk's prebuilt sign-up card for an invitation link. The ticket arrives as
 * `__clerk_ticket` in the query string and Clerk consumes it itself; without
 * one there is nothing to accept, so the card is replaced by a note pointing
 * back at the sign-in page (open sign-up is the sign-in card's business).
 */
export function AcceptInvitationCard() {
  const params = useSearchParams()
  const ticket = params.get("__clerk_ticket")

  if (!ticket) {
    return (
      <div className="w-full max-w-[28rem] rounded-lg bg-white/10 p-5 text-sm text-white/80 shadow-2xl">
        This page only works from the link in your invitation email. Open that
        email and use its <strong>Accept your invitation</strong> button, or
        ask for a new invitation if it has expired.
      </div>
    )
  }

  return (
    <SignUp
      routing="hash"
      signInUrl="/"
      forceRedirectUrl="/dashboard"
      appearance={{
        variables: { colorPrimary: "#0f1f52", borderRadius: "0.5rem" },
        elements: {
          header: { display: "none" },
          rootBox: { width: "100%" },
          cardBox: {
            width: "100%",
            maxWidth: "28rem",
            boxShadow: "0 25px 50px -12px rgb(0 0 0 / 0.25)",
          },
        },
      }}
    />
  )
}
