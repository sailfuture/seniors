import { Bricolage_Grotesque } from "next/font/google"

/**
 * The public portfolio's display face: headlines, section titles, figures.
 * Loaded only by the pages that render a portfolio, so the dashboard never
 * downloads it. Body text stays Inter.
 */
export const portfolioDisplay = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-pf-display",
  axes: ["opsz"],
})
