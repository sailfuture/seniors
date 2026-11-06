import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ClerkProvider } from "@clerk/nextjs";
import { preconnect } from "react-dom";
import { QueryProvider } from "@/components/query-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";
import { cn } from "@/lib/utils";

// Inter is the body face (from the shadcn preset), applied through
// --font-sans on <html>. Geist Mono stays for code.
const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "SailFuture Academy Senior Dashboard",
    template: "%s | SailFuture Academy Senior Dashboard",
  },
  description:
    "The SailFuture Academy Senior Dashboard is the private academic platform SailFuture Academy seniors and staff use to plan, submit, and track the senior projects required for graduation.",
};

/**
 * Clerk's Frontend API origin (clerk.seniors.sailfutureacademy.org in prod),
 * decoded from the publishable key: pk_<env>_<base64("<host>$")>.
 */
function clerkFrontendApiOrigin(): string | null {
  const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const encoded = key?.split("_")[2];
  if (!encoded) return null;
  try {
    const host = Buffer.from(encoded, "base64").toString("utf8").replace(/\$$/, "");
    return /^[a-z0-9.-]+$/i.test(host) ? `https://${host}` : null;
  } catch {
    return null;
  }
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Open the connection to Clerk from the first bytes of <head>, so the
  // sign-in card isn't also waiting on DNS + TLS. Two pools: clerk-js and its
  // UI chunks load as anonymous CORS scripts, while its /v1/environment and
  // /v1/client calls send cookies, and Chrome won't share one connection
  // across the two.
  const clerkOrigin = clerkFrontendApiOrigin();
  if (clerkOrigin) {
    preconnect(clerkOrigin, { crossOrigin: "anonymous" });
    preconnect(clerkOrigin, { crossOrigin: "use-credentials" });
  }

  return (
    <html lang="en" className={cn("font-sans", inter.variable)}>
      <body
        className={`${geistMono.variable} antialiased`}
      >
        <ClerkProvider
          signInUrl="/"
          signInFallbackRedirectUrl="/dashboard"
          appearance={{
            // Match the SailFuture navy across any Clerk-rendered UI.
            variables: {
              colorPrimary: "#0f1f52",
              colorForeground: "#1a1a2e",
              borderRadius: "0.5rem",
            },
          }}
          localization={{
            // Say who each sign-in method is for, right on the control:
            // students & teachers use school Google; thesis advisors get
            // email/phone from their welcome invite.
            socialButtonsBlockButton: "Students & Teachers — Continue with {{provider|titleize}}",
            formFieldLabel__emailAddress: "Thesis Advisors — Email address",
            formFieldLabel__phoneNumber: "Thesis Advisors — Phone number",
          }}
        >
          <QueryProvider>
            <TooltipProvider>{children}</TooltipProvider>
          </QueryProvider>
          <Toaster position="bottom-right" />
        </ClerkProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
