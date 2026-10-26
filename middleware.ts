import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { canAccessLifeMap, canEditTemplates, canManageAdvisors, canManageStaff, isStaffRole } from "@/lib/roles"

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

// One student's work. Advisors may open these for the students they're
// assigned to; the [studentId] layouts check the assignment itself.
const isStudentWorkRoute = createRouteMatcher([
  "/admin/life-map/:studentId(.*)",
  "/admin/business-thesis/:studentId(.*)",
])

// The Users page (staff roles + the thesis-advisor directory).
const isUsersRoute = createRouteMatcher(["/admin/users(.*)", "/admin/advisors(.*)"])

// The Users page proper, with the Staff tab. Admins only.
const isStaffUsersRoute = createRouteMatcher(["/admin/users(.*)"])

// Every Life Map page: the student's own, the staff roster and a student's
// work, and the template. Thesis supervisors never see the Life Map.
const isLifeMapRoute = createRouteMatcher(["/life-map(.*)", "/admin/life-map(.*)"])

/** The roster role the session token carries, when it's configured to. */
function roleFromClaims(sessionClaims: unknown): string | undefined {
  const metadata = (sessionClaims as Record<string, unknown> | null)?.metadata
  const role =
    metadata && typeof metadata === "object"
      ? (metadata as Record<string, unknown>).role
      : undefined
  return typeof role === "string" ? role : undefined
}

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    // Send signed-out visitors to the home page's sign-in, not Clerk's hosted page.
    const { sessionClaims } = await auth.protect({
      unauthenticatedUrl: new URL("/", req.url).toString(),
    })
    if (isLifeMapRoute(req) && !canAccessLifeMap(roleFromClaims(sessionClaims))) {
      return Response.redirect(new URL("/dashboard", req.url))
    }
  }

  // Keep students and advisors out of the staff surface (advisors may open
  // their assigned students' work), supervisors out of the templates (and,
  // above, the Life Map), and teachers out of the Users page. Only enforceable when the session token
  // is configured to carry publicMetadata; without that claim we let the
  // request through rather than lock staff out.
  if (isAdminRoute(req)) {
    const { sessionClaims } = await auth.protect({
      unauthenticatedUrl: new URL("/", req.url).toString(),
    })
    const role = roleFromClaims(sessionClaims)
    if (role === undefined) return
    if (role === "advisor" && isStudentWorkRoute(req)) return
    if (!isStaffRole(role)) {
      return Response.redirect(new URL("/dashboard", req.url))
    }
    if (isTemplateRoute(req) && !canEditTemplates(role)) {
      return Response.redirect(new URL("/dashboard", req.url))
    }
    if (isUsersRoute(req) && !canManageAdvisors(role)) {
      return Response.redirect(new URL("/dashboard", req.url))
    }
    // Thesis supervisors never see staff: their page is the advisors one.
    if (isStaffUsersRoute(req) && !canManageStaff(role)) {
      return Response.redirect(new URL("/admin/advisors", req.url))
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
