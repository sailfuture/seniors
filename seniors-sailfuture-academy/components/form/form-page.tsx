"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useForm, FormProvider } from "react-hook-form"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useAutoSave } from "@/hooks/use-auto-save"
import type { FormPageConfig, Comment } from "@/lib/form-types"
import { getSectionStatus } from "@/lib/form-types"
import { useSaveRegister } from "@/lib/save-context"
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
}

export function FormPage({ title, config, commentsEndpoint }: FormPageProps) {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()
  const { register: registerSave, unregister: unregisterSave } = useSaveRegister()
  const [comments, setComments] = useState<Comment[]>([])
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)
  const pendingAction = useRef<PendingAction>(null)

  const form = useForm<Record<string, unknown>>({
    defaultValues: config.defaultValues,
  })

  const { saveStatus, saveNow, lastSavedAt, isLoading } = useAutoSave({
    form,
    xanoEndpoint: config.xanoEndpoint,
    xanoLoadEndpoint: config.xanoLoadEndpoint,
  })

  const values = form.watch()

  const hasDirtyForm = form.formState.isDirty || saveStatus === "saving"

  // Register save state into the layout-level context so the header can access it
  useEffect(() => {
    registerSave({ saveStatus, saveNow, lastSavedAt })
  }, [saveStatus, saveNow, lastSavedAt, registerSave])

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
        const res = await fetch(
          `${commentsEndpoint}?students_id=${studentId}`
        )
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data)) setComments(data)
        }
      } catch {
        // Silently fail
      }
    }

    loadComments()
  }, [commentsEndpoint, session])

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
                <div className="grid gap-4 md:grid-cols-2">
                  {section.fields.map((fieldName) => {
                    const field = config.fields.find((f) => f.name === fieldName)
                    const isFullWidth =
                      field?.type === "textarea" || field?.type === "image"
                    return (
                      <div
                        key={fieldName}
                        className={isFullWidth ? "md:col-span-2" : ""}
                      >
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
                  <div className="grid gap-4 md:grid-cols-2">
                    {sectionFields.map((field) => {
                      const isFullWidth =
                        field.type === "textarea" || field.type === "image"

                      return (
                        <div
                          key={field.name}
                          className={isFullWidth ? "md:col-span-2" : ""}
                        >
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
