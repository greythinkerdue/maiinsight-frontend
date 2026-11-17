import { getApiUrl } from "@/lib/api"
import { getAuthHeaders } from "@/lib/roles"

export interface LowOccupancySessionCard {
  date: string
  courtType: string
  courtTypeLabel: string
  sessionName: string
  sessionStartHour: string
  sessionEndHour: string
  occupiedCourtHours: number
  availableCourtHours: number
  occupancyRate: number
  status: "Low" | "Normal"
  potentialTargetCount: number
}

export interface RecommendedTargetCustomer {
  customerKey: string
  customerName: string | null
  phone: string | null
  email: string | null
  customerTypeLabel: string
  bookingTypeDominant: string | null
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

export interface RecommendedCustomersResponse {
  campaignDay: string
  analysisPeriodMonths: number
  latestPlayDate: string | null
  unavailableReason: "LATEST_PLAY_DATE_NOT_AVAILABLE" | null
  courtType: string
  sessionName: string
  segmentName: string | null
  customerType: string
  campaignDate: string | null
  historyLookbackMonths: number
  slotAvailability: SlotAvailability | null
  audienceCoverage: AudienceCoverage | null
  customers: RecommendedTargetCustomer[]
  totalCustomers: number
  monthlyPerformance: Array<{
    month: string
    monthLabel: string
    dataThrough: string
    totalPossibleSlots: number
    occupiedSlots: number
    emptySlots: number
    occupancyRate: number | null
    revenue: number
  }>
  historicalSummary: {
    analysisPeriodMonths: number
    averageOccupancy: number | null
    averageFilledSlots: number
    totalRevenue: number
    averageMonthlyRevenue: number
  } | null
  pagination: {
    limit: number
    offset: number
    returned: number
    totalCustomers: number
    hasMore: boolean
  }
}

export interface SlotAvailability {
  campaignDate: string
  sessionName: string
  sessionStartHour: string | null
  sessionEndHour: string | null
  courtType: string
  courtTypeLabel: string
  capacityCourtHours: number
  occupiedCourtHours: number
  blockedCourtHours: number
  availableCourtHours: number
  occupancyRate: number
  dataAvailable: boolean
  note: string
}

export type AudienceCoverageStatus = "insufficient" | "adequate" | "sufficient" | "unknown"

export interface AudienceCoverage {
  emptySlots: number
  capacityCourtHours: number
  audienceSize: number
  customersPerEmptySlot: number | null
  recommendedCoveragePerSlot: number
  coverageStatus: AudienceCoverageStatus
  note: string
}

export type OutreachRecipientStatus = "pending" | "sent" | "skipped" | "opted_out"
export type OutreachCampaignStatus = "draft" | "active" | "completed" | "archived"

export interface OutreachRecipient {
  id: number
  customerKey: string
  customerName: string | null
  phone: string | null
  rfmSegmentName: string | null
  preferredSession: string | null
  customerTypeLabel: string
  suggestedAction: string
  promoCode: string
  isControl: boolean
  status: OutreachRecipientStatus
  sentAt: string | null
  whatsappMessage: string | null
  whatsappUrl: string | null
}

export interface OutreachPerformance {
  windowDays: number
  audienceSize: number
  sentCount: number
  pendingCount: number
  optedOutCount: number
  treatmentSize: number
  controlSize: number
  treatmentConvertedCustomers: number
  treatmentBookings: number
  treatmentRevenue: number
  controlConvertedCustomers: number
  controlBookings: number
  conversionRate: number
  controlConversionRate: number
  liftPct: number | null
  liftSignificance: {
    pValue: number
    zScore: number
    significant: boolean
    confidenceIntervalPct: [number, number]
    method: string
  } | null
  estimatedIncrementalBookings: number
  estimatedIncrementalRevenue: number
  attributedBookingCount: number
  attributedRevenue: number
  attributedCustomers: number
  windowRevenue: number
  redemptionRate: number
  revenuePerRecipient: number
  costBudget: number
  costPerBooking: number | null
  returnOnCampaignSpend: number | null
  responseRate: null
  responseRateNote: string
  optOutRate: number
  cannibalizationRate: number
  possibleUnmatchedConversions: Array<{
    customerKey: string
    customerName: string
    promoCode: string
    bookingCount: number
    revenue: number
  }>
  possibleUnmatchedConversionsNote: string | null
  emptySlots: number
  audienceCoverage: AudienceCoverage | null
  occupancyRate: number | null
  baselineOccupancyRate: number | null
  occupancyLiftPct: number | null
  controlNote: string | null
}

export interface OutreachCampaignSummary {
  id: number
  name: string
  promoCodePrefix: string
  campaignDate: string
  campaignDay: string
  sessionName: string
  courtType: string
  segmentName: string | null
  customerType: string
  status: OutreachCampaignStatus
  costBudget: number
  recipientCount: number
  createdAt: string
}

export interface OutreachCampaignDetail {
  campaign: OutreachCampaignSummary & {
    consentConfirmed: boolean
    consentConfirmedAt: string | null
    controlPercent: number
    audienceFilters: Record<string, unknown> | null
    updatedAt: string
  }
  performance: OutreachPerformance
  slotAvailability: SlotAvailability | null
  baselineOccupancy: {
    weeks: number
    sampleDays: number
    averageOccupancyRate: number | null
    averageOccupiedCourtHours: number | null
    averageAvailableCourtHours: number | null
  } | null
  recipients?: OutreachRecipient[]
  recipientCount: number
}

export interface OutreachSuppression {
  id: number
  customerKey: string
  reason: string | null
  createdAt: string
}

export interface CampaignKpiDefinition {
  key: string
  label: string
  description: string
}

export interface CampaignKpiOverview {
  campaigns: OutreachCampaignSummary[]
  selected: OutreachCampaignDetail | null
  kpiDefinitions: CampaignKpiDefinition[]
}

interface ApiEnvelope<T> {
  success: boolean
  message?: string
  error?: string
  data?: T
}

const buildQuery = (
  params: Record<string, string | number | boolean | null | undefined>
) => {
  const searchParams = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return
    searchParams.set(key, String(value))
  })

  const query = searchParams.toString()
  return query ? `?${query}` : ""
}

