"use client"

import { signIn } from "next-auth/react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className={cn("flex flex-col gap-4", className)} {...props}>
      <Card className="border-2 border-gray-50 px-4 py-4">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Senior Project Dashboard</CardTitle>
          <hr className="border-border my-1" />
          <CardDescription className="mx-auto max-w-[240px]">
            Sign in with your school Google account to access your life plan and business plan projects.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          <Button
            className="w-full bg-[#0f1f52] text-white hover:bg-[#152a6b]"
            onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
          >
            Sign In with Google Account
          </Button>
        </CardContent>
      </Card>
      <p className="text-muted-foreground text-center text-xs">
        &copy; 2025 SailFuture Academy &middot; St. Petersburg, FL &middot;{" "}
        <a href="mailto:hunter@sailfuture.org" className="underline hover:text-foreground">Support</a>{" "}
        &middot;{" "}
        <a href="https://sailfuture.org" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">sailfuture.org</a>
      </p>
    </div>
  )
}
