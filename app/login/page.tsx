import { redirect } from "next/navigation"

/**
 * Sign-in lives on the home page now. Old /login links and bookmarks land
 * there with their query string (e.g. ?error=not_authorized) intact.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(await searchParams)) {
    for (const v of Array.isArray(value) ? value : value === undefined ? [] : [value]) {
      params.append(key, v)
    }
  }
  const query = params.toString()
  redirect(query ? `/?${query}` : "/")
}
