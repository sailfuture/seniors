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
import { fetchBtSections, btTitleToSlug, type BusinessThesisSection } from "@/lib/businessthesis-sections"
import type { Comment } from "@/lib/form-types"

const XANO_BASE =
  process.env.NEXT_PUBLIC_XANO_API_BASE ??
  "https://xsc3-mvx7-r86m.n7e.xano.io/api:o2_UyOKn"
const ALL_REVIEWS_BY_STUDENT_ENDPOINT = `${XANO_BASE}/all_reviews_by_student`
const ALL_REVISIONS_BY_STUDENT_ENDPOINT = `${XANO_BASE}/all_revisions_by_student`
const COMMENTS_ENDPOINT = `${XANO_BASE}/lifemap_comments`
const RESPONSES_ENDPOINT = `${XANO_BASE}/lifemap_responses_by_student`
const TEMPLATE_ENDPOINT = `${XANO_BASE}/lifeplan_template`

const BT_BASE =
  process.env.NEXT_PUBLIC_XANO_BT_API_BASE ??
  "https://xsc3-mvx7-r86m.n7e.xano.io/api:45yS7ICi"
const BT_COMMENTS_ENDPOINT = `${BT_BASE}/businessthesis_comments`
const BT_RESPONSES_ENDPOINT = `${BT_BASE}/businessthesis_responses_by_student`
const BT_TEMPLATE_ENDPOINT = `${BT_BASE}/businessthesis_template`

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

interface StudentListItem {
  id: string
  name: string
}

function useStudentList(): StudentListItem[] {
  const [students, setStudents] = useState<StudentListItem[]>([])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch(STUDENTS_ENDPOINT)
        if (!res.ok || cancelled) return
        const data = await res.json()
        if (Array.isArray(data)) {
          const list = (data as { id: string; firstName: string; lastName: string; yearGroup?: string }[])
            .filter((s) => s.yearGroup === "Batch Year 2026")
            .map((s) => ({ id: s.id, name: `${s.firstName} ${s.lastName}` }))
            .sort((a, b) => a.name.localeCompare(b.name))
          if (!cancelled) setStudents(list)
        }
      } catch { /* ignore */ }
    }
    load()
    return () => { cancelled = true }
  }, [])

  return students
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
        const [responsesRes, templateRes] = await Promise.all([
          fetch(`${RESPONSES_ENDPOINT}?students_id=${studentId}`),
          fetch(TEMPLATE_ENDPOINT),
        ])

        if (cancelled) return

        const ready = new Map<number, number>()
        const revision = new Map<number, number>()

        if (responsesRes.ok && templateRes.ok) {
          const responses: { lifemap_template_id: number; readyReview?: boolean; revisionNeeded?: boolean; isComplete?: boolean; isArchived?: boolean }[] = await responsesRes.json()
          const templates: { id: number; lifemap_sections_id: number; isArchived?: boolean; isPublished?: boolean }[] = await templateRes.json()

          const templateToSection = new Map<number, number>()
          for (const t of templates) {
            if (!t.isArchived && t.isPublished) templateToSection.set(t.id, t.lifemap_sections_id)
          }

          for (const r of responses) {
            if (r.isArchived) continue
            const sid = templateToSection.get(r.lifemap_template_id)
            if (!sid) continue
            if (r.readyReview && !r.isComplete && !r.revisionNeeded) {
              ready.set(sid, (ready.get(sid) ?? 0) + 1)
            }
            if (r.revisionNeeded) {
              revision.set(sid, (revision.get(sid) ?? 0) + 1)
            }
          }
        }

        if (!cancelled) setCounts({ readyReview: ready, revisionNeeded: revision })
      } catch { /* ignore */ }
    }
    load()
    return () => { cancelled = true }
  }, [studentId])

  useEffect(() => {
    const handler = (e: Event) => {
      const { sectionId, delta, type } = (e as CustomEvent).detail as { sectionId: number; delta: number; type?: string }
      setCounts((prev) => {
        if (type === "revision") {
          const next = new Map(prev.revisionNeeded)
          const current = next.get(sectionId) ?? 0
          const updated = Math.max(0, current + delta)
          if (updated === 0) next.delete(sectionId)
          else next.set(sectionId, updated)
          return { ...prev, revisionNeeded: next }
        }
        const next = new Map(prev.readyReview)
        const current = next.get(sectionId) ?? 0
        const updated = Math.max(0, current + delta)
        if (updated === 0) next.delete(sectionId)
        else next.set(sectionId, updated)
        return { ...prev, readyReview: next }
      })
    }
    window.addEventListener("review-update", handler)
    return () => window.removeEventListener("review-update", handler)
  }, [])

  return counts
}

