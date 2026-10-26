import { crit, type SectionScoring } from "@/lib/rubric-scoring"

/**
 * Life Map scoring rubrics: for each section, a summary of what it must
 * accomplish, then one row per key objective scored on four levels, each
 * with a short paragraph on what success looks like. Meets expectations on
 * every row is the bar for complete.
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
      crit(
        "Who the student is",
        "Personal Statement",
        "The statement opens with who the student is as a person, not just what they plan to do after graduation.",
        "Opens with plans or a list of facts rather than the person.",
        "Introduces the student's personality and background from the start.",
        "A vivid opening that makes the reader want to know more."
      ),
      crit(
        "Values and qualities",
        "Personal Statement",
        "Names the student's values and qualities and shows them in action.",
        "Lists traits without showing them.",
        "Names key values or qualities with an example of each.",
        "Values and qualities come through naturally in the story."
      ),
      crit(
        "Personal story",
        "Personal Statement",
        "Includes a specific experience that shaped who the student is.",
        "No real experience, or one described only in general terms.",
        "A specific experience and what the student learned from it.",
        "A memorable, honest story that ties the statement together."
      ),
      crit(
        "Direction",
        "Personal Statement",
        "Connects who the student is to where they are headed.",
        "No link between the student and their plans.",
        "Shows how the student's background leads to their chosen path.",
        "The connection to the pathway and career is clear and convincing."
      ),
      crit(
        "Writing quality",
        "150+ words",
        "At least 150 words of the student's own clear, proofread writing.",
        "Under 150 words, or frequent errors.",
        "150+ words with only minor errors.",
        "Polished and engaging."
      ),
      crit(
        "Personal information",
        "Birth date, graduation date, location, school, program",
        "Every detail is correct and complete: date of birth, expected graduation date, current city and state, and the current school and program named in full.",
        "Details missing or incorrect.",
        "All details complete and accurate.",
        "Accurate and consistent with every other section."
      ),
    ],
  },

  pathway: {
    summary:
      "Selected Pathway is the plan for the first step after graduation: college, trade school, certification, military, apprenticeship or work. It should show the choice was deliberate (other options were weighed), practical (dates, steps, paperwork and cost are known), connected (it leads to the role in the Career section) and resilient (there is a real Plan B). A strong section is one someone else could follow to get the student started.",
    criteria: [
      crit(
        "Pathway choice",
        "Pathway, two images",
        "A post-graduation pathway is selected, with two images of the actual program, base or workplace.",
        "Pathway selected but images missing or generic.",
        "A selected pathway with two relevant images.",
        "Images show the specific place or program the student will attend."
      ),
      crit(
        "Reasoning",
        "Why I chose this pathway, 75+ words",
        "Explains why this pathway fits the student's strengths, goals and situation.",
        "Vague reasons, or under 75 words.",
        "75+ words on why the pathway fits the student.",
        "Reasons draw directly on the student's profile and goals."
      ),
      crit(
        "Alternatives considered",
        "Other pathways considered, 75+ words",
        "At least two other options are described, with why each was ruled out.",
        "Fewer than two alternatives, or no reasons given.",
        "Two alternatives, each with why it was ruled out.",
        "An honest comparison that shows the choice was deliberate."
      ),
      crit(
        "Timeline and milestones",
        "Commitment date, start date, milestones",
        "The plan runs from the commitment date to the start date, with milestones in order and deadlines attached.",
        "Dates or milestones missing.",
        "Commitment and start dates with milestones in order.",
        "Every milestone has a deadline someone else could follow."
      ),
      crit(
        "Entry steps and documents",
        "Steps to enter, documents, sources",
        "Lists the steps to enter the pathway and the documents required, each with a source.",
        "Steps or documents incomplete or unsourced.",
        "Entry steps and required documents listed with sources.",
        "Verified from official sources, with nothing missing."
      ),
      crit(
        "Cost estimate",
        "Estimated total cost, source",
        "Adds up the cost of education, certifications, licenses and exams into one sourced total.",
        "No total, or the total is unsupported.",
        "A total cost with a source.",
        "Each part of the cost is itemized and sourced."
      ),
      crit(
        "Connection to career",
        "100+ words",
        "Explains step by step how the pathway leads to the exact role named in the Career section.",
        "Doesn't name the career, or the link is unclear.",
        "100+ words connecting the pathway to the named role.",
        "A concrete bridge from the first day of the pathway to the first day of the job."
      ),
      crit(
        "Support system",
        "Supporter, doubters (75+ words)",
        "Names the person who supports the student most, and fairly describes a doubter's concern and how the student is handling it.",
        "Supporter or doubter missing, or the concern is dismissed.",
        "A named supporter and a fairly described doubter, with the student's response.",
        "Shows maturity in handling doubt, with specific ways the supporter helps."
      ),
      crit(
        "Biggest risk",
        "30+ words",
        "Names the one thing most likely to derail the plan, specifically and honestly.",
        "Vague (\"failure\", \"nothing\").",
        "One specific, honest risk with why it is the biggest.",
        "A risk analysis that clearly sets up the Plan B."
      ),
      crit(
        "Backup plan",
        "Plan B, 100+ words",
        "A real Plan B that responds directly to the biggest risk and could start right away.",
        "A wish rather than a plan, or unrelated to the risk.",
        "A 100+ word Plan B that answers the named risk.",
        "Specific steps, people and resources, and how the student would know to switch."
      ),
    ],
  },

  profile: {
    summary:
      "Personal Profile is the student's self-knowledge: personality, values, strengths, skills, interests and goals. It is the evidence base for every choice later in the Life Map, so the career and pathway should make sense given what is written here. Push for specifics and examples over single-word answers, and check that the goals at the end build on each other.",
    criteria: [
      crit(
        "Personality assessment",
        "Assessment, type, top two traits, summary 25+ words",
        "Names the assessment and personality type, lists the top two traits, and explains why the type fits.",
        "Results listed without explanation.",
        "Assessment, type, top traits and why they fit.",
        "Thoughtful reflection on which parts fit and which don't."
      ),
      crit(
        "Personality summary",
        "50+ words",
        "Summarizes the student's personality from self-knowledge and life experience, not only the test.",
        "Repeats the test result, or under 50 words.",
        "50+ words drawing on the student's own experience.",
        "Honest and insightful, linking personality to specific experiences."
      ),
      crit(
        "Core values",
        "4 core values",
        "Four core values, each described in the student's own words.",
        "Fewer than four, or one-word answers.",
        "Four described core values.",
        "Each value comes with an example of it in action."
      ),
      crit(
        "Personal strengths",
        "4 strengths",
        "Four personal strengths, each described.",
        "Fewer than four, or one-word answers.",
        "Four described strengths.",
        "Each strength comes with where the student has shown it."
      ),
      crit(
        "Areas for growth",
        "2 areas, 50+ words each",
        "Two honest areas for growth, each with how improving would help.",
        "Missing, under 50 words, or not honest.",
        "Two areas, each 50+ words with how improving would help.",
        "Each includes a concrete step the student is taking to improve."
      ),
      crit(
        "Skills",
        "5 hard skills, 5 soft skills",
        "Five hard skills (things the student can do) and five soft skills (how they work with people), each briefly described.",
        "Lists incomplete or one-word answers.",
        "Five hard and five soft skills, each described.",
        "Each skill comes with where it was learned or used."
      ),
      crit(
        "Interests",
        "3 hobbies, 3 subjects",
        "Three hobbies and three favorite subjects, each briefly described.",
        "Lists incomplete or one-word answers.",
        "Three hobbies and three subjects, each described.",
        "Interests clearly connect to the career choice."
      ),
      crit(
        "Short-term goal",
        "1–2 years, 200+ words",
        "A goal for the next one to two years: what it is, why it matters and the steps to reach it.",
        "Vague, with no steps, or under 200 words.",
        "A 200+ word goal with its reason and steps.",
        "Specific and measurable, with dates and resources."
      ),
      crit(
        "Medium-term goal",
        "3–5 years, 400+ words",
        "A goal for three to five years out, with the education, training or experience it takes.",
        "Vague, with no steps, or under 400 words.",
        "A 400+ word goal with its reason and steps.",
        "Builds directly on the short-term goal, with clear milestones."
      ),
      crit(
        "Long-term goal",
        "5+ years, 600+ words",
        "The future the student wants to create, and the steps that lead there.",
        "Vague, with no steps, or under 600 words.",
        "A 600+ word goal with its reason and steps.",
        "The three goals form one coherent plan that matches the pathway and career."
      ),
    ],
  },

  career: {
    summary:
      "Career names the specific role the student is aiming for and proves they understand it: what the work is, why it fits them, what the job market looks like, how to qualify, what skills it takes and where they could work. Labor-market figures should come from credible sources such as the Bureau of Labor Statistics. This section anchors the rest of the plan; the pathway and education choices should both lead here.",
    criteria: [
      crit(
        "Role and daily work",
        "Role title, summary 50+ words, environment 75+ words, related positions, images",
        "A specific role title, what people in it do each day, and where and how they work.",
        "A field rather than a role, or the daily work is vague.",
        "A specific role with its daily work and environment described.",
        "Detailed enough that a reader could picture a normal workday."
      ),
      crit(
        "Why this career",
        "200+ words",
        "Explains why this career fits the student's values, strengths and interests.",
        "Generic reasons, or under 200 words.",
        "200+ words tying the career to the student.",
        "Reasons draw directly on the Personal Profile and are convincing."
      ),
      crit(
        "Skills match and gaps",
        "Skills match 75+ words, skills to develop 75+ words",
        "Names the skills the student already has for the role, and the ones they still need to develop and how.",
        "Skills listed without connection to the role.",
        "Current skills matched to the role, and skills to develop with steps.",
        "A clear, specific plan for closing each skill gap."
      ),
      crit(
        "Work preferences",
        "Workspace, schedule, geography, benefits, source",
        "Describes the preferred workspace, schedule and location, and the benefits commonly offered, with a source.",
        "Preferences missing or one-word answers.",
        "Each preference described, with sourced benefits.",
        "Preferences are realistic for the role and location."
      ),
      crit(
        "Industry and outlook",
        "Industry description, future outlook, sources",
        "Describes the industry the role belongs to and how it is changing, with sources.",
        "Generic or unsourced.",
        "Industry description and future outlook, each sourced.",
        "Specific trends that affect the student's role."
      ),
      crit(
        "Labor market figures",
        "Growth, new jobs, openings, median pay, sources",
        "Projected growth, new jobs, annual openings, and median annual and hourly pay, each with a credible source such as the BLS Occupational Outlook Handbook.",
        "Figures missing or unsourced.",
        "All figures included, each with a credible source.",
        "Explains what the numbers mean for the student's prospects."
      ),
      crit(
        "Path into the role",
        "How to become one, 100+ words, source",
        "Traces the route from high school to the first day on the job, step by step.",
        "Vague, or under 100 words.",
        "A 100+ word step-by-step route, sourced.",
        "Specific to the student's location and consistent with the Pathway section."
      ),
      crit(
        "Education and credentials",
        "Education, length, degree, certifications, licenses, sources",
        "Lists the education, certifications and licenses the role requires, with sources.",
        "Requirements incomplete or unsourced.",
        "All required education and credentials listed with sources.",
        "Matches the program chosen in the Education section."
      ),
      crit(
        "Skills, responsibilities and knowledge",
        "4 key skills, 4 responsibilities, 2 knowledge areas, sources",
        "The key skills, responsibilities and knowledge the role requires, each described.",
        "Lists incomplete or one-word answers.",
        "Four skills, four responsibilities and two knowledge areas, sourced.",
        "Each item is specific to the role, not generic."
      ),
      crit(
        "Employers of interest",
        "3 employers: name, logo, website, why (40+ words)",
        "Three real employers that hire for the role, each with logo, website and why it interests the student.",
        "Fewer than three, or details missing.",
        "Three employers, each with logo, website and 40+ words on why.",
        "Reasons are researched and specific to each employer."
      ),
    ],
  },

  education: {
    summary:
      "Education lays out the plan at the chosen school or program: why this one, how to get in, what it costs and how it will be paid for, and how it leads to the career. The finances are what students most often get wrong; costs, aid and the remaining balance must add up. A strong section shows the student researched the program in depth and has a realistic plan to pay for it.",
    criteria: [
      crit(
        "School overview",
        "Name, location, website, photos, climate, distance, transport",
        "The school's full name, location, program website and photos, plus how the student will get there.",
        "Details missing or generic.",
        "All school details, photos and travel plans included.",
        "Paints a clear picture of daily life at the school."
      ),
      crit(
        "Program features and opportunities",
        "Key features 150+ words, special opportunities 150+ words",
        "Describes the program's key features and two or three special opportunities, such as labs, internships or certifications.",
        "Surface-level, or under the word minimums.",
        "Key features and special opportunities, each at its word minimum.",
        "Specific details that set this program apart."
      ),
      crit(
        "Why this program",
        "250+ words",
        "Explains why the student chose this program over the alternatives they considered.",
        "Generic reasons, or under 250 words.",
        "250+ words on why this program was chosen.",
        "Clearly research-driven, comparing specific features against alternatives."
      ),
      crit(
        "Differentiators",
        "250+ words",
        "What makes this institution unique and the best fit for the student.",
        "Generic claims, or under 250 words.",
        "250+ words of specific differentiators.",
        "Backed by specifics such as placement rates, accreditation or partnerships."
      ),
      crit(
        "Application timeline",
        "Open date, deadline, source",
        "The application open date and deadline, with a source.",
        "Dates missing or unsourced.",
        "Both dates with a source.",
        "Dates are built into the Pathway timeline."
      ),
      crit(
        "Entry requirements",
        "Prerequisites, GPA, transcript, tests, other requirements",
        "Every admission requirement, alongside where the student currently stands.",
        "Requirements incomplete.",
        "Prerequisites, test minimums, GPA, transcript link and other requirements listed.",
        "Shows exactly what the student still needs to meet each requirement."
      ),
      crit(
        "Program costs",
        "Tuition, room and board, books, fees, totals",
        "Annual costs itemized and adding up to the total.",
        "Costs missing, or the totals don't add up.",
        "Itemized costs with correct totals.",
        "Every cost sourced from the school."
      ),
      crit(
        "Financial aid",
        "Aid totals by type, aid information 200+ words",
        "Aid listed by type (grants, scholarships, loans) and explained.",
        "Aid vague or under 200 words.",
        "Aid by type with a 200+ word explanation.",
        "Aid is real or applied for, with amounts confirmed."
      ),
      crit(
        "Funds timeline and renewals",
        "How and when funds arrive, renewal tracking (75+ words each)",
        "Explains how aid gets from the award to the student's bill or pocket, and how each award's renewal rules will be tracked.",
        "Missing, or under the word minimums.",
        "Both explained at their word minimums.",
        "Names each award's renewal rule and how the student will keep it."
      ),
      crit(
        "Remaining balance plan",
        "Remaining cost, plan 200+ words",
        "The remaining annual cost after aid, and how the student will cover it.",
        "No remaining balance, or no plan.",
        "Remaining cost and a 200+ word plan to cover it.",
        "A realistic, specific plan that appears in the Finance budget."
      ),
      crit(
        "Field of study and credentials",
        "Program type, completion requirements, credentials, length",
        "The program type, field, length, completion requirements and credentials earned.",
        "Details incomplete.",
        "All program details listed.",
        "Specific courses or credentials are named."
      ),
      crit(
        "Connection to career",
        "200+ words",
        "Explains how the program leads to the role in the Career section.",
        "Unclear connection, or under 200 words.",
        "200+ words connecting the program to the career.",
        "Names the credential employers in the Career section look for."
      ),
    ],
  },

  transportation: {
    summary:
      "Transportation shows how the student will reliably get to work, school and daily responsibilities after graduation, and what it will cost. The method should fit the distances involved and the student's budget. Costs must come from real quotes and listings, and carry into the Finance budget.",
    criteria: [
      crit(
        "Method and daily use",
        "Primary method, how it's used (50+ words)",
        "The primary transportation method and how the student will use it day to day.",
        "Method chosen without describing its use.",
        "A method with 50+ words on daily use.",
        "Includes a backup for days the main method fails."
      ),
      crit(
        "Distance and commute",
        "Distance, commute time",
        "The distance and commute time between the student's actual housing and school or work.",
        "Missing or estimated without addresses.",
        "Distance and commute time from real addresses.",
        "Accounts for traffic, schedules or transfers."
      ),
      crit(
        "Why this method",
        "300+ words",
        "Explains why this method was chosen over other options.",
        "Generic reasons, or under 300 words.",
        "300+ words on why this method fits.",
        "Weighs cost, reliability and convenience against the alternatives."
      ),
      crit(
        "Vehicle and license",
        "Vehicle, listing, license type, status, expiry",
        "The vehicle's make, model and image from a real listing, plus license type, status and expiry.",
        "Details missing or no listing.",
        "Vehicle from a real listing, and license details complete.",
        "A vehicle realistic for the student's budget."
      ),
      crit(
        "Insurance",
        "Provider, coverage, monthly and upfront cost, quote source",
        "A real insurance quote for the student's age and ZIP code, with provider and coverage type.",
        "Quote missing or unsourced.",
        "Provider, coverage and sourced quote with monthly and upfront cost.",
        "Compares quotes or coverage options."
      ),
      crit(
        "Monthly costs",
        "Insurance, gas, maintenance, total",
        "Monthly insurance, gas and maintenance with a correct total.",
        "Costs missing, or the total is wrong.",
        "All monthly costs with a correct total.",
        "Every estimate is sourced and appears in the Finance budget."
      ),
      crit(
        "One-time costs",
        "Tax, title, license, initial insurance, total",
        "One-time costs to get on the road, with a correct total.",
        "Costs missing, or the total is wrong.",
        "All one-time costs with a correct total.",
        "Sourced and planned for in savings."
      ),
    ],
  },

  housing: {
    summary:
      "Housing shows the student can find and afford a realistic place to live. It covers the chosen home, why it was chosen over alternatives, how it meets daily needs, and every cost involved. Costs should come from a real listing and match the Finance budget, and the location should make sense with the school, work and transportation plans.",
    criteria: [
      crit(
        "Housing details",
        "Type, address, listing link, rooms, roommates, photos",
        "The chosen home from a real listing: type, full address, floor plan or listing link, rooms, roommates and photos.",
        "Details missing or no real listing.",
        "All details from a real listing.",
        "A listing realistic for the student's budget and situation."
      ),
      crit(
        "Location fit",
        "Distance to work, school or program",
        "How far the home is from school or work, consistent with the Transportation plan.",
        "Distance missing or inconsistent.",
        "Distance listed and consistent with Transportation.",
        "Location clearly chosen around school, work and transport."
      ),
      crit(
        "Why this housing",
        "300+ words",
        "Explains why this home was chosen, beyond appearance: cost, location, safety and routine.",
        "Reasons about looks only, or under 300 words.",
        "300+ words on cost, location and practical reasons.",
        "Weighs every factor honestly."
      ),
      crit(
        "Alternative considered",
        "225+ words",
        "At least one real alternative, what made it worth considering and why it was ruled out.",
        "No real alternative, or under 225 words.",
        "A real alternative explained and ruled out in 225+ words.",
        "Honest trade-offs that strengthen the final choice."
      ),
      crit(
        "Meeting needs",
        "300+ words",
        "How the home supports the student's routine, responsibilities and priorities.",
        "General statements, or under 300 words.",
        "300+ words on practical and personal needs.",
        "Specific to the student's daily life."
      ),
      crit(
        "Monthly costs",
        "Rent, utilities, internet",
        "Monthly rent, utilities and internet from the actual listing.",
        "Costs missing or unrealistic.",
        "All monthly costs listed.",
        "Costs are sourced and appear unchanged in the Finance budget."
      ),
      crit(
        "Move-in and lease",
        "Deposit, move-in date, lease term",
        "The deposit, move-in date and lease term.",
        "Details missing.",
        "Deposit, move-in date and lease term listed.",
        "The deposit is planned for in savings."
      ),
    ],
  },

  finance: {
    summary:
      "Finance brings the whole Life Map together into a working budget. Income from the planned job must cover housing, transportation, education and living costs, with savings on top. The numbers from earlier sections should appear here unchanged. A strong section shows the student understands their money, has a realistic plan to save, and knows where to turn for help.",
    criteria: [
      crit(
        "Savings goals",
        "12-month goals, 100+ words",
        "Savings goals for the next 12 months and what they are for.",
        "Vague, or under 100 words.",
        "100+ words of specific savings goals.",
        "Goals build month by month toward a clear purpose."
      ),
      crit(
        "Savings target",
        "Current savings, target amount and date",
        "Current savings and an exact target amount and date.",
        "No amount or date.",
        "An exact target amount and date.",
        "Broken into a monthly amount that appears in the budget."
      ),
      crit(
        "Budget spreadsheet",
        "Google Budget Sheet link",
        "The budget spreadsheet is linked and opens for anyone with the link.",
        "Link missing, broken or asks for a sign-in.",
        "A working, viewable link.",
        "Organized and labeled so a reader can follow it."
      ),
      crit(
        "Budget summary",
        "200+ words",
        "Explains income, expenses and one-time costs, and whether the budget ends in a surplus or deficit.",
        "Numbers without explanation, or under 200 words.",
        "200+ words covering income, expenses and the balance.",
        "Explains what the balance means and how gaps will be closed."
      ),
      crit(
        "Income",
        "Employer, position, type, W-4, wage, link",
        "The planned job, its hourly wage and a link to the application or careers page.",
        "Details missing or the wage is unrealistic.",
        "Employer, position, type, W-4 choice and wage, with a link.",
        "The wage matches what the employer pays, and it covers the budget."
      ),
      crit(
        "Purpose of budgeting",
        "100+ words",
        "What budgeting means to the student and how it will affect life after graduation.",
        "Generic, or under 100 words.",
        "100+ words on short and long-term effects.",
        "Personal and specific to the student's plans."
      ),
      crit(
        "Challenges and largest expense",
        "20+ words",
        "The money challenges the student expects and their biggest expense.",
        "Vague, or the largest expense is missing.",
        "Specific challenges and the largest expense.",
        "Includes how the student will handle each challenge."
      ),
      crit(
        "Spending decisions",
        "75+ words",
        "How the student will track spending and tell needs from wants.",
        "Vague, or under 75 words.",
        "75+ words naming a method or app and how needs and wants are separated.",
        "A specific routine the student will actually follow."
      ),
      crit(
        "Support system",
        "150+ words",
        "The people and resources the student can turn to for financial advice or emergencies.",
        "Generic, or under 150 words.",
        "150+ words naming specific people and resources.",
        "Explains when and how the student would use each one."
      ),
      crit(
        "Consistent figures",
        "Whole Life Map",
        "Housing, transportation and education costs appear in the budget exactly as in their sections.",
        "Figures differ between sections.",
        "Figures match across the Life Map.",
        "Every cost traces back to a sourced figure.",
        "Nothing to compare yet."
      ),
    ],
  },

  contact: {
    summary:
      "Contact is the student's professional network: how to reach them, a resume, references and a LinkedIn profile. Everything should be professional and current, and references should be people who have agreed to vouch for the student.",
    criteria: [
      crit(
        "Personal contact",
        "Personal email, phone, address",
        "A personal email (not an SFA address), phone number and current address.",
        "A school email, or details missing.",
        "Personal email, phone and address complete.",
        "A professional-sounding email address."
      ),
      crit(
        "Resume",
        "Resume link",
        "A current resume, linked so anyone can open it.",
        "Link missing or asks for a sign-in.",
        "A viewable, current resume.",
        "Polished, and tailored to the chosen career."
      ),
      crit(
        "Employer reference",
        "Name, company, website, phone, email",
        "An employer the student has worked well with, with full contact details.",
        "Details missing.",
        "Name, company, website, phone and email.",
        "The reference has agreed to be listed and knows the student well."
      ),
      crit(
        "Academic reference",
        "Name, position, phone, email",
        "A teacher who can speak to the student's work, with full contact details.",
        "Details missing.",
        "Name, position, phone and professional email.",
        "The reference has agreed to be listed and knows the student well."
      ),
      crit(
        "LinkedIn",
        "LinkedIn profile link",
        "A LinkedIn profile with photo, headline, education and experience.",
        "Link missing, or the profile is mostly empty.",
        "A filled-in profile linked.",
        "Complete, matching the resume and the chosen career."
      ),
    ],
  },
}
