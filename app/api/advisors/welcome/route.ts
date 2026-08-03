import { NextResponse } from "next/server"
import { Resend } from "resend"
import { getApiSession } from "@/lib/api-auth"

const APP_URL = "https://seniors.sailfutureacademy.org"
const FROM =
  process.env.ADVISOR_EMAIL_FROM ??
  "SailFuture Academy <noreply@sailfutureacademy.org>"

function welcomeHtml(firstName: string, email: string) {
  return `
  <div style="font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; color: #1a1a2e;">
    <div style="background: #0f1f52; border-radius: 12px 12px 0 0; padding: 28px; text-align: center;">
      <h1 style="color: #ffffff; font-size: 20px; margin: 0;">SailFuture Academy Senior Dashboard</h1>
    </div>
    <div style="border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; padding: 28px;">
      <p style="font-size: 15px; line-height: 1.6;">Hi ${firstName},</p>
      <p style="font-size: 15px; line-height: 1.6;">
        You've been added as a <strong>thesis advisor</strong> on the SailFuture
        Academy Senior Dashboard. Seniors at SailFuture Academy develop a
        business thesis and a life map as part of their graduation requirements,
        and advisors like you review and guide that work.
      </p>
      <p style="font-size: 15px; line-height: 1.6;">
        Sign in with your Google account for <strong>${email}</strong> — no
        password or separate registration needed. Once a student is assigned to
        you, their work will appear on your dashboard.
      </p>
      <div style="text-align: center; margin: 28px 0;">
        <a href="${APP_URL}/login"
           style="background: #0f1f52; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-size: 15px; font-weight: 600; display: inline-block;">
          Sign in to the dashboard
        </a>
      </div>
      <p style="font-size: 13px; line-height: 1.6; color: #6b7280;">
        Questions? Reply to this email or contact
        <a href="mailto:hthompson@sailfuture.org" style="color: #0f1f52;">hthompson@sailfuture.org</a>.
      </p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
      <p style="font-size: 12px; color: #9ca3af; text-align: center; margin: 0;">
        SailFuture Academy &middot; Operated by SailFuture, Inc. &middot; St. Petersburg, FL
      </p>
    </div>
  </div>`
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