function useBtSectionReviewCounts(studentId: string | null): SectionBadgeCounts {
  const [counts, setCounts] = useState<SectionBadgeCounts>({ readyReview: new Map(), revisionNeeded: new Map() })

  useEffect(() => {
    if (!studentId) { setCounts({ readyReview: new Map(), revisionNeeded: new Map() }); return }
    let cancelled = false
    const load = async () => {
      try {
        const [responsesRes, templateRes] = await Promise.all([
          fetch(`${BT_RESPONSES_ENDPOINT}?students_id=${studentId}`),
          fetch(BT_TEMPLATE_ENDPOINT),
        ])

        if (cancelled) return

        const ready = new Map<number, number>()
        const revision = new Map<number, number>()

        if (responsesRes.ok && templateRes.ok) {
          const responses: { businessthesis_template_id: number; readyReview?: boolean; revisionNeeded?: boolean; isComplete?: boolean; isArchived?: boolean }[] = await responsesRes.json()
          const templates: { id: number; businessthesis_sections_id: number; isArchived?: boolean; isPublished?: boolean }[] = await templateRes.json()

          const templateToSection = new Map<number, number>()
          for (const t of templates) {
            if (!t.isArchived && t.isPublished) templateToSection.set(t.id, t.businessthesis_sections_id)
          }

          for (const r of responses) {
            if (r.isArchived) continue
            const sid = templateToSection.get(r.businessthesis_template_id)
            if (!sid) continue
            if (r.readyReview && !r.isComplete && !r.revisionNeeded) {
              ready.set(sid, (ready.get(sid) ?? 0) + 1)
            }
            if (r.revisionNeeded) {
              revision.set(sid, (revision.get(sid) ?? 0) + 1)
            }
          }
        }

        if (!cancelled) setCounts({ readyReview: ready, revisionNeeded: revision })
      } catch { /* ignore */ }
    }
    load()
    return () => { cancelled = true }
  }, [studentId])

  useEffect(() => {
    const handler = (e: Event) => {
      const { sectionId, delta, type } = (e as CustomEvent).detail as { sectionId: number; delta: number; type?: string }
      setCounts((prev) => {
        if (type === "revision") {
          const next = new Map(prev.revisionNeeded)
          const current = next.get(sectionId) ?? 0
          const updated = Math.max(0, current + delta)
          if (updated === 0) next.delete(sectionId)
          else next.set(sectionId, updated)
          return { ...prev, revisionNeeded: next }
        }
        const next = new Map(prev.readyReview)
        const current = next.get(sectionId) ?? 0
        const updated = Math.max(0, current + delta)
        if (updated === 0) next.delete(sectionId)
        else next.set(sectionId, updated)
        return { ...prev, readyReview: next }
      })
    }
    window.addEventListener("bt-review-update", handler)
    return () => window.removeEventListener("bt-review-update", handler)
  }, [])

  return counts
}

