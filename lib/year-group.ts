/**
 * Display form of a student's year group: the roster data says "Batch Year
 * 2026" / "Batch of 2026", but cohorts are branded as classes — show
 * "Class of 2026". Labels without a "Batch … year" shape pass through.
 */
export function formatYearGroup(label: string): string {
  return label.replace(/batch\s*(?:of|year)?\s*(\d{4})/i, "Class of $1")
}
