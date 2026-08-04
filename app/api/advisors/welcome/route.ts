import { NextResponse } from "next/server"
import { Resend } from "resend"
import { getApiSession } from "@/lib/api-auth"
import { APP_URL, escapeHtml, renderBrandedEmail } from "@/lib/email-template"

const FROM =
  process.env.ADVISOR_EMAIL_FROM ??
  "SailFuture Academy <noreply@sailfutureacademy.org>"

function welcomeHtml(firstName: string, email: string) {
  return renderBrandedEmail({
    title: "Welcome, Thesis Advisor",
    subtitle: "You've been added to the SailFuture Academy Senior Dashboard",
    preheader: `Sign in with ${email} to start reviewing your students' work.`,
    greeting: `Dear ${firstName},`,
    paragraphs: [
      `You've been added as a <strong>thesis advisor</strong> on the <strong>SailFuture Academy Senior Dashboard</strong>. Seniors at SailFuture Academy develop a business thesis and a life map as part of their graduation requirements, and advisors like you review and guide that work.`,
      `Sign in with your Google account for <strong>${escapeHtml(email)}</strong> — no password or separate registration needed. Once a student is assigned to you, their work will appear on your dashboard.`,
    ],
    tilesIntro: "Here's what you'll be able to do:",
    tiles: [
      {
        label: "Google sign-in",
        body: "No password to create — sign in with the Google account this email was sent to.",
      },
      {
        label: "Your students only",
        body: "Your dashboard shows just the seniors you've been assigned to advise.",
      },
      {
        label: "Business thesis",
        body: "Review a complete business plan: market analysis, operations, and financials.",
      },
      {
        label: "Life map",
        body: "Review each senior's plan for career, education, housing, and finances.",
      },
    ],
    cta: { label: "Sign in to the dashboard", url: `${APP_URL}/login` },
    footnote: `Questions? Reply to this email or contact <a href="mailto:hthompson@sailfuture.org" style="color:#0d2345;">hthompson@sailfuture.org</a>.`,
  })
}

export async function POST(req: Request) {
  // Only signed-in staff can trigger mail, so the route can't be used to spam.
  const user = await getApiSession()
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 })
  }
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Admins only" }, { status: 403 })
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: "Email is not configured (RESEND_API_KEY is missing)" },
      { status: 503 }
    )
  }

  let body: { email?: string; firstName?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const email = body.email?.trim().toLowerCase()
  // Left raw: renderBrandedEmail escapes the greeting it goes into.
  const firstName = body.firstName?.trim() || "there"
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 })
  }

  const resend = new Resend(apiKey)
  const { data, error } = await resend.emails.send({
    from: FROM,
    to: email,
    replyTo: "hthompson@sailfuture.org",
    subject: "You've been added as a thesis advisor — SailFuture Academy",
    html: welcomeHtml(firstName, email),
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 502 })
  }

  return NextResponse.json({ id: data?.id })
}
