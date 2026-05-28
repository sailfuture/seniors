"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Image01Icon,
  Download01Icon,
  ArrowLeft02Icon,
  Delete02Icon,
} from "@hugeicons/core-free-icons"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

import {
  CATEGORIES,
  type GeneratedImage,
  type ImageCategory,
} from "@/lib/image-generation-config"

type Filter = ImageCategory | "all"

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "logo", label: "Logos" },
  { id: "product", label: "Products" },
  { id: "marketing", label: "Marketing" },
  { id: "audience", label: "Other" },
]

export default function LibraryPage() {
  const { data: session, status } = useSession()
  const role = (session?.user as Record<string, unknown> | undefined)?.role as string | undefined

  const [filter, setFilter] = useState<Filter>("all")
  const [images, setImages] = useState<GeneratedImage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status !== "authenticated" || role === "admin") return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const res = await fetch("/api/image-generation/library")
        if (!res.ok) {
          setError(`Failed to load (${res.status})`)
          setImages([])
        } else {
          const data = (await res.json()) as GeneratedImage[]
          if (!cancelled) setImages(Array.isArray(data) ? data : [])
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [status, role])

  const handleDelete = useCallback(async (image: GeneratedImage) => {
    const optimisticId = String(image.id)
    setImages((prev) => prev.filter((i) => String(i.id) !== optimisticId))
    const t = toast.loading("Deleting image…")
    try {
      const res = await fetch(`/api/image-generation/library/${optimisticId}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error ?? `Delete failed (${res.status})`)
      }
      toast.success("Image deleted.", { id: t })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Delete failed"
      // Restore on failure.
      setImages((prev) => {
        if (prev.some((i) => String(i.id) === optimisticId)) return prev
        return [image, ...prev]
      })
      toast.error(message, { id: t })
    }
  }, [])

  const filtered = useMemo(
    () => (filter === "all" ? images : images.filter((i) => i.category === filter)),
    [images, filter],
  )

  if (status === "loading") {
    return (
      <div className="flex flex-1 flex-col gap-6 p-6">
        <Skeleton className="h-8 w-48" />
      </div>
    )
  }

  if (role === "admin") {
    return (
      <div className="flex flex-1 flex-col gap-6 p-6">
        <h1 className="text-2xl font-bold">Image Library</h1>
        <p className="text-muted-foreground">Available to students only.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">Image Library</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          All the images you&apos;ve generated, ready to download.
        </p>
        <div className="mt-3 flex items-center justify-between">
          <Button variant="outline" size="sm" className="gap-2" asChild>
            <Link href="/image-generation">
              <HugeiconsIcon icon={ArrowLeft02Icon} strokeWidth={2} className="size-4" />
              Back to generator
            </Link>
          </Button>
          <Button variant="outline" size="sm" className="gap-2" asChild>
            <Link href="/dashboard">
              <HugeiconsIcon icon={Image01Icon} strokeWidth={2} className="size-4" />
              Dashboard
            </Link>
          </Button>
        </div>
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
        <TabsList className="grid w-full max-w-2xl grid-cols-5">
          {FILTERS.map((f) => (
            <TabsTrigger key={f.id} value={f.id}>
              {f.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {error && <p className="text-destructive text-sm">{error}</p>}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square w-full rounded-md" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {images.length === 0
            ? "You haven't generated any images yet."
            : "No images in this category."}
        </p>
      ) : (
        <div className="grid auto-rows-fr grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((img) => (
            <LibraryCard key={String(img.id)} image={img} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  )
}

function LibraryCard({
  image,
  onDelete,
}: {
  image: GeneratedImage
  onDelete: (img: GeneratedImage) => void
}) {
  return (
    <Card className="flex h-full flex-col overflow-hidden pt-0">
      <div className="bg-muted relative aspect-square">
        <Image
          src={image.image.url}
          alt={image.prompt}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          className="object-cover"
          unoptimized
        />
      </div>
      <CardContent className="flex flex-1 flex-col gap-2 pt-4">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{CATEGORIES[image.category]?.label ?? image.category}</Badge>
          <span className="text-muted-foreground truncate text-xs">{image.model}</span>
        </div>
        <p className="line-clamp-3 text-sm">{image.prompt}</p>
      </CardContent>
      <CardFooter className="flex gap-2">
        <Button asChild variant="outline" size="sm" className="flex-1">
          <a href={image.image.url} download target="_blank" rel="noopener noreferrer">
            <HugeiconsIcon icon={Download01Icon} strokeWidth={2} className="size-4" />
            Download
          </a>
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              aria-label="Delete image"
            >
              <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} className="size-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this image?</AlertDialogTitle>
              <AlertDialogDescription>
                The image will be removed from your library. This counts against your generation quota and cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => onDelete(image)}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardFooter>
    </Card>
  )
}
