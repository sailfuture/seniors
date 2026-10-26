import type { SectionScoring } from "@/lib/rubric-scoring"

/**
 * Life Map scoring rubrics: for each section, a summary of what it must
 * accomplish, then criteria scored on a 1–4 scale, each with a short
 * paragraph on what success looks like and level descriptions. Level 3 (Meets
 * expectations) is the bar for complete.
 *
 * Written from the Life Map template: each section's purpose, its groups,
 * and the word minimums, sources and figures its questions ask for.
 * Sections are keyed by their URL slug from titleToSlug in
 * lib/lifemap-sections.ts.
 */
export const LIFE_MAP_SCORING: Record<string, SectionScoring> = {
  overview: {
    summary:
      "The Overview introduces the student before any of the plan. A reader should finish the personal statement knowing who the student is, what shaped them and what drives them, which makes every later section more convincing. It is best revised near the end, once the pathway and career are settled, so the statement points toward them. The personal details appear on the public page, so they must be accurate.",
    criteria: [
      {
        name: "Personal statement",
        covers: "150+ words",
        expectations:
          "The personal statement introduces who the student is before what they plan to do. It names their values and qualities and shows them through a specific experience or story, then connects to where they are headed, in at least 150 words.",
        levels: [
          "Personal statement not submitted.",
          "Under 150 words, or only lists post-graduation plans or traits without saying who the student is.",
          "A 150+ word introduction to the student's values, background, personality and what drives them, with a real example.",
          "Vivid and specific: real experiences show how the student became who they are and where they are headed.",
        ],
      },
      {
        name: "Personal information",
        covers: "Birth date, graduation date, location, school, program",
        expectations:
          "Every detail is correct and complete: date of birth, expected graduation date, current city and state, and the current school and program named in full.",
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
    summary:
      "Selected Pathway is the plan for the first step after graduation: college, trade school, certification, military, apprenticeship or work. It should show the choice was deliberate (other options were weighed), practical (dates, steps, paperwork and cost are known), connected (it leads to the role in the Career section) and resilient (there is a real Plan B). A strong section is one someone else could follow to get the student started.",
    criteria: [
      {
        name: "Pathway choice and reasoning",
        covers: "Pathway, images, why I chose it (75+ words), other pathways considered",
        expectations:
          "The chosen pathway is supported by two images of the actual program, base or workplace and at least 75 words on why it was chosen. At least two other options are described along with why they were ruled out, which shows the choice was deliberate.",
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
        expectations:
          "The timeline runs from the commitment date to the target start date, with milestones in order and deadlines attached. Entry steps, required documents and an estimated total cost are listed, each with a source, so someone else could follow the plan.",
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
        expectations:
          "The pathway clearly leads to the exact role named in the Career section, explained step by step in at least 100 words. The person who supports the student most is named, and a doubter's concern is described fairly along with how the student is handling it.",
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
        expectations:
          "One specific, honest risk is named (\"failure\" or \"nothing\" don't count), and the Plan B responds directly to it. Plan B is a real plan that could start right away, naming the people and resources involved.",
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
    summary:
      "Personal Profile is the student's self-knowledge: personality, values, strengths, skills, interests and goals. It is the evidence base for every choice later in the Life Map, so the career and pathway should make sense given what is written here. Push for specifics and examples over single-word answers, and check that the goals at the end build on each other.",
    criteria: [
      {
        name: "Personality and self-knowledge",
        covers: "Assessment, top traits, summaries",
        expectations:
          "The assessment name, personality type and top two traits are listed, with an explanation of why they fit using real examples. The personality summary draws on the student's own experiences, not just the test results.",
        levels: [
          "Personality section not filled in.",
          "Results listed without reflection, or summaries under their word minimums.",
          "Names the assessment and type and the top two traits, explains why they fit, and summarizes personality from real experience.",
          "Honest, insightful reflection linking the results to specific experiences and obstacles.",
        ],
      },
      {
        name: "Values, strengths and growth",
        covers: "4 core values, 4 strengths, 2 areas for growth (50+ words each)",
        expectations:
          "Four core values and four strengths are each described in the student's own words, ideally with an example of each in action. Two areas for growth, at least 50 words each, are honest and include a concrete way to improve.",
        levels: [
          "Values and strengths not filled in.",
          "Fewer than four values or strengths, one-word answers, or growth areas missing.",
          "Four described core values, four described strengths, and two areas for growth explaining how improving would help.",
          "Specific and personal, with values, strengths and growth areas clearly connected to each other.",
        ],
      },
      {
        name: "Skills and interests",
        covers: "5 hard skills, 5 soft skills, 3 hobbies, 3 subjects",
        expectations:
          "Five hard skills (things the student can do, such as tools, software or trades), five soft skills (how they work with people), three hobbies and three favorite subjects are each briefly described, including where each one shows up.",
        levels: [
          "Skills and interests not filled in.",
          "Lists incomplete, or single words without description.",
          "Five hard skills, five soft skills, three hobbies and three subjects, each briefly described.",
          "Each entry gives an example of where it shows up, and the set clearly informs the career choice.",
        ],
      },
      {
        name: "Personal goals",
        covers: "Short (200+), medium (400+) and long-term (600+ words)",
        expectations:
          "Short, medium and long-term goals each meet their word minimum (200, 400 and 600) and explain what the goal is, why it matters and the steps to reach it. The goals build on each other and match the pathway and career elsewhere in the Life Map.",
        levels: [
          "Goals not submitted.",
          "Goals missing, under their word minimums, or vague with no steps.",
          "Short, medium and long-term goals that explain what, why and the steps to get there, each meeting its word minimum.",
          "The three goals form one coherent plan with specific, measurable milestones.",
        ],
      },
    ],
  },

  career: {
    summary:
      "Career names the specific role the student is aiming for and proves they understand it: what the work is, why it fits them, what the job market looks like, how to qualify, what skills it takes and where they could work. Labor-market figures should come from credible sources such as the Bureau of Labor Statistics. This section anchors the rest of the plan; the pathway and education choices should both lead here.",
    criteria: [
      {
        name: "Career path and fit",
        covers: "Role, summary, environment, why this career (200+ words), skills match",
        expectations:
          "A specific role title is named, not just a field, with a clear picture of the daily work and work environment. At least 200 words explain why it fits the student's values, strengths and interests, along with the skills they already have and the ones they still need to develop.",
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
        expectations:
          "Industry description, future outlook, growth rate, new jobs, annual openings, and median annual and hourly pay are all included, each with a credible source. The Bureau of Labor Statistics Occupational Outlook Handbook is a strong starting point.",
        levels: [
          "Industry research not filled in.",
          "Figures missing or unsourced, or the industry description is generic.",
          "Industry description, future outlook, growth rate, new jobs, annual openings and median pay, each with a credible source.",
          "Uses current official data and explains what the numbers mean for the student's prospects.",
        ],
      },
      {
        name: "Training, qualifications and skills",
        covers: "How to become one (100+ words), education, certifications, licenses, key skills",
        expectations:
          "The route into the role is traced step by step from high school to the first day on the job, in at least 100 words. Required education, certifications and licenses are listed with sources, along with four key skills, four key responsibilities and the key knowledge the role needs, all consistent with the Pathway and Education sections.",
        levels: [
          "Training and skills not filled in.",
          "The route into the role is unclear, or education, certification or skill lists are incomplete or unsourced.",
          "A step-by-step route into the role, required education and credentials, and key skills, responsibilities and knowledge, with sources.",
          "Requirements are specific to the student's location and match the Pathway and Education sections.",
        ],
      },
      {
        name: "Employers of interest",
        covers: "3 employers: name, logo, website, why (40+ words)",
        expectations:
          "Three real employers that hire for the role, ideally near where the student plans to live, are listed with logo and website. At least 40 words for each explain why that employer in particular interests the student.",
        levels: [
          "No employers listed.",
          "Fewer than three employers, or logos, websites or reasons missing.",
          "Three real employers hiring for the role, each with logo, website and 40+ words on why they interest the student.",
          "Reasons are researched and specific to each employer's culture, opportunities and fit.",
        ],
      },
    ],
  },

  education: {
    summary:
      "Education lays out the plan at the chosen school or program: why this one, how to get in, what it costs and how it will be paid for, and how it leads to the career. The finances are what students most often get wrong; costs, aid and the remaining balance must add up. A strong section shows the student researched the program in depth and has a realistic plan to pay for it.",
    criteria: [
      {
        name: "School and program choice",
        covers: "School overview, features (150+), why this program (250+), differentiators (250+)",
        expectations:
          "School name, location, website and photos are included, with the program's key features and special opportunities. At least 250 words explain why this program was chosen over the alternatives, and the differentiators point to specifics such as a lab, internship, certification or job placement rate.",
        levels: [
          "School and program not submitted.",
          "The school is named, but the program, its features or the reasons for choosing it are thin or under their minimums.",
          "School details and photos, key features and special opportunities, and why this program was chosen over others, each at its word minimum.",
          "Clearly research-driven, comparing specific features against alternatives the student considered.",
        ],
      },
      {
        name: "Entry requirements and timeline",
        covers: "Application dates, prerequisites, GPA, transcript, tests",
        expectations:
          "Application open and deadline dates are listed with a source, along with prerequisites, test minimums, other requirements, the student's current GPA and a transcript link. It is clear where the student stands against each requirement.",
        levels: [
          "Requirements and dates not filled in.",
          "Some requirements, test scores or application dates missing or unsourced.",
          "Application dates with a source, prerequisites, GPA, transcript link, test minimums and other requirements.",
          "Shows exactly where the student stands against each requirement and what is still needed.",
        ],
      },
      {
        name: "Cost and financial aid",
        covers: "Annual costs, aid totals, aid info (200+), funds timeline, remaining balance (200+)",
        expectations:
          "Annual costs are itemized and add up to the total, and aid is listed by type: grants, scholarships and loans. The section explains how and when funds arrive and how renewal rules will be tracked, then shows the remaining balance and a plan of at least 200 words to cover it.",
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
        expectations:
          "Program type, field, length, completion requirements and credentials earned are listed. At least 200 words explain how the program leads to the role in the Career section, ideally naming the credential employers will look for.",
        levels: [
          "Field of study not filled in.",
          "Program details incomplete, or the connection to the career is unclear.",
          "Program type, completion requirements, credentials and length, and 200+ words on how the program leads to the chosen career.",
          "Ties specific courses, credentials and opportunities to the role's requirements in the Career section.",
        ],
      },
    ],
  },

  transportation: {
    summary:
      "Transportation shows how the student will reliably get to work, school and daily responsibilities after graduation, and what it will cost. The method should fit the distances involved and the student's budget. Costs must come from real quotes and listings, and carry into the Finance budget.",
    criteria: [
      {
        name: "Transportation plan",
        covers: "Method, how it's used (50+), distance, commute, why (300+ words)",
        expectations:
          "A primary transportation method is chosen, with the distance and commute time between the student's actual housing and school or work. It explains how the method will be used day to day and, in at least 300 words, why it was chosen over other options.",
        levels: [
          "Transportation plan not submitted.",
          "Method chosen, but the reasoning, distance or commute time is missing or under its minimums.",
          "A primary method with how it will be used, distance and commute time, and 300+ words on why it was chosen.",
          "Weighs cost, reliability and the commute against the student's housing, school and work locations.",
        ],
      },
      {
        name: "Vehicle, license and insurance",
        covers: "Vehicle, license status, insurance quote and source",
        expectations:
          "Vehicle make, model and image are included with a real listing, plus license type, status and expiry. Insurance shows the provider, coverage type and a real quote for the student's age and ZIP code, with monthly and upfront cost.",
        levels: [
          "Vehicle, license and insurance not filled in.",
          "Vehicle, license or insurance details incomplete, or the quote has no source.",
          "Vehicle details with a listing, license type and status, and an insurance provider, coverage and sourced quote.",
          "A real, current quote and listing matched to the student's age, location and budget.",
        ],
      },
      {
        name: "Transportation costs",
        covers: "Monthly and one-time expenses",
        expectations:
          "Monthly costs (insurance, gas, maintenance) and one-time costs (tax, title, license, initial insurance) are listed with correct totals, and the same totals appear in the Finance budget.",
        levels: [
          "Costs not filled in.",
          "Some costs missing or totals don't add up.",
          "Monthly and one-time costs with correct totals.",
          "Every estimate is sourced and the totals carry into the Finance budget accurately.",
        ],
      },
    ],
  },

  housing: {
    summary:
      "Housing shows the student can find and afford a realistic place to live. It covers the chosen home, why it was chosen over alternatives, how it meets daily needs, and every cost involved. Costs should come from a real listing and match the Finance budget, and the location should make sense with the school, work and transportation plans.",
    criteria: [
      {
        name: "Housing choice",
        covers: "Housing details and photos, why I chose it (300+ words)",
        expectations:
          "The chosen home is backed by a real listing: housing type, full address, floor plan or listing link, photos, rooms, distance to school or work, and roommates. At least 300 words explain why it was chosen, going beyond appearance to cost, location and safety.",
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
        expectations:
          "At least one real alternative is described in 225+ words along with why it was ruled out. A further 300+ words explain how the chosen home meets the student's practical and personal needs, including any honest trade-offs.",
        levels: [
          "Alternatives and needs not addressed.",
          "No real alternative, or needs described generally rather than specifically.",
          "At least one alternative explained and ruled out, and 300+ words on how the choice meets practical and personal needs.",
          "Honest trade-offs: shows what the student gave up and why the choice still fits best.",
        ],
      },
      {
        name: "Housing costs",
        covers: "Rent, deposit, utilities, internet, move-in date, lease",
        expectations:
          "Monthly rent, utilities and internet, the deposit, move-in date and lease term are all listed from the actual listing, and the monthly total appears unchanged in the Finance budget.",
        levels: [
          "Housing costs not filled in.",
          "Some costs missing or not realistic for the location.",
          "Monthly rent, deposit, utilities and internet, with move-in date and lease term.",
          "Costs come from a real listing and carry into the Finance budget accurately.",
        ],
      },
    ],
  },

  finance: {
    summary:
      "Finance brings the whole Life Map together into a working budget. Income from the planned job must cover housing, transportation, education and living costs, with savings on top. The numbers from earlier sections should appear here unchanged. A strong section shows the student understands their money, has a realistic plan to save, and knows where to turn for help.",
    criteria: [
      {
        name: "Savings goals",
        covers: "12-month goals (100+), savings total, target amount and date",
        expectations:
          "Savings goals for the next 12 months are described in at least 100 words, along with current savings, what the savings are for, and an exact target amount and date. The target works out to a monthly amount that appears in the budget.",
        levels: [
          "Savings goals not submitted.",
          "Goals are vague, or no target amount and date.",
          "12-month goals in 100+ words, current savings, what they are for, and an exact target amount and date.",
          "Specific, achievable goals with monthly amounts that match the budget.",
        ],
      },
      {
        name: "Monthly budget",
        covers: "Budget sheet link, written summary (200+ words)",
        expectations:
          "The budget spreadsheet is linked and opens for anyone with the link. The 200+ word summary explains income, expenses and one-time costs, says whether the budget ends in a surplus or deficit and what that means, and uses the same costs as the Housing, Transportation and Education sections.",
        levels: [
          "No budget sheet or summary.",
          "Sheet missing or not viewable, or the summary lists numbers without explaining them.",
          "A viewable budget sheet and a 200+ word summary of income, expenses, one-time costs and whether it ends in surplus or deficit.",
          "Uses the real figures from Housing, Transportation and Education, and every gap has a plan.",
        ],
      },
      {
        name: "Income",
        covers: "Employer, position, type, W-4, wage, source",
        expectations:
          "Employer, position, employment type, W-4 choice and hourly wage are listed, with a link to the application or careers page. The wage is what this employer actually pays for the position, and it is enough to support the budget.",
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
        expectations:
          "The student explains why budgeting matters to them, the challenges they expect and their largest expense, and how they will separate needs from wants, naming the method or app they will use. A support system of at least 150 words names the people and resources they would turn to for advice or in a money emergency.",
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
    summary:
      "Contact is the student's professional network: how to reach them, a resume, references and a LinkedIn profile. Everything should be professional and current, and references should be people who have agreed to vouch for the student.",
    criteria: [
      {
        name: "Personal contact and resume",
        covers: "Personal email, phone, address, resume link",
        expectations:
          "A personal email (not an SFA address), phone number and current address are listed, along with a resume link that opens for anyone.",
        levels: [
          "Contact details not filled in.",
          "Uses a school email, or details or the resume link are missing.",
          "Personal email, phone, address and a viewable resume link.",
          "A professional email address and a polished, current resume.",
        ],
      },
      {
        name: "References",
        covers: "Employer reference and academic reference",
        expectations:
          "An employer reference (with company, website, phone and email) and an academic reference (with position, phone and email) are listed, and both have agreed to be named.",
        levels: [
          "No references listed.",
          "Only one reference, or names, contact details or websites missing.",
          "An employer reference with company, website, phone and email, and an academic reference with position, phone and email.",
          "References are people the student knows well and has asked permission to list.",
        ],
      },
      {
        name: "Professional presence",
        covers: "LinkedIn profile",
        expectations:
          "The LinkedIn profile is linked and filled in, with a photo, headline, education and experience that match the resume.",
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
