"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { useSession } from "next-auth/react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Image01Icon, Download01Icon, ArrowLeft02Icon } from "@hugeicons/core-free-icons"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"

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
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <Link
          href="/image-generation"
          className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1 text-sm"
        >
          <HugeiconsIcon icon={ArrowLeft02Icon} strokeWidth={2} className="size-4" />
          Back to generator
        </Link>
        <div className="bg-primary/10 flex size-10 items-center justify-center rounded-lg">
          <HugeiconsIcon icon={Image01Icon} strokeWidth={2} className="text-primary size-5" />
        </div>
        <h1 className="text-2xl font-bold">Image Library</h1>
        <p className="text-muted-foreground">All the images you&apos;ve generated, ready to download.</p>
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((img) => (
            <LibraryCard key={String(img.id)} image={img} />
          ))}
        </div>
      )}
    </div>
  )
}

function LibraryCard({ image }: { image: GeneratedImage }) {
  return (
    <Card className="overflow-hidden pt-0">
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
      <CardContent className="flex flex-col gap-2 pt-4">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{CATEGORIES[image.category]?.label ?? image.category}</Badge>
          <span className="text-muted-foreground truncate text-xs">{image.model}</span>
        </div>
        <p className="line-clamp-3 text-sm">{image.prompt}</p>
      </CardContent>
      <CardFooter>
        <Button asChild variant="outline" size="sm" className="w-full">
          <a href={image.image.url} download target="_blank" rel="noopener noreferrer">
            <HugeiconsIcon icon={Download01Icon} strokeWidth={2} className="size-4" />
            Download
          </a>
        </Button>
      </CardFooter>
    </Card>
  )
}
