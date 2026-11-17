export type LowOccupancyOutreachIntent = "message" | "campaign" | "workspace"

export const LOW_OCCUPANCY_OUTREACH_EVENT = "maiin-low-occupancy-outreach"
export const LOW_OCCUPANCY_OUTREACH_STORAGE_KEY = "maiin-low-occupancy-outreach-context"
export const LOW_OCCUPANCY_OUTREACH_TTL_MS = 2 * 60 * 60 * 1000

interface StoredOutreachEnvelope {
  savedAt: number
  context: LowOccupancyOutreachContext
}

export interface LowOccupancyOutreachContext {
  source: "low_occupancy_targeting"
  intent: LowOccupancyOutreachIntent
  customerKey: string
  customerName: string | null
  // Contact details are intentionally not persisted in localStorage. They stay
  // in the page's in-memory table and are re-fetched from the backend if needed.
  phone?: string | null
  email?: string | null
  customerTypeLabel: string
  bookingTypeDominant: string | null
  courtType: string
  sessionName: string
  sessionStartHour?: string | null
  sessionEndHour?: string | null
  slotTimeLabel?: string | null
  date: string
  preferredSession: string | null
  selectedSessionBookingCount: number
  selectedCourtBookingCount: number
  totalBookingCount: number
  lastBookingDate: string | null
  recencyDays: number
  avgSpend: number
  totalRevenue: number
  rfmSegmentName: string | null
  targetPriorityScore: number
  targetPriorityLabel: string
  suggestedAction: string
  whatsappMessage: string
}

export const saveLowOccupancyOutreachContext = (
  context: LowOccupancyOutreachContext
) => {
  if (typeof window === "undefined") return

  const safeContext: LowOccupancyOutreachContext = { ...context }
  delete safeContext.phone
  delete safeContext.email
  const envelope: StoredOutreachEnvelope = {
    savedAt: Date.now(),
    context: safeContext,
  }

  window.localStorage.setItem(
    LOW_OCCUPANCY_OUTREACH_STORAGE_KEY,
    JSON.stringify(envelope)
  )

  window.dispatchEvent(
    new CustomEvent(LOW_OCCUPANCY_OUTREACH_EVENT, {
      detail: safeContext,
    })
  )
}

export const readLowOccupancyOutreachContext = (): LowOccupancyOutreachContext | null => {
  if (typeof window === "undefined") return null

  const rawValue = window.localStorage.getItem(LOW_OCCUPANCY_OUTREACH_STORAGE_KEY)
  if (!rawValue) return null

  try {
    const parsed = JSON.parse(rawValue) as Partial<StoredOutreachEnvelope> & LowOccupancyOutreachContext

    // Legacy entries were stored without a timestamp and included phone/email;
    // discard them rather than keeping personal data indefinitely.
    if (!parsed?.savedAt || !parsed?.context) {
      clearLowOccupancyOutreachContext()
      return null
    }

    if (Date.now() - parsed.savedAt > LOW_OCCUPANCY_OUTREACH_TTL_MS) {
      clearLowOccupancyOutreachContext()
      return null
    }

    return parsed.context
  } catch {
    clearLowOccupancyOutreachContext()
    return null
  }
}

export const clearLowOccupancyOutreachContext = () => {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(LOW_OCCUPANCY_OUTREACH_STORAGE_KEY)
}
