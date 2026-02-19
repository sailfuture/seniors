import type { FormPageConfig } from "@/lib/form-types"

const XANO_BASE =
  process.env.NEXT_PUBLIC_XANO_API_BASE ??
  "https://xsc3-mvx7-r86m.n7e.xano.io/api:o2_UyOKn"

export const housingConfig: FormPageConfig = {
  xanoEndpoint: `${XANO_BASE}/lifeplan_housing`,
  xanoLoadEndpoint: `${XANO_BASE}/lifeplan_housing_by_student_id`,
  defaultValues: {
    user_email: "",
    students_id: null,
    housing_image_1: null,
    housing_image_2: null,
    housing_type: "",
    location: "",
    room_configuration: "",
    roommate_situation: "",
    distance_to_work_school_or_program: "",
    reason_chosen: "",
    meets_needs_explanation: "",
    alternative_housing_considered: "",
    monthly_rent: 0,
    housing_deposit: 0,
    utilities_cost: 0,
    internet_cost: 0,
    move_in_date: "",
    term_commitment: "",
    housing_description: "",
    amenities_included: "",
    housing_policies_rules: "",
  },
  sections: [
    {
      title: "Your Housing Choice",
      fields: [
        "housing_image_1",
        "housing_image_2",
        "housing_type",
        "location",
        "room_configuration",
      ],
    },
    {
      title: "Living Situation",
      fields: [
        "roommate_situation",
        "distance_to_work_school_or_program",
        "reason_chosen",
        "meets_needs_explanation",
        "alternative_housing_considered",
      ],
    },
    {
      title: "Costs",
      fields: ["monthly_rent", "housing_deposit", "utilities_cost", "internet_cost"],
    },
    {
      title: "Details",
      fields: [
        "move_in_date",
        "term_commitment",
        "housing_description",
        "amenities_included",
        "housing_policies_rules",
      ],
    },
  ],
  fields: [
    { name: "user_email", type: "hidden", section: "" },
    { name: "students_id", type: "hidden", section: "" },
    { name: "housing_image_1", type: "image", label: "Housing Image 1", required: true, section: "Your Housing Choice" },
    { name: "housing_image_2", type: "image", label: "Housing Image 2", required: true, section: "Your Housing Choice" },
    { name: "housing_type", type: "select", label: "Housing Type", placeholder: "Select housing type...", options: ["Apartment", "House", "Room Rental", "Dorm", "Other"], required: true, section: "Your Housing Choice" },
    { name: "location", type: "text", label: "Location", placeholder: "Address or area description", required: true, section: "Your Housing Choice" },
    { name: "room_configuration", type: "select", label: "Room Configuration", placeholder: "Select configuration...", options: ["Studio", "1BR", "2BR", "3BR+", "Shared Room"], required: true, section: "Your Housing Choice" },
    { name: "roommate_situation", type: "text", label: "Roommate Situation", required: true, section: "Living Situation" },
    { name: "distance_to_work_school_or_program", type: "text", label: "Distance to Work / School / Program", required: true, section: "Living Situation" },
    { name: "reason_chosen", type: "textarea", label: "Why did you choose this housing?", minWords: 50, required: true, section: "Living Situation" },
    { name: "meets_needs_explanation", type: "textarea", label: "How does it meet your needs?", minWords: 50, required: true, section: "Living Situation" },
    { name: "alternative_housing_considered", type: "textarea", label: "What alternatives did you consider?", minWords: 30, required: true, section: "Living Situation" },
    { name: "monthly_rent", type: "number", label: "Monthly Rent", required: true, section: "Costs" },
    { name: "housing_deposit", type: "number", label: "Housing Deposit", required: true, section: "Costs" },
    { name: "utilities_cost", type: "number", label: "Utilities Cost", required: true, section: "Costs" },
    { name: "internet_cost", type: "number", label: "Internet Cost", required: true, section: "Costs" },
    { name: "move_in_date", type: "date", label: "Move-in Date", required: true, section: "Details" },
    { name: "term_commitment", type: "select", label: "Term Commitment", placeholder: "Select term...", options: ["Month-to-month", "6 months", "12 months", "Other"], required: true, section: "Details" },
    { name: "housing_description", type: "textarea", label: "Describe the place", minWords: 75, required: true, section: "Details" },
    { name: "amenities_included", type: "textarea", label: "Amenities Included", minWords: 30, required: true, section: "Details" },
    { name: "housing_policies_rules", type: "textarea", label: "Housing Policies & Rules", minWords: 30, required: true, section: "Details" },
  ],
}

export const sectionConfigMap: Record<string, { title: string; config: FormPageConfig; commentsEndpoint?: string }> = {
  housing: {
    title: "Housing & Living",
    config: housingConfig,
    commentsEndpoint: `${XANO_BASE}/lifemap_comments`,
  },
}
