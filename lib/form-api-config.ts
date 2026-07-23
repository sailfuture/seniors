const LIFEMAP_BASE =
  process.env.NEXT_PUBLIC_XANO_API_BASE ??
  "https://xsc3-mvx7-r86m.n7e.xano.io/api:o2_UyOKn"

const BUSINESSTHESIS_BASE =
  process.env.NEXT_PUBLIC_XANO_BT_API_BASE ??
  "https://xsc3-mvx7-r86m.n7e.xano.io/api:45yS7ICi"

const PLAGIARISM_BASE = "https://xsc3-mvx7-r86m.n7e.xano.io/api:-S1CSX2N"

// The response event logs live in the shared students API group.
const EVENTS_BASE = "https://xsc3-mvx7-r86m.n7e.xano.io/api:fJsHVIeC"

export interface FormApiConfig {
  templateEndpoint: string
  responsesEndpoint: string
  /** Cross-student responses (no students_id filter) for admin/teacher views. */
  allResponsesEndpoint: string
  responsePatchBase: string
  customGroupEndpoint: string
  commentsEndpoint: string
  questionTypesEndpoint: string
  uploadEndpoint: string
  sectionsEndpoint: string
  publishQuestionsEndpoint: string
  groupDisplayTypesEndpoint: string
  addGroupDisplayTemplateEndpoint: string
  plagiarismCheckEndpoint?: string
  plagiarismResponseIdField?: string
  gptzeroEndpoint?: string
  gptzeroDeleteBase?: string
  eventPrefix?: string
  /** Append-only log of review-state transitions (submit/revision/complete). */
  responseEventsEndpoint?: string
  /** Append-only content snapshots for edit history. */
  responseVersionsEndpoint?: string
  /** Per-student project locks: frozen render snapshots of finished work. */
  locksEndpoint?: string
  /** Admin route base for this product, e.g. `/admin/business-thesis`. */
  adminBasePath: string
  fields: {
    sectionId: string
    customGroupId: string
    templateId: string
    displayTypesId: string
    displayTypesExpansion: string
  }
}

export const LIFEMAP_API_CONFIG: FormApiConfig = {
  adminBasePath: "/admin/life-map",
  responseEventsEndpoint: `${EVENTS_BASE}/lifemap_response_events`,
  responseVersionsEndpoint: `${LIFEMAP_BASE}/lifemap_response_versions`,
  locksEndpoint: `${LIFEMAP_BASE}/lifemap_locks`,
  templateEndpoint: `${LIFEMAP_BASE}/lifeplan_template`,
  responsesEndpoint: `${LIFEMAP_BASE}/lifemap_responses_by_student`,
  allResponsesEndpoint: `${LIFEMAP_BASE}/lifemap_responses`,
  responsePatchBase: `${LIFEMAP_BASE}/lifemap_responses`,
  customGroupEndpoint: `${LIFEMAP_BASE}/lifemap_custom_group`,
  commentsEndpoint: `${LIFEMAP_BASE}/lifemap_comments`,
  questionTypesEndpoint: `${LIFEMAP_BASE}/question_types`,
  uploadEndpoint: `${LIFEMAP_BASE}/upload/image`,
  sectionsEndpoint: `${LIFEMAP_BASE}/lifemap_sections`,
  publishQuestionsEndpoint: `${LIFEMAP_BASE}/publish_questions`,
  groupDisplayTypesEndpoint: `${LIFEMAP_BASE}/lifemap_group_display_types`,
  addGroupDisplayTemplateEndpoint: `${LIFEMAP_BASE}/add_group_display_template`,
  plagiarismCheckEndpoint: `${PLAGIARISM_BASE}/plagiarism_checker`,
  plagiarismResponseIdField: "lifemap_sections_responses_id",
  gptzeroEndpoint: `${PLAGIARISM_BASE}/gptzero_document_by_section`,
  gptzeroDeleteBase: `${PLAGIARISM_BASE}/gptzero_document`,
  fields: {
    sectionId: "lifemap_sections_id",
    customGroupId: "lifemap_custom_group_id",
    templateId: "lifemap_template_id",
    displayTypesId: "lifemap_group_display_types_id",
    displayTypesExpansion: "_lifemap_group_display_types",
  },
}

export const BUSINESSTHESIS_API_CONFIG: FormApiConfig = {
  eventPrefix: "bt-",
  adminBasePath: "/admin/business-thesis",
  responseEventsEndpoint: `${EVENTS_BASE}/businessthesis_response_events`,
  responseVersionsEndpoint: `${BUSINESSTHESIS_BASE}/businessthesis_response_versions`,
  locksEndpoint: `${BUSINESSTHESIS_BASE}/businessthesis_locks`,
  templateEndpoint: `${BUSINESSTHESIS_BASE}/businessthesis_template`,
  responsesEndpoint: `${BUSINESSTHESIS_BASE}/businessthesis_responses_by_student`,
  allResponsesEndpoint: `${BUSINESSTHESIS_BASE}/businessthesis_responses`,
  responsePatchBase: `${BUSINESSTHESIS_BASE}/businessthesis_responses`,
  customGroupEndpoint: `${BUSINESSTHESIS_BASE}/businessthesis_custom_group`,
  commentsEndpoint: `${BUSINESSTHESIS_BASE}/businessthesis_comments`,
  questionTypesEndpoint: `${LIFEMAP_BASE}/question_types`,
  uploadEndpoint: `${BUSINESSTHESIS_BASE}/businessthesis_upload/image`,
  sectionsEndpoint: `${BUSINESSTHESIS_BASE}/businessthesis_sections`,
  publishQuestionsEndpoint: `${BUSINESSTHESIS_BASE}/businessthesis_publish_questions`,
  groupDisplayTypesEndpoint: `${BUSINESSTHESIS_BASE}/businessthesis_group_display_types`,
  addGroupDisplayTemplateEndpoint: `${BUSINESSTHESIS_BASE}/businessthesis_add_group_display_template`,
  plagiarismCheckEndpoint: `${BUSINESSTHESIS_BASE}/businessthesis_plagiarism_checker`,
  plagiarismResponseIdField: "businessthesis_responses_id",
  gptzeroEndpoint: `${PLAGIARISM_BASE}/businessthesis_gptzero_document_by_section`,
  gptzeroDeleteBase: `${BUSINESSTHESIS_BASE}/businessthesis_gptzero_document`,
  fields: {
    sectionId: "businessthesis_sections_id",
    customGroupId: "businessthesis_custom_group_id",
    templateId: "businessthesis_template_id",
    displayTypesId: "businessthesis_group_display_types_id",
    displayTypesExpansion: "_businessthesis_group_display_types",
  },
}
