# SailFuture Student Portal — Product Requirements Document

## Overview

A web application where students complete structured planning projects (Business Thesis, Life Map) through multi-page forms. Administrators manage and review student submissions. All data persists to Xano backend APIs.

---

## Tech Stack

- **Frontend:** Next.js 15 (App Router), TypeScript, Tailwind CSS
- **UI Components:** shadcn/ui (Nova style, Radix primitives, Geist font, gray theme, small radius, Hugeicons)
- **Auth:** Google OAuth via NextAuth.js
- **Backend:** Xano (REST APIs) — no local database
- **State/Forms:** React Hook Form + Zod validation
- **Auto-save:** Debounced save (3s after last keystroke) + manual save button

### Project Scaffolding

Initialize the project using the shadcn CLI with this exact command:

```bash
pnpm dlx shadcn@latest create --preset "https://ui.shadcn.com/init?base=radix&style=nova&baseColor=gray&theme=gray&iconLibrary=hugeicons&font=geist&menuAccent=subtle&menuColor=default&radius=small&template=next&rtl=false" --template next
```

Then install the required blocks:

```bash
npx shadcn@latest add sidebar-16
npx shadcn@latest add login-03
npx shadcn@latest add input-group
```

This sets up Next.js with shadcn/ui pre-configured. All form inputs, buttons, cards, selects, date pickers, dialogs, and layout components should use shadcn/ui primitives. Do not install or use any other component library.

### Block Usage

**`sidebar-16`** — Primary application layout. Use this as the shell for all authenticated pages. The sidebar handles navigation between Life Map subpages, Business Thesis subpages, and admin views. Adapt the sidebar nav items to match the app's route structure:

**Student Sidebar Nav:**
```
Life Map
  ├── Overview
  ├── Selected Pathway
  ├── Personal Profile
  ├── Career
  ├── Education
  ├── Housing
  ├── Transportation
  ├── Finance
  └── Contact

Business Thesis
  ├── Executive Summary
  ├── Products & Services
  ├── Market Analysis
  ├── Competitive Analysis
  ├── Financial Plan
  ├── Marketing Plan
  ├── Closing Statement
  └── Contact
```

Each nav item shows a completion status dot (red/yellow/green) and a document icon badge if unread teacher comments exist. All form pages render in the main content area to the right of the sidebar.

**Admin Sidebar Nav:**
```
Life Map        → /admin/life-map (student roster)
Business Thesis → /admin/business-thesis (student roster)
```

**`login-03`** — Login page. Use this as the login screen with Google OAuth as the only sign-in method. Remove any email/password fields — Google button only. This is the only page visible to unauthenticated users.

---

## Authentication

### Google OAuth Login
- Use NextAuth.js with Google provider
- Two roles: `student` and `admin`
- On first login, check if user email exists in Xano student/admin tables
- Store session with: `user_email`, `role`, `students_id` (if student)
- Redirect: students → `/dashboard`, admins → `/admin/life-map`
- Unauthenticated users see login page only

### Role Routing
| Role | Access |
|------|--------|
| `student` | Dashboard, Business Thesis pages, Life Map pages |
| `admin` | Admin dashboard: student roster tables (Life Map, Business Thesis), individual student submission views with commenting |

---

## Application Structure

```
/app
├── /login                    # login-03 block — Google OAuth only, no sidebar
├── (authenticated)           # Layout group using sidebar-16 block as shell
│   ├── /dashboard            # Student home — two project cards
│   │
│   ├── /life-map
│   │   ├── /overview         # Life Map overview / landing
│   │   ├── /pathway          # Selected Pathway
│   │   ├── /profile          # Personal Profile
│   │   ├── /career           # Career
│   │   ├── /education        # Education
│   │   ├── /housing          # Housing & Living ✅ (fields defined)
│   │   ├── /transportation   # Transportation
│   │   ├── /finance          # Finance
│   │   └── /contact          # Contact
│   │
│   ├── /business-thesis
│   │   ├── /executive-summary    # Executive Summary
│   │   ├── /products-services    # Products & Services
│   │   ├── /market-analysis      # Market Analysis
│   │   ├── /competitive-analysis # Competitive Analysis
│   │   ├── /financial-plan       # Financial Plan
│   │   ├── /marketing-plan       # Marketing Plan
│   │   ├── /closing-statement    # Closing Statement
│   │   └── /contact              # Contact
│   │
│   └── /admin
│       ├── /life-map                      # Student table for Life Map
│       ├── /life-map/[studentId]          # Individual student's Life Map submissions
│       ├── /business-thesis               # Student table for Business Thesis
│       └── /business-thesis/[studentId]   # Individual student's Business Thesis submissions
│
└── /api
    └── /auth/[...nextauth]   # NextAuth route handlers
```

