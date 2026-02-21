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
  ArrowLeft02Icon,
} from "@hugeicons/core-free-icons"
import Link from "next/link"
import { fetchSections, titleToSlug, type LifeMapSection } from "@/lib/lifemap-sections"
import type { Comment } from "@/lib/form-types"

const XANO_BASE =
  process.env.NEXT_PUBLIC_XANO_API_BASE ??
  "https://xsc3-mvx7-r86m.n7e.xano.io/api:o2_UyOKn"
const ALL_REVIEWS_BY_STUDENT_ENDPOINT = `${XANO_BASE}/all_reviews_by_student`
const ALL_REVISIONS_BY_STUDENT_ENDPOINT = `${XANO_BASE}/all_revisions_by_student`
const COMMENTS_ENDPOINT = `${XANO_BASE}/lifemap_comments`

const STUDENTS_ENDPOINT =
  "https://xsc3-mvx7-r86m.n7e.xano.io/api:fJsHVIeC/get_active_students_email"

interface StudentInfo {
  name: string
  email: string
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
        for (const s of students as { id: string; firstName: string; lastName: string; profileImage: string; studentEmail: string }[]) {
          const name = `${s.firstName} ${s.lastName}`
          const initials = `${s.firstName.charAt(0)}${s.lastName.charAt(0)}`.toUpperCase()
          studentInfoCache.set(s.id, { name, email: s.studentEmail ?? "", image: s.profileImage, initials })
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

function useLifeMapSections() {
  const [sections, setSections] = useState<LifeMapSection[]>([])

  useEffect(() => {
    let cancelled = false
    fetchSections().then((data) => {
      if (!cancelled) setSections(data)
    })
    return () => { cancelled = true }
  }, [])

  return sections
}

interface SectionBadgeCounts {
  readyReview: Map<number, number>
  revisionNeeded: Map<number, number>
}

function useSectionReviewCounts(studentId: string | null): SectionBadgeCounts {
  const [counts, setCounts] = useState<SectionBadgeCounts>({ readyReview: new Map(), revisionNeeded: new Map() })

  useEffect(() => {
    if (!studentId) { setCounts({ readyReview: new Map(), revisionNeeded: new Map() }); return }
    let cancelled = false
    const load = async () => {
      try {
        const [reviewsRes, revisionsRes] = await Promise.all([
          fetch(`${ALL_REVIEWS_BY_STUDENT_ENDPOINT}?students_id=${studentId}`),
          fetch(`${ALL_REVISIONS_BY_STUDENT_ENDPOINT}?students_id=${studentId}`),
        ])

        const ready = new Map<number, number>()
        const revision = new Map<number, number>()

        if (reviewsRes.ok && !cancelled) {
          const data = await reviewsRes.json()
          if (Array.isArray(data)) {
            for (const r of data) {
              const sid = Number(r.lifemap_sections_id)
              if (sid) ready.set(sid, (ready.get(sid) ?? 0) + 1)
            }
          }
        }

        if (revisionsRes.ok && !cancelled) {
          const data = await revisionsRes.json()
          if (Array.isArray(data)) {
            for (const r of data) {
              const sid = Number(r.lifemap_sections_id)
              if (sid) revision.set(sid, (revision.get(sid) ?? 0) + 1)
            }
          }
        }

        if (!cancelled) setCounts({ readyReview: ready, revisionNeeded: revision })
      } catch { /* ignore */ }
    }
    load()
    return () => { cancelled = true }
  }, [studentId])

  return counts
}

function useSectionCommentCounts(studentId: string | null): Map<number, number> {
  const [counts, setCounts] = useState<Map<number, number>>(new Map())

  useEffect(() => {
    if (!studentId) { setCounts(new Map()); return }
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch(`${COMMENTS_ENDPOINT}?students_id=${studentId}`)
        if (!res.ok || cancelled) return
        const data: Comment[] = await res.json()
        if (!Array.isArray(data) || cancelled) return
        const map = new Map<number, number>()
        for (const c of data) {
          if (c.isComplete || c.isOld) continue
          const sid = Number(c.lifemap_sections_id)
          if (sid) map.set(sid, (map.get(sid) ?? 0) + 1)
        }
        setCounts(map)
      } catch { /* ignore */ }
    }
    load()
    return () => { cancelled = true }
  }, [studentId])

  return counts
}

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

function buildLifeMapNavItems(sections: LifeMapSection[]) {
  return sections.map((s) => ({
    title: s.section_title,
    url: "", // filled by callers
    slug: titleToSlug(s.section_title),
  }))
}

