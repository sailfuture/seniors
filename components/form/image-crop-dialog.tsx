"use client"

import { useEffect, useState } from "react"
import Cropper, { type Area } from "react-easy-crop"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

const RATIOS = [
  { label: "3:4", value: 3 / 4 },
  { label: "1:1", value: 1 },
  { label: "16:9", value: 16 / 9 },
  { label: "9:16", value: 9 / 16 },
] as const

// Cap the long edge of the cropped output so a full-res phone photo doesn't
// turn into a multi-megabyte upload.
const MAX_OUTPUT_DIM = 2560

async function cropToFile(src: string, area: Area, original: File): Promise<File> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image()
    el.onload = () => resolve(el)
    el.onerror = () => reject(new Error("Could not load image"))
    el.src = src
  })

  const scale = Math.min(1, MAX_OUTPUT_DIM / Math.max(area.width, area.height))
  const canvas = document.createElement("canvas")
  canvas.width = Math.round(area.width * scale)
  canvas.height = Math.round(area.height * scale)
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas unavailable")
  ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, canvas.width, canvas.height)

  // PNG/WebP sources keep PNG so transparency (e.g. logos) survives the crop.
  const keepAlpha = original.type === "image/png" || original.type === "image/webp"
  const type = keepAlpha ? "image/png" : "image/jpeg"
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.92))
  if (!blob) throw new Error("Crop failed")

  const base = original.name.replace(/\.[^.]+$/, "") || "image"
  return new File([blob], `${base}.${keepAlpha ? "png" : "jpg"}`, { type })
}

export function ImageCropDialog({
  file,
  onCropped,
  onCancel,
}: {
  file: File | null
  onCropped: (file: File) => void
  onCancel: () => void
}) {
  const [src, setSrc] = useState<string | null>(null)
  const [aspect, setAspect] = useState<number>(RATIOS[0].value)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedArea, setCroppedArea] = useState<Area | null>(null)
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    if (!file) {
      setSrc(null)
      return
    }
    setAspect(RATIOS[0].value)
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setCroppedArea(null)
    const url = URL.createObjectURL(file)
    setSrc(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const handleConfirm = async () => {
    if (!file || !src || !croppedArea) return
    setProcessing(true)
    try {
      onCropped(await cropToFile(src, croppedArea, file))
    } catch {
      onCancel()
    } finally {
      setProcessing(false)
    }
  }

  return (
    <Dialog
      open={!!file}
      onOpenChange={(open) => {
        if (!open && !processing) onCancel()
      }}
    >
      <DialogContent className="sm:max-w-lg" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Crop image</DialogTitle>
        </DialogHeader>

        <div className="relative h-72 w-full overflow-hidden rounded-lg bg-gray-950 sm:h-80">
          {src && (
            <Cropper
              image={src}
              crop={crop}
              zoom={zoom}
              aspect={aspect}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(_, areaPixels) => setCroppedArea(areaPixels)}
            />
          )}
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5" role="group" aria-label="Crop ratio">
            {RATIOS.map((r) => (
              <button
                key={r.label}
                type="button"
                onClick={() => setAspect(r.value)}
                className={`rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  aspect === r.value
                    ? "border-gray-900 bg-gray-900 text-white"
                    : "border-input hover:bg-accent text-muted-foreground"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="accent-gray-900 w-28 sm:w-36"
            aria-label="Zoom"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={processing}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={processing || !croppedArea}>
            {processing ? "Cropping..." : "Crop & Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