---

## Shared Form Architecture

Every form page across the app follows this pattern. Build it once as a reusable system.

### Auto-Save Behavior
1. Each form field onChange triggers a debounce timer (3 seconds)
2. After 3s of inactivity, POST/PATCH full form payload to Xano
3. Show subtle save indicator: "Saving..." → "Saved ✓" → fades out
4. Manual "Save" button always visible — triggers immediate POST
5. On page load, GET existing data from Xano and populate form
6. Unsaved changes warning if user tries to navigate away

### Completion Validation (Soft)

Forms use **soft validation** — data always saves regardless of completion status. Word counts and required fields determine whether a section is marked complete. This is visual feedback only, never a blocker to saving.

**Rules:**
- Textarea (essay) fields have a **minimum word count** displayed below the field (e.g., "12 / 50 words")
- Non-textarea required fields are "complete" when non-empty
- Number fields are "complete" when > 0
- Image fields are "complete" when an image is uploaded
- Auto-save fires regardless of completion state — incomplete data saves normally

**Section Status Indicator:**

Each form section header displays a single small colored dot next to the section title:
- 🔴 **Red dot** — Section not started (all fields empty)
- 🟡 **Yellow dot** — Section in progress (some fields filled, but not all completion requirements met)
- 🟢 **Green dot** — Section complete (all fields meet their requirements including word minimums)

The dot should be subtle — ~8px circle, no label, no tooltip needed. The color speaks for itself. The sidebar nav item for each page should also show the same dot logic based on overall page status (red if no sections started, yellow if any section incomplete, green if all sections complete).

**Word Count UI per field:**
- Below each textarea: `{currentWords} / {minWords} words` in muted text
- Under minimum: muted amber text
- At or over minimum: muted green text

**InputGroup Patterns for Form Fields:**

```tsx
// Textarea with word count + comment badge
<InputGroup>
  <InputGroupTextarea placeholder="Why did you choose this housing?" />
  <InputGroupAddon align="block-end">
    <InputGroupText className="text-muted-foreground text-xs">
      12 / 50 words
    </InputGroupText>
    {hasComments && (
      <InputGroupButton size="icon-xs" onClick={openCommentPopover}>
        <DocumentIcon />
      </InputGroupButton>
    )}
  </InputGroupAddon>
</InputGroup>

// Currency input with $ prefix
<InputGroup>
  <InputGroupAddon align="inline-start">
    <InputGroupText>$</InputGroupText>
  </InputGroupAddon>
  <InputGroupInput type="number" placeholder="0" />
</InputGroup>

// Text input with comment badge
<InputGroup>
  <InputGroupInput placeholder="Enter location..." />
  <InputGroupAddon align="inline-end">
    {hasComments && (
      <InputGroupButton size="icon-xs" onClick={openCommentPopover}>
        <DocumentIcon />
      </InputGroupButton>
    )}
  </InputGroupAddon>
</InputGroup>
```

These are reference patterns — the actual implementation should use the shared form infrastructure to render fields from the `FieldConfig` definitions, not hardcoded JSX per field.

### Teacher Comments

Comments are stored in a **separate Xano table/endpoint** — not as columns on each form table. This keeps form schemas clean and scales across all pages without modification.

**Xano Endpoint:** `POST/GET https://xsc3-mvx7-r86m.n7e.xano.io/api:o2_UyOKn/lifemap_comments`

**Comment Data Shape (matches Xano):**
```json
{
  "teachers_id": null,
  "students_id": null,
  "field_name": "",
  "isOld": false,
  "note": ""
}
```