function useBtSectionCommentCounts(studentId: string | null): Map<number, number> {
  const [counts, setCounts] = useState<Map<number, number>>(new Map())

  useEffect(() => {
    if (!studentId) { setCounts(new Map()); return }
    let cancelled = false
    const load = async () => {
      try {
        const [commentsRes, templateRes] = await Promise.all([
          fetch(`${BT_COMMENTS_ENDPOINT}?students_id=${studentId}`),
          fetch(BT_TEMPLATE_ENDPOINT),
        ])
        if (!commentsRes.ok || cancelled) return
        const data: Comment[] = await commentsRes.json()
        if (!Array.isArray(data) || cancelled) return

        const excludedIds = new Set<number>()
        if (templateRes.ok) {
          const questions = await templateRes.json()
          if (Array.isArray(questions)) {
            for (const q of questions as { id: number; isArchived?: boolean; isDraft?: boolean }[]) {
              if (q.isArchived || q.isDraft) excludedIds.add(q.id)
            }
          }
        }

        const map = new Map<number, number>()
        for (const c of data) {
          if (c.isComplete || c.isOld) continue
          if (c.businessthesis_template_id && excludedIds.has(c.businessthesis_template_id)) continue
          const sid = Number(c.businessthesis_sections_id)
          if (sid) map.set(sid, (map.get(sid) ?? 0) + 1)
        }
        setCounts(map)
      } catch { /* ignore */ }
    }
    load()
    return () => { cancelled = true }
  }, [studentId])

  useEffect(() => {
    const handler = (e: Event) => {
      const { sectionId, count } = (e as CustomEvent).detail as { sectionId: number; count: number }
      setCounts((prev) => {
        const next = new Map(prev)
        const current = next.get(sectionId) ?? 0
        const updated = Math.max(0, current - count)
        if (updated === 0) next.delete(sectionId)
        else next.set(sectionId, updated)
        return next
      })
    }
    window.addEventListener("bt-comment-read", handler)
    return () => window.removeEventListener("bt-comment-read", handler)
  }, [])

  return counts
}

function useSectionCommentCounts(studentId: string | null): Map<number, number> {
  const [counts, setCounts] = useState<Map<number, number>>(new Map())

  useEffect(() => {
    if (!studentId) { setCounts(new Map()); return }
    let cancelled = false
    const load = async () => {
      try {
        const [commentsRes, templateRes] = await Promise.all([
          fetch(`${COMMENTS_ENDPOINT}?students_id=${studentId}`),
          fetch(`${XANO_BASE}/lifeplan_template`),
        ])
        if (!commentsRes.ok || cancelled) return
        const data: Comment[] = await commentsRes.json()
        if (!Array.isArray(data) || cancelled) return

        const excludedIds = new Set<number>()
        if (templateRes.ok) {
          const questions = await templateRes.json()
          if (Array.isArray(questions)) {
            for (const q of questions as { id: number; isArchived?: boolean; isDraft?: boolean }[]) {
              if (q.isArchived || q.isDraft) excludedIds.add(q.id)
            }
          }
        }

        const map = new Map<number, number>()
        for (const c of data) {
          if (c.isComplete || c.isOld) continue
          if (c.lifemap_template_id && excludedIds.has(c.lifemap_template_id)) continue
          const sid = Number(c.lifemap_sections_id)
          if (sid) map.set(sid, (map.get(sid) ?? 0) + 1)
        }
        setCounts(map)
      } catch { /* ignore */ }
    }
    load()
    return () => { cancelled = true }
  }, [studentId])

  useEffect(() => {
    const handler = (e: Event) => {
      const { sectionId, count } = (e as CustomEvent).detail as { sectionId: number; count: number }
      setCounts((prev) => {
        const next = new Map(prev)
        const current = next.get(sectionId) ?? 0
        const updated = Math.max(0, current - count)
        if (updated === 0) next.delete(sectionId)
        else next.set(sectionId, updated)
        return next
      })
    }
    window.addEventListener("comment-read", handler)
    return () => window.removeEventListener("comment-read", handler)
  }, [])

  return counts
}

function useBusinessThesisSections() {
  const [sections, setSections] = useState<BusinessThesisSection[]>([])

  useEffect(() => {
    let cancelled = false
    fetchBtSections().then((data) => {
      if (!cancelled) setSections(data)
    })
    return () => { cancelled = true }
  }, [])

  return sections
}

