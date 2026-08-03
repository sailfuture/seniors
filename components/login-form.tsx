"use client"

import { useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useSignIn } from "@clerk/nextjs"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

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
    <div className={cn("flex flex-col gap-4", className)} {...props}>
      <Card className="border-2 border-gray-50 px-4 py-4">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">
            SailFuture Academy Senior Dashboard
          </CardTitle>
          <hr className="border-border my-1" />
          <CardDescription className="mx-auto max-w-[240px]">
            Sign in with your school Google account to access your life plan and business plan projects.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          <Button
            className="w-full bg-[#0f1f52] text-white hover:bg-[#152a6b]"
            disabled={busy}
            onClick={handleSignIn}
          >
            Sign In with Google Account
          </Button>
          {notAuthorized && (
            <p className="text-destructive mt-3 text-center text-xs">
              That account is not on the SailFuture Academy roster. Sign in with
              your school Google account, or contact your teacher if you believe
              this is an error.
            </p>
          )}
          {error && (
            <p className="text-destructive mt-3 text-center text-xs">{error}</p>
          )}
        </CardContent>
      </Card>
      <p className="text-muted-foreground text-center text-xs">
        &copy; 2025 SailFuture Academy &middot; St. Petersburg, FL &middot;{" "}
        <a href="mailto:hthompson@sailfuture.org" className="underline hover:text-foreground">Support</a>{" "}
        &middot;{" "}
        <a href="https://sailfuture.org" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">sailfuture.org</a>
        <br />
        <Link href="/privacy" className="underline hover:text-foreground">Privacy Policy</Link>{" "}
        &middot;{" "}
        <Link href="/terms" className="underline hover:text-foreground">Terms of Use</Link>
      </p>
    </div>
  )
}
