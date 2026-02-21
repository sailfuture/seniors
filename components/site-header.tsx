"use client"

import React, { useEffect, useRef, useState } from "react"
import { useSession, signOut } from "next-auth/react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { useSidebar } from "@/components/ui/sidebar"
import { useSaveContext } from "@/lib/save-context"
import { HugeiconsIcon } from "@hugeicons/react"
import { SidebarLeftIcon, LogoutIcon, UserIcon, Link01Icon } from "@hugeicons/core-free-icons"
import { slugToTitle } from "@/lib/lifemap-sections"

function getRelativeTime(date: Date): string {
  const now = Date.now()
  const diff = Math.floor((now - date.getTime()) / 1000)

  if (diff < 5) return "just now"
  if (diff < 60) return `${diff}s ago`
  const mins = Math.floor(diff / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return date.toLocaleDateString()
}

const STUDENTS_ENDPOINT =
  "https://xsc3-mvx7-r86m.n7e.xano.io/api:fJsHVIeC/get_active_students_email"

const studentNameCache = new Map<string, string>()

function useStudentName(studentId: string | null) {
  const [name, setName] = useState<string | null>(
    studentId ? (studentNameCache.get(studentId) ?? null) : null
  )

  useEffect(() => {
    if (!studentId) {
      setName(null)
      return
    }

    if (studentNameCache.has(studentId)) {
      setName(studentNameCache.get(studentId)!)
      return
    }

    const cached = sessionStorage.getItem(`student-name-${studentId}`)
    if (cached) {
      studentNameCache.set(studentId, cached)
      setName(cached)
      return
    }

    let cancelled = false
    const fetchName = async () => {
      try {
        const res = await fetch(STUDENTS_ENDPOINT)
        if (!res.ok || cancelled) return
        const students = await res.json()
        for (const s of students as { id: string; firstName: string; lastName: string }[]) {
          const fullName = `${s.firstName} ${s.lastName}`
          studentNameCache.set(s.id, fullName)
          sessionStorage.setItem(`student-name-${s.id}`, fullName)
        }
        if (!cancelled && studentNameCache.has(studentId)) {
          setName(studentNameCache.get(studentId)!)
        }
      } catch {
        // Silently fail
      }
    }

    fetchName()
    return () => { cancelled = true }
  }, [studentId])

  return name
}

function HeaderBreadcrumb() {
  const pathname = usePathname()

  const adminLifeMap = pathname.match(/^\/admin\/life-map\/([^/]+)/)
  const adminBusiness = pathname.match(/^\/admin\/business-thesis\/([^/]+)/)

  const studentId = adminLifeMap?.[1] ?? adminBusiness?.[1] ?? null
  const studentName = useStudentName(studentId)

  const crumbs: { label: string; href?: string }[] = [
    { label: "SailFuture Academy", href: "/dashboard" },
  ]

  if (adminLifeMap) {
    const sectionMatch = pathname.match(/^\/admin\/life-map\/([^/]+)\/([^/]+)/)
    crumbs.push({ label: "Life Map", href: "/admin/life-map" })
    if (studentName) {
      crumbs.push(
        sectionMatch
          ? { label: studentName, href: `/admin/life-map/${adminLifeMap[1]}` }
          : { label: studentName }
      )
    }
    if (sectionMatch) {
      crumbs.push({ label: slugToTitle(sectionMatch[2]) })
    }
  } else if (adminBusiness) {
    crumbs.push({ label: "Business Thesis", href: "/admin/business-thesis" })
    if (studentName) {
      crumbs.push({ label: studentName })
    }
  } else if (pathname.startsWith("/admin/life-map-template")) {
    const sectionMatch = pathname.match(/^\/admin\/life-map-template\/([^/]+)/)
    if (sectionMatch) {
      crumbs.push({ label: "Life Map Template", href: "/admin/life-map-template" })
      crumbs.push({ label: slugToTitle(sectionMatch[1]) })
    } else {
      crumbs.push({ label: "Life Map Template" })
    }
  } else if (pathname.startsWith("/admin/life-map")) {
    crumbs.push({ label: "Life Map" })
  } else if (pathname.startsWith("/admin/business-thesis")) {
    crumbs.push({ label: "Business Thesis" })
  } else if (pathname.startsWith("/life-map")) {
    crumbs.push({ label: "Life Map" })
  } else if (pathname.startsWith("/business-thesis")) {
    crumbs.push({ label: "Business Thesis" })
  }

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {crumbs.map((crumb, i) => {
          const isLast = i === crumbs.length - 1
          return (
            <React.Fragment key={i}>
              {i > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem>
                {isLast || !crumb.href ? (
                  <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={crumb.href}>{crumb.label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </React.Fragment>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}

export function SiteHeader() {
  const { toggleSidebar } = useSidebar()
  const { data: session, status } = useSession()
  const saveCtx = useSaveContext()
  const studentsId = (session?.user as Record<string, unknown>)?.students_id as string | undefined
  const role = (session?.user as Record<string, unknown>)?.role as string | undefined
  const isStudent = role === "student" && studentsId

  const userRef = useRef({ name: "", email: "", image: "", initials: "" })

  if (session?.user?.name) {
    const name = session.user.name
    const email = session.user.email ?? ""
    const image = session.user.image ?? ""
    const initials = name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
    userRef.current = { name, email, image, initials }
  }

  const { name: userName, email: userEmail, image: userImage, initials } = userRef.current
  const showUser = status === "authenticated" || userName !== ""

  return (
    <header className="bg-background sticky top-0 z-50 flex w-full items-center border-b">
      <div className="flex h-(--header-height) w-full items-center gap-2 px-4">
        <Button
          className="h-8 w-8"
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
        >
          <HugeiconsIcon icon={SidebarLeftIcon} strokeWidth={2} />
        </Button>
        <Separator
          orientation="vertical"
          className="mr-2 data-vertical:h-4 data-vertical:self-auto"
        />
        <HeaderBreadcrumb />

        <div className="ml-auto flex items-center gap-3">
          {saveCtx && <SaveControls />}

          {showUser && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 gap-2 px-2">
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={userImage} alt={userName} />
                    <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                  </Avatar>
                  <span className="hidden text-sm font-medium sm:inline-block">
                    {userName}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{userName}</p>
                    <p className="text-muted-foreground text-xs leading-none">
                      {userEmail}
                    </p>
                  </div>
                </DropdownMenuLabel>
                {isStudent && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <a
                        href={`https://lifemap.sailfutureacademy.org/dashboard?student=${studentsId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <HugeiconsIcon icon={Link01Icon} strokeWidth={2} />
                        Life Map Public Page
                      </a>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <a
                        href={`https://thesis.sailfutureacademy.org/dashboard?id=${studentsId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <HugeiconsIcon icon={Link01Icon} strokeWidth={2} />
                        Business Thesis Public Page
                      </a>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })}>
                  <HugeiconsIcon icon={LogoutIcon} strokeWidth={2} />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  )
}

function SaveControls() {
  const saveCtx = useSaveContext()
  const [, forceUpdate] = useState(0)

  // Re-render every 15s so relative time stays fresh
  useEffect(() => {
    if (!saveCtx?.lastSavedAt) return
    const interval = setInterval(() => forceUpdate((n) => n + 1), 15000)
    return () => clearInterval(interval)
  }, [saveCtx?.lastSavedAt])

  if (!saveCtx) return null

  const { saveStatus, saveNow, lastSavedAt, hasDirty } = saveCtx
  const isSaving = saveStatus === "saving"

  return (
    <div className="flex items-center gap-2">
      {saveStatus === "saving" && (
        <span className="text-muted-foreground text-xs">Saving...</span>
      )}
      {saveStatus === "error" && (
        <span className="text-destructive text-xs">Save failed</span>
      )}
      {saveStatus !== "saving" && saveStatus !== "error" && lastSavedAt && (
        <span className="text-muted-foreground/60 hidden text-xs sm:inline">
          Saved {getRelativeTime(lastSavedAt)}
        </span>
      )}
      <Separator
        orientation="vertical"
        className="mx-1 data-vertical:h-4 data-vertical:self-auto"
      />
      <Button
        type="button"
        size="sm"
        className="h-8 bg-gray-100 px-4 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:pointer-events-none disabled:opacity-50"
        onClick={saveNow}
        disabled={isSaving || !hasDirty}
      >
        {isSaving ? "Saving..." : "Save"}
      </Button>
    </div>
  )
}
