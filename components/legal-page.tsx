import Link from "next/link"

export function LegalPage({
  title,
  effectiveDate,
  children,
}: {
  title: string
  effectiveDate: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-muted min-h-svh px-4 py-10 md:py-16">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <Link href="/">
            <img
              src="/images/sailfuture-square.webp"
              alt="SailFuture Academy"
              className="size-14 rounded-full border-[3px] border-white shadow-md"
            />
          </Link>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Effective Date: {effectiveDate}
            </p>
          </div>
        </div>

        <div className="bg-card rounded-xl border-2 border-gray-50 p-6 shadow-sm md:p-10">
          <div className="prose prose-sm prose-headings:font-semibold prose-headings:tracking-tight prose-h2:mt-8 prose-h2:text-base prose-h3:text-sm max-w-none">
            {children}
          </div>
        </div>

        <p className="text-muted-foreground text-center text-xs">
          &copy; 2025 SailFuture Academy &middot; St. Petersburg, FL &middot;{" "}
          <Link href="/privacy" className="underline hover:text-foreground">
            Privacy Policy
          </Link>{" "}
          &middot;{" "}
          <Link href="/terms" className="underline hover:text-foreground">
            Terms of Use
          </Link>{" "}
          &middot;{" "}
          <a
            href="https://www.sailfutureacademy.org"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            sailfutureacademy.org
          </a>
        </p>
      </div>
    </div>
  )
}
