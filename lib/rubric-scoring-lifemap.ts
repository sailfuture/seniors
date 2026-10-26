import type { SectionScoring } from "@/lib/rubric-scoring"

/**
 * Life Map scoring rubrics: for each section, a summary of what it must
 * accomplish, then criteria scored on a 1–4 scale with things to look for,
 * coaching notes for advisors and level descriptions. Level 3 (Meets
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
        coaching:
          "Ask the student to tell you about a moment that changed how they see themselves; that story is often the heart of the statement. Help them move from listing traits to showing them in action.",
        lookFor: [
          "Opens with who the student is, not what they plan to do",
          "Includes a specific experience or story",
          "Names values or qualities and shows them in action",
          "Connects to where the student is headed",
          "150+ words",
        ],
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
        coaching: "Check each field against school records. Small errors here undermine the whole document.",
        lookFor: [
          "Date of birth and expected graduation date are correct",
          "Current city and state",
          "Current school and program named in full",
        ],
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
        coaching:
          "Ask what else the student considered and why they ruled it out; a choice made without alternatives isn't really a choice. Images should show the actual program, base or workplace.",
        lookFor: [
          "A pathway selected",
          "Two images of the actual pathway",
          "Why it was chosen, in 75+ words",
          "At least two alternatives and why they were ruled out",
        ],
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
        coaching:
          "Build the timeline backward from the start date with the student. For each step, ask how they will know it's done and where they found the requirement.",
        lookFor: [
          "Commitment date and target start date",
          "Milestones in order, with deadlines",
          "Entry steps and required documents listed",
          "Total cost estimated, with sources",
        ],
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
        coaching:
          "The pathway must lead to the role named in the Career section. Ask the student to describe each step from the first day of the pathway to the first day of the job.",
        lookFor: [
          "Names the exact career role and the pathway",
          "Explains how one leads to the other, in 100+ words",
          "Names the person who supports them most",
          "Addresses a doubter fairly",
        ],
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
        coaching:
          "Ask: what is the one thing most likely to stop this plan? Then: if it happens, what would you do the next day? That answer is Plan B.",
        lookFor: [
          "One specific, honest risk",
          "Plan B responds directly to that risk",
          "Plan B could start right away",
          "Names the people or resources involved",
        ],
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
        coaching:
          "Look at the assessment results with the student and ask which parts feel true and which don't. Their reasoning matters more than the label.",
        lookFor: [
          "Assessment name and personality type",
          "Top two traits from the results",
          "Why the type fits, with examples",
          "A personality summary drawn from real experience",
        ],
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
        coaching:
          "Ask for an example of each value or strength in action. Growth areas should be honest and paired with a concrete step to improve.",
        lookFor: [
          "Four core values, each described",
          "Four personal strengths, each described",
          "Two areas for growth, each 50+ words",
          "Each growth area includes a way to improve",
        ],
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
        coaching:
          "Hard skills are things the student can do (tools, software, trades); soft skills are how they work with people. Ask where each was learned or used.",
        lookFor: [
          "Five hard skills and five soft skills, each described",
          "Three hobbies and three favorite subjects",
          "Each entry says where it shows up",
        ],
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
        coaching:
          "Check that the three goals line up: the short-term goal should be a step toward the medium-term goal, which leads to the long-term one. Ask for steps and dates.",
        lookFor: [
          "Short, medium and long-term goals, each at its word minimum",
          "Each says what, why and the steps to get there",
          "The goals build on each other",
          "Goals match the pathway and career",
        ],
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
        coaching:
          "Ask the student to describe a normal workday in the role. If they can't, they need more research. The \"why\" should connect to their profile: values, strengths and interests.",
        lookFor: [
          "A specific role title, not just a field",
          "What the work involves day to day",
          "Why it fits the student, in 200+ words",
          "Skills they have and skills still to develop",
        ],
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
        coaching:
          "Start the student on the Bureau of Labor Statistics Occupational Outlook Handbook page for their role; most of these figures are there. Ask what the numbers mean for them personally.",
        lookFor: [
          "Industry description and future outlook",
          "Growth rate, new jobs and annual openings",
          "Median annual and hourly pay",
          "A credible source for each figure",
        ],
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
        coaching:
          "Have the student trace the route from high school to the first day on the job, step by step. Each requirement should come from a real source and match the Pathway and Education plans.",
        lookFor: [
          "Step-by-step route into the role, 100+ words",
          "Required education, certifications and licenses",
          "Four key skills and four key responsibilities",
          "Sources for each requirement",
        ],
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
        coaching:
          "Ask the student to find real employers hiring for the role near where they plan to live. The \"why\" should mention something specific to each employer.",
        lookFor: [
          "Three real employers hiring for the role",
          "Logo and website for each",
          "40+ words on why each one",
          "Reasons specific to each employer",
        ],
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
        coaching:
          "Ask what this program offers that the others they looked at don't. The answer should be specific: a lab, an internship, a certification, a job placement rate.",
        lookFor: [
          "School name, location, website and photos",
          "Key program features and special opportunities",
          "Why this program over others, 250+ words",
          "What makes it different, with specifics",
        ],
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
        coaching:
          "Have the student list each admission requirement next to where they stand today. Anything not yet met becomes a milestone in the Pathway timeline.",
        lookFor: [
          "Application open and deadline dates, with a source",
          "Prerequisites and test minimums",
          "Current GPA and a transcript link",
          "Other application requirements",
        ],
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
        coaching:
          "Do the math together: total annual cost minus total aid equals the remaining balance. Then ask how each dollar of that balance will be covered, and what each scholarship requires to renew.",
        lookFor: [
          "Itemized annual costs that add up to the total",
          "Aid by type (grants, scholarships, loans)",
          "How and when funds arrive, and renewal rules",
          "Remaining balance and a 200+ word plan to cover it",
        ],
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
        coaching:
          "Ask the student which credential from this program the employer in their Career section will look for. That link is the heart of this criterion.",
        lookFor: [
          "Program type, field and length",
          "Completion requirements and credentials earned",
          "How the program leads to the career, 200+ words",
        ],
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
        coaching:
          "Map the commute with the student using the actual housing and school or work addresses. Ask what happens if the main method fails for a day.",
        lookFor: [
          "A primary method chosen",
          "Distance and commute time from home",
          "How it will be used day to day",
          "Why it was chosen, 300+ words",
        ],
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
        coaching:
          "Have the student get a real insurance quote for their age and ZIP code and find an actual vehicle listing in their budget. Check license status and expiry.",
        lookFor: [
          "Vehicle make, model and image, with a listing",
          "License type, status and expiry",
          "Insurance provider and coverage type",
          "A real quote with monthly and upfront cost",
        ],
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
        coaching: "Check the totals add up, then check they appear unchanged in the Finance budget.",
        lookFor: [
          "Monthly costs: insurance, gas, maintenance",
          "One-time costs: tax, title, license, initial insurance",
          "Correct totals",
        ],
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
        coaching:
          "Ask the student to show you the actual listing. Check the address, rooms and distance, and that the reasons go beyond \"it looks nice\" to cost, location and safety.",
        lookFor: [
          "Housing type and full address",
          "Floor plan or listing link and photos",
          "Rooms, distance and roommates",
          "Why it was chosen, 300+ words",
        ],
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
        coaching:
          "Ask what the student gave up by choosing this home. A good answer names real trade-offs and still explains why it fits best.",
        lookFor: [
          "At least one real alternative, 225+ words",
          "Why the alternative was ruled out",
          "How the choice meets practical and personal needs, 300+ words",
        ],
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
        coaching: "Check each cost against the listing, then check the monthly total appears unchanged in the Finance budget.",
        lookFor: [
          "Monthly rent, utilities and internet",
          "Deposit",
          "Move-in date and lease term",
        ],
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
        coaching:
          "Turn the savings target into a monthly amount together, then check that amount appears in the budget.",
        lookFor: [
          "12-month savings goals, 100+ words",
          "Current savings and what they are for",
          "An exact target amount and date",
        ],
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
        coaching:
          "Open the budget sheet together and check it is viewable by link. Read the summary against it, and check the housing, transportation and education costs match their sections.",
        lookFor: [
          "Budget sheet link opens without a sign-in",
          "Income, expenses and one-time costs explained",
          "Ends in a surplus or deficit, with what that means",
          "Costs match the Housing, Transportation and Education sections",
        ],
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
        coaching:
          "The wage should be what this employer actually pays for this position; check the careers page. Then check income times hours covers the budget.",
        lookFor: [
          "Employer and position",
          "Employment type and W-4 choice",
          "Hourly wage",
          "An application or careers page link",
        ],
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
        coaching:
          "Ask which app or method the student will actually use to track spending, and who they would call in a money emergency.",
        lookFor: [
          "Why budgeting matters to them",
          "Expected challenges and largest expense",
          "How they will separate needs from wants",
          "A support system, 150+ words",
        ],
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
        coaching: "Check the email isn't a school address and the resume link opens without a sign-in.",
        lookFor: [
          "Personal email (not SFA)",
          "Phone and current address",
          "Resume link that opens for anyone",
        ],
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
        coaching: "Confirm the student has asked each reference for permission before listing them.",
        lookFor: [
          "An employer reference with company, website, phone and email",
          "An academic reference with position, phone and email",
          "Both have agreed to be listed",
        ],
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
        coaching: "Sit with the student and fill in any empty LinkedIn sections using their resume.",
        lookFor: ["LinkedIn link", "Photo and headline", "Education and experience filled in"],
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
