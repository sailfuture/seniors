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
import { Checkbox } from "@/components/ui/checkbox"

import {
  CATEGORIES,
  GENERATION_TIPS,
  MARKETING_PLACEMENTS,
  MAX_IMAGES_PER_STUDENT,
  type GeneratedImage,
  type ImageCategory,
  type MarketingPlacement,
} from "@/lib/image-generation-config"

const CATEGORY_ORDER: ImageCategory[] = ["logo", "product", "marketing", "audience"]

interface BrandPanelData {
  colors: { name: string; hex: string }[]
  fonts: string[]
  moods: string[]
  otherNotes: string[]
  logoUrls: string[]
}

const PLACEMENT_ORDER: MarketingPlacement[] = [
  "billboard",
  "flyer",
  "digital_ad",
  "ooh",
  "in_home",
]

interface CategoryFormState {
  prompt: string
  model: string
  placement: MarketingPlacement
  useBrand: boolean
  useLogo: boolean
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
    logo: { prompt: "", model: CATEGORIES.logo.defaultModel, placement: "billboard", useBrand: true, useLogo: false },
    product: { prompt: "", model: CATEGORIES.product.defaultModel, placement: "billboard", useBrand: true, useLogo: false },
    marketing: { prompt: "", model: CATEGORIES.marketing.defaultModel, placement: "billboard", useBrand: true, useLogo: true },
    audience: { prompt: "", model: CATEGORIES.audience.defaultModel, placement: "billboard", useBrand: true, useLogo: false },
  }))
  const [brandAvailable, setBrandAvailable] = useState<boolean | null>(null)
  const [logoAvailable, setLogoAvailable] = useState<boolean>(false)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [brandDetails, setBrandDetails] = useState<BrandPanelData | null>(null)
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

  useEffect(() => {
    let cancelled = false
    fetch("/api/student/brand")
      .then((r) => (r.ok ? r.json() : { hasContent: false }))
      .then(
        (data: {
          hasContent?: boolean
          hasLogo?: boolean
          logoUrl?: string | null
          logoUrls?: string[]
          colors?: { name: string; hex: string }[]
          fonts?: string[]
          moods?: string[]
          otherNotes?: string[]
        }) => {
          if (cancelled) return
          setBrandAvailable(!!data.hasContent)
          setLogoAvailable(!!data.hasLogo)
          setLogoUrl(data.logoUrl ?? null)
          if (data.hasContent) {
            setBrandDetails({
              colors: data.colors ?? [],
              fonts: data.fonts ?? [],
              moods: data.moods ?? [],
              otherNotes: data.otherNotes ?? [],
              logoUrls: data.logoUrls ?? [],
            })
          } else {
            setBrandDetails(null)
          }
        },
      )
      .catch(() => {
        if (!cancelled) {
          setBrandAvailable(false)
          setLogoAvailable(false)
          setLogoUrl(null)
          setBrandDetails(null)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

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
        body: JSON.stringify({
          idea: original,
          category,
          placement: category === "marketing" ? current.placement : undefined,
          useBrand: !!brandAvailable && current.useBrand,
        }),
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
          placement: category === "marketing" ? current.placement : undefined,
          useBrand: !!brandAvailable && current.useBrand,
          useLogo: category === "marketing" && logoAvailable && current.useLogo,
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

      {brandDetails && <BrandPanel brand={brandDetails} />}

      <Tabs value={category} onValueChange={(v) => setCategory(v as ImageCategory)}>
        <TabsList className="grid w-full max-w-3xl grid-cols-4">
          {CATEGORY_ORDER.map((id) => (
            <TabsTrigger key={id} value={id}>
              {CATEGORIES[id].label}
            </TabsTrigger>
          ))}
        </TabsList>

        {CATEGORY_ORDER.map((id) => (
          <TabsContent key={id} value={id} className="mt-4">
            <div className="relative">
              <Card>
                <CardHeader>
                  <CardTitle>{CATEGORIES[id].label}</CardTitle>
                  <CardDescription>{CATEGORIES[id].description}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  {CATEGORIES[id].hasPlacements && (
                    <div className="flex flex-col gap-2 sm:max-w-md">
                      <Label htmlFor={`placement-${id}`}>Placement</Label>
                      <Select
                        value={forms[id].placement}
                        onValueChange={(value) =>
                          setForms((prev) => ({
                            ...prev,
                            [id]: { ...prev[id], placement: value as MarketingPlacement },
                          }))
                        }
                        disabled={generating || brainstorming}
                      >
                        <SelectTrigger id={`placement-${id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PLACEMENT_ORDER.map((p) => (
                            <SelectItem key={p} value={p}>
                              {MARKETING_PLACEMENTS[p].label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-muted-foreground text-xs">
                        {MARKETING_PLACEMENTS[forms[id].placement].description}
                      </p>
                    </div>
                  )}
                  <div className="flex flex-col gap-2">
                    <Label htmlFor={`prompt-${id}`}>
                      {CATEGORIES[id].hasPlacements ? "What's on the ad?" : "Prompt"}
                    </Label>
                    <Textarea
                      id={`prompt-${id}`}
                      value={forms[id].prompt}
                      onChange={(e) => {
                        const value = e.target.value
                        setForms((prev) => ({ ...prev, [id]: { ...prev[id], prompt: value } }))
                      }}
                      placeholder={
                        CATEGORIES[id].hasPlacements
                          ? MARKETING_PLACEMENTS[forms[id].placement].examplePrompt
                          : CATEGORIES[id].promptPlaceholder
                      }
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
                  {brandAvailable && (
                    <label className="flex items-start gap-2 text-sm">
                      <Checkbox
                        id={`use-brand-${id}`}
                        checked={forms[id].useBrand}
                        onCheckedChange={(checked) =>
                          setForms((prev) => ({
                            ...prev,
                            [id]: { ...prev[id], useBrand: !!checked },
                          }))
                        }
                        disabled={generating || brainstorming}
                      />
                      <span className="flex flex-col">
                        <span>Use my brand identity</span>
                        <span className="text-muted-foreground text-xs">
                          Pulls in your colors, fonts, and brand voice from your business thesis.
                        </span>
                      </span>
                    </label>
                  )}
                  {id === "marketing" && logoAvailable && (
                    <label className="flex items-start gap-2 text-sm">
                      <Checkbox
                        id={`use-logo-${id}`}
                        checked={forms[id].useLogo}
                        onCheckedChange={(checked) =>
                          setForms((prev) => ({
                            ...prev,
                            [id]: { ...prev[id], useLogo: !!checked },
                          }))
                        }
                        disabled={generating || brainstorming}
                      />
                      <span className="flex flex-col">
                        <span>Include my actual logo in the image</span>
                        <span className="text-muted-foreground text-xs">
                          Uses the logo you uploaded to your business thesis as a reference, so the real mark appears on the ad. May take longer than a normal generation.
                        </span>
                        {logoUrl && (
                          <span className="mt-2 inline-flex">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={logoUrl}
                              alt="Your brand logo"
                              className="bg-muted size-16 rounded-md border object-contain"
                            />
                          </span>
                        )}
                      </span>
                    </label>
                  )}
                  {brandAvailable === false && (
                    <p className="text-muted-foreground text-xs">
                      Tip: fill in the branding section of your business thesis to automatically include your brand colors, fonts, and voice in every generation.
                    </p>
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

              {generating && id === category && <GenerationOverlay />}
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

function GenerationOverlay() {
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
    <div
      role="status"
      aria-live="polite"
      className="bg-background/85 absolute inset-0 z-10 flex items-center justify-center rounded-xl backdrop-blur-sm"
    >
      <div className="flex max-w-sm flex-col items-center gap-4 p-6 text-center">
        <div className="bg-muted relative flex size-24 items-center justify-center overflow-hidden rounded-md">
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
      </div>
    </div>
  )
}

function BrandPanel({ brand }: { brand: BrandPanelData }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Your brand identity</CardTitle>
        <CardDescription>
          Pulled from your business thesis. Generations will use these by default.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {brand.logoUrls.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              Logo
            </span>
            <div className="flex flex-wrap gap-2">
              {brand.logoUrls.map((url) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={url}
                  src={url}
                  alt="Brand logo"
                  className="bg-muted size-20 rounded-md border object-contain p-1"
                />
              ))}
            </div>
          </div>
        )}

        {brand.colors.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              Colors
            </span>
            <div className="flex flex-wrap gap-3">
              {brand.colors.map((c, i) => (
                <div key={`${c.hex}-${i}`} className="flex items-center gap-2">
                  <span
                    className="size-8 rounded-md border"
                    style={{ backgroundColor: c.hex }}
                    aria-label={`${c.name} swatch`}
                  />
                  <div className="flex flex-col">
                    <span className="text-sm">{c.name}</span>
                    <span className="text-muted-foreground font-mono text-xs">{c.hex}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {brand.fonts.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              Typography
            </span>
            <div className="flex flex-wrap gap-2">
              {brand.fonts.map((f) => (
                <span
                  key={f}
                  className="bg-muted text-sm rounded-md border px-3 py-1"
                  style={{ fontFamily: f }}
                >
                  {f}
                </span>
              ))}
            </div>
          </div>
        )}

        {brand.moods.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              Brand mood & voice
            </span>
            {brand.moods.map((m, i) => (
              <p key={i} className="text-muted-foreground text-sm">
                {m}
              </p>
            ))}
          </div>
        )}

        {brand.otherNotes.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              Other notes
            </span>
            {brand.otherNotes.map((n, i) => (
              <p key={i} className="text-muted-foreground text-sm">
                {n}
              </p>
            ))}
          </div>
        )}

        <p className="text-muted-foreground text-xs">
          Edit these in your{" "}
          <Link href="/business-thesis" className="text-primary hover:underline">
            business thesis
          </Link>
          .
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
