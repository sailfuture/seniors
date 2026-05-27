"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Image01Icon,
  MagicWand01Icon,
  Download01Icon,
  ArrowRight02Icon,
  Loading03Icon,
} from "@hugeicons/core-free-icons"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"

import {
  CATEGORIES,
  GENERATION_TIPS,
  MAX_IMAGES_PER_STUDENT,
  type GeneratedImage,
  type ImageCategory,
} from "@/lib/image-generation-config"

const CATEGORY_ORDER: ImageCategory[] = ["logo", "product", "audience"]

interface CategoryFormState {
  prompt: string
  model: string
}

export default function ImageGenerationPage() {
  const { data: session, status } = useSession()
  const role = (session?.user as Record<string, unknown> | undefined)?.role as string | undefined

  if (status === "loading") {
    return (
      <div className="flex flex-1 flex-col gap-6 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (role === "admin") {
    return (
      <div className="flex flex-1 flex-col gap-6 p-6">
        <h1 className="text-2xl font-bold">Image Generation</h1>
        <p className="text-muted-foreground">
          This tool is available to students. Sign in as a student to generate images.
        </p>
      </div>
    )
  }

  return <StudentImageGeneration />
}

function StudentImageGeneration() {
  const [category, setCategory] = useState<ImageCategory>("logo")
  const [forms, setForms] = useState<Record<ImageCategory, CategoryFormState>>(() => ({
    logo: { prompt: "", model: CATEGORIES.logo.defaultModel },
    product: { prompt: "", model: CATEGORIES.product.defaultModel },
    audience: { prompt: "", model: CATEGORIES.audience.defaultModel },
  }))
  const [brainstorming, setBrainstorming] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [allImages, setAllImages] = useState<GeneratedImage[]>([])
  const [imagesLoading, setImagesLoading] = useState(true)

  const recent = useMemo(() => allImages.slice(0, 8), [allImages])
  const used = allImages.length
  const remaining = Math.max(0, MAX_IMAGES_PER_STUDENT - used)
  const atLimit = remaining === 0

  const loadImages = useCallback(async () => {
    setImagesLoading(true)
    try {
      const res = await fetch("/api/image-generation/library")
      if (!res.ok) {
        setAllImages([])
        return
      }
      const data = (await res.json()) as GeneratedImage[]
      setAllImages(Array.isArray(data) ? data : [])
    } catch {
      setAllImages([])
    } finally {
      setImagesLoading(false)
    }
  }, [])

  useEffect(() => {
    loadImages()
  }, [loadImages])

  const current = forms[category]

  const handleBrainstorm = async () => {
    if (!current.prompt.trim() || brainstorming || generating) return
    setError(null)
    setBrainstorming(true)
    const original = current.prompt
    try {
      const res = await fetch("/api/image-generation/brainstorm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea: original, category }),
      })
      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => "")
        setError(`Brainstorm failed (${res.status})${text ? `: ${text}` : ""}`)
        return
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let assembled = ""
      let cleared = false
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        if (!chunk) continue
        if (!cleared) {
          cleared = true
          assembled = chunk
        } else {
          assembled += chunk
        }
        setForms((prev) => ({ ...prev, [category]: { ...prev[category], prompt: assembled } }))
      }
      if (!cleared) {
        setError("Brainstorm returned no content")
      }
    } catch (err) {
      setForms((prev) => ({ ...prev, [category]: { ...prev[category], prompt: original } }))
      setError(err instanceof Error ? err.message : "Brainstorm failed")
    } finally {
      setBrainstorming(false)
    }
  }

  const handleGenerate = async () => {
    if (!current.prompt.trim() || generating || brainstorming || atLimit) return
    setError(null)
    setGenerating(true)
    const generationToast = toast.loading("Generating image — this can take 15–40 seconds.")
    try {
      const res = await fetch("/api/image-generation/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: current.prompt,
          category,
          model: current.model,
        }),
      })
      const data = await res.json()
      if (!res.ok && res.status !== 207) {
        const message = data?.error ?? `Generate failed (${res.status})`
        setError(message)
        toast.error(message, { id: generationToast })
        return
      }
      if (data?.warning) {
        setError(`Saved image, but library write failed: ${data.warning}`)
      }
      toast.success("Image ready — saved to your library.", { id: generationToast })
      await loadImages()
    } catch (err) {
      const message = err instanceof Error ? err.message : "Generate failed"
      setError(message)
      toast.error(message, { id: generationToast })
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <div className="bg-primary/10 flex size-10 items-center justify-center rounded-lg">
          <HugeiconsIcon icon={Image01Icon} strokeWidth={2} className="text-primary size-5" />
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-2xl font-bold">Image Generation</h1>
          <span className="text-muted-foreground text-sm">
            {used} of {MAX_IMAGES_PER_STUDENT} images used
          </span>
        </div>
        <p className="text-muted-foreground">
          Generate logos, product visuals, and audience images for your business. All images are saved to your library.
        </p>
      </div>

      <Tabs value={category} onValueChange={(v) => setCategory(v as ImageCategory)}>
        <TabsList className="grid w-full max-w-2xl grid-cols-3">
          {CATEGORY_ORDER.map((id) => (
            <TabsTrigger key={id} value={id}>
              {CATEGORIES[id].label}
            </TabsTrigger>
          ))}
        </TabsList>

        {CATEGORY_ORDER.map((id) => (
          <TabsContent key={id} value={id} className="mt-4">
            <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
              <Card>
                <CardHeader>
                  <CardTitle>{CATEGORIES[id].label}</CardTitle>
                  <CardDescription>{CATEGORIES[id].description}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor={`prompt-${id}`}>Prompt</Label>
                    <Textarea
                      id={`prompt-${id}`}
                      value={forms[id].prompt}
                      onChange={(e) => {
                        const value = e.target.value
                        setForms((prev) => ({ ...prev, [id]: { ...prev[id], prompt: value } }))
                      }}
                      placeholder={CATEGORIES[id].promptPlaceholder}
                      className="min-h-32"
                      disabled={brainstorming || generating}
                    />
                  </div>
                  {CATEGORIES[id].alternativeModels.length > 1 && (
                    <div className="flex flex-col gap-2 sm:max-w-md">
                      <Label htmlFor={`model-${id}`}>Model</Label>
                      <Select
                        value={forms[id].model}
                        onValueChange={(value) =>
                          setForms((prev) => ({ ...prev, [id]: { ...prev[id], model: value } }))
                        }
                        disabled={generating || brainstorming}
                      >
                        <SelectTrigger id={`model-${id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORIES[id].alternativeModels.map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {atLimit && (
                    <p className="text-destructive text-sm">
                      You&apos;ve reached the {MAX_IMAGES_PER_STUDENT}-image class limit. Ask your teacher if you need more.
                    </p>
                  )}
                  {error && id === category && (
                    <p className="text-destructive text-sm">{error}</p>
                  )}
                </CardContent>
                <CardFooter className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={handleBrainstorm}
                    disabled={!current.prompt.trim() || brainstorming || generating || id !== category}
                  >
                    {brainstorming && id === category ? (
                      <HugeiconsIcon icon={Loading03Icon} strokeWidth={2} className="size-4 animate-spin" />
                    ) : (
                      <HugeiconsIcon icon={MagicWand01Icon} strokeWidth={2} className="size-4" />
                    )}
                    {brainstorming && id === category ? "Polishing your prompt…" : "Help me write a prompt"}
                  </Button>
                  <Button
                    onClick={handleGenerate}
                    disabled={
                      !current.prompt.trim() || generating || brainstorming || id !== category || atLimit
                    }
                  >
                    {generating && id === category ? (
                      <HugeiconsIcon icon={Loading03Icon} strokeWidth={2} className="size-4 animate-spin" />
                    ) : (
                      <HugeiconsIcon icon={Image01Icon} strokeWidth={2} className="size-4" />
                    )}
                    {generating && id === category ? "Generating…" : "Generate image"}
                  </Button>
                </CardFooter>
              </Card>

              {generating && id === category && <GenerationPreview />}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent generations</h2>
          <Link
            href="/image-generation/library"
            className="text-primary inline-flex items-center gap-1 text-sm hover:underline"
          >
            View library
            <HugeiconsIcon icon={ArrowRight02Icon} strokeWidth={2} className="size-4" />
          </Link>
        </div>
        {imagesLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square w-full rounded-md" />
            ))}
          </div>
        ) : recent.length === 0 ? (
          <p className="text-muted-foreground text-sm">No images yet — generate one above.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {recent.map((img) => (
              <RecentTile key={String(img.id)} image={img} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function GenerationPreview() {
  const [tipIndex, setTipIndex] = useState(0)
  const startRef = useRef(Date.now())
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const tipTimer = setInterval(() => {
      setTipIndex((i) => (i + 1) % GENERATION_TIPS.length)
    }, 3500)
    const elapsedTimer = setInterval(() => {
      setElapsed(Math.round((Date.now() - startRef.current) / 1000))
    }, 1000)
    return () => {
      clearInterval(tipTimer)
      clearInterval(elapsedTimer)
    }
  }, [])

  return (
    <Card className="lg:w-72">
      <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
        <div className="bg-muted relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-md">
          <div className="bg-muted-foreground/10 absolute inset-0 animate-pulse" />
          <HugeiconsIcon
            icon={Loading03Icon}
            strokeWidth={2}
            className="text-muted-foreground relative size-10 animate-spin"
          />
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">{GENERATION_TIPS[tipIndex]}</p>
          <p className="text-muted-foreground text-xs">{elapsed}s elapsed</p>
        </div>
        <p className="text-muted-foreground text-xs">
          Feel free to keep working — we&apos;ll save the image to your library when it&apos;s ready.
        </p>
      </CardContent>
    </Card>
  )
}

function RecentTile({ image }: { image: GeneratedImage }) {
  return (
    <div className="group bg-muted relative aspect-square overflow-hidden rounded-md border">
      <Image
        src={image.image.url}
        alt={image.prompt}
        fill
        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
        className="object-cover"
        unoptimized
      />
      <a
        href={image.image.url}
        download
        target="_blank"
        rel="noopener noreferrer"
        className="absolute inset-0 flex items-end bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100"
      >
        <span className="bg-background/90 text-foreground inline-flex items-center gap-1 rounded px-2 py-1 text-xs">
          <HugeiconsIcon icon={Download01Icon} strokeWidth={2} className="size-3" />
          Download
        </span>
      </a>
    </div>
  )
}