function buildStudentNav(sections: LifeMapSection[], commentCounts?: Map<number, number>, revisionCounts?: Map<number, number>) {
  const mapItems = buildLifeMapNavItems(sections)
  return [
    {
      title: "Life Map",
      url: "/life-map/overview",
      icon: <HugeiconsIcon icon={MapsIcon} strokeWidth={2} />,
      isActive: true,
      items: mapItems.map((s) => {
        const sec = sections.find((sec) => sec.section_title === s.title)
        return {
          title: s.title,
          url: `/life-map/${s.slug}`,
          badge: sec && commentCounts ? (commentCounts.get(sec.id) ?? 0) : 0,
          badgeRed: sec && revisionCounts ? (revisionCounts.get(sec.id) ?? 0) : 0,
        }
      }),
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
}

function buildTeacherBaseNav(sections: LifeMapSection[]) {
  const mapItems = buildLifeMapNavItems(sections)
  return [
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
      items: mapItems.map((s) => ({
        title: s.title,
        url: `/admin/life-map-template/${s.slug}`,
      })),
    },
  ]
}

function getTeacherStudentNav(pathname: string, sections: LifeMapSection[], readyReviewCounts?: Map<number, number>) {
  const mapItems = buildLifeMapNavItems(sections)

  const lifeMapMatch = pathname.match(/^\/admin\/life-map\/([^/]+)/)
  if (lifeMapMatch) {
    const studentId = lifeMapMatch[1]
    return [
      {
        title: "Life Map",
        url: `/admin/life-map/${studentId}`,
        icon: <HugeiconsIcon icon={MapsIcon} strokeWidth={2} />,
        isActive: true,
        items: mapItems.map((s) => {
          const sec = sections.find((sc) => titleToSlug(sc.section_title) === s.slug)
          return {
            title: s.title,
            url: `/admin/life-map/${studentId}/${s.slug}`,
            badge: sec && readyReviewCounts ? (readyReviewCounts.get(sec.id) ?? 0) : 0,
          }
        }),
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

interface NavBadgeData {
  commentCounts?: Map<number, number>
  revisionCounts?: Map<number, number>
  readyReviewCounts?: Map<number, number>
}

function getNavFromPathname(pathname: string, isAdmin: boolean, sections: LifeMapSection[], badges: NavBadgeData) {
  if (pathname.startsWith("/admin/")) {
    return getTeacherStudentNav(pathname, sections, badges.readyReviewCounts) ?? buildTeacherBaseNav(sections)
  }
  if (isAdmin) {
    return buildTeacherBaseNav(sections)
  }
  return buildStudentNav(sections, badges.commentCounts, badges.revisionCounts)
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
  const sections = useLifeMapSections()

  const adminStudentId = extractStudentId(pathname)
  const ownStudentId = !isAdmin ? ((session?.user as Record<string, unknown>)?.students_id as string | undefined) ?? null : null
  const studentId = adminStudentId ?? ownStudentId
  const reviewCounts = useSectionReviewCounts(studentId)
  const commentCounts = useSectionCommentCounts(!isAdmin ? studentId : null)
  const navItems = getNavFromPathname(pathname, isAdmin, sections, {
    commentCounts,
    revisionCounts: reviewCounts.revisionNeeded,
    readyReviewCounts: reviewCounts.readyReview,
  })
  const studentInfo = useStudentInfo(adminStudentId)

  const isLifeMap = pathname.startsWith("/admin/life-map/") && adminStudentId
  const isBusiness = pathname.startsWith("/admin/business-thesis/") && adminStudentId
  const publicUrl = isLifeMap
    ? `https://lifemap.sailfutureacademy.org/dashboard?student=${adminStudentId}`
    : isBusiness
      ? `https://thesis.sailfutureacademy.org/dashboard?id=${adminStudentId}`
      : null

  return (
    <Sidebar
      className="top-(--header-height) h-[calc(100svh-var(--header-height))]!"
      {...props}
    >
      {studentInfo && (
        <>
          <SidebarHeader className="gap-0 px-0 py-0">
            <div className="flex items-center gap-3 px-4 py-4">
              <Avatar className="size-9">
                <AvatarImage src={studentInfo.image} alt={studentInfo.name} />
                <AvatarFallback className="text-xs">{studentInfo.initials}</AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-col">
                <span className="text-sm font-semibold">{studentInfo.name}</span>
                {studentInfo.email && (
                  <span className="text-muted-foreground truncate text-xs">{studentInfo.email}</span>
                )}
              </div>
            </div>
          </SidebarHeader>
          <Separator />
        </>
      )}
      <SidebarContent>
        {studentInfo && (
          <div className="px-3 pt-3">
            <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-foreground w-full justify-start gap-1.5 text-xs">
              <Link href={isLifeMap ? "/admin/life-map" : "/admin/business-thesis"}>
                <HugeiconsIcon icon={ArrowLeft02Icon} strokeWidth={2} className="size-3.5" />
                Student List
              </Link>
            </Button>
          </div>
        )}
        <NavMain items={navItems} hideLabel={!!studentInfo} />
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
