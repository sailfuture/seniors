/**
 * Scoring rubrics: for each primary section, a summary of what the section
 * must accomplish, then one row per key objective, each scored on four
 * levels (Not started, Needs improvement, Meets expectations, Exceeds
 * expectations). Meets expectations on every row is the bar for a section
 * to count as complete.
 *
 * Rows come from the template: each section's purpose, its groups, and the
 * word minimums, source counts and instructions on its questions. Each row
 * has a short paragraph on what success looks like, written for anyone
 * reading (student, teacher, advisor). Edit the wording here; sections are
 * keyed by their URL slug. The Life Map's rubrics live in
 * lib/rubric-scoring-lifemap.ts.
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
  /** What each level looks like, in order: Not started to Exceeds expectations. */
  levels: [string, string, string, string]
  /** Template group ids this row scores (0 = the ungrouped questions), from lib/rubric-groups.ts. */
  groups?: number[]
}

export interface SectionScoring {
  /** What the section must accomplish and how its parts fit together. */
  summary?: string
  criteria: ScoringCriterion[]
}

/**
 * One rubric row. Most rows read "Not submitted." at Not started, so that is
 * the default; pass `notStarted` to say something more specific.
 */
export function crit(
  name: string,
  covers: string,
  expectations: string,
  needsImprovement: string,
  meets: string,
  exceeds: string,
  notStarted = "Not submitted."
): ScoringCriterion {
  return { name, covers, expectations, levels: [notStarted, needsImprovement, meets, exceeds] }
}