const readApiResponse = async <T>(response: Response): Promise<T> => {
  const result: ApiEnvelope<T> | null = await response.json().catch(() => null)

  if (!response.ok || !result?.success || !result.data) {
    throw new Error(result?.message || result?.error || "Request failed.")
  }

  return result.data
}

export const getLowOccupancySessions = async (params: {
  date?: string
  startDate?: string
  endDate?: string
  campaignDay?: string
  analysisPeriodMonths?: number
  courtType?: string
  threshold?: number
} = {}) => {
  const query = buildQuery(params)
  const response = await fetch(getApiUrl(`/targeting/low-occupancy-sessions${query}`), {
    method: "GET",
    cache: "no-store",
    headers: getAuthHeaders(),
  })

  return readApiResponse<{ sessions: LowOccupancySessionCard[] }>(response)
}

export const getRecommendedCustomers = async (params: {
  campaignDay: string
  analysisPeriodMonths: number
  courtType?: string
  sessionName: string
  customerType?: string
  segmentName?: string
  campaignDate?: string
  limit?: number
  offset?: number
}) => {
  const query = buildQuery(params)
  const response = await fetch(getApiUrl(`/targeting/recommended-customers${query}`), {
    method: "GET",
    cache: "no-store",
    headers: getAuthHeaders(),
  })

  return readApiResponse<RecommendedCustomersResponse>(response)
}

