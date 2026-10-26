import type { SectionScoring } from "@/lib/rubric-scoring"

/**
 * Life Map scoring rubrics: for each section, the criteria a reviewer scores
 * on a 1–4 scale. Level 3 (Meets expectations) is the bar for complete.
 *
 * Written from the Life Map template: each section's purpose, its groups,
 * and the word minimums, sources and figures its questions ask for.
 * Sections are keyed by their URL slug from titleToSlug in
 * lib/lifemap-sections.ts.
 */
export const LIFE_MAP_SCORING: Record<string, SectionScoring> = {
  overview: {
    criteria: [
      {
        name: "Personal statement",
        covers: "150+ words",
        levels: [
          "Personal statement not submitted.",
          "Under 150 words, or only lists post-graduation plans without saying who the student is.",
          "A 150+ word introduction to the student's values, background, personality and what drives them.",
          "Vivid and specific: real experiences show how the student became who they are and where they are headed.",
        ],
      },
      {
        name: "Personal information",
        covers: "Birth date, graduation date, location, school, program",
        levels: [
          "Personal details not filled in.",
          "Some details missing or incorrect.",
          "Date of birth, expected graduation date, current location, school and program all complete and accurate.",
          "Complete, accurate and consistent with every other section of the Life Map.",
        ],
      },
    ],
  },

  pathway: {
    criteria: [
      {
        name: "Pathway choice and reasoning",
        covers: "Pathway, images, why I chose it (75+ words), other pathways considered",
        levels: [
          "No pathway selected.",
          "A pathway is chosen but the reasoning is vague, or no other options were considered.",
          "A selected pathway with two images, 75+ words on why it was chosen, and at least two other pathways weighed and ruled out.",
          "The reasoning draws on the student's strengths, values and goals, and the comparison with alternatives is honest and specific.",
        ],
      },
      {
        name: "Timeline and requirements",
        covers: "Dates, milestones, entry steps, documents, total cost, sources",
        levels: [
          "Timeline and requirements not filled in.",
          "Dates, milestones or entry steps missing, or the cost estimate is unsupported.",
          "Commitment and start dates, key milestones, entry steps, required documents and an estimated total cost, each with a source.",
          "A realistic, dated plan someone could follow, with deadlines and costs verified from official sources.",
        ],
      },
      {
        name: "Connection to the Life Map",
        covers: "Link to career (100+ words), support, doubters",
        levels: [
          "Connection not explained.",
          "Doesn't name the career or explain how the pathway leads to it; support people missing.",
          "Explains in 100+ words how the pathway leads to the chosen role, names the main supporter, and fairly addresses a doubter.",
          "The bridge from pathway to career is concrete, step by step, and consistent with the Career and Education sections.",
        ],
      },
      {
        name: "Risk and backup plan",
        covers: "Biggest risk (30+ words), Plan B (100+ words)",
        levels: [
          "Risk and backup plan not submitted.",
          "The risk is vague (\"failure\", \"nothing\") or the Plan B is a wish rather than a plan.",
          "Names the single biggest risk honestly and gives a 100+ word Plan B that responds directly to it.",
          "Plan B could start tomorrow: specific steps, people and resources, and how the student would know to switch.",
        ],
      },
    ],
  },

  profile: {
    criteria: [
      {
        name: "Personality and self-knowledge",
        covers: "Assessment, top traits, summaries",
        levels: [
          "Personality section not filled in.",
          "Assessment results listed without reflection, or summaries under their word minimums.",
          "Names the assessment and type, the top two traits, and explains why they fit, with a personality summary grounded in real experience.",
          "Reflection is honest and insightful, linking results to specific life experiences and obstacles.",
        ],
      },
      {
        name: "Values, strengths and growth",
        covers: "4 core values, 4 strengths, 2 areas for growth (50+ words each)",
        levels: [
          "Values and strengths not filled in.",
          "Fewer than four values or strengths, generic one-word answers, or growth areas missing.",
          "Four described core values, four described strengths, and two areas for growth explaining how improving would help.",
          "Values, strengths and growth areas are specific, personal and clearly connected to each other.",
        ],
      },
      {
        name: "Skills and interests",
        covers: "5 hard skills, 5 soft skills, 3 hobbies, 3 subjects",
        levels: [
          "Skills and interests not filled in.",
          "Lists incomplete, or entries are single words without description.",
          "Five hard skills, five soft skills, three hobbies and three subjects, each briefly described.",
          "Each entry gives an example of where the skill or interest shows up, and the set clearly informs the career choice.",
        ],
      },
      {
        name: "Personal goals",
        covers: "Short (200+), medium (400+) and long-term (600+ words)",
        levels: [
          "Goals not submitted.",
          "Goals missing, under their word minimums, or vague with no steps.",
          "Short, medium and long-term goals that explain what, why and the steps to get there, each meeting its word minimum.",
          "The three goals build on each other into one coherent plan with specific, measurable milestones.",
        ],
      },
    ],
  },

  career: {
    criteria: [
      {
        name: "Career path and fit",
        covers: "Role, summary, environment, why this career (200+ words), skills match",
        levels: [
          "Career path not submitted.",
          "The role is named but the summary, environment or reasons are vague or under their minimums.",
          "A specific role with daily work and environment described, 200+ words on why it fits, and how current skills match and what to develop.",
          "The fit is convincing: the reasons tie directly to the student's profile, values and goals.",
        ],
      },
      {
        name: "Industry and labor market research",
        covers: "Industry, outlook, growth, openings, median pay, with sources",
        levels: [
          "Industry research not filled in.",
          "Figures missing or unsourced, or the industry description is generic.",
          "Industry description, future outlook, growth rate, new jobs, annual openings and median pay, each with a credible source.",
          "Uses current official data (such as the BLS) and explains what the numbers mean for the student's prospects.",
        ],
      },
      {
        name: "Training, qualifications and skills",
        covers: "How to become one (100+ words), education, certifications, licenses, key skills",
        levels: [
          "Training and skills not filled in.",
          "The route into the role is unclear, or education, certification or skill lists are incomplete or unsourced.",
          "A step-by-step route from high school into the role, required education and credentials, and key skills, responsibilities and knowledge, with sources.",
          "Requirements are specific to the student's location and match the plan in the Pathway and Education sections.",
        ],
      },
      {
        name: "Employers of interest",
        covers: "3 employers: name, logo, website, why (40+ words)",
        levels: [
          "No employers listed.",
          "Fewer than three employers, or logos, websites or reasons missing.",
          "Three real employers hiring for the role, each with logo, website and 40+ words on why they interest the student.",
          "Reasons are researched and specific to each employer's culture, opportunities and fit with the student's goals.",
        ],
      },
    ],
  },

  education: {
    criteria: [
      {
        name: "School and program choice",
        covers: "School overview, features (150+), why this program (250+), differentiators (250+)",
        levels: [
          "School and program not submitted.",
          "The school is named, but the program, its features or the reasons for choosing it are thin or under their minimums.",
          "School details and photos, key features and special opportunities, and why this program was chosen over others, each meeting its word minimum.",
          "The choice is clearly research-driven, comparing specific features against alternatives the student considered.",
        ],
      },
      {
        name: "Entry requirements and timeline",
        covers: "Application dates, prerequisites, GPA, transcript, tests",
        levels: [
          "Requirements and dates not filled in.",
          "Some requirements, test scores or application dates missing or unsourced.",
          "Application open and deadline dates with a source, prerequisites, GPA, transcript link, test minimums and other requirements.",
          "Shows exactly where the student stands against each requirement and what is still needed.",
        ],
      },
      {
        name: "Cost and financial aid",
        covers: "Annual costs, aid totals, aid info (200+), funds timeline, remaining balance (200+)",
        levels: [
          "Costs and aid not filled in.",
          "Costs or aid incomplete, totals don't add up, or no plan for the remaining balance.",
          "Itemized annual costs, aid by type, how and when funds arrive, how renewals are tracked, and a 200+ word plan to cover the remaining balance.",
          "Figures reconcile exactly, aid is real or applied for, and the plan for the gap is realistic and specific.",
        ],
      },
      {
        name: "Field of study and career connection",
        covers: "Program type, credentials, length, how it meets career goals (200+)",
        levels: [
          "Field of study not filled in.",
          "Program details incomplete, or the connection to the career is unclear.",
          "Program type, completion requirements, credentials and length, and 200+ words on how the program leads to the chosen career.",
          "Ties specific courses, credentials and opportunities to the role's requirements from the Career section.",
        ],
      },
    ],
  },

  transportation: {
    criteria: [
      {
        name: "Transportation plan",
        covers: "Method, how it's used (50+), distance, commute, why (300+ words)",
        levels: [
          "Transportation plan not submitted.",
          "Method chosen, but the reasoning, distance or commute time is missing or under its minimums.",
          "A primary method with how it will be used, distance and commute time, and 300+ words on why it was chosen.",
          "The reasoning weighs cost, reliability and the commute against the student's housing, school and work locations.",
        ],
      },
      {
        name: "Vehicle, license and insurance",
        covers: "Vehicle, license status, insurance quote and source",
        levels: [
          "Vehicle, license and insurance not filled in.",
          "Vehicle, license or insurance details incomplete, or the quote has no source.",
          "Vehicle make, model and image with a source, license type and status, and an insurance provider, coverage and sourced quote.",
          "A real, current quote and listing matched to the student's age, location and budget.",
        ],
      },
      {
        name: "Transportation costs",
        covers: "Monthly and one-time expenses",
        levels: [
          "Costs not filled in.",
          "Some costs missing or totals don't add up.",
          "Monthly costs (insurance, gas, maintenance) and one-time costs (tax, title, license, initial insurance) with correct totals.",
          "Every estimate is sourced and the totals carry through accurately into the Finance budget.",
        ],
      },
    ],
  },

  housing: {
    criteria: [
      {
        name: "Housing choice",
        covers: "Housing details and photos, why I chose it (300+ words)",
        levels: [
          "Housing choice not submitted.",
          "Housing named, but details are missing or the reasoning is under 300 words.",
          "Housing type, address, floor plan link, rooms, distance, roommates and photos, with 300+ words on why it was chosen.",
          "The choice is clearly weighed against cost, location, safety and the student's routine.",
        ],
      },
      {
        name: "Alternatives and fit",
        covers: "Alternative considered (225+), how it meets my needs (300+)",
        levels: [
          "Alternatives and needs not addressed.",
          "No real alternative, or needs described generally rather than specifically.",
          "At least one alternative explained and ruled out (225+ words), and 300+ words on how the choice meets practical and personal needs.",
          "Honest trade-offs: shows what the student gave up and why the choice still fits best.",
        ],
      },
      {
        name: "Housing costs",
        covers: "Rent, deposit, utilities, internet, move-in date, lease",
        levels: [
          "Housing costs not filled in.",
          "Some costs missing or not realistic for the location.",
          "Monthly rent, deposit, utilities and internet, with move-in date and lease term.",
          "Costs come from a real listing and carry through accurately into the Finance budget.",
        ],
      },
    ],
  },

  finance: {
    criteria: [
      {
        name: "Savings goals",
        covers: "12-month goals (100+), savings total, target amount and date",
        levels: [
          "Savings goals not submitted.",
          "Goals are vague, or no target amount and date.",
          "12-month savings goals in 100+ words, current savings, what the savings are for, and an exact target amount and date.",
          "Goals are specific and achievable, with monthly amounts that match the budget.",
        ],
      },
      {
        name: "Monthly budget",
        covers: "Budget sheet link, written summary (200+ words)",
        levels: [
          "No budget sheet or summary.",
          "Sheet missing or not viewable, or the summary lists numbers without explaining them.",
          "A viewable budget sheet and a 200+ word summary of income, expenses, one-time costs and whether it ends in surplus or deficit.",
          "The budget uses the real figures from Housing, Transportation and Education, and every gap has a plan.",
        ],
      },
      {
        name: "Income",
        covers: "Employer, position, type, W-4, wage, source",
        levels: [
          "Income not filled in.",
          "Employer, position or wage missing or unrealistic.",
          "Employer, position, employment type, W-4 choice and hourly wage, with an application or careers page link.",
          "Income is realistic for the role and location and supports the budget.",
        ],
      },
      {
        name: "Financial habits and support",
        covers: "Purpose of budgeting, challenges, trade-offs, support system (150+)",
        levels: [
          "Reflections not submitted.",
          "Reflections are generic or under their word minimums.",
          "Explains why budgeting matters, expected challenges and largest expense, how needs and wants will be separated, and a 150+ word support system.",
          "Specific tools, habits and people the student will actually use, tied to their own budget.",
        ],
      },
    ],
  },

  contact: {
    criteria: [
      {
        name: "Personal contact and resume",
        covers: "Personal email, phone, address, resume link",
        levels: [
          "Contact details not filled in.",
          "Uses a school email, or details or the resume link are missing.",
          "Personal email (not SFA), phone, address and a viewable resume link.",
          "A professional email address and a polished, current resume.",
        ],
      },
      {
        name: "References",
        covers: "Employer reference and academic reference",
        levels: [
          "No references listed.",
          "Only one reference, or names, contact details or websites missing.",
          "An employer reference with company, website, phone and email, and an academic reference with position, phone and email.",
          "References are people the student has a strong relationship with and has asked permission to list.",
        ],
      },
      {
        name: "Professional presence",
        covers: "LinkedIn profile",
        levels: [
          "No LinkedIn profile.",
          "Profile link missing or the profile is mostly empty.",
          "A LinkedIn profile with photo, headline, education and experience.",
          "A complete profile that matches the resume and shows the student's chosen career path.",
        ],
      },
    ],
  },
}
