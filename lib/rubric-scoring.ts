/**
 * Scoring rubrics: for each primary section, a summary of what the section
 * must accomplish, then the criteria a reviewer scores on a 1–4 scale.
 * Each criterion carries a short paragraph on what success looks like,
 * written for anyone (student, teacher, advisor), and what each level
 * looks like. Level 3 (Meets
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
  /** A short paragraph, for students and staff alike, on what success looks like. */
  expectations?: string
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
        expectations:
          "A successful executive summary gives a complete picture of the business in essay form. The first paragraph names the product or service and the customer; the essay then states the problem and how the business solves it, explains what sets it apart from competitors, and uses at least one real figure from the Market Analysis or Financial Plan. It closes with where the business is headed or what it needs, and is best revised last so it reflects the finished thesis.",
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
        expectations:
          "The essay reads as the student's own professional writing: each paragraph makes one point in a logical order, the voice is confident and free of slang or filler, and spelling, grammar and capitalization are clean. Sentence starters are a scaffold, so the finished text should not read like a template. Reading it aloud is a quick way to find sentences that need work.",
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
        expectations:
          "Every detail is real, complete and consistent with the rest of the thesis. The company name matches every section, the tagline is a short phrase that captures what the brand stands for, the email and phone actually work, and the street address, city, state and ZIP match the location used in the Financial Plan.",
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
        expectations:
          "The cover and section images are the first impression on the public page. They are wide, sharp photos of the product, the setting or the customer rather than generic stock art, and still look good cropped to a 16:9 banner.",
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
        expectations:
          "The problem belongs to a specific group of people and is explained clearly enough that a reader feels why it matters. The evidence then proves the problem exists, not that the business is good, using statistics, customer reviews or research from three credible, cited sources. Each part is at least 150 words.",
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
        expectations:
          "The solution explains, step by step, how the business solves the exact problem described above. The unique value proposition is different: it names what customers would otherwise use and gives one clear reason they would choose this business instead. A useful test is finishing the sentence \"Customers will choose us instead of ___ because ___.\"",
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
        expectations:
          "A reader can picture buying each product. Two distinct products or service packages each have a clear name, a real photo (ideally of the student's own product) and a description of what it is, what is included and who it is for, and both match the solution described above.",
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
        expectations:
          "This proves the student can actually make or deliver what they sell. The procedure walks through the process from start to finish as if training a new employee, including materials, tools and timing, and six photos show the student doing the work in order, each with a detailed description. Someone else could repeat the process from it.",
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
        expectations:
          "The industry is named in the standard terms a government site or news article would use, with an explanation of what it provides, who it serves and where the business fits within a specific niche. Statistics and trends belong in the next two parts, not here.",
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
        expectations:
          "Two credible numbers carry this part: the size of the market, in dollars or customers with a year, and whether it is growing, shrinking or stable, with a rate. Both are cited from credible sources such as industry reports, government data or reputable news, and the writing explains what the figures mean for this business.",
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
        expectations:
          "Trends are what is changing now or soon (technology, customer habits, prices, regulations), not the industry's history. At least two distinct trends are described, each linked to the customers or the business and supported by two credible sources. Naming a trend that could hurt the business makes the analysis more credible.",
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
        expectations:
          "Competitors are the real businesses a customer would turn to if this one didn't exist. Three are chosen, including at least one direct competitor selling the same thing, and each is shown with its logo alongside the student's own company.",
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
        expectations:
          "The two axes are things customers actually weigh when choosing, such as price, quality, speed, convenience or specialization, and they measure different things. Good axes spread the four businesses across the map and leave the student's business in a distinct position; if everyone clusters together, an axis needs changing.",
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
        expectations:
          "Each business gets an X and Y score from 1 to 100, and every score is justified in a positioning summary with evidence the student can point to, such as prices, reviews or hours. The student's own placement is honest; a business that wins on both axes isn't believable.",
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
        expectations:
          "The budget spreadsheet is linked and opens for anyone with the link. The written summary walks a reader through startup costs, monthly operating costs, pricing and weekly hours, and the cost structure itemizes every expense that goes into one unit. The figures in the writing match the spreadsheet.",
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
        expectations:
          "The table lists every cost that goes into one product or service (materials, labor, packaging, fees) as its own row, followed by the total unit cost, the sale price and the margin. The totals add up, with margin equal to price minus unit cost.",
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
        expectations:
          "This part explains what it cost to start the business, where that money came from, and how many sales it takes to earn it back. Break-even is worked out and shown (startup costs divided by profit per unit), along with how long reaching it will realistically take.",
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
        expectations:
          "Each price is listed with how it was set and why it makes sense: it covers the unit cost with a healthy margin and compares sensibly with at least two competitors' prices for the customers being served.",
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
        expectations:
          "One clear objective says who the marketing will reach and what they should do or feel as a result, such as follow, visit, book or buy. Ideally it includes a number and a timeframe, and it is specific enough to guide every channel and content choice that follows.",
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
        expectations:
          "The audience is a focused group, not \"everyone,\" defined by age, location, occupation, interests and lifestyle. The persona turns that audience into one believable person with a name, photo, age, story and tech habits, and every detail agrees with the audience description.",
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
        expectations:
          "The brand identity is complete and consistent: a logo that works on light and dark backgrounds, six colors named with hex codes, primary and secondary fonts, an imagery guideline specific enough for someone else to choose photos from, and five reference images. The choices clearly suit the audience and the product.",
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
        expectations:
          "Out-of-home, social media and digital channels are each described with a specific placement (where a flyer goes, which platform is used), an ad mockup, and what the viewer should do next. The summary explains how the three work together, and every channel is somewhere the persona actually spends time.",
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
        expectations:
          "Each content strategy reads like a series people would recognize: a name, a theme, a platform, how often it posts and what viewers should do afterward. The two strategies complement each other, and the summary ties them back to the marketing objective.",
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
        expectations:
          "The closing statement looks forward rather than summarizing: why the business matters to the student, where it is going, and why they are the right person to build it. It ends with a clear call to invest, support or partner, in at least 150 words.",
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
        expectations:
          "The writing is proofread and matches the brand's voice, and the section image works as a closing shot of the product, the team or the vision.",
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
