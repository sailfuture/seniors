"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useForm, FormProvider } from "react-hook-form"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useAutoSave } from "@/hooks/use-auto-save"
import type { FormPageConfig, Comment } from "@/lib/form-types"
import { getSectionStatus } from "@/lib/form-types"
import { useSaveRegister } from "@/lib/save-context"
import { getSectionIdBySlug } from "@/lib/lifemap-sections"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { SectionStatusDot } from "./section-status-dot"
import { FormFieldRenderer } from "./form-field-renderer"
import { UnsavedChangesDialog } from "./unsaved-changes-dialog"

type PendingAction = { type: "navigate"; href: string } | { type: "refresh" } | null

interface FormPageProps {
  title: string
  config: FormPageConfig
  commentsEndpoint?: string
  sectionId?: number
  sectionSlug?: string
}

export function FormPage({ title, config, commentsEndpoint, sectionId: sectionIdProp, sectionSlug }: FormPageProps) {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()
  const { register: registerSave, unregister: unregisterSave } = useSaveRegister()
  const [comments, setComments] = useState<Comment[]>([])
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)
  const pendingAction = useRef<PendingAction>(null)
  const [resolvedSectionId, setResolvedSectionId] = useState<number | undefined>(sectionIdProp)

  useEffect(() => {
    if (sectionIdProp) { setResolvedSectionId(sectionIdProp); return }
    if (!sectionSlug) return
    getSectionIdBySlug(sectionSlug).then((id) => { if (id) setResolvedSectionId(id) })
  }, [sectionIdProp, sectionSlug])

  const sectionId = resolvedSectionId

  const form = useForm<Record<string, unknown>>({
    defaultValues: config.defaultValues,
  })

  const imageFieldNames = useMemo(
    () => config.fields.filter((f) => f.type === "image").map((f) => f.name),
    [config.fields]
  )

  const { saveStatus, saveNow, lastSavedAt, isLoading } = useAutoSave({
    form,
    xanoEndpoint: config.xanoEndpoint,
    xanoLoadEndpoint: config.xanoLoadEndpoint,
    imageFieldNames,
  })

  const values = form.watch()

  const hasDirtyForm = form.formState.isDirty || saveStatus === "saving"

  // Register save state into the layout-level context so the header can access it
  useEffect(() => {
    registerSave({ saveStatus, saveNow, lastSavedAt, hasDirty: hasDirtyForm })
  }, [saveStatus, saveNow, lastSavedAt, hasDirtyForm, registerSave])

  // Unregister when unmounting (navigating away from form page)
  useEffect(() => {
    return () => unregisterSave()
  }, [unregisterSave])

  // Load comments
  useEffect(() => {
    if (!commentsEndpoint || !session?.user) return

    const studentId = (session.user as Record<string, unknown>)?.students_id
    if (!studentId) return

    const loadComments = async () => {
      try {
        const url = sectionId
          ? `${commentsEndpoint}?students_id=${studentId}&lifemap_sections_id=${sectionId}`
          : `${commentsEndpoint}?students_id=${studentId}`
        const res = await fetch(url)
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data)) setComments(data)
        }
      } catch {
        // Silently fail
      }
    }

    loadComments()
  }, [commentsEndpoint, session, sectionId])

  const handleMarkRead = async (commentIds: number[]) => {
    setComments((prev) =>
      prev.map((c) =>
        commentIds.includes(c.id!) ? { ...c, isOld: true } : c
      )
    )

    if (commentsEndpoint) {
      for (const id of commentIds) {
        try {
          await fetch(`${commentsEndpoint}/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isOld: true }),
          })
        } catch {
          // Silently fail
        }
      }
    }
  }

  // Native browser warning for tab/window close
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasDirtyForm) {
        e.preventDefault()
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [hasDirtyForm])

  // Ctrl+S / Cmd+S to save
  useEffect(() => {
    const handleSave = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault()
        saveNow()
      }
    }
    window.addEventListener("keydown", handleSave, true)
    return () => window.removeEventListener("keydown", handleSave, true)
  }, [saveNow])

  // Intercept refresh shortcuts (F5, Ctrl+R, Cmd+R) to show our modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!hasDirtyForm) return

      const isRefresh =
        e.key === "F5" ||
        ((e.ctrlKey || e.metaKey) && e.key === "r")

      if (isRefresh) {
        e.preventDefault()
        e.stopPropagation()
        pendingAction.current = { type: "refresh" }
        setShowUnsavedDialog(true)
      }
    }

    window.addEventListener("keydown", handleKeyDown, true)
    return () => window.removeEventListener("keydown", handleKeyDown, true)
  }, [hasDirtyForm])

  // Intercept in-app link clicks to show our dialog
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (!hasDirtyForm) return

      const anchor = (e.target as HTMLElement).closest("a[href]")
      if (!anchor) return

      const href = anchor.getAttribute("href")
      if (!href || href.startsWith("#") || href.startsWith("http")) return

      e.preventDefault()
      e.stopPropagation()
      pendingAction.current = { type: "navigate", href }
      setShowUnsavedDialog(true)
    }

    document.addEventListener("click", handleClick, true)
    return () => document.removeEventListener("click", handleClick, true)
  }, [hasDirtyForm])

  const executePendingAction = useCallback(() => {
    const action = pendingAction.current
    if (!action) return

    pendingAction.current = null
    setShowUnsavedDialog(false)
    form.reset(form.getValues())

    if (action.type === "navigate") {
      router.push(action.href)
    } else {
      window.location.reload()
    }
  }, [router, form])

  const handleDiscard = useCallback(() => {
    executePendingAction()
  }, [executePendingAction])

  const handleSaveAndLeave = useCallback(async () => {
    const action = pendingAction.current
    await saveNow()
    pendingAction.current = action
    executePendingAction()
  }, [saveNow, executePendingAction])

  const handleCancel = useCallback(() => {
    pendingAction.current = null
    setShowUnsavedDialog(false)
  }, [])

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-6">
          {config.sections.map((section) => (
            <Card key={section.title}>
              <CardHeader>
                <Skeleton className="h-5 w-40" />
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-6">
                  {section.fields.map((fieldName) => {
                    const field = config.fields.find((f) => f.name === fieldName)
                    let colSpan = "md:col-span-3"
                    if (field?.columns === 3) {
                      colSpan = "md:col-span-2"
                    } else if (field?.columns === 2) {
                      colSpan = "md:col-span-3"
                    } else if (field?.type === "textarea" || field?.type === "image") {
                      colSpan = "md:col-span-6"
                    }
                    return (
                      <div key={fieldName} className={colSpan}>
                        <Skeleton className="mb-2 h-4 w-24" />
                        <Skeleton
                          className={
                            field?.type === "textarea"
                              ? "h-28 w-full"
                              : field?.type === "image"
                                ? "h-32 w-full"
                                : "h-10 w-full"
                          }
                        />
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <FormProvider {...form}>
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        <h1 className="text-2xl font-bold">{title}</h1>

        <div className="space-y-6">
          {config.sections.map((section, i) => {
            const status = getSectionStatus(section, config.fields, values)
            const sectionFields = config.fields.filter((f) =>
              section.fields.includes(f.name)
            )

            return (
              <Card key={section.title} className="relative">
                <div className="absolute right-4 top-4">
                  <SectionStatusDot status={status} />
                </div>
                <CardHeader>
                  <CardTitle className="text-lg">{section.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-6">
                    {sectionFields.map((field) => {
                      let colSpan = "md:col-span-3"
                      if (field.columns === 3) {
                        colSpan = "md:col-span-2"
                      } else if (field.columns === 2) {
                        colSpan = "md:col-span-3"
                      } else if (field.type === "textarea" || field.type === "image") {
                        colSpan = "md:col-span-6"
                      }

                      return (
                        <div key={field.name} className={colSpan}>
                          <FormFieldRenderer
                            field={field}
                            comments={comments}
                            onMarkRead={handleMarkRead}
                          />
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
                {i < config.sections.length - 1 && <Separator />}
              </Card>
            )
          })}
        </div>
      </div>

      <UnsavedChangesDialog
        open={showUnsavedDialog}
        onCancel={handleCancel}
        onDiscard={handleDiscard}
        onSaveAndLeave={handleSaveAndLeave}
      />
    </FormProvider>
  )
}
