export type ImageCategory = "logo" | "product" | "marketing" | "audience"

export type MarketingPlacement =
  | "billboard"
  | "flyer"
  | "digital_ad"
  | "ooh"
  | "in_home"

export interface PlacementConfig {
  id: MarketingPlacement
  label: string
  description: string
  /** Snippet describing the placement, woven into the brainstorm system prompt. */
  contextHint: string
  /** Used in the prompt placeholder so students know what to type. */
  examplePrompt: string
}

export const MARKETING_PLACEMENTS: Record<MarketingPlacement, PlacementConfig> = {
  billboard: {
    id: "billboard",
    label: "Billboard",
    description: "Highway or city billboard, photographed in context.",
    contextHint:
      "a large highway or city billboard photographed in context (sky, road, surrounding buildings, realistic lighting)",
    examplePrompt: "Driftwood Coffee — bold wordmark, warm cream, photographed at golden hour",
  },
  flyer: {
    id: "flyer",
    label: "8.5×11 Flyer",
    description: "Printed flyer photographed in a real-world setting.",
    contextHint:
      "an 8.5x11 printed flyer photographed in a realistic setting (pinned to a community corkboard, held in hand, taped to a window, etc.)",
    examplePrompt: "Friday night open-mic poster for Driftwood Coffee, with date, time, and address",
  },
  digital_ad: {
    id: "digital_ad",
    label: "Digital Ad",
    description: "Ad displayed on a phone, laptop, or tablet screen.",
    contextHint:
      "a digital ad shown on a modern phone, laptop, or tablet screen, photographed in a realistic environment (cafe table, desk, on a couch)",
    examplePrompt: "Instagram ad for a new launch — wave-icon water bottle, minimalist design",
  },
  ooh: {
    id: "ooh",
    label: "Other Out-of-Home",
    description: "Transit shelter, subway, mall kiosk, wild-postings, etc.",
    contextHint:
      "an out-of-home ad placement other than a billboard or flyer (bus stop shelter, subway car wall, mall kiosk, wild-posting wall, airport gate)",
    examplePrompt: "Bus stop shelter ad for a campus food delivery service, evening urban scene",
  },
  in_home: {
    id: "in_home",
    label: "In-Home",
    description: "Branded merch in a styled home setting (mug, tee, framed print).",
    contextHint:
      "branded merchandise styled in a home environment (a branded mug on a kitchen counter, a t-shirt on a model in a living room, a framed poster on a wall, a tote bag on a chair)",
    examplePrompt: "Branded ceramic mug for Driftwood Coffee on a sunlit kitchen counter",
  },
}

export interface CategoryConfig {
  id: ImageCategory
  label: string
  description: string
  defaultModel: string
  alternativeModels: { id: string; label: string }[]
  promptPlaceholder: string
  brainstormSystemPrompt: string
  /** Optional sub-selector (used by the marketing tab to choose placement). */
  hasPlacements?: boolean
}

export const CATEGORIES: Record<ImageCategory, CategoryConfig> = {
  logo: {
    id: "logo",
    label: "Logo",
    description: "Brand marks, wordmarks, and logo concepts with clean type.",
    defaultModel: "openai/gpt-image-2",
    alternativeModels: [
      { id: "openai/gpt-image-2", label: "GPT Image 2 (text accuracy)" },
    ],
    promptPlaceholder:
      "e.g. A modern wordmark logo for a coffee shop called 'Driftwood', warm cream background, hand-drawn serif type",
    brainstormSystemPrompt:
      "You are a brand designer helping a high-school student write an image-generation prompt for a LOGO. Take the student's rough idea and expand it into a single polished prompt of 2-4 sentences. Include: the brand name (in quotes), the type of mark (wordmark, monogram, icon+text, etc.), typographic feel, color palette in plain language, background, and overall mood. Be specific but concise. Output only the prompt — no preamble, no labels.",
  },
  product: {
    id: "product",
    label: "Product / Business Visual",
    description: "High-quality photographic visuals of products, packaging, or scenes.",
    defaultModel: "openai/gpt-image-2",
    alternativeModels: [
      { id: "openai/gpt-image-2", label: "GPT Image 2 (photoreal)" },
    ],
    promptPlaceholder:
      "e.g. A matte black water bottle photographed on a wet rock at sunrise, shallow depth of field, soft golden light",
    brainstormSystemPrompt:
      "You are a product photographer helping a high-school student write an image-generation prompt for a PRODUCT or business visual. Take the student's rough idea and expand it into a single polished prompt of 2-4 sentences. Include: the subject and any branding, environment/setting, camera framing and angle, lighting, materials and textures, and mood. Aim for photoreal unless the student asked otherwise. Output only the prompt — no preamble, no labels.",
  },
  marketing: {
    id: "marketing",
    label: "Marketing",
    description: "Mock-ups of your brand or product in a real-world ad placement.",
    defaultModel: "openai/gpt-image-2",
    alternativeModels: [
      { id: "openai/gpt-image-2", label: "GPT Image 2 (best for ads)" },
    ],
    promptPlaceholder: "What brand, product, or message should be featured?",
    brainstormSystemPrompt:
      "You are an art director helping a high-school student write an image-generation prompt for a MARKETING MOCK-UP. The image must show the student's brand, product, or message displayed inside a specific real-world ad placement (described in the user message). Expand the student's idea into a single polished prompt of 2-4 sentences. Always include: (1) the placement context — camera angle, environment, lighting, surroundings; (2) the brand/product/message shown on the ad creative itself, with any text in quotes; (3) typographic and color feel of the ad design; (4) overall mood. Make it photo-realistic. Output only the prompt — no preamble, no labels.",
    hasPlacements: true,
  },
  audience: {
    id: "audience",
    label: "Other",
    description: "Target audience personas, brand reference images, lifestyle scenes, mood boards, and anything else.",
    defaultModel: "openai/gpt-image-2",
    alternativeModels: [
      { id: "openai/gpt-image-2", label: "GPT Image 2" },
    ],
    promptPlaceholder:
      "e.g. A college student studying in a sunlit campus cafe, laptop open, friends laughing in the background",
    brainstormSystemPrompt:
      "You are a creative director helping a high-school student write an image-generation prompt for a TARGET-AUDIENCE or lifestyle image. Take the student's rough idea and expand it into a single polished prompt of 2-4 sentences. Include: who is in the scene (age, vibe, clothing), what they are doing, where it takes place, lighting and mood, and overall style. Output only the prompt — no preamble, no labels.",
  },
}

export const BRAINSTORM_MODEL = "openai/gpt-5-nano"

export const MAX_IMAGES_PER_STUDENT = 50

export const GENERATION_TIPS = [
  "Sketching the concept…",
  "Choosing a color palette…",
  "Composing the scene…",
  "Refining the details…",
  "Polishing the final image…",
  "Saving to your library…",
]

export interface XanoFileMetadata {
  access?: string
  path?: string
  name?: string
  type?: string
  size?: number
  mime?: string
  meta?: Record<string, unknown>
  url: string
}

export interface GeneratedImage {
  id: number | string
  students_id: string
  category: ImageCategory
  model: string
  prompt: string
  image: XanoFileMetadata
  created_at: number
}