- `field_name`: matches the form field key exactly (e.g., `"reason_chosen"`, `"housing_description"`)
- `isOld`: defaults to `false` when created. Used to track whether the student has seen the comment. When student opens the popover for a field, mark that comment's `isOld` as `true` via PATCH.
- `note`: the teacher's comment text

Comments are **per-field**, not per-section. A teacher can leave feedback on any individual textarea or input.

**Student View — Badge + Popover:**
- If a field has comments where `isOld === false`, show the document icon badge with an accent indicator (new feedback)
- If all comments on a field have `isOld === true`, show the document icon badge without accent (previously read)
- If no comments exist on a field, no icon — completely hidden
- Clicking the badge opens a `Popover` (shadcn) showing teacher name, and comment text
- On popover open, PATCH any `isOld: false` comments to `isOld: true`
- Sidebar nav items show a document icon badge next to any page that has comments where `isOld === false`

**GET pattern:** On page load, fetch all comments for the student + page in one call (e.g., `GET /lifemap_comments?students_id={id}&page=housing`), then distribute to fields client-side by matching `field_name`.
- Idle: no indicator
- Saving: "Saving..." (subtle, top-right or near save button)
- Saved: "All changes saved ✓" (fades after 2s)
- Error: "Save failed — retry" (persists until resolved)

### Form Component Pattern
```typescript
// Reusable pattern for all form pages
interface FormPageConfig {
  xanoEndpoint: string;         // POST/GET URL
  formSchema: ZodSchema;        // Zod validation schema
  defaultValues: Record<string, any>;
  fields: FieldConfig[];        // Field definitions for rendering
}

interface FieldConfig {
  name: string;
  type: 'text' | 'textarea' | 'number' | 'select' | 'date' | 'image' | 'hidden';
  label?: string;
  placeholder?: string;
  options?: string[];           // For select fields
  minWords?: number;            // For textarea fields — soft validation only
  required?: boolean;           // For completion tracking, not save blocking
  section: string;              // Which form section this field belongs to
}
```

---

## Life Map Page: Housing & Living

**Route:** `/life-map/housing`

**Xano Endpoint:** `POST https://xsc3-mvx7-r86m.n7e.xano.io/api:o2_UyOKn/lifeplan_housing`

### Data Schema

```json
{
  "user_email": "",
  "students_id": null,
  "housing_image_1": {},
  "housing_image_2": {},
  "housing_type": "",
  "location": "",
  "room_configuration": "",
  "roommate_situation": "",
  "distance_to_work_school_or_program": "",
  "reason_chosen": "",
  "meets_needs_explanation": "",
  "alternative_housing_considered": "",
  "monthly_rent": 0,
  "housing_deposit": 0,
  "utilities_cost": 0,
  "internet_cost": 0,
  "move_in_date": null,
  "term_commitment": "",
  "housing_description": "",
  "amenities_included": "",
  "housing_policies_rules": ""
}
```

### Field Mapping

| Field | Input Type | Notes |
|-------|-----------|-------|
| `user_email` | Hidden | From auth session |
| `students_id` | Hidden | From auth session |
| `housing_image_1` | Image upload | Upload to Xano file storage, store returned object |
| `housing_image_2` | Image upload | Upload to Xano file storage, store returned object |
| `housing_type` | Select dropdown | Options: Apartment, House, Room Rental, Dorm, Other |
| `location` | Text input | Address or area description |
| `room_configuration` | Select dropdown | Options: Studio, 1BR, 2BR, 3BR+, Shared Room |
| `roommate_situation` | Text input | e.g., "Living alone", "1 roommate" |
| `distance_to_work_school_or_program` | Text input | e.g., "15 min drive" |
| `reason_chosen` | Textarea | Why did you choose this housing? **Min: 50 words** |
| `meets_needs_explanation` | Textarea | How does it meet your needs? **Min: 50 words** |
| `alternative_housing_considered` | Textarea | What else did you look at? **Min: 30 words** |
| `monthly_rent` | Number input | Currency — use `InputGroupText` for `$` prefix via `inline-start` addon |
| `housing_deposit` | Number input | Currency — use `InputGroupText` for `$` prefix via `inline-start` addon |
| `utilities_cost` | Number input | Currency — use `InputGroupText` for `$` prefix via `inline-start` addon |
| `internet_cost` | Number input | Currency — use `InputGroupText` for `$` prefix via `inline-start` addon |
| `move_in_date` | Date picker | ISO date format for Xano |
| `term_commitment` | Select dropdown | Options: Month-to-month, 6 months, 12 months, Other |
| `housing_description` | Textarea | Describe the place. **Min: 75 words** |
| `amenities_included` | Textarea | What's included? **Min: 30 words** |
| `housing_policies_rules` | Textarea | Any rules or policies? **Min: 30 words** |

