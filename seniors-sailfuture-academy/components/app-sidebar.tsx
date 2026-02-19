"use client"

import * as React from "react"
import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"

import { NavMain } from "@/components/nav-main"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  BookOpen02Icon,
  MapsIcon,
  Link01Icon,
  Settings02Icon,
} from "@hugeicons/core-free-icons"

const STUDENTS_ENDPOINT =
  "https://xsc3-mvx7-r86m.n7e.xano.io/api:fJsHVIeC/get_active_students_email"

interface StudentInfo {
  name: string
  image: string
  initials: string
}

const studentInfoCache = new Map<string, StudentInfo>()

function useStudentInfo(studentId: string | null): StudentInfo | null {
  const [info, setInfo] = useState<StudentInfo | null>(
    studentId ? (studentInfoCache.get(studentId) ?? null) : null
  )

  useEffect(() => {
    if (!studentId) {
      setInfo(null)
      return
    }

    if (studentInfoCache.has(studentId)) {
      setInfo(studentInfoCache.get(studentId)!)
      return
    }

    let cancelled = false
    const fetchInfo = async () => {
      try {
        const res = await fetch(STUDENTS_ENDPOINT)
        if (!res.ok || cancelled) return
        const students = await res.json()
        for (const s of students as { id: string; firstName: string; lastName: string; profileImage: string }[]) {
          const name = `${s.firstName} ${s.lastName}`
          const initials = `${s.firstName.charAt(0)}${s.lastName.charAt(0)}`.toUpperCase()
          studentInfoCache.set(s.id, { name, image: s.profileImage, initials })
        }
        if (!cancelled && studentInfoCache.has(studentId)) {
          setInfo(studentInfoCache.get(studentId)!)
        }
      } catch {
        // Silently fail
      }
    }

    fetchInfo()
    return () => { cancelled = true }
  }, [studentId])

  return info
}

const lifeMapSections = [
  { title: "Overview", slug: "overview" },
  { title: "Selected Pathway", slug: "pathway" },
  { title: "Personal Profile", slug: "profile" },
  { title: "Career", slug: "career" },
  { title: "Education", slug: "education" },
  { title: "Housing", slug: "housing" },
  { title: "Transportation", slug: "transportation" },
  { title: "Finance", slug: "finance" },
  { title: "Contact", slug: "contact" },
]

const businessSections = [
  { title: "Executive Summary", slug: "executive-summary" },
  { title: "Products & Services", slug: "products-services" },
  { title: "Market Analysis", slug: "market-analysis" },
  { title: "Competitive Analysis", slug: "competitive-analysis" },
  { title: "Financial Plan", slug: "financial-plan" },
  { title: "Marketing Plan", slug: "marketing-plan" },
  { title: "Closing Statement", slug: "closing-statement" },
  { title: "Contact", slug: "contact" },
]

const studentNav = [
  {
    title: "Life Map",
    url: "/life-map/overview",
    icon: <HugeiconsIcon icon={MapsIcon} strokeWidth={2} />,
    isActive: true,
    items: lifeMapSections.map((s) => ({
      title: s.title,
      url: `/life-map/${s.slug}`,
    })),
  },
  {
    title: "Business Thesis",
    url: "/business-thesis/executive-summary",
    icon: <HugeiconsIcon icon={BookOpen02Icon} strokeWidth={2} />,
    isActive: true,
    items: businessSections.map((s) => ({
      title: s.title,
      url: `/business-thesis/${s.slug}`,
    })),
  },
]

const teacherBaseNav = [
  {
    title: "Life Map",
    url: "/admin/life-map",
    icon: <HugeiconsIcon icon={MapsIcon} strokeWidth={2} />,
    isActive: true,
    items: [],
  },
  {
    title: "Business Thesis",
    url: "/admin/business-thesis",
    icon: <HugeiconsIcon icon={BookOpen02Icon} strokeWidth={2} />,
    isActive: true,
    items: [],
  },
  {
    title: "Life Map Template",
    url: "/admin/life-map-template",
    icon: <HugeiconsIcon icon={Settings02Icon} strokeWidth={2} />,
    isActive: true,
    items: lifeMapSections.map((s) => ({
      title: s.title,
      url: `/admin/life-map-template/${s.slug}`,
    })),
  },
]

function getTeacherStudentNav(pathname: string) {
  const lifeMapMatch = pathname.match(/^\/admin\/life-map\/([^/]+)/)
  if (lifeMapMatch) {
    const studentId = lifeMapMatch[1]
    return [
      {
        title: "Life Map",
        url: `/admin/life-map/${studentId}`,
        icon: <HugeiconsIcon icon={MapsIcon} strokeWidth={2} />,
        isActive: true,
        items: lifeMapSections.map((s) => ({
          title: s.title,
          url: `/admin/life-map/${studentId}/${s.slug}`,
        })),
      },
    ]
  }

  const businessMatch = pathname.match(/^\/admin\/business-thesis\/([^/]+)/)
  if (businessMatch) {
    const studentId = businessMatch[1]
    return [
      {
        title: "Business Thesis",
        url: `/admin/business-thesis/${studentId}`,
        icon: <HugeiconsIcon icon={BookOpen02Icon} strokeWidth={2} />,
        isActive: true,
        items: businessSections.map((s) => ({
          title: s.title,
          url: `/admin/business-thesis/${studentId}/${s.slug}`,
        })),
      },
    ]
  }

  return null
}

function getNavFromPathname(pathname: string, isAdmin: boolean) {
  if (pathname.startsWith("/admin/")) {
    return getTeacherStudentNav(pathname) ?? teacherBaseNav
  }
  if (isAdmin) {
    return teacherBaseNav
  }
  return studentNav
}

function extractStudentId(pathname: string): string | null {
  const match = pathname.match(/^\/admin\/(?:life-map|business-thesis)\/([^/]+)/)
  return match?.[1] ?? null
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const role = (session?.user as Record<string, unknown>)?.role as string | undefined
  const isAdmin = role === "admin"

  const navItems = getNavFromPathname(pathname, isAdmin)
  const studentId = extractStudentId(pathname)
  const studentInfo = useStudentInfo(studentId)

  const isLifeMap = pathname.startsWith("/admin/life-map/") && studentId
  const isBusiness = pathname.startsWith("/admin/business-thesis/") && studentId
  const publicUrl = isLifeMap
    ? `https://lifemap.sailfutureacademy.org/dashboard?student=${studentId}`
    : isBusiness
      ? `https://thesis.sailfutureacademy.org/dashboard?id=${studentId}`
      : null

  return (
    <Sidebar
      className="top-(--header-height) h-[calc(100svh-var(--header-height))]!"
      {...props}
    >
      {studentInfo && (
        <>
          <SidebarHeader className="flex flex-row items-center gap-3 px-4 py-4">
            <Avatar className="size-9">
              <AvatarImage src={studentInfo.image} alt={studentInfo.name} />
              <AvatarFallback className="text-xs">{studentInfo.initials}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="text-sm font-semibold">{studentInfo.name}</span>
            </div>
          </SidebarHeader>
          <Separator />
        </>
      )}
      <SidebarContent>
        <NavMain items={navItems} />
      </SidebarContent>
      {publicUrl && (
        <SidebarFooter className="px-3 pb-4">
          <Button variant="outline" size="sm" className="w-full gap-2" asChild>
            <a href={publicUrl} target="_blank" rel="noopener noreferrer">
              <HugeiconsIcon icon={Link01Icon} strokeWidth={2} className="size-4" />
              View Live Public Page
            </a>
          </Button>
        </SidebarFooter>
      )}
    </Sidebar>
  )
}
