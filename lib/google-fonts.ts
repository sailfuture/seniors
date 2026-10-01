// Curated Google Fonts catalog — names must match fonts.google.com exactly.
// Powers the student font picker's suggestions and lets the brand parser
// recognize real font names verbatim (so families containing weight-like
// words — "Shadows Into Light", "Archivo Black" — are never mangled).
export const GOOGLE_FONTS: string[] = [
  // Sans-serif
  "Inter", "Roboto", "Open Sans", "Lato", "Montserrat", "Poppins", "Raleway",
  "Nunito", "Work Sans", "Rubik", "DM Sans", "Manrope", "Karla", "Mulish",
  "Barlow", "Kanit", "Heebo", "Outfit", "Sora", "Figtree", "Plus Jakarta Sans",
  "Urbanist", "Lexend", "Quicksand", "Josefin Sans", "Cabin", "Assistant",
  "Archivo", "Oxygen", "PT Sans", "Noto Sans", "Source Sans 3", "Fira Sans",
  "Titillium Web", "Dosis", "Exo 2", "Chivo", "Red Hat Display", "Public Sans",
  "Space Grotesk", "Albert Sans", "Hanken Grotesk", "Instrument Sans",
  // Serif
  "Playfair Display", "Merriweather", "Lora", "PT Serif", "Noto Serif",
  "Libre Baskerville", "Crimson Text", "EB Garamond", "Cormorant Garamond",
  "Bitter", "Domine", "Spectral", "Source Serif 4", "Zilla Slab", "Arvo",
  "Frank Ruhl Libre", "DM Serif Display", "Fraunces", "Literata", "Newsreader",
  // Display
  "Bebas Neue", "Oswald", "Anton", "Archivo Black", "Alfa Slab One",
  "Righteous", "Passion One", "Fjalla One", "Russo One", "Bungee", "Monoton",
  "Lobster", "Abril Fatface", "Luckiest Guy", "Bangers", "Black Ops One",
  "Titan One", "Shrikhand", "Secular One", "Staatliches", "Unbounded",
  "Audiowide", "Orbitron", "Press Start 2P", "Silkscreen", "Special Elite",
  "Creepster", "Rye",
  // Script & handwriting
  "Dancing Script", "Great Vibes", "Satisfy", "Caveat", "Kaushan Script",
  "Sacramento", "Courgette", "Amatic SC", "Shadows Into Light", "Indie Flower",
  "Patrick Hand", "Architects Daughter", "Gloria Hallelujah", "Pacifico",
  "Permanent Marker", "Comfortaa", "Fredoka", "Baloo 2", "Chewy",
  // Monospace
  "Roboto Mono", "JetBrains Mono", "Fira Code", "Space Mono", "IBM Plex Mono",
  "Source Code Pro", "Inconsolata", "Courier Prime",
]

/**
 * Faces students name that Google doesn't host — Canva's own fonts and the
 * usual system faces — each with the closest Google family to show instead.
 * Keys are lowercase; values need not be in the curated list above, only on
 * fonts.google.com.
 */
export const FONT_STAND_INS: Record<string, string> = {
  // Canva
  "canva sans": "Open Sans",
  "horizon": "Montserrat",
  "glacial indifference": "Jost",
  "open sauce": "Open Sans",
  "open sauce one": "Open Sans",
  "garet": "Poppins",
  "aileron": "Nunito Sans",
  "brittany": "Great Vibes",
  "the seasons": "Cormorant Garamond",
  "cooper hewitt": "Lato",
  "ttnorms": "DM Sans",
  "tt norms": "DM Sans",
  // Microsoft / Apple / Adobe
  "arial": "Arimo",
  "arial black": "Archivo Black",
  "helvetica": "Inter",
  "helvetica neue": "Inter",
  "san francisco": "Inter",
  "sf pro": "Inter",
  "segoe ui": "Open Sans",
  "calibri": "Carlito",
  "cambria": "Caladea",
  "times": "Tinos",
  "times new roman": "Tinos",
  "georgia": "Gelasio",
  "garamond": "EB Garamond",
  "baskerville": "Libre Baskerville",
  "bodoni": "Bodoni Moda",
  "didot": "Playfair Display",
  "palatino": "Crimson Pro",
  "book antiqua": "Crimson Pro",
  "optima": "Marcellus",
  "futura": "Jost",
  "avenir": "Nunito Sans",
  "avenir next": "Nunito Sans",
  "gill sans": "Cabin",
  "verdana": "Noto Sans",
  "tahoma": "Noto Sans",
  "trebuchet ms": "Fira Sans",
  "century gothic": "Questrial",
  "franklin gothic": "Libre Franklin",
  "courier": "Cousine",
  "courier new": "Cousine",
  "impact": "Anton",
  "comic sans": "Comic Neue",
  "comic sans ms": "Comic Neue",
  "brush script": "Dancing Script",
  "copperplate": "Cinzel",
  "rockwell": "Zilla Slab",
  "proxima nova": "Montserrat",
  "gotham": "Montserrat",
  "circular": "DM Sans",
  "brandon grotesque": "Josefin Sans",
  "din": "Barlow",
  "museo sans": "Raleway",
  "myriad pro": "PT Sans",
  "minion pro": "Crimson Text",
}

/** Edit distance, for catching one- or two-letter typos in a font name. */
function editDistance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]
    prev[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1))
      diag = tmp
    }
  }
  return prev[b.length]
}

/**
 * The catalog or stand-in name a misspelled answer most likely meant
 * ("Monserrat" → "Montserrat", "Canva Sons" → "canva sans"), or "" when
 * nothing is close enough. Short names allow one wrong letter, longer ones
 * two, so unrelated families never collapse into each other.
 */
export function closestFontName(name: string, candidates: readonly string[]): string {
  const q = name.trim().toLowerCase()
  if (q.length < 4) return ""
  const budget = q.length < 7 ? 1 : 2
  let best = ""
  let bestDist = budget + 1
  for (const c of candidates) {
    const cl = c.toLowerCase()
    if (Math.abs(cl.length - q.length) > budget) continue
    const d = editDistance(q, cl)
    if (d < bestDist) {
      bestDist = d
      best = c
    }
  }
  return best
}