### Form Layout (suggested sections)

**Section 1: Your Housing Choice**
- housing_image_1, housing_image_2 (side by side)
- housing_type, location, room_configuration

**Section 2: Living Situation**
- roommate_situation, distance_to_work_school_or_program
- reason_chosen, meets_needs_explanation, alternative_housing_considered

**Section 3: Costs**
- monthly_rent, housing_deposit, utilities_cost, internet_cost

**Section 4: Details**
- move_in_date, term_commitment
- housing_description, amenities_included, housing_policies_rules

---

## Life Map Page: Overview

**Route:** `/life-map/overview`

**Xano Endpoint:** `POST https://xsc3-mvx7-r86m.n7e.xano.io/api:o2_UyOKn/lifeplan_overview` *(TBD — create in Xano)*

**Purpose:** Introduction and high-level summary of the student's life plan. Sets the stage for all subsequent sections.

**Fields:** TBD

---

## Life Map Page: Selected Pathway

**Route:** `/life-map/pathway`

**Xano Endpoint:** `POST https://xsc3-mvx7-r86m.n7e.xano.io/api:o2_UyOKn/lifeplan_pathway` *(TBD — create in Xano)*

**Purpose:** The career/life pathway the student has selected and their rationale for choosing it.

**Fields:** TBD

---

## Life Map Page: Personal Profile

**Route:** `/life-map/profile`

**Xano Endpoint:** `POST https://xsc3-mvx7-r86m.n7e.xano.io/api:o2_UyOKn/lifeplan_profile` *(TBD — create in Xano)*

**Purpose:** Personal background, strengths, values, and self-assessment.

**Fields:** TBD

---

## Life Map Page: Career

**Route:** `/life-map/career`

**Xano Endpoint:** `POST https://xsc3-mvx7-r86m.n7e.xano.io/api:o2_UyOKn/lifeplan_career` *(TBD — create in Xano)*

**Purpose:** Career goals, target roles, skills needed, and action plan for employment.

**Fields:** TBD

---

## Life Map Page: Education

**Route:** `/life-map/education`

**Xano Endpoint:** `POST https://xsc3-mvx7-r86m.n7e.xano.io/api:o2_UyOKn/lifeplan_education` *(TBD — create in Xano)*

**Purpose:** Education plans — certifications, trade programs, college, or continuing education.

**Fields:** TBD

---

## Life Map Page: Transportation

**Route:** `/life-map/transportation`

**Xano Endpoint:** `POST https://xsc3-mvx7-r86m.n7e.xano.io/api:o2_UyOKn/lifeplan_transportation` *(TBD — create in Xano)*

**Purpose:** How the student plans to get around — vehicle, public transit, biking, etc. Costs and logistics.

**Fields:** TBD

---

## Life Map Page: Finance

**Route:** `/life-map/finance`

**Xano Endpoint:** `POST https://xsc3-mvx7-r86m.n7e.xano.io/api:o2_UyOKn/lifeplan_finance` *(TBD — create in Xano)*

**Purpose:** Monthly budget, income sources, savings goals, and financial planning.

**Fields:** TBD

---

## Life Map Page: Contact

**Route:** `/life-map/contact`

**Xano Endpoint:** `POST https://xsc3-mvx7-r86m.n7e.xano.io/api:o2_UyOKn/lifeplan_contact` *(TBD — create in Xano)*

**Purpose:** Key contacts and support network — mentors, case workers, employers, emergency contacts.

**Fields:** TBD

---

## Business Thesis Page: Executive Summary

**Route:** `/business-thesis/executive-summary`

**Xano Endpoint:** `POST https://xsc3-mvx7-r86m.n7e.xano.io/api:o2_UyOKn/thesis_executive_summary` *(TBD — create in Xano)*

