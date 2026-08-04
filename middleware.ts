import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"

const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/life-map(.*)",
  "/business-thesis(.*)",
  "/admin(.*)",
  "/image-generation(.*)",
  "/api/image-generation(.*)",
  "/api/student(.*)",
  "/api/advisors(.*)",
  "/api/essay(.*)",
])

const isAdminRoute = createRouteMatcher(["/admin(.*)"])

// The one staff surface reserved for admins: the thesis-advisor directory.
const isAdvisorDirectoryRoute = createRouteMatcher(["/admin/advisors(.*)"])

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    // Send signed-out visitors to our branded login, not Clerk's hosted page.
    await auth.protect({
      unauthenticatedUrl: new URL("/login", req.url).toString(),
    })
  }

  // Keep students and advisors out of the staff surface, and teachers out of
  // the advisor directory. Only enforceable when the session token is
  // configured to carry publicMetadata; without that claim we let the request
  // through rather than lock staff out.
  if (isAdminRoute(req)) {
    const { sessionClaims } = await auth.protect({
      unauthenticatedUrl: new URL("/login", req.url).toString(),
    })
    const metadata = (sessionClaims as Record<string, unknown> | null)?.metadata
    const role =
      metadata && typeof metadata === "object"
        ? (metadata as Record<string, unknown>).role
        : undefined
    if (typeof role === "string" && role !== "admin" && role !== "teacher") {
      return Response.redirect(new URL("/dashboard", req.url))
    }
    if (isAdvisorDirectoryRoute(req) && typeof role === "string" && role !== "admin") {
      return Response.redirect(new URL("/dashboard", req.url))
    }
  }
})

export const config = {
  matcher: [
    // Skip Next internals and static files, but always run on API routes.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
}
