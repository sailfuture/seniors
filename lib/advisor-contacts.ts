/**
 * Who thesis advisors contact at SailFuture Academy, shown on the advisor
 * home page. Edit here; a contact without a phone simply shows no phone.
 */
export interface AdvisorContact {
  name: string
  title: string
  email: string
  /** As displayed, e.g. "727-353-2318". */
  phone?: string
}

export const ADVISOR_CONTACTS: AdvisorContact[] = [
  {
    name: "Ms. Witeck",
    title: "Teacher, SailFuture Academy",
    email: "mwiteck@sailfuture.org",
    phone: "727-353-2318",
  },
  {
    name: "Renee",
    title: "Thesis Advisor Supervisor",
    email: "renee@hanover-consulting.com",
    // Phone number not provided yet.
  },
]

/** "727-353-2318" -> "tel:+17273532318" (US numbers). */
export function telHref(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  return `tel:+${digits.length === 10 ? `1${digits}` : digits}`
}
