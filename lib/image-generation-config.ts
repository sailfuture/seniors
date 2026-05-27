export type ImageCategory = "logo" | "product" | "audience"

export interface CategoryConfig {
  id: ImageCategory
  label: string
  description: string
  defaultModel: string
  alternativeModels: { id: string; label: string }[]
  promptPlaceholder: string
  brainstormSystemPrompt: string
}

export const CATEGORIES: Record<ImageCategory, CategoryConfig> = {
  logo: {
    id: "logo",
    label: "Logo",
    description: "Brand marks, wordmarks, and logo concepts with clean type.",
    defaultModel: "openai/gpt-image-2",
    alternativeModels: [
      { id: "openai/gpt-image-2", label: "GPT Image 2 (text accuracy)" },
      { id: "google/gemini-2.5-flash-image", label: "Gemini 2.5 Flash Image" },
      { id: "google/gemini-3.1-flash-image-preview", label: "Gemini 3.1 Flash Image (preview)" },
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
    defaultModel: "google/gemini-2.5-flash-image",
    alternativeModels: [
      { id: "google/gemini-2.5-flash-image", label: "Gemini 2.5 Flash Image (photoreal)" },
      { id: "google/gemini-3.1-flash-image-preview", label: "Gemini 3.1 Flash Image (preview)" },
      { id: "openai/gpt-image-2", label: "GPT Image 2" },
    ],
    promptPlaceholder:
      "e.g. A matte black water bottle photographed on a wet rock at sunrise, shallow depth of field, soft golden light",
    brainstormSystemPrompt:
      "You are a product photographer helping a high-school student write an image-generation prompt for a PRODUCT or business visual. Take the student's rough idea and expand it into a single polished prompt of 2-4 sentences. Include: the subject and any branding, environment/setting, camera framing and angle, lighting, materials and textures, and mood. Aim for photoreal unless the student asked otherwise. Output only the prompt — no preamble, no labels.",
  },
  audience: {
    id: "audience",
    label: "Other",
    description: "Target audience personas, brand reference images, lifestyle scenes, mood boards, and anything else.",
    defaultModel: "google/gemini-3.1-flash-image-preview",
    alternativeModels: [
      { id: "google/gemini-3.1-flash-image-preview", label: "Gemini 3.1 Flash Image (default)" },
      { id: "google/gemini-2.5-flash-image", label: "Gemini 2.5 Flash Image" },
      { id: "openai/gpt-image-2", label: "GPT Image 2" },
    ],
    promptPlaceholder:
      "e.g. A college student studying in a sunlit campus cafe, laptop open, friends laughing in the background",
    brainstormSystemPrompt:
      "You are a creative director helping a high-school student write an image-generation prompt for a TARGET-AUDIENCE or lifestyle image. Take the student's rough idea and expand it into a single polished prompt of 2-4 sentences. Include: who is in the scene (age, vibe, clothing), what they are doing, where it takes place, lighting and mood, and overall style. Output only the prompt — no preamble, no labels.",
  },
}

export const BRAINSTORM_MODEL = "openai/gpt-5-nano"

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
