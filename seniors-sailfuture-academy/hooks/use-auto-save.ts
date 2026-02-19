"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import type { UseFormReturn } from "react-hook-form"
import type { SaveStatus } from "@/lib/form-types"

const AUTO_SAVE_MS = 3 * 60 * 1000

interface UseAutoSaveOptions {
  form: UseFormReturn<Record<string, unknown>>
  xanoEndpoint: string
  xanoLoadEndpoint?: string
  enabled?: boolean
}

export function useAutoSave({ form, xanoEndpoint, xanoLoadEndpoint, enabled = true }: UseAutoSaveOptions) {
  const { data: session } = useSession()
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle")
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const hasLoadedRef = useRef(false)

  const save = useCallback(
    async (data: Record<string, unknown>, manual = false) => {
      if (!enabled) return

      setSaveStatus("saving")

      const hasUploadedImage = (v: unknown): boolean =>
        v != null &&
        typeof v === "object" &&
        !(v instanceof File) &&
        "path" in v &&
        Boolean((v as Record<string, unknown>).path)

      const cleaned: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(data)) {
        if (value instanceof File) {
          continue
        } else {
          cleaned[key] = value
        }
      }

      // Ensure image fields are always present with correct format
      for (const key of Object.keys(data)) {
        if (key.includes("image")) {
          cleaned[key] = hasUploadedImage(data[key]) ? data[key] : ""
        }
      }

      const payload = {
        ...cleaned,
        user_email: session?.user?.email ?? "",
        students_id: (session?.user as Record<string, unknown>)?.students_id ?? null,
      }

      try {
        const res = await fetch(xanoEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })

        if (!res.ok) {
          const body = await res.json().catch(() => null)
          const xanoMsg = body?.message ?? ""
          const isXanoInternalError =
            xanoMsg.includes("Missing var entry") ||
            (res.status === 500 && body?.code === "ERROR_FATAL")
          if (!isXanoInternalError) {
            throw new Error(xanoMsg || "Save failed")
          }
        }

        form.reset(form.getValues())

        const now = new Date()
        setSaveStatus("saved")
        setLastSavedAt(now)

        if (manual) {
          toast("Changes saved", { duration: 2000 })
        }
      } catch {
        setSaveStatus("error")
        if (manual) {
          toast("Save failed", {
            description: "Your changes couldn\u2019t be saved. Please try again.",
            duration: 4000,
          })
        }
      }
    },
    [xanoEndpoint, session, enabled, form]
  )

  const saveNow = useCallback(() => {
    save(form.getValues(), true)
  }, [save, form])

  // Auto-save on a 3-minute interval when there are dirty changes
  useEffect(() => {
    if (!enabled) return

    const interval = setInterval(() => {
      if (!hasLoadedRef.current) return
      if (form.formState.isDirty) {
        save(form.getValues())
      }
    }, AUTO_SAVE_MS)

    return () => clearInterval(interval)
  }, [form, save, enabled])

  // Load existing data on mount
  useEffect(() => {
    if (!enabled || !session?.user) return

    const studentId = (session.user as Record<string, unknown>)?.students_id
    if (!studentId) {
      hasLoadedRef.current = true
      setIsLoading(false)
      return
    }

    const loadData = async () => {
      try {
        const loadUrl = xanoLoadEndpoint ?? xanoEndpoint
        const url = new URL(loadUrl)
        url.searchParams.set("students_id", String(studentId))

        const res = await fetch(url.toString())
        if (res.ok) {
          const data = await res.json()
          let record: Record<string, unknown> | null = null
          if (Array.isArray(data)) {
            record = data.find(
              (r: Record<string, unknown>) => r.students_id === studentId
            ) ?? null
          } else {
            record = data
          }
          if (record && typeof record === "object") {
            const currentDefaults = form.getValues()
            const merged = { ...currentDefaults }
            for (const key of Object.keys(currentDefaults)) {
              if (record[key] !== undefined && record[key] !== null) {
                merged[key] = record[key]
              }
            }
            form.reset(merged)
          }
        }
      } catch {
        // Silently fail on load
      } finally {
        hasLoadedRef.current = true
        setIsLoading(false)
      }
    }

    loadData()
  }, [xanoEndpoint, xanoLoadEndpoint, session, form, enabled])

  return { saveStatus, saveNow, lastSavedAt, isLoading }
}