export const BUSINESS_THESIS_SCORING: Record<string, SectionScoring> = {
  "executive-summary": {
    summary:
      "The Executive Summary is the whole business on one page. A reader who sees nothing else should come away knowing what the company sells, who buys it, why they need it, how it makes money and why this student can pull it off. Because it summarizes every other section, it is best drafted early and rewritten last, once the market, competitor and financial work is done. The Company Information fields feed the public cover, so they must be accurate and match the Financial Plan.",
    criteria: [
      crit(
        "Business overview",
        "Opening paragraph",
        "The opening paragraph tells a reader exactly what the business sells and who it sells to, in plain language, before anything else.",
        "The product or the customer is vague, or only becomes clear late in the essay.",
        "Names the product or service and the target customer in the first paragraph.",
        "States what the business does and for whom in one memorable sentence a stranger could repeat."
      ),
      crit(
        "Problem and solution",
        "Executive Summary essay",
        "The summary states the problem customers face and how the business solves it, matching the Product & Service section.",
        "Describes the business without the problem it solves, or the problem doesn't match the rest of the thesis.",
        "States the customer's problem and how the business solves it, consistent with Product & Service.",
        "Makes the problem feel urgent with a specific detail or figure, and shows why this solution fits it best."
      ),
      crit(
        "Market opportunity",
        "Executive Summary essay",
        "The summary shows there is real demand for the business, drawing on the Market Analysis.",
        "Claims there is demand without evidence, or leaves the market out entirely.",
        "Includes at least one real market figure or trend from the Market Analysis.",
        "Connects market size and trends to why now is the right time for this business."
      ),
      crit(
        "Competitive advantage",
        "Executive Summary essay",
        "The summary explains why customers will choose this business over the alternatives.",
        "Says the business is better without saying how, or compared to whom.",
        "Names the main alternative and the business's specific advantage over it.",
        "States the advantage as a clear unique value proposition backed by the Competitive Analysis."
      ),
      crit(
        "Financial viability",
        "Executive Summary essay",
        "The summary gives a reader confidence the business can make money: its price, its costs or margin, and what it took to start.",
        "Mentions money only in general terms, with no real figures.",
        "Includes the price and at least one figure on costs, margin or startup expenses from the Financial Plan.",
        "Summarizes price, margin and break-even in a sentence or two that shows the business is viable."
      ),
      crit(
        "Vision and ask",
        "Closing paragraph",
        "The summary closes with where the business is going and what it needs from the reader.",
        "Ends abruptly, or simply repeats earlier points.",
        "Closes with the business's next goals or what it needs, such as support, partners or investment.",
        "Ends with a specific, confident ask tied to a clear next milestone."
      ),
      crit(
        "Writing quality",
        "500+ words",
        "The essay is at least 500 words of the student's own clear, professional writing, organized into paragraphs that each make one point.",
        "Under 500 words, reads like notes, or has errors that distract the reader.",
        "500+ words in organized paragraphs, with only minor errors.",
        "Polished and persuasive; it reads like a professional pitch."
      ),
      crit(
        "Company information",
        "Name, tagline, phone, email, address",
        "Every company detail is complete, real and consistent with the rest of the thesis, and the address matches the location in the Financial Plan.",
        "Details missing or placeholders, or the address doesn't match the Financial Plan.",
        "Name, tagline, phone, email and full address complete, real and consistent.",
        "A memorable tagline that captures the brand, and a dedicated business email and phone."
      ),
      crit(
        "Visual presentation",
        "Cover and section images",
        "The cover and section images are wide, sharp photos that fit the business and still look good cropped to a 16:9 banner.",
        "An image missing, blurry, badly cropped or unrelated to the business.",
        "Wide, sharp cover and section images that clearly fit the business.",
        "High-quality, on-brand images that set the tone for the whole thesis."
      ),
    ],
  },

  "product-and-service": {
    summary:
      "Product & Service makes the case that a real problem exists and that this business solves it. It runs in a line: the problem, proof the problem is real, the solution, why customers would choose this solution, what exactly is sold, and how it is made. Each part should lead into the next; if the problem statement and the solution describe different things, the section doesn't hold together. The prototype photos prove the student can actually deliver what they sell.",
    criteria: [
      crit(
        "Problem statement",
        "150+ words",
        "Names a specific group of people and the problem they face, and explains why it matters to them.",
        "The problem is broad (\"people need X\"), or the group affected is unclear.",
        "A specific problem for a defined group, explained in 150+ words.",
        "Makes the reader feel the problem's cost or frustration with a concrete example."
      ),
      crit(
        "Problem evidence",
        "150+ words",
        "Proves the problem is real with statistics, customer reviews or research rather than opinion.",
        "Relies on opinion, or argues the business is good instead of proving the problem exists.",
        "150+ words of factual evidence that the problem exists.",
        "Quantifies how many people have the problem or what it costs them."
      ),
      crit(
        "Sources",
        "3 sources",
        "Three credible sources back the evidence, each fully cited.",
        "Fewer than three sources, or sources that aren't credible or don't support the claims.",
        "Three credible sources, each cited with title, author or publisher, and link.",
        "Recent, authoritative sources such as research, government data or reputable news."
      ),
      crit(
        "Solution overview",
        "150+ words",
        "Explains, step by step, how the business solves the exact problem described above.",
        "Describes the business without connecting it to the problem.",
        "150+ words on how the business works and solves the stated problem.",
        "Shows why this approach works better than the options customers have today."
      ),
      crit(
        "Unique value proposition",
        "100+ words",
        "Gives one clear reason customers would choose this business over what they use now. A useful test: \"Customers will choose us instead of ___ because ___.\"",
        "Generic claims like \"better quality,\" or a repeat of the solution overview.",
        "100+ words naming the alternative and one specific differentiator.",
        "A memorable UVP that matches what the target customer values most."
      ),
      crit(
        "Products and services",
        "Two products: name, photo, description",
        "Two products or service packages, each with a clear name, a real photo and a description of what it is, what's included and who it's for.",
        "Only one product, or names, photos or descriptions missing or vague.",
        "Two products, each named, photographed and clearly described.",
        "Descriptions include features, price point and value to the customer; photos are professional."
      ),
      crit(
        "Prototype process",
        "100+ words",
        "A step-by-step procedure for making the product or delivering the service, written as if training a new employee.",
        "Vague, out of order, or under 100 words.",
        "100+ words covering each step from start to finish.",
        "Includes materials, tools and timing, so someone else could repeat the process."
      ),
      crit(
        "Prototype photos",
        "6 described photos",
        "Six photos show the student doing the work, in order, each with a detailed description.",
        "Fewer than six photos, photos that don't show the student working, or missing descriptions.",
        "Six photos of the process, each with a detailed description.",
        "Photos and descriptions document every stage clearly and professionally."
      ),
    ],
  },

  "market-analysis": {
    summary:
      "Market Analysis shows that enough people want what the business sells, and that now is a good time to sell it. It narrows from the wide view to the specific: which industry the business belongs to, how big that industry is and how fast it is growing, and what is changing in it right now. Every claim should rest on a real number from a credible source; this is where the research does the talking. Keep each part in its lane: definitions in the industry definition, numbers in size and growth, current changes in trends.",
    criteria: [
      crit(
        "Industry definition",
        "125+ words",
        "Names the industry in the standard terms a government site or news article would use, and explains what it provides and who it serves.",
        "Names the industry without explaining it, or mixes in statistics and trends.",
        "Defines the industry, what it provides and who it serves, in 125+ words.",
        "Uses the precise industry name and describes its scope clearly enough for an outsider."
      ),
      crit(
        "The business's niche",
        "Industry definition",
        "Shows where the business fits within its industry.",
        "Describes only the industry or only the business, not how they connect.",
        "Names the segment or niche the business occupies.",
        "Positions the business precisely within its niche and explains why it fits there."
      ),
      crit(
        "Market size",
        "Market Size & Growth",
        "States how big the market is, in dollars or customers, with a year and a credible source.",
        "A number without a year or source, or no number at all.",
        "A market size figure with its year, from a credible source.",
        "Gives national and local figures, or the size of the specific niche."
      ),
      crit(
        "Market growth",
        "Market Size & Growth, 125+ words",
        "States whether the market is growing, shrinking or stable, with a rate, and what that means for the business.",
        "Says the market is growing without a figure.",
        "A growth rate or projection from a credible source.",
        "Explains what the growth means for demand and timing for this business."
      ),
      crit(
        "Current trends",
        "Market Trends, 150+ words",
        "Describes at least two things changing in the industry now or soon: technology, customer habits, prices or regulations.",
        "Describes the industry's history, or names trends without explaining them.",
        "Two or more current trends, explained in 150+ words.",
        "Trends are specific, recent and clearly relevant to the target customer."
      ),
      crit(
        "Trend impact",
        "Market Trends",
        "Connects each trend to an opportunity or a risk for the business.",
        "Trends listed with no link to the business.",
        "Explains how each trend affects the business.",
        "Names both an opportunity and a risk, and how the business will respond."
      ),
      crit(
        "Research and sources",
        "4 sources",
        "Two credible, cited sources support size and growth, and two support the trends.",
        "Sources missing, incomplete or not credible.",
        "Four credible sources, each fully cited.",
        "Sources are recent, authoritative and directly support each figure."
      ),
    ],
  },

  "competitive-analysis": {
    summary:
      "Competitive Analysis places the business on a map against real alternatives a customer would consider, and shows where it stands apart. The map only works if the two axes matter to customers and spread the businesses out; if everyone lands in one corner, the axes need rethinking. Every score must be backed by evidence the student can point to, such as prices, reviews or hours. The student's own position should be honest: a business that wins on every axis isn't believable.",
    criteria: [
      crit(
        "Competitor selection",
        "3 competitors",
        "Three real businesses a customer would turn to if this one didn't exist, including at least one direct competitor.",
        "Fewer than three, or businesses that aren't real or relevant.",
        "Three real, relevant competitors, at least one of them direct.",
        "A deliberate mix of direct and indirect competitors a customer would genuinely weigh."
      ),
      crit(
        "Names and logos",
        "Names and logos for all four businesses",
        "Each competitor and the student's own company appears on the map with a correct name and logo.",
        "Names misspelled or logos missing.",
        "All four businesses named correctly, each with a logo.",
        "Clean, high-quality logos that make the map easy to read."
      ),
      crit(
        "Axis choice",
        "X and Y axis labels",
        "Two different dimensions customers weigh when choosing, such as price, quality, speed or convenience.",
        "Axes are vague, overlap, or don't matter to customers.",
        "Two distinct, customer-relevant axes.",
        "The axes reveal a clear open position the business occupies."
      ),
      crit(
        "Competitor scores",
        "X and Y scores, 1–100",
        "Each competitor gets X and Y scores from 1 to 100 that reflect the evidence.",
        "Scores missing or guessed.",
        "Scores for every competitor on both axes.",
        "Scores are consistent across competitors and anchored to clear extremes."
      ),
      crit(
        "Positioning evidence",
        "Positioning summaries",
        "A positioning summary for each competitor explains its scores with evidence such as prices, reviews or hours.",
        "Summaries missing or based on opinion.",
        "Each summary justifies its scores with specific evidence.",
        "Evidence is specific and verifiable for every score."
      ),
      crit(
        "Own position",
        "My company's scores and positioning",
        "The student's business is placed honestly on the map, with its own justification.",
        "Placed perfectly on both axes, or without justification.",
        "An honest placement, justified like the competitors'.",
        "The position clearly shows the gap in the market the business fills."
      ),
    ],
  },

  "financial-plan": {
    summary:
      "The Financial Plan proves the business can make money. It runs from the spreadsheet built in term 3 to the written explanation of it: what it costs to make one unit, what it sells for, what it cost to start, how many sales it takes to break even, and why the prices make sense. The numbers must agree everywhere they appear; a different unit cost in the summary and the breakdown is the most common problem. Coach the student to explain the thinking behind each number, not just list it.",
    criteria: [
      crit(
        "Budget spreadsheet",
        "Google Budget Sheet link",
        "The term 3 budget spreadsheet is linked and opens for anyone with the link.",
        "Link missing, broken, or asks for a sign-in.",
        "A working, viewable link to the budget spreadsheet.",
        "The spreadsheet is organized and labeled so a reader can follow it."
      ),
      crit(
        "Budget summary",
        "200+ words",
        "Explains in words the startup costs, monthly costs, pricing and weekly hours behind the budget.",
        "Lists numbers without explaining them, or under 200 words.",
        "200+ words walking through the budget's key figures.",
        "Explains the reasoning behind each figure and what it means for the business."
      ),
      crit(
        "Cost structure",
        "125+ words",
        "Itemizes every cost that goes into making one unit of the product or delivering one service.",
        "Costs missing, or not broken down per unit.",
        "125+ words itemizing the per-unit costs.",
        "Every cost is specific and sourced, with nothing left out."
      ),
      crit(
        "Unit cost table",
        "Unit Cost Breakdown",
        "A row for each cost, then the total unit cost, sale price and margin (price minus cost).",
        "Rows missing, or totals wrong.",
        "A correct total unit cost, sale price and margin.",
        "Complete, clearly organized, and matching every other figure."
      ),
      crit(
        "Startup costs and funding",
        "150+ words",
        "Explains what it cost to start the business and where that money came from.",
        "Startup costs vague, or the funding source missing.",
        "Startup costs with a total, and their funding source.",
        "Includes a plan and timeline to recover the investment."
      ),
      crit(
        "Break-even analysis",
        "125+ words",
        "Works out how many sales it takes to cover startup costs (startup costs divided by profit per unit), with the math shown.",
        "Break-even stated without the math, or missing.",
        "Break-even calculated from startup costs and profit per unit.",
        "Explains how realistic break-even is and when it will be reached."
      ),
      crit(
        "Pricing strategy",
        "125+ words",
        "Explains how each price was set and why it works for both the business and the customer.",
        "Prices listed without reasoning.",
        "Explains each price, its margin and its fit with the customer.",
        "Compares with at least two competitors' prices and justifies the strategy."
      ),
      crit(
        "Consistent figures",
        "Whole section",
        "Every figure matches across the spreadsheet, the summary, the unit table and the pricing strategy.",
        "Figures disagree between parts of the section.",
        "Figures are consistent across the section.",
        "Figures are also consistent with the Executive Summary and the rest of the thesis.",
        "Nothing to compare yet."
      ),
    ],
  },

  "marketing-plan": {
    summary:
      "The Marketing Plan explains how the business will reach its customers and turn them into buyers. It builds in order: one clear marketing objective, a specific target audience brought to life by a persona, a brand identity that appeals to that persona, the places the brand will show up, and the content it will post. Each part should follow from the one before; if the persona lives on TikTok but the plan leans on flyers, the plan doesn't make sense. Everything should trace back to the objective.",
    criteria: [
      crit(
        "Marketing objective",
        "Primary Marketing Objective",
        "One specific goal naming who the marketing will reach and what they should do as a result, such as follow, visit, book or buy.",
        "A business goal like \"make money,\" or too vague to guide decisions.",
        "A specific objective naming the audience and the action.",
        "Measurable, with a target and a timeframe."
      ),
      crit(
        "Target audience",
        "Audience description 150+ words, demographics",
        "A focused group, not \"everyone,\" described by age, location, occupation, interests and lifestyle.",
        "\"Everyone,\" or demographic fields missing.",
        "A specific audience with every demographic field filled in, described in 150+ words.",
        "Detailed enough to show exactly where and how to reach them."
      ),
      crit(
        "Customer persona",
        "Persona photo, name, description 100+ words, tech usage",
        "One believable person who represents the audience: name, photo, age, location, story and tech habits.",
        "Persona details missing, or they don't match the audience.",
        "A complete persona consistent with the audience, with a 100+ word description.",
        "Vivid and specific, and it clearly shapes the marketing choices."
      ),
      crit(
        "Logo",
        "Light and dark background versions",
        "Logo versions that work on both light and dark backgrounds.",
        "A version missing, or the logo is hard to read.",
        "Clear logos for light and dark backgrounds.",
        "A professional logo that fits the brand and the audience."
      ),
      crit(
        "Colors and fonts",
        "6 colors with hex codes, 2 fonts",
        "Six colors, each named with its hex code, and a primary and secondary font.",
        "Colors, hex codes or fonts missing.",
        "All six colors with hex codes, and both fonts named.",
        "A cohesive palette and type that suit the audience."
      ),
      crit(
        "Imagery",
        "Imagery guideline, 5 reference images",
        "An imagery guideline and five reference images that show what the brand's visuals should look and feel like.",
        "Guideline vague, or reference images missing.",
        "A specific guideline and five reference images.",
        "Specific enough that someone else could choose on-brand photos from it."
      ),
      crit(
        "Messaging locations",
        "Out-of-home, social media, digital, summary",
        "Out-of-home, social media and digital channels, each with a specific placement and what the viewer should do next, plus a summary of how they work together.",
        "Channels named without specifics.",
        "All three channels described specifically, plus a summary.",
        "Every channel matches where the persona actually spends time."
      ),
      crit(
        "Ad mockups",
        "One mockup per channel",
        "An ad mockup for each channel, shown in its real setting.",
        "Mockups missing or generic.",
        "Three mockups, one for each channel.",
        "Polished, on-brand ads placed in realistic settings."
      ),
      crit(
        "Content strategy",
        "Two strategies 100+ words each, summary 100+ words",
        "Two named content series, each with a theme, platform, posting frequency and goal, plus a summary that ties them to the objective.",
        "Vague ideas without a platform or goal.",
        "Two complete strategies and a summary.",
        "The strategies complement each other and tie back to the objective."
      ),
    ],
  },

  "closing-statement": {
    summary:
      "The Closing Statement is the student's final word to an investor or partner. It should look forward, not back: why this business matters, where it is going, and why the student is the right person to build it. It works best written after the rest of the thesis, so it can draw on the strongest points without repeating them. Encourage a personal voice and a clear final ask.",
    criteria: [
      crit(
        "Vision",
        "Closing Statement",
        "Describes where the business is going, rather than summarizing what came before.",
        "Only repeats earlier sections.",
        "Describes the business's future direction.",
        "A specific, inspiring picture of the next few years."
      ),
      crit(
        "Personal connection",
        "Closing Statement",
        "Explains why the business matters to the student, and why they are the right person to make it succeed.",
        "Impersonal or generic.",
        "Shares why the student cares and why they will make it work.",
        "A genuine, specific personal story that makes the case."
      ),
      crit(
        "Call to action",
        "Closing paragraph",
        "Ends with a clear ask to invest in, support or partner with the business.",
        "No ask, or a vague one.",
        "A clear call to invest, support or partner.",
        "A specific ask tied to a concrete next step."
      ),
      crit(
        "Writing quality",
        "150+ words",
        "At least 150 proofread words in the brand's voice.",
        "Under 150 words, or noticeable errors.",
        "150+ proofread words.",
        "Polished and memorable."
      ),
      crit(
        "Section image",
        "Section background image",
        "A section image that works as a closing shot: the product, the team or the vision.",
        "Missing, or unrelated to the business.",
        "A fitting section image.",
        "A strong, on-brand closing image."
      ),
    ],
  },
}