**Purpose:** High-level overview of the business concept, mission, and value proposition.

**Fields:** TBD

---

## Business Thesis Page: Products & Services

**Route:** `/business-thesis/products-services`

**Xano Endpoint:** `POST https://xsc3-mvx7-r86m.n7e.xano.io/api:o2_UyOKn/thesis_products_services` *(TBD — create in Xano)*

**Purpose:** What the business sells or provides, pricing model, and unique differentiators.

**Fields:** TBD

---

## Business Thesis Page: Market Analysis

**Route:** `/business-thesis/market-analysis`

**Xano Endpoint:** `POST https://xsc3-mvx7-r86m.n7e.xano.io/api:o2_UyOKn/thesis_market_analysis` *(TBD — create in Xano)*

**Purpose:** Target market, customer demographics, market size, and industry trends.

**Fields:** TBD

---

## Business Thesis Page: Competitive Analysis

**Route:** `/business-thesis/competitive-analysis`

**Xano Endpoint:** `POST https://xsc3-mvx7-r86m.n7e.xano.io/api:o2_UyOKn/thesis_competitive_analysis` *(TBD — create in Xano)*

**Purpose:** Competitor landscape, strengths/weaknesses vs. competitors, and competitive advantage.

**Fields:** TBD

---

## Business Thesis Page: Financial Plan

**Route:** `/business-thesis/financial-plan`

**Xano Endpoint:** `POST https://xsc3-mvx7-r86m.n7e.xano.io/api:o2_UyOKn/thesis_financial_plan` *(TBD — create in Xano)*

**Purpose:** Startup costs, revenue projections, break-even analysis, and funding needs.

**Fields:** TBD

---

## Business Thesis Page: Marketing Plan

**Route:** `/business-thesis/marketing-plan`

**Xano Endpoint:** `POST https://xsc3-mvx7-r86m.n7e.xano.io/api:o2_UyOKn/thesis_marketing_plan` *(TBD — create in Xano)*

**Purpose:** Customer acquisition strategy, branding, channels, and marketing budget.

**Fields:** TBD

---

## Business Thesis Page: Closing Statement

**Route:** `/business-thesis/closing-statement`

**Xano Endpoint:** `POST https://xsc3-mvx7-r86m.n7e.xano.io/api:o2_UyOKn/thesis_closing_statement` *(TBD — create in Xano)*

**Purpose:** Final pitch — why this business will succeed and the student's commitment to executing it.

**Fields:** TBD

---

## Business Thesis Page: Contact

**Route:** `/business-thesis/contact`

**Xano Endpoint:** `POST https://xsc3-mvx7-r86m.n7e.xano.io/api:o2_UyOKn/thesis_contact` *(TBD — create in Xano)*

**Purpose:** Business contact information, team members, advisors, and key partnerships.

**Fields:** TBD

---

## UI/Design Guidelines

- Use shadcn/ui components exclusively — no custom styled inputs or buttons
- **All form inputs must use the `InputGroup` component system** (installed via `npx shadcn@latest add input-group`):
  - `InputGroup` + `InputGroupInput` for text and number fields (not bare `<Input />`)
  - `InputGroup` + `InputGroupTextarea` for essay/textarea fields (not bare `<Textarea />`)
  - `InputGroupAddon` with `align="block-end"` on textareas for the word count display (e.g., `12 / 50 words`)
  - `InputGroupAddon` with `align="inline-end"` on inputs for the comment icon badge when comments exist
  - `InputGroupText` for currency prefixes (`$`) on number fields via `align="inline-start"`
  - `InputGroupButton` for inline actions where needed
- Other key components:
  - `Card` for form sections
  - `Select` for dropdowns, `DatePicker` for dates
  - `Button` for save actions
  - `Label` for field labels
  - `Separator` between form sections
  - `Badge` or subtle text for save state indicator
  - `AlertDialog` for unsaved changes warning
  - `Sidebar` from `sidebar-16` block as the primary app layout — do not build a custom nav
  - Login UI from `login-03` block — do not build a custom login page
  - `Avatar` + `DropdownMenu` for user menu (logout, profile)
  - `Popover` for teacher comment display (anchored to document icon badge per field)
  - `Table` for admin student roster views
