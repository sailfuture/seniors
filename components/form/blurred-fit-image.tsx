import { cn } from "@/lib/utils"

interface BlurredFitImageProps {
  src: string
  alt: string
  className?: string
}

export function BlurredFitImage({ src, alt, className }: BlurredFitImageProps) {
  return (
    <div className={cn("relative h-40 w-full overflow-hidden bg-muted", className)}>
      <img
        src={src}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full scale-110 object-cover blur-2xl"
      />
      <img
        src={src}
        alt={alt}
        className="relative h-full w-full object-contain"
      />
    </div>
  )
}
