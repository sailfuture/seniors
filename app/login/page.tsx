"use client"

import { LoginForm } from "@/components/login-form"

export default function LoginPage() {
  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex justify-center">
          <img
            src="/images/sailfuture-square.webp"
            alt="SailFuture Academy"
            className="size-16 rounded-full border-[3px] border-white shadow-md"
          />
        </div>
        <LoginForm />
      </div>
    </div>
  )
}
