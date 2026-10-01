import { NextRequest, NextResponse } from "next/server"
import { getApiSession } from "@/lib/api-auth"
import { WRITING_CHECK_MAX_CHARS } from "@/lib/writing-check"
import { LanguageToolBusyError } from "@/lib/languagetool"
import { runWritingCheck } from "@/lib/writing-check-run"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  const user = await getApiSession(req)
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 })
  }

  let body: { text?: unknown; gate?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  // Checked exactly as sent: the issue offsets index into this string.
  const text = typeof body.text === "string" ? body.text : ""
  if (!text.trim()) {
    return NextResponse.json({ error: "There's nothing to check yet." }, { status: 400 })
  }
  if (text.length > WRITING_CHECK_MAX_CHARS) {
    return NextResponse.json({ error: "This is too long to check in one go." }, { status: 400 })
  }

  try {
    return NextResponse.json({ issues: await runWritingCheck(text, { gate: body.gate === true }) })
  } catch (err) {
    if (err instanceof LanguageToolBusyError) {
      return NextResponse.json(
        { error: "The checker is busy right now. Try again in a minute." },
        { status: 503 }
      )
    }
    return NextResponse.json(
      { error: "The check couldn't be completed. Please try again." },
      { status: 502 }
    )
  }
}