export const generateOutreachMessage = async (params: {
  customerName: string
  rfmSegmentName: string | null
  customerTypeLabel: string
  preferredSession: string | null
  courtType: string
  suggestedAction: string
  recencyDays: number
  totalBookingCount: number
}) => {
  const response = await fetch(getApiUrl("/targeting/generate-message"), {
    method: "POST",
    cache: "no-store",
    headers: {
      ...getAuthHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  })

  return readApiResponse<{ provider: string; model: string; message: string }>(response)
}

export const getSlotAvailability = async (params: {
  campaignDate: string
  sessionName: string
  courtType?: string
}) => {
  const query = buildQuery(params)
  const response = await fetch(getApiUrl(`/targeting/slot-availability${query}`), {
    method: "GET",
    cache: "no-store",
    headers: getAuthHeaders(),
  })

  return readApiResponse<{ slotAvailability: SlotAvailability }>(response)
}

export const createOutreachCampaign = async (params: {
  name: string
  campaignDate: string
  campaignDay: string
  sessionName: string
  courtType: string
  customerType: string
  segmentName?: string
  analysisPeriodMonths: number
  promoCodePrefix: string
  costBudget: number
  controlPercent: number
  consentConfirmed: boolean
}) => {
  const response = await fetch(getApiUrl("/targeting/outreach-campaigns"), {
    method: "POST",
    cache: "no-store",
    headers: {
      ...getAuthHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  })

  return readApiResponse<OutreachCampaignDetail>(response)
}

export const listOutreachCampaigns = async () => {
  const response = await fetch(getApiUrl("/targeting/outreach-campaigns"), {
    method: "GET",
    cache: "no-store",
    headers: getAuthHeaders(),
  })

  return readApiResponse<{ campaigns: OutreachCampaignSummary[] }>(response)
}

export const getOutreachCampaign = async (campaignId: number) => {
  const response = await fetch(getApiUrl(`/targeting/outreach-campaigns/${campaignId}`), {
    method: "GET",
    cache: "no-store",
    headers: getAuthHeaders(),
  })

  return readApiResponse<OutreachCampaignDetail>(response)
}

export const updateOutreachRecipientStatus = async (
  campaignId: number,
  recipientId: number,
  status: OutreachRecipientStatus
) => {
  const response = await fetch(
    getApiUrl(`/targeting/outreach-campaigns/${campaignId}/recipients/${recipientId}`),
    {
      method: "PATCH",
      cache: "no-store",
      headers: {
        ...getAuthHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status }),
    }
  )

  return readApiResponse<{ recipient: { id: number; status: OutreachRecipientStatus; sentAt: string | null } }>(
    response
  )
}

export const updateOutreachCampaignStatus = async (
  campaignId: number,
  status: OutreachCampaignStatus,
  confirmConsent?: boolean
) => {
  const response = await fetch(getApiUrl(`/targeting/outreach-campaigns/${campaignId}/status`), {
    method: "PATCH",
    cache: "no-store",
    headers: {
      ...getAuthHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status, confirmConsent }),
  })

  return readApiResponse<{ campaign: OutreachCampaignSummary }>(response)
}

export interface OutreachSendResult {
  attempted: number
  sent: number
  failed: number
  skippedNoPhone: number
  errors: Array<{ customerKey: string; error: string }>
}

export const sendOutreachCampaignMessages = async (campaignId: number) => {
  const response = await fetch(getApiUrl(`/targeting/outreach-campaigns/${campaignId}/send`), {
    method: "POST",
    cache: "no-store",
    headers: getAuthHeaders(),
  })

  return readApiResponse<OutreachSendResult>(response)
}

export interface AutoDraftScanResult {
  created: Array<{
    campaignId: number
    name: string
    campaignDate: string
    campaignDay: string
    sessionName: string
    courtType: string
    audienceSize: number
    baselineOccupancyRate: number
  }>
  scannedDays: number
  occupancyThreshold: number
  minAudience: number
}

export const runAutoDraftScan = async () => {
  const response = await fetch(getApiUrl("/targeting/outreach-campaigns/auto-draft/run"), {
    method: "POST",
    cache: "no-store",
    headers: getAuthHeaders(),
  })

  return readApiResponse<AutoDraftScanResult>(response)
}

export const listOutreachSuppressions = async () => {
  const response = await fetch(getApiUrl("/targeting/outreach-suppressions"), {
    method: "GET",
    cache: "no-store",
    headers: getAuthHeaders(),
  })

  return readApiResponse<{ suppressions: OutreachSuppression[] }>(response)
}

export const addOutreachSuppression = async (customerKey: string, reason?: string) => {
  const response = await fetch(getApiUrl("/targeting/outreach-suppressions"), {
    method: "POST",
    cache: "no-store",
    headers: {
      ...getAuthHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ customerKey, reason }),
  })

  return readApiResponse<{ suppression: OutreachSuppression }>(response)
}

export const removeOutreachSuppression = async (customerKey: string) => {
  const response = await fetch(
    getApiUrl(`/targeting/outreach-suppressions/${encodeURIComponent(customerKey)}`),
    {
      method: "DELETE",
      cache: "no-store",
      headers: getAuthHeaders(),
    }
  )

  return readApiResponse<{ removed: boolean }>(response)
}

export const getCampaignKpis = async (campaignId?: number) => {
  const query = buildQuery({ campaignId })
  const response = await fetch(getApiUrl(`/targeting/campaign-kpis${query}`), {
    method: "GET",
    cache: "no-store",
    headers: getAuthHeaders(),
  })

  return readApiResponse<CampaignKpiOverview>(response)
}
