import { Suspense } from "react"
import { LoginForm } from "@/components/login-form"

export default function LoginPage() {
  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden bg-[#111a2e] p-6 md:p-10">
      {/* Soft blue glow falling from the top, fading into the navy base. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_-10%,#1d3160_0%,#16223f_40%,transparent_75%)]"
      />
      <div className="relative flex w-full max-w-md flex-col items-center gap-6 text-center">
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
    </div>
  )
}
