import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ClerkProvider } from "@clerk/nextjs";
import { QueryProvider } from "@/components/query-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Self-hosted so the login headline never flashes a fallback face. Only the
// Medium (500) cut is loaded — style it with font-medium, never font-bold, or
// the browser synthesizes a faux bold from this file.
const switzer = localFont({
  src: "./fonts/Switzer-Medium.woff2",
  weight: "500",
  style: "normal",
  variable: "--font-switzer",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "SailFuture Academy Senior Dashboard",
    template: "%s | SailFuture Academy Senior Dashboard",
  },
  description:
    "The SailFuture Academy Senior Dashboard is the private academic platform SailFuture Academy seniors and staff use to plan, submit, and track the senior projects required for graduation.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${switzer.variable} antialiased`}
      >
        <ClerkProvider
          signInUrl="/login"
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
