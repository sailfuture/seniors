/**
 * Scoring rubrics: for each primary section, a summary of what the section
 * must accomplish, then the criteria a reviewer scores on a 1–4 scale.
 * Each criterion carries the specific things to look for, coaching notes
 * for advisors, and what each level looks like. Level 3 (Meets
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
  /** Which fields the criterion looks at, in a few words. */
  covers?: string
  /** For advisors: what this criterion is really about and how to help. */
  coaching?: string
  /** Specific, checkable things a complete answer includes. */
  lookFor?: string[]
  /** What each level looks like, in order 1 to 4. */
  levels: [string, string, string, string]
}

export interface SectionScoring {
  /** What the section must accomplish and how its parts fit together. */
  summary?: string
  criteria: ScoringCriterion[]
}

export const BUSINESS_THESIS_SCORING: Record<string, SectionScoring> = {
  "executive-summary": {
    summary:
      "The Executive Summary is the whole business on one page. A reader who sees nothing else should come away knowing what the company sells, who buys it, why they need it, how it makes money and why this student can pull it off. Because it summarizes every other section, it is best drafted early and rewritten last, once the market, competitor and financial work is done. The Company Information fields feed the public cover, so they must be accurate and match the Financial Plan.",
    criteria: [
      {
        name: "Business concept and opportunity",
        covers: "Executive Summary essay, 500+ words",
        coaching:
          "This is the most important essay in the thesis, and the easiest to write too early. Ask the student to pitch the business out loud in 60 seconds, then check the essay covers the same points. Push for specifics borrowed from later sections: a real market figure, a named competitor, a price and a margin.",
        lookFor: [
          "Names the product or service and the customer in the first paragraph",
          "States the problem and how the business solves it",
          "Uses at least one figure from Market Analysis or the Financial Plan",
          "Explains what sets the business apart from competitors",
          "Closes with where the business is headed or what it needs",
        ],
        levels: [
          "No executive summary submitted.",
          "Under 500 words, or reads as an introduction rather than a summary: the customer, the problem, the competitive edge or the money side is missing.",
          "A 500+ word essay covering the product, customer, problem, solution, competitive edge and how it makes money, clear enough for a stranger to follow.",
          "Persuasive and evidence-based: specific figures from later sections, a confident voice, and a clear vision or ask to close.",
        ],
      },
      {
        name: "Writing and clarity",
        covers: "Organization, voice, mechanics",
        coaching:
          "Read one paragraph aloud with the student; wherever they stumble, the writing needs work. Encourage one idea per paragraph, and a final pass with spell check turned on. Sentence starters are a scaffold, so the finished essay should read in the student's own words.",
        lookFor: [
          "Each paragraph makes one point, in a logical order",
          "Professional voice without slang or filler",
          "Few spelling, grammar or capitalization errors",
          "Sentence starters reworked into the student's own words",
        ],
        levels: [
          "Nothing to assess.",
          "Reads as notes or a list, repeats itself, or has frequent errors that distract the reader.",
          "Organized paragraphs in a clear, professional voice with only minor errors.",
          "Polished and engaging; every paragraph earns its place and it reads like a professional pitch.",
        ],
      },
      {
        name: "Company information",
        covers: "Name, tagline, phone, email, address",
        coaching:
          "Quick to fill in but easy to get wrong. Check the address against the location in the financial spreadsheet and that the email actually works. A tagline deserves a short brainstorm: ask for five options and pick the strongest together.",
        lookFor: [
          "Company name is the same everywhere in the thesis",
          "Tagline is short and says what the brand stands for",
          "Business email and phone are real and professional",
          "Street address, city, state and ZIP match the Financial Plan location",
        ],
        levels: [
          "Company details not filled in.",
          "Details missing, placeholder values, or the address doesn't match the financial plan.",
          "Name, tagline, phone, email and full address complete, real and consistent with the financial plan.",
          "A memorable tagline that captures the brand, and a dedicated business email and phone.",
        ],
      },
      {
        name: "Visual presentation",
        covers: "Cover and section background images",
        coaching:
          "These images are the first impression on the public page. Steer the student toward wide, sharp photos of the product, the setting or the customer rather than generic stock art, and check how they look cropped to 16:9.",
        lookFor: [
          "Cover image is wide (landscape) and sharp",
          "Images relate to the business, not generic stock",
          "Both images still read well cropped to 16:9",
        ],
        levels: [
          "No images uploaded.",
          "An image missing, blurry, badly cropped or unrelated to the business.",
          "Wide, sharp cover and section images that clearly fit the business.",
          "High-quality, on-brand images that set the tone for the whole thesis.",
        ],
      },
    ],
  },

  "product-and-service": {
    summary:
      "Product & Service makes the case that a real problem exists and that this business solves it. It runs in a line: the problem, proof the problem is real, the solution, why customers would choose this solution, what exactly is sold, and how it is made. Each part should lead into the next; if the problem statement and the solution describe different things, the section doesn't hold together. The prototype photos prove the student can actually deliver what they sell.",
    criteria: [
      {
        name: "Problem and evidence",
        covers: "Problem statement and evidence, 150+ words each, 3 sources",
        coaching:
          "Start by asking who has this problem and how they deal with it today. The problem should belong to a specific group of people, not \"people need X.\" Evidence must prove the problem exists, not that the student's business is good; check each source is credible and actually says what the student claims.",
        lookFor: [
          "Names who has the problem and when it happens",
          "Explains the cost or frustration the problem causes",
          "Evidence uses statistics, reviews or research, not opinion",
          "Three credible sources, each cited",
          "Problem statement and evidence each 150+ words",
        ],
        levels: [
          "Problem statement and evidence not submitted.",
          "The problem is broad or opinion-based, the evidence argues for the business instead of the problem, or fewer than 3 credible sources.",
          "A specific problem for a defined group, proven with statistics, reviews or research and 3 credible cited sources, each part 150+ words.",
          "Quantifies the problem's size or cost and makes the reader feel why it matters, with recent, authoritative sources.",
        ],
      },
      {
        name: "Solution and unique value",
        covers: "Solution Overview 150+ words, UVP 100+ words",
        coaching:
          "Ask the student to finish the sentence \"Customers will choose us instead of ___ because ___.\" That answer is the UVP. The solution overview explains how the business works; the UVP explains why it wins. If the two read the same, help the student separate them.",
        lookFor: [
          "Solution answers the exact problem stated above",
          "Explains how the business works, step by step",
          "UVP names what customers would otherwise use",
          "UVP is one clear differentiator, not a list of adjectives",
        ],
        levels: [
          "Solution and UVP not submitted.",
          "Describes the business but not how it solves the stated problem, or the UVP is generic (\"better quality, great service\").",
          "Explains how the business solves the stated problem (150+ words) and one specific reason customers would choose it over alternatives (100+ words).",
          "Solution and UVP tie tightly to the problem and customer; the UVP is memorable and backed up by the competitive analysis.",
        ],
      },
      {
        name: "Products and services",
        covers: "Two products: name, photo, description",
        coaching:
          "A reader should be able to picture buying each product. Ask what it includes, what it costs and who it is for. Photos should show the student's own product wherever possible.",
        lookFor: [
          "Two distinct products or service packages",
          "Each has a clear name and a real photo",
          "Each description says what it is, what's included and who it's for",
          "Products match the solution described above",
        ],
        levels: [
          "No products listed.",
          "Only one product, or names, photos or descriptions missing or vague.",
          "Two products, each with a clear name, a real photo and a description of what it is and who it is for.",
          "Descriptions include features, price point and value to the customer; photos are clear and professional.",
        ],
      },
      {
        name: "Prototype and process",
        covers: "Procedure 100+ words, 6 described images",
        coaching:
          "This is the proof the student can make or deliver what they sell. Ask them to walk through the process as if training a new employee. Photos should show the student doing the work, in order, each described.",
        lookFor: [
          "Procedure runs step by step from start to finish",
          "Mentions materials, tools and how long steps take",
          "Six photos of the student doing the work",
          "Each photo has a detailed description",
          "Someone else could repeat the process",
        ],
        levels: [
          "No procedure or prototype images.",
          "Procedure is vague or under 100 words, or fewer than 6 photos, missing descriptions or photos that don't show the student working.",
          "A step-by-step procedure (100+ words) and 6 photos of the student making the product or delivering the service, each described in detail.",
          "Clearly repeatable; photos and descriptions follow the process stage by stage, with materials, tools and timing.",
        ],
      },
    ],
  },

  "market-analysis": {
    summary:
      "Market Analysis shows that enough people want what the business sells, and that now is a good time to sell it. It narrows from the wide view to the specific: which industry the business belongs to, how big that industry is and how fast it is growing, and what is changing in it right now. Every claim should rest on a real number from a credible source; this is where the research does the talking. Keep each part in its lane: definitions in the industry definition, numbers in size and growth, current changes in trends.",
    criteria: [
      {
        name: "Industry definition",
        covers: "125+ words",
        coaching:
          "Ask the student to name their industry the way a government website or news article would (for example \"test preparation and tutoring\"), then say where their business fits inside it. Market numbers don't belong here yet.",
        lookFor: [
          "Names the industry in standard terms",
          "Explains what the industry provides and to whom",
          "Places the business in a specific niche",
          "Leaves statistics and trends for the later parts",
        ],
        levels: [
          "Industry definition not submitted.",
          "Names the industry without explaining it, describes only the business, or mixes in market data and trends.",
          "Defines the industry, what it provides, who it serves and where the business fits, in 125+ words.",
          "Names the specific segment or niche and positions the business precisely within it.",
        ],
      },
      {
        name: "Market size and growth",
        covers: "125+ words, 2 sources",
        coaching:
          "Help the student find two credible numbers: the size of the market (in dollars or customers) and its growth rate. Industry reports, government data and reputable news work well. Then ask what the numbers mean for their business, not just what they are.",
        lookFor: [
          "Market size as a number with a year",
          "Whether the market is growing, shrinking or stable, with a rate",
          "Two credible sources cited",
          "Explains what the figures mean for the business",
        ],
        levels: [
          "Market size and growth not submitted.",
          "Claims without real numbers, numbers without a year or source, or sources that aren't credible.",
          "Market size and growth rate from 2 credible cited sources, with what they mean for the business, in 125+ words.",
          "Uses local and national figures and explains what they mean for demand and timing.",
        ],
      },
      {
        name: "Market trends",
        covers: "150+ words, 2 sources",
        coaching:
          "Trends are what is changing now: technology, customer habits, prices, regulations. Ask which change helps the business most and which could hurt it; both make the analysis more credible.",
        lookFor: [
          "Describes current or near-future changes, not history",
          "At least two distinct trends",
          "Each trend is linked to customers or the business",
          "Two credible sources cited",
        ],
        levels: [
          "Market trends not submitted.",
          "Describes history rather than current trends, or trends are unsupported.",
          "Two or more current trends affecting the industry and its customers, each linked to the business, with 2 credible sources, in 150+ words.",
          "Connects each trend to an opportunity or risk for the business and shows why the timing is right.",
        ],
      },
    ],
  },

  "competitive-analysis": {
    summary:
      "Competitive Analysis places the business on a map against real alternatives a customer would consider, and shows where it stands apart. The map only works if the two axes matter to customers and spread the businesses out; if everyone lands in one corner, the axes need rethinking. Every score must be backed by evidence the student can point to, such as prices, reviews or hours. The student's own position should be honest: a business that wins on every axis isn't believable.",
    criteria: [
      {
        name: "Competitor selection",
        covers: "3 competitors plus your company, with logos",
        coaching:
          "Ask: if your business didn't exist, where would your customer go instead? Those are the competitors. At least one should sell the same thing directly.",
        lookFor: [
          "Three real businesses a customer would actually consider",
          "At least one direct competitor",
          "A logo for each, plus the student's own",
          "Names spelled correctly",
        ],
        levels: [
          "No competitors identified.",
          "Fewer than 3 competitors, businesses that aren't real or relevant, or logos missing.",
          "Three real, relevant competitors and the student's company, each named with a logo.",
          "A deliberate mix of direct and indirect alternatives a customer would genuinely weigh.",
        ],
      },
      {
        name: "Map axes",
        covers: "X and Y axis labels",
        coaching:
          "Good axes are things customers weigh when choosing: price, quality, speed, convenience, specialization. Have the student sketch the map on paper first; if all four businesses cluster together, swap an axis.",
        lookFor: [
          "Two different dimensions, not two versions of the same one",
          "Both matter to the target customer",
          "The axes spread the businesses across the map",
          "The student's business sits in a distinct position",
        ],
        levels: [
          "No axes chosen.",
          "Axes are vague, overlap, or leave every business clustered together.",
          "Two distinct, customer-relevant axes that spread the businesses across the map.",
          "The axes reveal a clear open position that the business occupies.",
        ],
      },
      {
        name: "Scores and positioning",
        covers: "1–100 scores and a positioning summary for each business",
        coaching:
          "Every score needs a reason. Ask the student to show you the price, review or fact behind each number, and check their own scores are believable rather than perfect on both axes.",
        lookFor: [
          "X and Y scores (1–100) for all four businesses",
          "A positioning summary for each business",
          "Each summary cites specific evidence",
          "The student's own placement is honest",
        ],
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
    summary:
      "The Financial Plan proves the business can make money. It runs from the spreadsheet built in term 3 to the written explanation of it: what it costs to make one unit, what it sells for, what it cost to start, how many sales it takes to break even, and why the prices make sense. The numbers must agree everywhere they appear; a different unit cost in the summary and the breakdown is the most common problem. Coach the student to explain the thinking behind each number, not just list it.",
    criteria: [
      {
        name: "Budget and cost structure",
        covers: "Budget sheet link, summary 200+ words, cost structure 125+ words",
        coaching:
          "Open the spreadsheet with the student and check it is shared so anyone with the link can view it. Then read the summary against the sheet line by line. The cost structure should list every expense that goes into one unit.",
        lookFor: [
          "Budget sheet link opens without a sign-in",
          "Summary covers startup costs, monthly costs, pricing and weekly hours",
          "Cost structure itemizes the per-unit costs",
          "Figures match the spreadsheet",
        ],
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
        coaching:
          "Walk through making one unit together and list every cost: materials, labor, packaging, fees. Then check the math: total unit cost, sale price, and margin as price minus cost.",
        lookFor: [
          "A row for each per-unit cost",
          "Total unit cost adds up",
          "Sale price listed",
          "Margin calculated correctly",
        ],
        levels: [
          "Unit cost table not filled in.",
          "Some costs listed, but the total unit cost, sale price or margin is missing or wrong.",
          "Itemized per-unit costs with a correct total unit cost, sale price and margin.",
          "Accounts for every cost (materials, labor, packaging, fees) and shows a realistic margin.",
        ],
      },
      {
        name: "Funding and break-even",
        covers: "Startup expenses 150+ words, break-even 125+ words",
        coaching:
          "Break-even is startup costs divided by profit per unit. Do the calculation together, then ask whether that many sales is realistic and how long it would take.",
        lookFor: [
          "Startup costs listed with a total",
          "Where the starting money came from",
          "Break-even in units or sales, with the math shown",
          "How long it will take to recover the investment",
        ],
        levels: [
          "Funding and break-even not submitted.",
          "Startup costs or break-even stated without numbers or explanation.",
          "Startup costs and where the money came from, and a break-even point worked out from unit margin and startup costs.",
          "Shows the math, a timeline to recover the investment, and how realistic break-even is.",
        ],
      },
      {
        name: "Pricing strategy",
        covers: "125+ words",
        coaching:
          "Ask the student to compare their price with two competitors: is theirs higher, lower or the same, and why? The price must also cover the unit cost with a healthy margin.",
        lookFor: [
          "A price for each product",
          "How each price was set",
          "Comparison with competitor prices",
          "Prices cover costs with a margin",
        ],
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
    summary:
      "The Marketing Plan explains how the business will reach its customers and turn them into buyers. It builds in order: one clear marketing objective, a specific target audience brought to life by a persona, a brand identity that appeals to that persona, the places the brand will show up, and the content it will post. Each part should follow from the one before; if the persona lives on TikTok but the plan leans on flyers, the plan doesn't make sense. Everything should trace back to the objective.",
    criteria: [
      {
        name: "Marketing objective",
        covers: "Primary marketing objective",
        coaching:
          "Ask what the student wants marketing to make people do: follow, visit, book, buy. A good objective names the audience and that action, ideally with a number and a timeframe.",
        lookFor: [
          "Names who the marketing will reach",
          "States the action or feeling it should produce",
          "Specific enough to guide decisions",
          "Ideally measurable, with a target and timeframe",
        ],
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
        coaching:
          "Push past \"everyone.\" Ask the student to describe one real customer they have sold to or could sell to; the persona should look like that person, and every demographic field should agree with the audience description.",
        lookFor: [
          "Audience defined by age, location and occupation",
          "Interests and lifestyle are specific",
          "Persona has a name, photo, age and story",
          "Tech usage says where the persona spends time online",
        ],
        levels: [
          "Audience and persona not submitted.",
          "Audience is broad (\"anyone\"), or demographics or persona details are incomplete or contradict each other.",
          "A specific audience with age, location, occupation, interests and lifestyle, and a named persona with photo, 100+ word description and tech usage.",
          "The persona is vivid, consistent with the audience data, and directly shapes the channel choices.",
        ],
      },
      {
        name: "Brand identity",
        covers: "Logos, colors, fonts, imagery guideline, reference images",
        coaching:
          "Check the logo on both a white and a dark background, and that each color has a hex code. Ask why the colors and fonts suit the audience. The imagery guideline should be specific enough that someone else could pick photos from it.",
        lookFor: [
          "Logo versions for light and dark backgrounds",
          "Six colors named with hex codes",
          "Primary and secondary fonts named",
          "An imagery guideline and 5 reference images",
        ],
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
        coaching:
          "For each channel ask: does the persona actually see this, where exactly, and what should they do next? Ad mockups should look like the real placement.",
        lookFor: [
          "Out-of-home, social and digital channels each described",
          "Each placement is specific (where, which platform)",
          "An ad mockup for each channel",
          "Summary explains how the channels work together",
        ],
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
        coaching:
          "Each strategy should be a series people would recognize: a name, a theme, a platform, how often it posts, and what viewers should do afterwards.",
        lookFor: [
          "Two named strategies",
          "Each has a theme, platform and posting frequency",
          "Each states a goal tied to the objective",
          "Summary shows how the two work together",
        ],
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
    summary:
      "The Closing Statement is the student's final word to an investor or partner. It should look forward, not back: why this business matters, where it is going, and why the student is the right person to build it. It works best written after the rest of the thesis, so it can draw on the strongest points without repeating them. Encourage a personal voice and a clear final ask.",
    criteria: [
      {
        name: "Vision and case for support",
        covers: "Closing Statement, 150+ words",
        coaching:
          "Ask the student: in five years, what does your business look like, and why do you care? Use their answer as the spine of the statement, and make sure it ends with a clear ask.",
        lookFor: [
          "Looks forward rather than summarizing",
          "Says why the business matters to the student",
          "Describes where the business is headed",
          "Ends with a clear call to invest, support or partner",
          "150+ words",
        ],
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
        coaching:
          "Read the statement aloud together as a final proofread. The image should feel like a closing shot: the product, the team or the vision.",
        lookFor: ["Proofread, with few errors", "Matches the brand's voice", "A fitting section image"],
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
