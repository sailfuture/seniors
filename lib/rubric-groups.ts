/**
 * Which template groups each scoring criterion is about, so a group's
 * "Criteria" button can show just the rows of the Section Rubric that score
 * that group. Keyed by section slug, then criterion name (as written in
 * lib/rubric-scoring.ts / lib/rubric-scoring-lifemap.ts), to the group ids
 * from the template's custom-group table. UNGROUPED stands for the questions
 * in a section that sit in no group.
 *
 * Group ids, not names, so renaming a group in the template doesn't break the
 * link. A new group or criterion needs a line here; until then a criterion
 * with no line still shows on the Section Rubric, just under no group.
 */
import type { SectionScoring } from "@/lib/rubric-scoring"

/** The questions in a section that sit in no group. */
export const UNGROUPED = 0

type GroupMap = Record<string, Record<string, number[]>>

export const BUSINESS_THESIS_CRITERIA_GROUPS: GroupMap = {
  "executive-summary": {
    "Business overview": [21],
    "Problem and solution": [21],
    "Market opportunity": [21],
    "Competitive advantage": [21],
    "Financial viability": [21],
    "Vision and ask": [21],
    "Writing quality": [21],
    "Company information": [10],
    "Visual presentation": [21],
  },
  "product-and-service": {
    "Problem statement": [36],
    "Problem evidence": [36],
    Sources: [36],
    "Solution overview": [36],
    "Unique value proposition": [36],
    "Products and services": [22],
    "Prototype process": [18],
    "Prototype photos": [18],
  },
  "market-analysis": {
    "Industry definition": [31],
    "The business's niche": [31],
    "Market size": [31],
    "Market growth": [31],
    "Current trends": [31],
    "Trend impact": [31],
    "Research and sources": [31],
  },
  "competitive-analysis": {
    "Competitor selection": [23],
    "Names and logos": [23],
    "Axis choice": [23],
    "Competitor scores": [23],
    "Positioning evidence": [23],
    "Own position": [23],
  },
  "financial-plan": {
    "Budget spreadsheet": [19],
    "Budget summary": [19],
    "Cost structure": [19],
    "Unit cost table": [40],
    "Startup costs and funding": [20],
    "Break-even analysis": [20],
    "Pricing strategy": [20],
    "Consistent figures": [19, 40, 20],
  },
  "marketing-plan": {
    "Marketing objective": [24],
    "Target audience": [27],
    "Customer persona": [35],
    Logo: [38],
    "Colors and fonts": [28, 39],
    Imagery: [37],
    "Messaging locations": [41, 42, 43, 44],
    "Ad mockups": [42, 43, 44],
    "Content strategy": [25],
  },
  "closing-statement": {
    Vision: [UNGROUPED],
    "Personal connection": [UNGROUPED],
    "Call to action": [UNGROUPED],
    "Writing quality": [UNGROUPED],
    "Section image": [UNGROUPED],
  },
}

export const LIFE_MAP_CRITERIA_GROUPS: GroupMap = {
  overview: {
    "Who the student is": [64],
    "Values and qualities": [64],
    "Personal story": [64],
    Direction: [64],
    "Writing quality": [64],
    "Personal information": [66],
  },
  pathway: {
    "Pathway choice": [63],
    Reasoning: [63],
    "Alternatives considered": [76],
    "Timeline and milestones": [74],
    "Entry steps and documents": [74],
    "Cost estimate": [74],
    "Connection to career": [75],
    "Support system": [75],
    "Biggest risk": [76],
    "Backup plan": [76],
  },
  profile: {
    "Personality assessment": [51],
    "Personality summary": [51],
    "Core values": [52],
    "Personal strengths": [52],
    "Areas for growth": [52],
    Skills: [53],
    Interests: [53],
    "Short-term goal": [54],
    "Medium-term goal": [54],
    "Long-term goal": [54],
  },
  career: {
    "Role and daily work": [55],
    "Why this career": [56],
    "Skills match and gaps": [56],
    "Work preferences": [61],
    "Industry and outlook": [57],
    "Labor market figures": [57],
    "Path into the role": [59],
    "Education and credentials": [59],
    "Skills, responsibilities and knowledge": [60],
    "Employers of interest": [71, 72, 73],
  },
  education: {
    "School overview": [23, 30],
    "Program features and opportunities": [30],
    "Why this program": [30],
    Differentiators: [30],
    "Application timeline": [24],
    "Entry requirements": [31, 32],
    "Program costs": [25],
    "Financial aid": [34],
    "Funds timeline and renewals": [77],
    "Remaining balance plan": [35],
    "Field of study and credentials": [27],
    "Connection to career": [36],
  },
  transportation: {
    "Method and daily use": [4],
    "Distance and commute": [4],
    "Why this method": [4],
    "Vehicle and license": [7],
    Insurance: [6],
    "Monthly costs": [20],
    "One-time costs": [20],
  },
  housing: {
    "Housing details": [37],
    "Location fit": [37],
    "Why this housing": [38],
    "Alternative considered": [69],
    "Meeting needs": [70],
    "Monthly costs": [39],
    "Move-in and lease": [39],
  },
  finance: {
    "Savings goals": [45],
    "Savings target": [45],
    "Budget spreadsheet": [19],
    "Budget summary": [19],
    Income: [42],
    "Purpose of budgeting": [46],
    "Challenges and largest expense": [48],
    "Spending decisions": [48],
    "Support system": [49],
    "Consistent figures": [45, 19, 46, 48, 42, 49],
  },
  contact: {
    "Personal contact": [65],
    Resume: [65],
    "Employer reference": [8],
    "Academic reference": [67],
    LinkedIn: [68],
  },
}

/** A copy of the scoring tables with each criterion's group ids filled in. */
export function withCriteriaGroups(
  scoring: Record<string, SectionScoring>,
  groups: GroupMap
): Record<string, SectionScoring> {
  return Object.fromEntries(
    Object.entries(scoring).map(([slug, section]) => [
      slug,
      {
        ...section,
        criteria: section.criteria.map((c) => {
          const ids = groups[slug]?.[c.name]
          return ids ? { ...c, groups: ids } : c
        }),
      },
    ])
  )
}

/** The rows of a section's scoring that are about one group (null = ungrouped). */
export function criteriaForGroup(scoring: SectionScoring, groupId: number | null): SectionScoring {
  const id = groupId ?? UNGROUPED
  return { criteria: scoring.criteria.filter((c) => c.groups?.includes(id)) }
}