function buildBusinessSectionItems(sections: BusinessThesisSection[]) {
  return sections.map((s) => ({
    title: s.section_title,
    slug: btTitleToSlug(s.section_title),
  }))
}

function buildLifeMapNavItems(sections: LifeMapSection[]) {
  return sections.map((s) => ({
    title: s.section_title,
    url: "", // filled by callers
    slug: titleToSlug(s.section_title),
  }))
}

function buildStudentNav(
  sections: LifeMapSection[],
  btSections: BusinessThesisSection[],
  pathname: string,
  commentCounts?: Map<number, number>,
  revisionCounts?: Map<number, number>,
  btCommentCounts?: Map<number, number>,
  btRevisionCounts?: Map<number, number>,
) {
  const mapItems = buildLifeMapNavItems(sections)
  const btItems = buildBusinessSectionItems(btSections)
  const onLifeMap = pathname.startsWith("/life-map")
  const onBusiness = pathname.startsWith("/business-thesis")
  return [
    {
      title: "Life Map",
      url: `/life-map`,
      icon: <HugeiconsIcon icon={MapsIcon} strokeWidth={2} />,
      isActive: onLifeMap,
      items: mapItems.map((s) => {
        const sec = sections.find((sec) => sec.section_title === s.title)
        return {
          title: s.title,
          url: `/life-map/${s.slug}`,
          badge: sec && commentCounts ? (commentCounts.get(sec.id) ?? 0) : 0,
          badgeRed: sec && revisionCounts ? (revisionCounts.get(sec.id) ?? 0) : 0,
          isLocked: sec?.isLocked ?? false,
        }
      }),
    },
    {
      title: "Business Thesis",
      url: `/business-thesis`,
      icon: <HugeiconsIcon icon={BookOpen02Icon} strokeWidth={2} />,
      isActive: onBusiness,
      items: btItems.map((s) => {
        const sec = btSections.find((sc) => btTitleToSlug(sc.section_title) === s.slug)
        return {
          title: s.title,
          url: `/business-thesis/${s.slug}`,
          badge: sec && btCommentCounts ? (btCommentCounts.get(sec.id) ?? 0) : 0,
          badgeRed: sec && btRevisionCounts ? (btRevisionCounts.get(sec.id) ?? 0) : 0,
          isLocked: sec?.isLocked ?? false,
        }
      }),
    },
  ]
}

function buildTeacherBaseNav(sections: LifeMapSection[], btSections: BusinessThesisSection[], pathname: string, students: StudentListItem[]) {
  const mapItems = buildLifeMapNavItems(sections)
  const btItems = buildBusinessSectionItems(btSections)
  const onTemplate = pathname.startsWith("/admin/life-map-template")
  const onBtTemplate = pathname.startsWith("/admin/business-thesis-template")
  const onLifeMap = !onTemplate && (pathname === "/admin/life-map" || pathname.startsWith("/admin/life-map/"))
  const onBusiness = !onBtTemplate && (pathname === "/admin/business-thesis" || pathname.startsWith("/admin/business-thesis/"))

  return [
    {
      title: "Life Map",
      url: "/admin/life-map",
      icon: <HugeiconsIcon icon={MapsIcon} strokeWidth={2} />,
      isActive: onLifeMap,
      items: students.map((s) => ({
        title: s.name,
        url: `/admin/life-map/${s.id}`,
      })),
    },
    {
      title: "Business Thesis",
      url: "/admin/business-thesis",
      icon: <HugeiconsIcon icon={BookOpen02Icon} strokeWidth={2} />,
      isActive: onBusiness,
      items: students.map((s) => ({
        title: s.name,
        url: `/admin/business-thesis/${s.id}`,
      })),
    },
    {
      title: "Life Map Template",
      url: "/admin/life-map-template",
      icon: <HugeiconsIcon icon={Settings02Icon} strokeWidth={2} />,
      isActive: onTemplate,
      separatorBefore: true,
      items: mapItems.map((s) => ({
        title: s.title,
        url: `/admin/life-map-template/${s.slug}`,
      })),
    },
    {
      title: "Business Thesis Template",
      url: "/admin/business-thesis-template",
      icon: <HugeiconsIcon icon={Settings02Icon} strokeWidth={2} />,
      isActive: onBtTemplate,
      items: btItems.map((s) => ({
        title: s.title,
        url: `/admin/business-thesis-template/${s.slug}`,
      })),
    },
  ]
}

