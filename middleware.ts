import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { canEditTemplates, canManageAdvisors, isStaffRole } from "@/lib/roles"

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

// The template editors: staff who only supervise advisors never edit these.
const isTemplateRoute = createRouteMatcher([
  "/admin/life-map-template(.*)",
  "/admin/business-thesis-template(.*)",
])

// The Users page (staff roles + the thesis-advisor directory).
const isUsersRoute = createRouteMatcher(["/admin/users(.*)", "/admin/advisors(.*)"])

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    // Send signed-out visitors to the home page's sign-in, not Clerk's hosted page.
    await auth.protect({
      unauthenticatedUrl: new URL("/", req.url).toString(),
    })
  }

  // Keep students and advisors out of the staff surface, supervisors out of
  // the templates, and teachers out of the Users page. Only enforceable when
  // the session token is configured to carry publicMetadata; without that
  // claim we let the request through rather than lock staff out.
  if (isAdminRoute(req)) {
    const { sessionClaims } = await auth.protect({
      unauthenticatedUrl: new URL("/", req.url).toString(),
    })
    const metadata = (sessionClaims as Record<string, unknown> | null)?.metadata
    const role =
      metadata && typeof metadata === "object"
        ? (metadata as Record<string, unknown>).role
        : undefined
    if (typeof role !== "string") return
    if (!isStaffRole(role)) {
      return Response.redirect(new URL("/dashboard", req.url))
    }
    if (isTemplateRoute(req) && !canEditTemplates(role)) {
      return Response.redirect(new URL("/dashboard", req.url))
    }
    if (isUsersRoute(req) && !canManageAdvisors(role)) {
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
