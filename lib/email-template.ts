/**
 * Shared branded shell for transactional email, matching the SailFuture
 * Academy admissions template: light grey page, rounded white card, navy
 * masthead with the knot logo, and a grid of grey feature tiles.
 *
 * Written as tables with inline styles because that is the only layout email
 * clients agree on — Outlook ignores flex/grid and most `<style>` blocks.
 */

export const APP_URL = "https://seniors.sailfutureacademy.org"

/** The logo PNG's own background, so it sits on the masthead seamlessly. */
const NAVY = "#0d2345"
const PAGE_BG = "#eef0f3"
const TILE_BG = "#f5f6f8"
const TEXT = "#1f2937"
const MUTED = "#6b7280"
const BORDER = "#e5e7eb"

const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"

/** Values interpolated into the HTML are all caller-supplied, so escape them. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

export interface EmailTile {
  /** Shown in caps as the tile heading, e.g. "Google sign-in". */
  label: string
  body: string
}

export interface BrandedEmailOptions {
  /** Masthead headline. */
  title: string
  /** Masthead sub-line under the headline. */
  subtitle?: string
  /** e.g. "Dear Andreina," — rendered as the first body line. */
  greeting?: string
  /** Body copy above the tiles. Each entry becomes a paragraph; inline HTML
   *  such as <strong> is allowed, so callers must escape their own values. */
  paragraphs: string[]
  /** Lead-in sentence directly above the tile grid. */
  tilesIntro?: string
  /** Feature tiles, laid out two per row. */
  tiles?: EmailTile[]
  cta?: { label: string; url: string }
  /** Small print under the divider, above the address line. */
  footnote?: string
  /** Hidden one-line preview shown in the inbox list. */
  preheader?: string
}

function renderTiles(tiles: EmailTile[]): string {
  if (tiles.length === 0) return ""

  // Two per row, with a spacer cell as the gutter. A trailing odd tile gets an
  // empty partner cell so the row keeps its 50/50 split.
  const rows: string[] = []
  for (let i = 0; i < tiles.length; i += 2) {
    const pair = [tiles[i], tiles[i + 1]]
    const cells = pair
      .map((tile) => {
        if (!tile) return `<td class="tile" width="48%" style="width:48%;"></td>`
        return `<td class="tile" width="48%" valign="top" bgcolor="${TILE_BG}" style="width:48%; background-color:${TILE_BG}; border-radius:10px; padding:20px;">
                  <p style="margin:0 0 6px; font-family:${FONT}; font-size:13px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:${NAVY};">${escapeHtml(tile.label)}</p>
                  <p style="margin:0; font-family:${FONT}; font-size:14px; line-height:1.5; color:${MUTED};">${escapeHtml(tile.body)}</p>
                </td>`
      })
      .join(`<td class="gutter" width="4%" style="width:4%; font-size:0; line-height:0;">&nbsp;</td>`)
    rows.push(`<tr>${cells}</tr>`)
  }

  // Spacer rows between tile rows, since margin between <tr> is unreliable.
  const spaced = rows.join(
    `<tr><td colspan="3" height="16" style="height:16px; font-size:0; line-height:0;">&nbsp;</td></tr>`
  )

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%; border-collapse:separate; margin:0 0 28px;">${spaced}</table>`
}

export function renderBrandedEmail(options: BrandedEmailOptions): string {
  const {
    title,
    subtitle,
    greeting,
    paragraphs,
    tilesIntro,
    tiles = [],
    cta,
    footnote,
    preheader,
  } = options

  const body = paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 16px; font-family:${FONT}; font-size:16px; line-height:1.65; color:${TEXT};">${p}</p>`
    )
    .join("")

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<title>${escapeHtml(title)}</title>
<style>
  /* Progressive enhancement only — clients that drop <style> still get the
     fluid two-column grid, which stays legible down to ~320px. */
  @media only screen and (max-width:480px) {
    .tile { display:block !important; width:100% !important; }
    .gutter { display:none !important; }
    .tile + .tile { margin-top:12px !important; }
  }
</style>
</head>
<body style="margin:0; padding:0; background-color:${PAGE_BG};">
${
  preheader
    ? `<div style="display:none; max-height:0; overflow:hidden; opacity:0; mso-hide:all;">${escapeHtml(preheader)}</div>`
    : ""
}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${PAGE_BG}" style="background-color:${PAGE_BG}; margin:0; padding:0;">
  <tr>
    <td align="center" style="padding:32px 16px;">

      <!-- width attr drives Outlook (fixed), the CSS drives everyone else
           (fluid) so the card never overflows a phone viewport. -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%; max-width:600px; background-color:#ffffff; border-radius:16px; overflow:hidden;">

        <!-- Masthead: the logo's own background is this navy, so it blends. -->
        <tr>
          <td align="center" bgcolor="${NAVY}" style="background-color:${NAVY}; padding:44px 32px;">
            <img src="${APP_URL}/images/sailfuture-academy-logo-120.png"
                 width="76" height="76" alt="SailFuture Academy"
                 style="display:block; width:76px; height:76px; border:0; border-radius:50%; margin:0 auto 22px;">
            <h1 style="margin:0; font-family:${FONT}; font-size:29px; line-height:1.25; font-weight:700; color:#ffffff;">${escapeHtml(title)}</h1>
            ${
              subtitle
                ? `<p style="margin:12px 0 0; font-family:${FONT}; font-size:16px; line-height:1.5; color:#aeb9cd;">${escapeHtml(subtitle)}</p>`
                : ""
            }
          </td>
        </tr>

        <tr>
          <td style="padding:40px 36px 36px;">
            ${
              greeting
                ? `<p style="margin:0 0 20px; font-family:${FONT}; font-size:16px; line-height:1.65; color:${TEXT};">${escapeHtml(greeting)}</p>`
                : ""
            }
            ${body}
            ${
              tilesIntro
                ? `<p style="margin:26px 0 18px; font-family:${FONT}; font-size:16px; line-height:1.65; color:${TEXT};">${escapeHtml(tilesIntro)}</p>`
                : ""
            }
            ${renderTiles(tiles)}
            ${
              cta
                ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;">
                     <tr><td align="center" style="padding:4px 0 8px;">
                       <a href="${escapeHtml(cta.url)}" style="display:inline-block; font-family:${FONT}; font-size:15px; font-weight:600; color:#ffffff; background-color:${NAVY}; text-decoration:none; padding:13px 30px; border-radius:8px;">${escapeHtml(cta.label)}</a>
                     </td></tr>
                   </table>`
                : ""
            }
            ${
              footnote
                ? `<hr style="border:0; border-top:1px solid ${BORDER}; margin:28px 0 18px;">
                   <p style="margin:0; font-family:${FONT}; font-size:13px; line-height:1.6; color:${MUTED};">${footnote}</p>`
                : ""
            }
          </td>
        </tr>

        <tr>
          <td align="center" bgcolor="${TILE_BG}" style="background-color:${TILE_BG}; padding:20px 32px;">
            <p style="margin:0; font-family:${FONT}; font-size:12px; line-height:1.6; color:#9ca3af;">
              SailFuture Academy &middot; Operated by SailFuture, Inc. &middot; St. Petersburg, FL
            </p>
          </td>
        </tr>

      </table>

    </td>
  </tr>
</table>
</body>
</html>`
}