function getTeacherStudentNav(
  pathname: string,
  sections: LifeMapSection[],
  btSections: BusinessThesisSection[],
  readyReviewCounts?: Map<number, number>,
  revisionCounts?: Map<number, number>,
  btReadyReviewCounts?: Map<number, number>,
  btRevisionCounts?: Map<number, number>,
) {
  const mapItems = buildLifeMapNavItems(sections)
  const btItems = buildBusinessSectionItems(btSections)

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
            badgeGray: sec && readyReviewCounts ? (readyReviewCounts.get(sec.id) ?? 0) : 0,
            badgeRed: sec && revisionCounts ? (revisionCounts.get(sec.id) ?? 0) : 0,
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
        items: btItems.map((s) => {
          const sec = btSections.find((sc) => btTitleToSlug(sc.section_title) === s.slug)
          return {
            title: s.title,
            url: `/admin/business-thesis/${studentId}/${s.slug}`,
            badgeGray: sec && btReadyReviewCounts ? (btReadyReviewCounts.get(sec.id) ?? 0) : 0,
            badgeRed: sec && btRevisionCounts ? (btRevisionCounts.get(sec.id) ?? 0) : 0,
          }
        }),
      },
    ]
  }

  return null
}

interface NavBadgeData {
  commentCounts?: Map<number, number>
  revisionCounts?: Map<number, number>
  readyReviewCounts?: Map<number, number>
  btCommentCounts?: Map<number, number>
  btRevisionCounts?: Map<number, number>
  btReadyReviewCounts?: Map<number, number>
}

function getNavFromPathname(pathname: string, isAdmin: boolean, sections: LifeMapSection[], btSections: BusinessThesisSection[], badges: NavBadgeData, students: StudentListItem[]) {
  if (pathname.startsWith("/admin/")) {
    return getTeacherStudentNav(pathname, sections, btSections, badges.readyReviewCounts, badges.revisionCounts, badges.btReadyReviewCounts, badges.btRevisionCounts) ?? buildTeacherBaseNav(sections, btSections, pathname, students)
  }
  if (isAdmin) {
    return buildTeacherBaseNav(sections, btSections, pathname, students)
  }
  return buildStudentNav(sections, btSections, pathname, badges.commentCounts, badges.revisionCounts, badges.btCommentCounts, badges.btRevisionCounts)
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
  const btSections = useBusinessThesisSections()

  const adminStudentId = extractStudentId(pathname)
  const ownStudentId = !isAdmin ? ((session?.user as Record<string, unknown>)?.students_id as string | undefined) ?? null : null
  const studentId = adminStudentId ?? ownStudentId
  const reviewCounts = useSectionReviewCounts(studentId)
  const commentCounts = useSectionCommentCounts(!isAdmin ? studentId : null)
  const btReviewCounts = useBtSectionReviewCounts(studentId)
  const btCommentCounts = useBtSectionCommentCounts(!isAdmin ? studentId : null)
  const studentList = useStudentList()
  const navItems = getNavFromPathname(pathname, isAdmin, sections, btSections, {
    commentCounts,
    revisionCounts: reviewCounts.revisionNeeded,
    readyReviewCounts: reviewCounts.readyReview,
    btCommentCounts,
    btRevisionCounts: btReviewCounts.revisionNeeded,
    btReadyReviewCounts: btReviewCounts.readyReview,
  }, studentList)
  const studentInfo = useStudentInfo(adminStudentId)

  const isLifeMap = pathname.startsWith("/admin/life-map/") && adminStudentId
  const isBusiness = pathname.startsWith("/admin/business-thesis/") && adminStudentId
  const publicUrl = isLifeMap
    ? `/public/life-map/${adminStudentId}`
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
