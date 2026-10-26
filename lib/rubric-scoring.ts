/**
 * Scoring rubrics: for each primary section, the criteria a reviewer scores
 * on a 1–4 scale and what each level looks like. Level 3 (Meets
 * expectations) is the bar for a section to count as complete.
 *
 * Criteria are written from the template: each section's purpose, its
 * groups, and the word minimums, source counts and instructions on its
 * questions. Edit the wording here; sections are keyed by their URL slug.
 * The Life Map's rubrics live in lib/rubric-scoring-lifemap.ts.
 */

export type ScoreLevel = 1 | 2 | 3 | 4

export const SCORE_LEVELS: { score: ScoreLevel; label: string }[] = [
  { score: 1, label: "Not started" },
  { score: 2, label: "Needs improvement" },
  { score: 3, label: "Meets expectations" },
  { score: 4, label: "Exceeds expectations" },
]

/** The level a section must reach on every criterion to count as complete. */
export const COMPLETE_AT: ScoreLevel = 3

export interface ScoringCriterion {
  name: string
  /** What the criterion looks at, in a few words. */
  covers?: string
  /** What each level looks like, in order 1 to 4. */
  levels: [string, string, string, string]
}

export interface SectionScoring {
  criteria: ScoringCriterion[]
}

export const BUSINESS_THESIS_SCORING: Record<string, SectionScoring> = {
  "executive-summary": {
    criteria: [
      {
        name: "Business concept and opportunity",
        covers: "Executive Summary essay, 500+ words",
        levels: [
          "No executive summary submitted.",
          "Under 500 words, or leaves out what the business does, who it serves, or why it will succeed.",
          "A 500+ word essay a new reader can follow: what the business does, who it serves, the problem it solves, and why it will succeed.",
          "Also persuasive: draws on specific figures from later sections and closes with a clear vision or ask.",
        ],
      },
      {
        name: "Writing and clarity",
        covers: "Organization, voice, mechanics",
        levels: [
          "Nothing to assess.",
          "Reads as notes or a list; frequent spelling or grammar errors.",
          "Organized paragraphs in a clear, confident voice with few errors.",
          "Polished and engaging; every paragraph earns its place.",
        ],
      },
      {
        name: "Company information",
        covers: "Name, tagline, phone, email, address",
        levels: [
          "Company details not filled in.",
          "Some details missing or placeholders, or the address doesn't match the financial plan.",
          "Name, tagline, phone, email and full address complete and consistent with the financial plan.",
          "A memorable tagline that captures the brand and a professional business email.",
        ],
      },
      {
        name: "Visual presentation",
        covers: "Cover and section background images",
        levels: [
          "No images uploaded.",
          "One image missing, or images are low quality or unrelated to the business.",
          "Wide cover and section images that fit the business.",
          "High-quality, on-brand images that set the tone for the whole thesis.",
        ],
      },
    ],
  },

  "product-and-service": {
    criteria: [
      {
        name: "Problem and evidence",
        covers: "Problem statement and evidence, 150+ words each, 3 sources",
        levels: [
          "Problem statement and evidence not submitted.",
          "The problem is vague or unsupported, or fewer than 3 credible sources are cited.",
          "A specific, real problem explained in 150+ words, proven in 150+ words of evidence with 3 credible cited sources.",
          "Evidence is specific and quantified (statistics, reviews, research) and makes the reader feel why the problem matters.",
        ],
      },
      {
        name: "Solution and unique value",
        covers: "Solution Overview 150+ words, UVP 100+ words",
        levels: [
          "Solution and UVP not submitted.",
          "Describes the business but not how it solves the problem, or the UVP repeats the solution.",
          "Explains how the business works and solves the problem, and why a customer would choose it over the alternatives.",
          "Solution and UVP tie tightly to the problem and customer; the UVP is memorable and specific.",
        ],
      },
      {
        name: "Products and services",
        covers: "Two products: name, photo, description",
        levels: [
          "No products listed.",
          "Only one product, or names, photos or descriptions missing.",
          "Two products, each with a name, a photo and a clear description.",
          "Descriptions cover features, value and who each product is for; photos are clear and professional.",
        ],
      },
      {
        name: "Prototype and process",
        covers: "Procedure 100+ words, 6 described images",
        levels: [
          "No procedure or prototype images.",
          "Procedure is vague or under 100 words, or fewer than 6 images or descriptions.",
          "A step-by-step procedure of 100+ words and 6 photos of the student making the product or delivering the service, each described.",
          "The process is clearly repeatable; images and descriptions document every stage in detail.",
        ],
      },
    ],
  },

  "market-analysis": {
    criteria: [
      {
        name: "Industry definition",
        covers: "125+ words",
        levels: [
          "Industry definition not submitted.",
          "Names the industry without explaining it, or mixes in market data and trends.",
          "Defines the industry, what it does, who it serves and where the business fits, in 125+ words.",
          "Names the specific segment or niche and positions the business precisely within it.",
        ],
      },
      {
        name: "Market size and growth",
        covers: "125+ words, 2 sources",
        levels: [
          "Market size and growth not submitted.",
          "Claims without real numbers, or sources missing or not credible.",
          "Market size and growth direction backed by real figures and 2 credible cited sources, in 125+ words.",
          "Uses local and national figures and explains what they mean for demand and timing.",
        ],
      },
      {
        name: "Market trends",
        covers: "150+ words, 2 sources",
        levels: [
          "Market trends not submitted.",
          "Describes history rather than current trends, or trends are unsupported.",
          "Current and near-future trends affecting the industry and its customers, with 2 credible sources, in 150+ words.",
          "Connects each trend to an opportunity or risk for the business and shows why the timing is right.",
        ],
      },
    ],
  },

  "competitive-analysis": {
    criteria: [
      {
        name: "Competitor selection",
        covers: "3 competitors plus your company, with logos",
        levels: [
          "No competitors identified.",
          "Fewer than 3 competitors, competitors that aren't real or relevant, or logos missing.",
          "Three real, relevant competitors and the student's company, each named with a logo.",
          "Includes direct and indirect alternatives a customer would genuinely consider.",
        ],
      },
      {
        name: "Map axes",
        covers: "X and Y axis labels",
        levels: [
          "No axes chosen.",
          "Axes are vague or so similar that every business clusters together.",
          "Two distinct, customer-relevant axes (such as price, quality, convenience) that spread businesses across the map.",
          "The axes reveal a clear open position that the business occupies.",
        ],
      },
      {
        name: "Scores and positioning",
        covers: "1–100 scores and a positioning summary for each business",
        levels: [
          "No scores or positioning summaries.",
          "Scores given without evidence, or positioning summaries missing.",
          "Every business has X and Y scores, each justified with evidence in its positioning summary.",
          "Justifications cite specific evidence (prices, reviews, hours) and the student's own position is honest and defensible.",
        ],
      },
    ],
  },

  "financial-plan": {
    criteria: [
      {
        name: "Budget and cost structure",
        covers: "Budget sheet link, summary 200+ words, cost structure 125+ words",
        levels: [
          "No budget sheet or summary.",
          "Sheet missing or not viewable, or the summary lists numbers without explaining them.",
          "A viewable budget sheet; a 200+ word summary of startup costs, operating costs, pricing and weekly hours; an itemized 125+ word cost structure.",
          "Figures match across the sheet, summary and unit breakdown, and every assumption is explained.",
        ],
      },
      {
        name: "Unit cost breakdown",
        covers: "Per-unit costs, total, price, margin",
        levels: [
          "Unit cost table not filled in.",
          "Some costs listed, but the total unit cost, sale price or margin is missing.",
          "Itemized per-unit costs with total unit cost, sale price and margin.",
          "Accounts for every cost (materials, labor, packaging, fees) and shows a realistic margin.",
        ],
      },
      {
        name: "Funding and break-even",
        covers: "Startup expenses 150+ words, break-even 125+ words",
        levels: [
          "Funding and break-even not submitted.",
          "Startup costs or break-even stated without numbers or explanation.",
          "Startup costs and where the money came from, and a break-even point worked out from unit margin and fixed costs.",
          "Shows the math, a timeline to recover the investment, and how realistic break-even is.",
        ],
      },
      {
        name: "Pricing strategy",
        covers: "125+ words",
        levels: [
          "Pricing strategy not submitted.",
          "Lists prices without the reasoning behind them.",
          "Explains each price, how it was set, and why it is profitable and fits the target customer.",
          "Compares against competitors' prices and justifies the strategy with evidence.",
        ],
      },
    ],
  },

  "marketing-plan": {
    criteria: [
      {
        name: "Marketing objective",
        covers: "Primary marketing objective",
        levels: [
          "No objective stated.",
          "A business goal (such as \"make more money\") or too vague to guide decisions.",
          "A specific objective naming who the marketing reaches and what they should do or feel.",
          "Measurable, and clearly drives the channel and content choices that follow.",
        ],
      },
      {
        name: "Target audience and persona",
        covers: "Audience 150+ words, demographics, persona with tech usage",
        levels: [
          "Audience and persona not submitted.",
          "Audience is broad (\"anyone\"), or demographics or persona details are incomplete.",
          "A specific audience with age, location, occupation, interests and lifestyle, and a named persona with photo, 100+ word description and tech usage.",
          "The persona is vivid, consistent with the audience data, and directly shapes the channel choices.",
        ],
      },
      {
        name: "Brand identity",
        covers: "Logos, colors, fonts, imagery guideline, reference images",
        levels: [
          "No brand elements submitted.",
          "Missing a logo version, hex codes, fonts, the imagery guideline or reference images.",
          "Logo on light and dark backgrounds, six named colors with hex codes, two fonts, an imagery guideline and 5 reference images.",
          "A cohesive brand: colors, fonts and imagery clearly suit the audience and the product.",
        ],
      },
      {
        name: "Messaging locations",
        covers: "Out-of-home, social media, digital, summary",
        levels: [
          "No messaging locations described.",
          "Channels named without explanation, or ad mockups missing.",
          "Out-of-home, social media and digital plans, each with an ad mockup, and a summary of how they work together.",
          "Channels match where the persona actually spends time, with specific placements and a clear call to action.",
        ],
      },
      {
        name: "Content strategy",
        covers: "Two strategies 100+ words each, summary 100+ words",
        levels: [
          "No content strategy submitted.",
          "Content ideas are vague or not tied to a platform or goal.",
          "Two named strategies with theme, platform, frequency and goal, plus a summary of how they work together.",
          "The strategies complement each other and connect back to the objective and persona.",
        ],
      },
    ],
  },

  "closing-statement": {
    criteria: [
      {
        name: "Vision and case for support",
        covers: "Closing Statement, 150+ words",
        levels: [
          "Closing statement not submitted.",
          "Under 150 words, or only summarizes earlier sections without a forward-looking vision.",
          "A forward-looking 150+ word statement of why the business matters, where it is going and why it will succeed.",
          "Personal and persuasive, ending with a clear call to invest, support or partner.",
        ],
      },
      {
        name: "Presentation",
        covers: "Proofreading and section image",
        levels: [
          "Nothing to assess.",
          "Noticeable spelling or grammar errors, or the section image is missing.",
          "Clean, proofread writing and a section image that fits the business.",
          "Polished and confident; the image and tone match the brand.",
        ],
      },
    ],
  },
}