- Nova style with Geist font gives a clean, modern feel — lean into that
- Gray base color — keep the palette neutral, use accent color sparingly for CTAs and save confirmation
- Small border radius per the theme config
- Mobile responsive — students will use phones
- Form sections should feel like a guided experience, not a wall of fields
- Use Hugeicons for all iconography (already configured via shadcn init)

---

## Admin Dashboard

Admins/teachers see a different experience from students. The sidebar shows two top-level nav items: **Life Map** and **Business Thesis**. Each leads to a student roster table.

### Student Roster Table

**Routes:** `/admin/life-map`, `/admin/business-thesis`

- Displays a `Table` (shadcn) of all students enrolled in the teacher's course
- Data source: Xano endpoint that returns students for the logged-in teacher (TBD — needs a GET endpoint filtered by `teachers_id`)
- Columns: Student Name, overall completion status (red/yellow/green dot), last updated timestamp
- Each row is clickable — navigates to that student's submissions

### Individual Student View

**Route:** `/admin/life-map/[studentId]`, `/admin/business-thesis/[studentId]`

**Layout:**
- Top: Student name displayed prominently
- Left sidebar: Sub-navigation for form pages (Life Map: Overview, Pathway, Profile, Career, Education, Housing, Transportation, Finance, Contact — or Business Thesis equivalents)
- Main content: Read-only view of the student's submitted form data for the selected page

**Form Display:**
- Render each form section with the same layout as the student view, but all fields are **read-only** (no editing by the teacher)
- Show the section completion dots (red/yellow/green) so teachers can see progress at a glance
- Empty fields should show a muted "No response" placeholder

**Commenting:**
- Next to each form field, show a comment icon button (Hugeicons document/note icon)
- If comments already exist on that field, the icon shows with a filled style or badge count
- Clicking the icon opens a `Popover` (shadcn) with:
  - Any existing comments on that field (read-only, stacked chronologically)
  - A textarea input at the bottom to add a new comment
  - A "Submit" button that POSTs to `/lifemap_comments` with `teachers_id` (from session), `students_id` (from route param), `field_name`, `isOld: false`, and `note`
- After submitting, the new comment appears in the popover immediately (optimistic UI)
- Teachers can add multiple comments to the same field over time

**Comment Data Flow:**
```
Teacher clicks comment icon on "reason_chosen" field
→ Popover opens, shows existing comments (GET /lifemap_comments?students_id={id}&field_name=reason_chosen)
→ Teacher writes note, clicks Submit
→ POST /lifemap_comments { teachers_id, students_id, field_name: "reason_chosen", isOld: false, note: "..." }
→ Comment appears in popover
→ Student sees new badge on their next visit (isOld: false)
→ Student opens popover → PATCH isOld: true
```

---

## Implementation Order

0. **Scaffold project** using the shadcn CLI command above, then install `sidebar-16`, `login-03`, and `input-group`
1. **Login page** — Adapt `login-03` block for Google-only OAuth via NextAuth.js, route students vs admins by role
2. **App shell** — Adapt `sidebar-16` block with full nav structure for both student and admin views
3. **Shared form infrastructure** (auto-save hook, save indicator, form wrapper component, completion dot logic, comment fetching/display)
4. **Housing page** (first form — fields already defined, validates the form system works)
5. **Remaining Life Map pages** — Overview, Pathway, Profile, Career, Education, Transportation, Finance, Contact (one at a time, each using the shared form system)
6. **Business Thesis pages** — Executive Summary, Products & Services, Market Analysis, Competitive Analysis, Financial Plan, Marketing Plan, Closing Statement, Contact
7. **Admin student roster table** (Life Map and Business Thesis)
8. **Admin individual student view** with read-only form display and commenting

---

## Key Implementation Notes

- `user_email` and `students_id`: Pull from NextAuth session on every save — never expose in form UI.
- Image uploads: Check if Xano has a separate file upload endpoint. Upload image first, get back file object/URL, then include in form payload.
- All currency fields use `InputGroup` with `InputGroupText` `$` prefix addon. Accept numbers only, send as numbers to Xano.
- Date fields send as ISO 8601 strings or null.
