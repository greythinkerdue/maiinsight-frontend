"use client"

import { useEffect, useRef, useState } from "react"
import {
  AlertCircle,
  CalendarDays,
  Check,
  Copy,
  Download,
  Info,
  Loader2,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Target,
  UserX,
} from "lucide-react"
import { HeatmapGrid } from "@/components/segment-visualization"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardTitleTooltip,
} from "@/components/ui/card"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
} from "@/components/ui/pagination"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  addOutreachSuppression,
  createOutreachCampaign,
  generateOutreachMessage,
  getOutreachCampaign,
  getRecommendedCustomers,
  updateOutreachRecipientStatus,
  type AudienceCoverage,
  type OutreachCampaignDetail,
  type OutreachRecipientStatus,
  type RecommendedCustomersResponse,
  type RecommendedTargetCustomer,
  type SlotAvailability,
} from "@/lib/targeting"
import { saveLowOccupancyOutreachContext } from "@/lib/low-occupancy-outreach"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts"
import { getApiUrl } from "@/lib/api"
import { getAuthHeaders } from "@/lib/roles"
import type { PageId } from "./dashboard-sidebar"

interface LowOccupancyTargetingProps {
  onNavigate: (page: PageId) => void
}
interface PlaytimeSessionPoint {
  play_time_group?: string
  playTimeGroup?: string
  session_count?: number
  sessionCount?: number
}

interface HeatmapSummary {
  slots: Array<{
    day_short: string
    startHour: string
    session_count: number
    session_label?: string
    totalCapacity?: number
    totalPossibleSessions?: number
    occupiedCustomerSessions?: number
    occupiedSlots?: number
    internalSessions?: number
    blockedSlots?: number
    tutupSessions?: number
    emptySessions?: number
    emptySlots?: number
    totalPossibleSlots?: number
    occupancyRate?: number | null
    emptyRate?: number
    internalRate?: number
    tutupRate?: number
  }>
  mostEmptySlot: {
    dayLabel: string
    hourLabel: string
    sessionLabel: string
    sessionCount: number
  } | null
}

interface PlaytimeMixData {
  totalCustomers: number
  totalSessions: number
  sessionByTime?: unknown
}

interface CustomerPagination {
  totalCustomers: number
  returned: number
  offset: number
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const PLAYTIME_CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"]
const PLAYTIME_ORDER: Record<string, number> = {
  Morning: 0, Afternoon: 1, Evening: 2, Night: 3,
  Pagi: 0, Siang: 1, Malam: 3,
}

const SESSION_HOUR_LABELS: Record<string, string> = {
  Morning: "06:00 - 10:59",
  Afternoon: "11:00 - 14:59",
  Evening: "15:00 - 18:59",
  Night: "19:00 - 23:59",
}

const PlaytimeAxisTick = ({ x, y, payload }: { x?: number; y?: number; payload?: { value?: string } }) => {
  const sessionName = payload?.value || ""
  const hourLabel = SESSION_HOUR_LABELS[sessionName] || ""

  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={12} textAnchor="middle" fill="var(--foreground)" fontSize={12} fontWeight={500}>
        {sessionName}
      </text>
      <text x={0} y={0} dy={28} textAnchor="middle" fill="var(--muted-foreground)" fontSize={10}>
        {hourLabel}
      </text>
    </g>
  )
}
const PLAYTIME_LABEL_MAP: Record<string, string> = {
  Pagi: "Morning", Siang: "Afternoon", Malam: "Night",
}
const formatPlaytimePercent = (value: number) => `${Number(value.toFixed(1))}%`

const parsePlaytimeJsonArray = <T,>(value: unknown): T[] => {
  if (Array.isArray(value)) return value as T[]
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? (parsed as T[]) : []
    } catch {
      return []
    }
  }
  return []
}

const buildPlaytimeChart = (data: PlaytimeMixData | null) => {
  const directRows = parsePlaytimeJsonArray<PlaytimeSessionPoint>(data?.sessionByTime)

  return directRows
    .map((row, index) => {
      const rawName = row.play_time_group || row.playTimeGroup || ""
      if (!rawName) return null
      return {
        name: PLAYTIME_LABEL_MAP[rawName] || rawName,
        rawName,
        value: Number(row.session_count ?? row.sessionCount ?? 0),
        color: PLAYTIME_CHART_COLORS[index % PLAYTIME_CHART_COLORS.length],
      }
    })
    .filter((item): item is { name: string; rawName: string; value: number; color: string } => Boolean(item))
    .sort((left, right) => (PLAYTIME_ORDER[left.rawName] ?? 99) - (PLAYTIME_ORDER[right.rawName] ?? 99))
}

const SESSION_OPTIONS = ["Morning", "Afternoon", "Evening", "Night"] as const
const COURT_OPTIONS = [
  { value: "all", label: "All" },
  { value: "mini_soccer", label: "Mini Soccer" },
  { value: "basketball", label: "Basketball" },
]
const CUSTOMER_TYPE_OPTIONS = [
  { value: "all", label: "All" },
  { value: "membership", label: "Membership" },
  { value: "non_membership", label: "Non Membership" },
]
const SEGMENT_OPTIONS = [
  { value: "all", label: "All" },
  { value: "High-Value Players", label: "High-Value Players" },
  { value: "Regular Players", label: "Regular Players" },
  { value: "Occasional Players", label: "Occasional Players" },
  { value: "Lapsed Players", label: "Lapsed Players" },
]

const getTodayIso = () => {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, "0")
  const day = String(today.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

const formatIsoDateLocal = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

const getNextWeekdayIso = (dayName: string, fromIso?: string) => {
  const targetIndex = CAMPAIGN_DAY_OPTIONS.indexOf(dayName)
  if (targetIndex < 0) return fromIso || getTodayIso()
  const date = fromIso ? new Date(`${fromIso}T00:00:00`) : new Date()
  if (Number.isNaN(date.getTime())) return getTodayIso()
  const currentIndex = date.getDay() === 0 ? 6 : date.getDay() - 1
  const offset = (targetIndex - currentIndex + 7) % 7
  date.setDate(date.getDate() + offset)
  return formatIsoDateLocal(date)
}

const getWeekdayNameFromIso = (isoDate: string) => {
  const date = new Date(`${isoDate}T00:00:00`)
  if (Number.isNaN(date.getTime())) return null
  const index = date.getDay() === 0 ? 6 : date.getDay() - 1
  return CAMPAIGN_DAY_OPTIONS[index] || null
}

const formatIsoDateDisplay = (isoDate: string | null) => {
  if (!isoDate) return "-"
  const date = new Date(`${isoDate.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(date.getTime())) return isoDate
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date)
}

const normalizePhoneForLink = (phone: string | null) => {
  const digits = String(phone || "").replace(/\D/g, "")
  if (!digits) return null
  if (digits.startsWith("62")) return digits
  if (digits.startsWith("0")) return `62${digits.slice(1)}`
  return digits
}

const buildWhatsappLink = (phone: string | null, message: string | null) => {
  const normalized = normalizePhoneForLink(phone)
  if (!normalized || !message) return null
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`
}

const downloadTextFile = (filename: string, content: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

const escapeCsvValue = (value: unknown) => {
  const text = String(value ?? "")
  if (!/[",\n]/.test(text)) return text
  return `"${text.replace(/"/g, '""')}"`
}
const INITIAL_COURT_TYPE = "all"
const INITIAL_SESSION_NAME: (typeof SESSION_OPTIONS)[number] = "Morning"
const INITIAL_CUSTOMER_TYPE = "all"
const INITIAL_SEGMENT_NAME = "all"
const CAMPAIGN_DAY_OPTIONS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
const INITIAL_CAMPAIGN_DAY = "Monday"
const INITIAL_CAMPAIGN_DATE = getNextWeekdayIso(INITIAL_CAMPAIGN_DAY)
const INITIAL_PROMO_PREFIX = "MAIIN"
const ANALYSIS_PERIOD_OPTIONS = [1, 2, 3, 4, 6, 12]

const VENUE_OPTIONS = [
  { value: "All Venue", label: "All Venue" },
  { value: "Mini Soccer", label: "Mini Soccer" },
  { value: "Basketball", label: "Basketball" },
]

const BOOKING_TYPE_OPTIONS = [
  { value: "All Type", label: "All Type" },
  { value: "GeloraApp Booking", label: "Gelora Booking" },
  { value: "Manual/Walk-in", label: "Manual/Walk-in" },
  { value: "Internal", label: "Internal" },
]

const INITIAL_CUSTOMER_PAGE_SIZE = 10

const getLast30DaysRange = () => {
  const end = new Date()
  const start = new Date()

  start.setDate(end.getDate() - 30)

  const formatDate = (value: Date) => {
    const year = value.getFullYear()
    const month = String(value.getMonth() + 1).padStart(2, "0")
    const day = String(value.getDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
  }

  return {
    startDate: formatDate(start),
    endDate: formatDate(end),
  }
}

const INITIAL_DATE_RANGE = getLast30DaysRange()

const buildMonthRange = (monthKey: string) => {
  const parts = monthKey.split("-")
  if (parts.length !== 2) return null
  const year = Number(parts[0])
  const month = Number(parts[1])
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return null
  const lastDay = new Date(year, month, 0).getDate()
  const monthValue = String(month).padStart(2, "0")
  return {
    startDate: `${year}-${monthValue}-01`,
    endDate: `${year}-${monthValue}-${String(lastDay).padStart(2, "0")}`,
  }
}

const buildMonthRangeLabel = (min?: string | null, max?: string | null) => {
  const format = (key?: string | null) => {
    if (!key) return null
    const parts = key.split("-")
    if (parts.length !== 2) return null
    const month = Number(parts[1])
    if (!Number.isFinite(month) || month < 1 || month > 12) return null
    return `${MONTHS[month - 1]} ${parts[0]}`
  }
  const minLabel = format(min)
  const maxLabel = format(max)
  if (minLabel && maxLabel && minLabel !== maxLabel) return `${minLabel} – ${maxLabel}`
  return minLabel || maxLabel || null
}

const FILTER_HELP_TEXT = {
  campaignDay: "Choose the weekday the campaign will run. Recommendations still prioritise customers with proof of booking on this weekday.",
  campaignDate: "The actual date the offer is valid for. Availability and the campaign lift baseline use this date, not the page's historical date range.",
  analysisPeriod: "Calendar months ending on the latest available play date, used for the Historical Campaign Performance figures below.",
  courtType:
    "Only shows customers whose preferred (most-booked) court matches this type, or keep all courts included.",
  playSession:
    "The session bucket the campaign targets: Morning, Afternoon, Evening, or Night.",
  customerType:
    "Narrow the target audience to membership, non-membership, or both depending on the promo goal.",
  rfmSegment:
    "Filter the audience by the latest available RFM segment to support retention, growth, or re-engagement campaigns.",
  promoCodePrefix:
    "Each recipient gets a unique code built from this prefix. Redemptions are matched from the promo fields in imported transactions.",
  costBudget:
    "Optional campaign spend. Used to calculate cost per booking and return on campaign spend.",
  controlPercent:
    "Share of the audience held back from outreach so incremental lift can be measured. Only applied when the audience has at least 20 customers.",
} as const

function FilterLabel({ label, tooltip }: { label: string; tooltip: string }) {
  return (
    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
      <span>{label}</span>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition hover:bg-accent hover:text-foreground"
            aria-label={`More information about ${label}`}
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={8} className="max-w-xs text-left leading-relaxed">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </div>
  )
}

function InfoTooltip({ content }: { content: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-accent hover:text-foreground"
          aria-label="More information"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        sideOffset={8}
        className="max-w-xs text-left leading-relaxed"
      >
        {content}
      </TooltipContent>
    </Tooltip>
  )
}

export function LowOccupancyTargeting({ onNavigate }: LowOccupancyTargetingProps) {

  const [playtimeMixData, setPlaytimeMixData] = useState<PlaytimeMixData | null>(null)
const [isLoadingPlaytime, setIsLoadingPlaytime] = useState(true)
const [heatmapData, setHeatmapData] = useState<HeatmapSummary | null>(null)
const [isLoadingHeatmap, setIsLoadingHeatmap] = useState(true)
const [dataMonthLabel, setDataMonthLabel] = useState<string | null>(null)
const [dataMonthRange, setDataMonthRange] = useState<{ min?: string | null; max?: string | null } | null>(null)
const playtimeRequestRef = useRef(0)

  const [campaignDay, setCampaignDay] = useState(INITIAL_CAMPAIGN_DAY)
  const [campaignDate, setCampaignDate] = useState(INITIAL_CAMPAIGN_DATE)
  const [analysisPeriodMonths, setAnalysisPeriodMonths] = useState(3)
  const [courtType, setCourtType] = useState(INITIAL_COURT_TYPE)
  const [sessionName, setSessionName] = useState<(typeof SESSION_OPTIONS)[number]>(INITIAL_SESSION_NAME)
  const [customerType, setCustomerType] = useState(INITIAL_CUSTOMER_TYPE)
  const [segmentName, setSegmentName] = useState(INITIAL_SEGMENT_NAME)
  const [monthlyPerformance, setMonthlyPerformance] = useState<RecommendedCustomersResponse["monthlyPerformance"]>([])
  const [historicalSummary, setHistoricalSummary] = useState<RecommendedCustomersResponse["historicalSummary"]>(null)
  const [occupancyForecast, setOccupancyForecast] = useState<RecommendedCustomersResponse["occupancyForecast"]>(null)
  const [latestCampaignPlayDate, setLatestCampaignPlayDate] = useState<string | null>(null)
  const [slotAvailability, setSlotAvailability] = useState<SlotAvailability | null>(null)
  const [audienceCoverage, setAudienceCoverage] = useState<AudienceCoverage | null>(null)
  const customerRequestRef = useRef(0)

  const [promoCodePrefix, setPromoCodePrefix] = useState(INITIAL_PROMO_PREFIX)
  const [costBudget, setCostBudget] = useState("0")
  const [controlPercent, setControlPercent] = useState("10")
  const [campaignDialogOpen, setCampaignDialogOpen] = useState(false)
  const [campaignName, setCampaignName] = useState("")
  const [consentConfirmed, setConsentConfirmed] = useState(false)
  const [isCreatingCampaign, setIsCreatingCampaign] = useState(false)
  const [createCampaignError, setCreateCampaignError] = useState<string | null>(null)
  const [createdCampaign, setCreatedCampaign] = useState<OutreachCampaignDetail | null>(null)
  const [campaignWorkspaceOpen, setCampaignWorkspaceOpen] = useState(false)
  const [recipientActionId, setRecipientActionId] = useState<number | null>(null)

  const [customers, setCustomers] = useState<RecommendedTargetCustomer[]>([])
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(true)
  const [customerError, setCustomerError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [messageDraftCustomer, setMessageDraftCustomer] = useState<RecommendedTargetCustomer | null>(null)
  const [generatedDraftMessage, setGeneratedDraftMessage] = useState<string | null>(null)
  const [isGeneratingDraftMessage, setIsGeneratingDraftMessage] = useState(false)
  const [generateDraftMessageError, setGenerateDraftMessageError] = useState<string | null>(null)

  const [selectedStartDate, setSelectedStartDate] = useState(INITIAL_DATE_RANGE.startDate)
  const [selectedEndDate, setSelectedEndDate] = useState(INITIAL_DATE_RANGE.endDate)
  const [selectedVenue, setSelectedVenue] = useState("All Venue")
  const [selectedBookingType, setSelectedBookingType] = useState("All Type")
  const [currentCustomerPage, setCurrentCustomerPage] = useState(1)
  const [customerPageSize] = useState(INITIAL_CUSTOMER_PAGE_SIZE)
  const [customerPagination, setCustomerPagination] = useState<CustomerPagination | null>(null)
  // Historical Campaign Performance reflects whatever filters were last
  // applied, so keep it hidden until the user has actually asked for
  // recommendations rather than showing it pre-filled from the page's
  // default filters on first load.
  const [hasRequestedRecommendations, setHasRequestedRecommendations] = useState(false)

  const loadCustomers = async (filters?: {
    nextCampaignDay?: string
    nextCampaignDate?: string
    nextAnalysisPeriodMonths?: number
    nextCourtType?: string
    nextSessionName?: string
    nextCustomerType?: string
    nextSegmentName?: string
    nextCustomerPage?: number
    nextPageSize?: number
  }) => {
    const nextCampaignDay = filters?.nextCampaignDay ?? campaignDay
    const nextCampaignDate = filters?.nextCampaignDate ?? campaignDate
    const nextAnalysisPeriodMonths = filters?.nextAnalysisPeriodMonths ?? analysisPeriodMonths
    const nextCourtType = filters?.nextCourtType ?? courtType
    const nextSessionName = filters?.nextSessionName ?? sessionName
    const nextCustomerType = filters?.nextCustomerType ?? customerType
    const nextSegmentName = filters?.nextSegmentName ?? segmentName
    const nextCustomerPage = filters?.nextCustomerPage ?? currentCustomerPage
    const nextPageSize = filters?.nextPageSize ?? customerPageSize
    const requestId = ++customerRequestRef.current

    setIsLoadingCustomers(true)
    setCustomerError(null)

    try {
      const response = await getRecommendedCustomers({
        campaignDay: nextCampaignDay,
        campaignDate: nextCampaignDate,
        analysisPeriodMonths: nextAnalysisPeriodMonths,
        courtType: nextCourtType,
        sessionName: nextSessionName,
        customerType: nextCustomerType,
        segmentName: nextSegmentName === "all" ? undefined : nextSegmentName,
        limit: nextPageSize,
        offset: (nextCustomerPage - 1) * nextPageSize,
      })

      if (requestId !== customerRequestRef.current) return

      setCustomers(response.customers)
      setMonthlyPerformance(response.monthlyPerformance || [])
      setHistoricalSummary(response.historicalSummary)
      setOccupancyForecast(response.occupancyForecast)
      setLatestCampaignPlayDate(response.latestPlayDate)
      setSlotAvailability(response.slotAvailability)
      setAudienceCoverage(response.audienceCoverage)
      setCustomerPagination(response.pagination ?? null)
    } catch (error) {
      if (requestId !== customerRequestRef.current) return
      setCustomerError(
        error instanceof Error
          ? error.message
          : "Failed to load recommended customers."
      )
      setCustomers([])
      setCustomerPagination(null)
    } finally {
      if (requestId === customerRequestRef.current) {
        setIsLoadingCustomers(false)
      }
    }
  }

  const loadPlaytime = async (filters?: {
    nextStartDate?: string
    nextEndDate?: string
    nextVenue?: string
    nextCustomerType?: string
  }) => {
    const requestId = ++playtimeRequestRef.current
    setIsLoadingPlaytime(true)
    setIsLoadingHeatmap(true)
    try {
      const hasExplicitDateRange = filters?.nextStartDate && filters?.nextEndDate

      let monthLabel = dataMonthLabel ?? "All Month"
      let year = String(new Date().getFullYear())

      if (!hasExplicitDateRange) {
        const statusRes = await fetch(getApiUrl("/operations/status"), {
          headers: getAuthHeaders(),
          cache: "no-store",
        })
        const statusResult = await statusRes.json().catch(() => null)
        const availableMonths = statusResult?.success
          ? (statusResult.data?.transactionAvailableMonths as string[])
          : null

        if (availableMonths && availableMonths.length > 0) {
          const latest = availableMonths[availableMonths.length - 1]
          const parts = latest.split("-")
          if (parts.length === 2) {
            year = parts[0]
            const monthIndex = parseInt(parts[1], 10) - 1
            if (monthIndex >= 0 && monthIndex < 12) {
              monthLabel = MONTHS[monthIndex]
            }
          }
        }
      } else {
        // The query itself always covers the full selected start–end range
        // (sent as explicit startDate/endDate below), so the caption must
        // reflect that whole range too — not just the start date's month —
        // otherwise a multi-month selection shows a misleadingly narrow
        // "Data period" label next to data that actually spans further.
        const start = new Date(filters!.nextStartDate!)
        const end = new Date(filters!.nextEndDate!)
        const startKey = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`
        const endKey = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}`
        monthLabel = buildMonthRangeLabel(startKey, endKey) ?? MONTHS[start.getMonth()]
        year = String(start.getFullYear())
      }

      if (requestId !== playtimeRequestRef.current) return
      setDataMonthLabel(monthLabel)

      const params = new URLSearchParams({
        venue: filters?.nextVenue ?? "All Venue",
        customerType: filters?.nextCustomerType ?? "All Type",
      })

      if (hasExplicitDateRange) {
        params.set("startDate", filters!.nextStartDate!)
        params.set("endDate", filters!.nextEndDate!)
      } else {
        params.set("month", monthLabel)
        params.set("year", year)
        params.set("periodType", "MTD")
      }

      const [playtimeRes, heatmapRes] = await Promise.all([
        fetch(getApiUrl(`/dashboard/playtime-mix?${params.toString()}`), {
          headers: getAuthHeaders(),
          cache: "no-store",
        }),
        fetch(getApiUrl(`/dashboard/empty-slot-heatmap?${params.toString()}`), {
          headers: getAuthHeaders(),
          cache: "no-store",
        }),
      ])

      const playtimeResult = await playtimeRes.json().catch(() => null)
      const heatmapResult = await heatmapRes.json().catch(() => null)

      if (requestId !== playtimeRequestRef.current) return
      setPlaytimeMixData(playtimeResult?.success ? playtimeResult.data : null)
      setHeatmapData(heatmapResult?.success ? heatmapResult.data : null)
    } catch {
      if (requestId !== playtimeRequestRef.current) return
      setPlaytimeMixData(null)
      setHeatmapData(null)
    } finally {
      if (requestId === playtimeRequestRef.current) {
        setIsLoadingPlaytime(false)
        setIsLoadingHeatmap(false)
      }
    }
  }

  useEffect(() => {
    const initializePeriod = async () => {
      try {
        const statusRes = await fetch(getApiUrl("/operations/status"), {
          headers: getAuthHeaders(),
          cache: "no-store",
        })
        const statusResult = await statusRes.json().catch(() => null)
        const statusData = statusResult?.success ? statusResult.data : null
        const availableMonths = Array.isArray(statusData?.transactionAvailableMonths)
          ? (statusData.transactionAvailableMonths as string[])
          : []

        if (statusData?.transactionMonthRange?.min || statusData?.transactionMonthRange?.max) {
          setDataMonthRange({
            min: statusData.transactionMonthRange.min ?? null,
            max: statusData.transactionMonthRange.max ?? null,
          })
        }

        if (availableMonths.length > 0) {
          const latest = availableMonths[availableMonths.length - 1]
          const monthRange = buildMonthRange(latest)
          const parts = latest.split("-")
          if (monthRange && parts.length === 2) {
            setSelectedStartDate(monthRange.startDate)
            setSelectedEndDate(monthRange.endDate)
            const monthIndex = parseInt(parts[1], 10) - 1
            if (monthIndex >= 0 && monthIndex < 12) {
              setDataMonthLabel(MONTHS[monthIndex])
            }
          }
        }
      } catch {
        // Keep the default last-30-days range when status cannot be loaded.
      }
    }

    void initializePeriod()
  }, [])

  useEffect(() => {
    // Initial load only. Later audience loads happen through "Find
    // Recommended Customers" so page-level date changes don't refetch people.
    void loadCustomers({
      nextCampaignDay: INITIAL_CAMPAIGN_DAY,
      nextCampaignDate: INITIAL_CAMPAIGN_DATE,
      nextAnalysisPeriodMonths: 3,
      nextCourtType: INITIAL_COURT_TYPE,
      nextSessionName: INITIAL_SESSION_NAME,
      nextCustomerType: INITIAL_CUSTOMER_TYPE,
      nextSegmentName: INITIAL_SEGMENT_NAME,
      nextCustomerPage: 1,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleApply = async () => {
    setStatusMessage(null)
    setCurrentCustomerPage(1)
    setHasRequestedRecommendations(true)
    await loadCustomers({ nextCustomerPage: 1 })
  }

  const handleCampaignDayChange = (nextDay: string) => {
    setCampaignDay(nextDay)
    setCampaignDate((currentDate) => getNextWeekdayIso(nextDay, currentDate))
    setCurrentCustomerPage(1)
  }

  const handleCampaignDateChange = (nextDate: string) => {
    setCampaignDate(nextDate)
    const derivedDay = getWeekdayNameFromIso(nextDate)
    if (derivedDay) setCampaignDay(derivedDay)
    setCurrentCustomerPage(1)
  }

  const handleCustomerPageChange = (nextPage: number) => {
    const totalPages = Math.max(
      1,
      Math.ceil((customerPagination?.totalCustomers || 0) / customerPageSize)
    )
    const safePage = Math.max(1, Math.min(nextPage, totalPages))
    if (safePage === currentCustomerPage) return
    setCurrentCustomerPage(safePage)
    void loadCustomers({ nextCustomerPage: safePage })
  }

  const copyAllRecommendedMessages = async () => {
    const messages = customers
      .map((customer) => customer.whatsappMessage)
      .filter(Boolean)
      .join("\n\n---\n\n")
    await copyText(messages, `${customers.length} WhatsApp messages copied to clipboard.`)
  }

  const exportRecommendedCustomers = () => {
    const header = [
      "customerKey",
      "customerName",
      "phone",
      "email",
      "customerTypeLabel",
      "rfmSegmentName",
      "preferredSession",
      "campaignMatchCount",
      "courtBookingCount",
      "lastBookingDate",
      "avgSpend",
      "targetPriorityLabel",
      "suggestedAction",
      "whatsappMessage",
    ]
    const rows = customers.map((customer) => [
      customer.customerKey,
      customer.customerName,
      customer.phone,
      customer.email,
      customer.customerTypeLabel,
      customer.rfmSegmentName,
      customer.preferredSession,
      customer.selectedSessionBookingCount,
      customer.selectedCourtBookingCount,
      customer.lastBookingDate,
      customer.avgSpend,
      customer.targetPriorityLabel,
      customer.suggestedAction,
      customer.whatsappMessage,
    ])
    const csv = [header, ...rows]
      .map((row) => row.map(escapeCsvValue).join(","))
      .join("\n")
    downloadTextFile(
      `fill-sessions-${campaignDate}-${sessionName.toLowerCase()}.csv`,
      csv,
      "text/csv;charset=utf-8"
    )
    setStatusMessage("Recommended customers exported as CSV.")
  }

  const openCampaignDialog = () => {
    if (!customers.length) {
      setStatusMessage("Load recommended customers before creating a campaign.")
      return
    }
    const defaultName = `${campaignDay} ${sessionName} - ${formatIsoDateDisplay(campaignDate)}`
    setCampaignName(defaultName)
    setConsentConfirmed(false)
    setCreateCampaignError(null)
    setCampaignDialogOpen(true)
  }

  const handleCreateCampaign = async () => {
    setIsCreatingCampaign(true)
    setCreateCampaignError(null)

    try {
      const detail = await createOutreachCampaign({
        name: campaignName.trim(),
        campaignDate,
        campaignDay,
        sessionName,
        courtType,
        customerType,
        segmentName: segmentName === "all" ? undefined : segmentName,
        analysisPeriodMonths,
        promoCodePrefix,
        costBudget: Number(costBudget) || 0,
        controlPercent: Number(controlPercent) || 0,
        consentConfirmed,
      })
      setCreatedCampaign(detail)
      setCampaignDialogOpen(false)
      setCampaignWorkspaceOpen(true)
      setStatusMessage(
        `Campaign created for ${detail.recipientCount} recipients. Promo codes are ready to send.`
      )
    } catch (error) {
      setCreateCampaignError(
        error instanceof Error ? error.message : "Failed to create the campaign."
      )
    } finally {
      setIsCreatingCampaign(false)
    }
  }

  const refreshCreatedCampaign = async (campaignId: number) => {
    try {
      const detail = await getOutreachCampaign(campaignId)
      setCreatedCampaign(detail)
    } catch {
      // Keep the current snapshot if the refresh fails.
    }
  }

  const handleRecipientStatus = async (
    recipientId: number,
    status: OutreachRecipientStatus
  ) => {
    if (!createdCampaign) return
    setRecipientActionId(recipientId)
    try {
      await updateOutreachRecipientStatus(createdCampaign.campaign.id, recipientId, status)
      await refreshCreatedCampaign(createdCampaign.campaign.id)
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "Failed to update the recipient."
      )
    } finally {
      setRecipientActionId(null)
    }
  }

  const handleOptOutCustomer = async (customer: RecommendedTargetCustomer) => {
    const confirmed = window.confirm(
      `Mark ${customer.customerName || customer.customerKey} as opted out? They will be excluded from future campaigns.`
    )
    if (!confirmed) return

    try {
      await addOutreachSuppression(customer.customerKey)
      setCustomers((current) =>
        current.filter((item) => item.customerKey !== customer.customerKey)
      )
      setStatusMessage("Customer added to the opt-out list.")
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "Failed to save the opt-out."
      )
    }
  }

  const copyCampaignMessages = async () => {
    const messages = (createdCampaign?.recipients || [])
      .filter((recipient) => !recipient.isControl && recipient.whatsappMessage)
      .map((recipient) => recipient.whatsappMessage)
      .join("\n\n---\n\n")
    await copyText(messages, "All non-control WhatsApp messages copied.")
  }

  const exportCampaignRecipients = () => {
    if (!createdCampaign) return
    const header = [
      "customerKey",
      "customerName",
      "phone",
      "promoCode",
      "isControl",
      "status",
      "rfmSegmentName",
      "whatsappMessage",
    ]
    const rows = (createdCampaign.recipients || []).map((recipient) => [
      recipient.customerKey,
      recipient.customerName,
      recipient.phone,
      recipient.promoCode,
      recipient.isControl ? "yes" : "no",
      recipient.status,
      recipient.rfmSegmentName,
      recipient.isControl ? "" : recipient.whatsappMessage,
    ])
    const csv = [header, ...rows]
      .map((row) => row.map(escapeCsvValue).join(","))
      .join("\n")
    downloadTextFile(
      `campaign-${createdCampaign.campaign.id}-recipients.csv`,
      csv,
      "text/csv;charset=utf-8"
    )
  }

  useEffect(() => {
    // Page filters describe historical analysis only. They intentionally do
    // not touch Campaign Targeting, which has its own day/date/session scope.
    void loadPlaytime({
      nextStartDate: selectedStartDate,
      nextEndDate: selectedEndDate,
      nextVenue: selectedVenue,
      nextCustomerType: selectedBookingType,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStartDate, selectedEndDate, selectedVenue, selectedBookingType])

  const loadMessageDraft = async (customer: RecommendedTargetCustomer) => {
    setIsGeneratingDraftMessage(true)
    setGenerateDraftMessageError(null)

    try {
      const result = await generateOutreachMessage({
        customerName: customer.customerName || customer.customerKey,
        rfmSegmentName: customer.rfmSegmentName,
        customerTypeLabel: customer.customerTypeLabel,
        preferredSession: customer.preferredSession,
        courtType,
        suggestedAction: customer.suggestedAction,
        recencyDays: customer.recencyDays,
        totalBookingCount: customer.totalBookingCount,
      })
      setGeneratedDraftMessage(result.message)
    } catch (error) {
      setGenerateDraftMessageError(
        error instanceof Error ? error.message : "Failed to generate the message draft."
      )
    } finally {
      setIsGeneratingDraftMessage(false)
    }
  }

  useEffect(() => {
    if (!messageDraftCustomer) {
      setGeneratedDraftMessage(null)
      setGenerateDraftMessageError(null)
      return
    }

    void loadMessageDraft(messageDraftCustomer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messageDraftCustomer])

  const copyText = async (text: string | null, successMessage: string) => {
    if (!text) {
      setStatusMessage("No value available to copy.")
      return
    }

    try {
      await navigator.clipboard.writeText(text)
      setStatusMessage(successMessage)
    } catch {
      setStatusMessage("Failed to copy to clipboard.")
    }
  }

  const openGenAi = (customer: RecommendedTargetCustomer) => {
    const [sessionStartHour, sessionEndHour] = (SESSION_HOUR_LABELS[sessionName] || "").split(" - ")
    const slotTimeLabel = SESSION_HOUR_LABELS[sessionName] || null

    saveLowOccupancyOutreachContext({
      source: "low_occupancy_targeting",
      intent: "campaign",
      customerKey: customer.customerKey,
      customerName: customer.customerName,
      customerTypeLabel: customer.customerTypeLabel,
      bookingTypeDominant: customer.bookingTypeDominant,
      courtType,
      sessionName,
      sessionStartHour: sessionStartHour || null,
      sessionEndHour: sessionEndHour || null,
      slotTimeLabel,
      date: campaignDate,
      preferredSession: customer.preferredSession,
      selectedSessionBookingCount: customer.selectedSessionBookingCount,
      selectedCourtBookingCount: customer.selectedCourtBookingCount,
      totalBookingCount: customer.totalBookingCount,
      lastBookingDate: customer.lastBookingDate,
      recencyDays: customer.recencyDays,
      avgSpend: customer.avgSpend,
      totalRevenue: customer.totalRevenue,
      rfmSegmentName: customer.rfmSegmentName,
      targetPriorityScore: customer.targetPriorityScore,
      targetPriorityLabel: customer.targetPriorityLabel,
      suggestedAction: customer.suggestedAction,
      whatsappMessage: customer.whatsappMessage,
    })

    setStatusMessage("Campaign context sent to GenAI Workspace.")
    onNavigate("genai")
  }

  const playtimeChart = buildPlaytimeChart(playtimeMixData)
const playtimeChartTotal = playtimeChart.reduce((sum, item) => sum + item.value, 0)
const playtimeLegend = playtimeChart.map((item) => ({
  ...item,
  percentage: playtimeChartTotal > 0 ? (item.value / playtimeChartTotal) * 100 : 0,
}))
const dominantPlaytime = playtimeLegend.reduce<typeof playtimeLegend[number] | null>(
  (selected, item) => (!selected || item.value > selected.value ? item : selected),
  null
)
const playtimeBehaviorInsight = !dominantPlaytime || !playtimeMixData
  ? "No historical play-time preference insight is available yet."
  : `Most bookings are in the ${dominantPlaytime.name} slot with ${formatPlaytimePercent(dominantPlaytime.percentage)} of all bookings.`
const dataMonthRangeLabel = buildMonthRangeLabel(dataMonthRange?.min ?? null, dataMonthRange?.max ?? null)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Fill Sessions</h1>
        <p className="text-base text-muted-foreground">
          Use uploaded historical transactions to spot weaker play sessions and build a targeted promo audience.
        </p>
      </div>

      <div className="flex items-center gap-2 rounded-lg border-l-4 border-amber-400 bg-amber-50/50 px-3 py-2 text-xs text-amber-800 animate-pulse-subtle">
        <Info className="h-3.5 w-3.5 shrink-0" />
        <span>Insights on this page are based on uploaded historical transaction data and do not reflect real-time slot availability.</span>
      </div>

      {statusMessage && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-4 text-sm text-primary">
            {statusMessage}
          </CardContent>
        </Card>
      )}
      
<div className="rounded-2xl border border-border/70 bg-card/80 p-3 shadow-sm backdrop-blur">
  <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
    <p className="shrink-0 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
      Page filters
    </p>
    <div className="flex flex-wrap items-center justify-end gap-2">
      <div className="group flex h-11 w-[200px] items-center gap-3 rounded-xl border border-border/70 bg-background/90 px-3 shadow-sm transition hover:border-primary/35 hover:bg-background focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Start</span>
        <input
          type="date"
          value={selectedStartDate}
          onChange={(event) => {
            const nextStartDate = event.target.value
            setSelectedStartDate(nextStartDate)
            if (selectedEndDate && nextStartDate > selectedEndDate) {
              setSelectedEndDate(nextStartDate)
            }
          }}
          className="min-w-0 flex-1 bg-transparent text-sm font-medium text-foreground outline-none"
        />
      </div>
      <div className="group flex h-11 w-[200px] items-center gap-3 rounded-xl border border-border/70 bg-background/90 px-3 shadow-sm transition hover:border-primary/35 hover:bg-background focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">End</span>
        <input
          type="date"
          value={selectedEndDate}
          onChange={(event) => {
            const nextEndDate = event.target.value
            setSelectedEndDate(nextEndDate)
            if (selectedStartDate && nextEndDate < selectedStartDate) {
              setSelectedStartDate(nextEndDate)
            }
          }}
          className="min-w-0 flex-1 bg-transparent text-sm font-medium text-foreground outline-none"
        />
      </div>
      <div className="w-[160px]">
        <Select value={selectedVenue} onValueChange={setSelectedVenue}>
          <SelectTrigger className="h-11 w-full rounded-xl border border-border/70 bg-background/90 px-3 shadow-sm outline-none transition hover:border-primary/35 hover:bg-background focus:ring-2 focus:ring-primary/15">
            <div className="flex min-w-0 items-center gap-3">
              <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Venue</span>
              <SelectValue placeholder="Venue" />
            </div>
          </SelectTrigger>
          <SelectContent position="popper" className="w-[var(--radix-select-trigger-width)] rounded-xl border bg-background shadow-lg">
            {VENUE_OPTIONS.map((venue) => (
              <SelectItem key={venue.value} value={venue.value}>{venue.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="w-[210px] min-w-[210px]">
        <Select value={selectedBookingType} onValueChange={setSelectedBookingType}>
          <SelectTrigger className="h-11 w-full rounded-xl border border-border/70 bg-background/90 px-3 shadow-sm outline-none transition hover:border-primary/35 hover:bg-background focus:ring-2 focus:ring-primary/15">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Booking</span>
              <SelectValue placeholder="Booking Type" className="whitespace-nowrap" />
            </div>
          </SelectTrigger>
          <SelectContent position="popper" className="w-[var(--radix-select-trigger-width)] rounded-xl border bg-background shadow-lg">
            {BOOKING_TYPE_OPTIONS.map((bt) => (
              <SelectItem key={bt.value} value={bt.value}>{bt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  </div>
</div>

     {isLoadingHeatmap ? (
  <Card className="border-border bg-card shadow-sm">
    <CardContent className="flex items-center justify-center py-8 text-sm text-muted-foreground">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading slot data...
    </CardContent>
  </Card>
) : (
  <>
    <HeatmapGrid heatmapSummary={heatmapData} emptyHint={dataMonthRangeLabel} />
    {dataMonthLabel && (
      <p className="mt-1 text-xs text-muted-foreground">
        Data period: {dataMonthLabel}
      </p>
    )}
  </>
)}

<Card className="border-border bg-card shadow-sm">
  <CardHeader>
    <CardTitleTooltip title="Play-Time Preference Mix" tooltip="Shows how bookings are distributed across morning, afternoon, evening, and night." />
    <CardDescription>{playtimeBehaviorInsight}</CardDescription>
  </CardHeader>
  <CardContent className="space-y-4">
    {isLoadingPlaytime ? (
      <div className="flex h-[320px] items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading play-time data...
      </div>
    ) : (
      <>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] xl:items-start">
          <div className="h-[320px] min-w-0">
            {playtimeChart.every((item) => item.value === 0) || playtimeChart.length === 0 ? (
              <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
                No play-time data available yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={playtimeChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="name" stroke="var(--muted-foreground)" tickLine={false} axisLine={false} tick={<PlaytimeAxisTick />} height={50} />
                  <YAxis stroke="var(--muted-foreground)" tickLine={false} axisLine={false} allowDecimals={false} />
                  <RechartsTooltip
                    formatter={(value: number, _name: string, props: { payload?: { value?: number; name?: string } }) => {
                      const sessionCount = Number(value || props.payload?.value || 0)
                      const percentage = playtimeChartTotal > 0 ? (sessionCount / playtimeChartTotal) * 100 : 0
                      return [`${sessionCount.toLocaleString("en-US")} sessions (${formatPlaytimePercent(percentage)})`, props.payload?.name || "Historical demand"]
                    }}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]} cursor="pointer">
                    {playtimeChart.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="min-w-0 space-y-3">
            <div className="rounded-2xl border border-border bg-primary/5 p-4">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Dominant Historical Preference</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">{dominantPlaytime?.name || "-"}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {dominantPlaytime
                  ? `${formatPlaytimePercent(dominantPlaytime.percentage)} of booked sessions${dataMonthLabel ? ` in ${dataMonthLabel}` : " in the current period"} came from this play-time window.`
                  : "No historical data to determine dominant play-time window."}
              </p>
            </div>
            {playtimeMixData ? (
              <div className="rounded-xl border border-border bg-secondary/20 p-4 text-sm text-muted-foreground">
                {playtimeMixData.totalSessions.toLocaleString("en-US")} sessions from {playtimeMixData.totalCustomers.toLocaleString("en-US")} customers in {dataMonthLabel || "the current period"}.
              </div>
            ) : null}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {playtimeLegend.map((item) => (
            <div key={item.name} className="rounded-xl border border-border bg-secondary/20 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="mt-1 inline-flex h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <div>
                    <p className="font-medium text-slate-900">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{formatPlaytimePercent(item.percentage)} of historical booked sessions</p>
                  </div>
                </div>
                <p className="text-sm font-semibold text-slate-900">{item.value.toLocaleString("en-US")}</p>
              </div>
            </div>
          ))}
        </div>
      </>
    )}
  </CardContent>
</Card>

<Card>
  <CardHeader>
    <CardTitle className="flex items-center gap-2 text-xl">
      <Target className="h-5 w-5 text-primary" />
      Campaign Targeting
      <InfoTooltip content="Set the campaign day, session, and audience filters — customers are ranked from their entire booking history." />
    </CardTitle>
          <CardDescription>
            Set the campaign day, session, and audience filters — customers are ranked from their entire booking history.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2">
              <FilterLabel
                label="Campaign Day"
                tooltip={FILTER_HELP_TEXT.campaignDay}
              />
              <Select value={campaignDay} onValueChange={handleCampaignDayChange}>
                <SelectTrigger className="h-11 w-full rounded-xl border border-border/70 bg-background/90 px-3 shadow-sm outline-none transition hover:border-primary/35 hover:bg-background focus:ring-2 focus:ring-primary/15">
                  <SelectValue placeholder="Campaign Day" />
                </SelectTrigger>
                <SelectContent position="popper" className="w-[var(--radix-select-trigger-width)] rounded-xl border bg-background shadow-lg">
                  {CAMPAIGN_DAY_OPTIONS.map((day) => (
                    <SelectItem key={day} value={day}>{day}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <FilterLabel
                label="Campaign Date"
                tooltip={FILTER_HELP_TEXT.campaignDate}
              />
              <div className="flex h-11 items-center gap-2 rounded-xl border border-border/70 bg-background/90 px-3 shadow-sm transition hover:border-primary/35 hover:bg-background focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
                <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
                <input
                  type="date"
                  value={campaignDate}
                  onChange={(event) => handleCampaignDateChange(event.target.value)}
                  className="min-w-0 flex-1 bg-transparent text-sm font-medium text-foreground outline-none"
                />
              </div>
            </div>

            <div className="space-y-2">
              <FilterLabel label="Analysis Period" tooltip={FILTER_HELP_TEXT.analysisPeriod} />
              <Select
                value={String(analysisPeriodMonths)}
                onValueChange={(value) => setAnalysisPeriodMonths(Number(value))}
              >
                <SelectTrigger className="h-11 w-full rounded-xl border border-border/70 bg-background/90 px-3 shadow-sm outline-none transition hover:border-primary/35 hover:bg-background focus:ring-2 focus:ring-primary/15">
                  <SelectValue placeholder="Analysis Period" />
                </SelectTrigger>
                <SelectContent position="popper" className="w-[var(--radix-select-trigger-width)] rounded-xl border bg-background shadow-lg">
                  {ANALYSIS_PERIOD_OPTIONS.map((months) => (
                    <SelectItem key={months} value={String(months)}>
                      {months} Month{months > 1 ? "s" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <FilterLabel
                label="Court Type"
                tooltip={FILTER_HELP_TEXT.courtType}
              />
              <Select value={courtType} onValueChange={setCourtType}>
                <SelectTrigger className="h-11 w-full rounded-xl border border-border/70 bg-background/90 px-3 shadow-sm outline-none transition hover:border-primary/35 hover:bg-background focus:ring-2 focus:ring-primary/15">
                  <SelectValue placeholder="Court Type" />
                </SelectTrigger>
                <SelectContent position="popper" className="w-[var(--radix-select-trigger-width)] rounded-xl border bg-background shadow-lg">
                  {COURT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <FilterLabel
                label="Play Session"
                tooltip={FILTER_HELP_TEXT.playSession}
              />
              <Select
                value={sessionName}
                onValueChange={(value) =>
                  setSessionName(value as (typeof SESSION_OPTIONS)[number])
                }
              >
                <SelectTrigger className="h-11 w-full rounded-xl border border-border/70 bg-background/90 px-3 shadow-sm outline-none transition hover:border-primary/35 hover:bg-background focus:ring-2 focus:ring-primary/15">
                  <SelectValue placeholder="Play Session" />
                </SelectTrigger>
                <SelectContent position="popper" className="w-[var(--radix-select-trigger-width)] rounded-xl border bg-background shadow-lg">
                  {SESSION_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <FilterLabel
                label="Target Customer"
                tooltip={FILTER_HELP_TEXT.customerType}
              />
              <Select value={customerType} onValueChange={setCustomerType}>
                <SelectTrigger className="h-11 w-full rounded-xl border border-border/70 bg-background/90 px-3 shadow-sm outline-none transition hover:border-primary/35 hover:bg-background focus:ring-2 focus:ring-primary/15">
                  <SelectValue placeholder="Target Customer" />
                </SelectTrigger>
                <SelectContent position="popper" className="w-[var(--radix-select-trigger-width)] rounded-xl border bg-background shadow-lg">
                  {CUSTOMER_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <FilterLabel
                label="RFM Segment"
                tooltip={FILTER_HELP_TEXT.rfmSegment}
              />
              <Select value={segmentName} onValueChange={setSegmentName}>
                <SelectTrigger className="h-11 w-full rounded-xl border border-border/70 bg-background/90 px-3 shadow-sm outline-none transition hover:border-primary/35 hover:bg-background focus:ring-2 focus:ring-primary/15">
                  <SelectValue placeholder="RFM Segment" />
                </SelectTrigger>
                <SelectContent position="popper" className="w-[var(--radix-select-trigger-width)] rounded-xl border bg-background shadow-lg">
                  {SEGMENT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

          </div>

          <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
            <Button onClick={handleApply} className="h-11 gap-2 rounded-xl px-5">
              {isLoadingCustomers ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Applying...
                </>
              ) : (
                <>
                  <Target className="h-4 w-4" />
                  Find Recommended Customers
                </>
              )}
            </Button>
            <Button
              variant="outline"
              className="h-11 gap-2 rounded-xl px-5"
              onClick={openCampaignDialog}
              disabled={!customers.length}
            >
              <ShieldCheck className="h-4 w-4" />
              Create Campaign
            </Button>
            <p className="text-sm text-muted-foreground md:whitespace-nowrap">
              Ranked from up to 24 months of booking history and the latest available RFM segmentation.
            </p>
          </div>
        </CardContent>
      </Card>

      {slotAvailability ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarDays className="h-5 w-5 text-primary" />
              Slot Availability &amp; Audience Coverage
            </CardTitle>
            <CardDescription>
              {formatIsoDateDisplay(campaignDate)} · {sessionName} · {slotAvailability.courtTypeLabel}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-border bg-card p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Empty Court-Hours</p>
                <p className="mt-1.5 text-2xl font-bold text-foreground">{slotAvailability.availableCourtHours}</p>
                <p className="text-xs text-muted-foreground">of {slotAvailability.capacityCourtHours} capacity</p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Occupancy</p>
                <p className="mt-1.5 text-2xl font-bold text-foreground">{slotAvailability.occupancyRate}%</p>
                <p className="text-xs text-muted-foreground">{slotAvailability.occupiedCourtHours} occupied court-hours</p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Audience Size</p>
                <p className="mt-1.5 text-2xl font-bold text-foreground">{audienceCoverage?.audienceSize ?? customers.length}</p>
                <p className="text-xs text-muted-foreground">
                  {audienceCoverage?.customersPerEmptySlot ?? "-"} customers per empty slot
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Coverage</p>
                <div className="mt-2">
                  <Badge
                    variant="secondary"
                    className={
                      audienceCoverage?.coverageStatus === "insufficient"
                        ? "border border-red-200 bg-red-50 text-red-700"
                        : audienceCoverage?.coverageStatus === "sufficient"
                          ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border border-amber-200 bg-amber-50 text-amber-700"
                    }
                  >
                    {audienceCoverage?.coverageStatus || "unknown"}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{audienceCoverage?.note}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {slotAvailability.dataAvailable
                ? slotAvailability.note
                : `${slotAvailability.note} Future dates are estimates until usage is imported.`}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {hasRequestedRecommendations && (
      <Card>
        <CardHeader>
          <CardTitleTooltip title="Historical Campaign Performance" tooltip="Facility occupancy and revenue for the selected weekday, court, and play session." />
          <CardDescription>Calendar-month performance anchored to the latest available play date.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {historicalSummary && (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="flex min-h-20 flex-col justify-center rounded-2xl border border-primary/20 bg-primary/15 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Average Occupancy</p>
                <p className="mt-1.5 text-xl font-bold text-foreground">{historicalSummary.averageOccupancy ?? "Unavailable"}%</p>
              </div>
              <div className="flex min-h-20 flex-col justify-center rounded-2xl border border-primary/20 bg-primary/15 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Average Filled Slots</p>
                <p className="mt-1.5 text-xl font-bold text-foreground">
                  {historicalSummary.averageFilledSlots}{" "}
                  <span className="text-sm font-medium text-muted-foreground">slots/month</span>
                </p>
              </div>
              <div className="flex min-h-20 flex-col justify-center rounded-2xl border border-primary/20 bg-primary/15 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total Revenue</p>
                <p className="mt-1.5 whitespace-nowrap text-xl font-bold text-foreground">Rp {historicalSummary.totalRevenue.toLocaleString("id-ID")}</p>
              </div>
              <div className="flex min-h-20 flex-col justify-center rounded-2xl border border-primary/20 bg-primary/15 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Average Monthly Revenue</p>
                <p className="mt-1.5 whitespace-nowrap text-xl font-bold text-foreground">Rp {historicalSummary.averageMonthlyRevenue.toLocaleString("id-ID")}</p>
              </div>
            </div>
          )}
          {occupancyForecast && (
            <div className="rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Predicted Next Occupancy
              </p>
              {occupancyForecast.available ? (
                <>
                  <p className="mt-1.5 text-xl font-bold text-foreground">
                    {occupancyForecast.forecastOccupancyRate}%{" "}
                    <span className="text-sm font-medium text-muted-foreground">
                      ({occupancyForecast.confidenceBandLow}%–{occupancyForecast.confidenceBandHigh}%)
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Trend {occupancyForecast.trendPerWeek! >= 0 ? "+" : ""}
                    {occupancyForecast.trendPerWeek} pts/week over {occupancyForecast.historicalWeeks}{" "}
                    historical weeks (Holt&apos;s linear-trend smoothing).
                  </p>
                </>
              ) : (
                <p className="mt-1.5 text-sm text-muted-foreground">{occupancyForecast.reason}</p>
              )}
            </div>
          )}
          {monthlyPerformance.length > 0 && (
            <p className="text-sm font-semibold text-foreground">Monthly Breakdown</p>
          )}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {monthlyPerformance.map((month) => (
              <div key={month.month} className="flex h-full flex-col rounded-2xl border border-border/80 bg-card p-4 transition-colors hover:border-primary/25 hover:bg-primary/[0.025]">
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">{month.monthLabel}</p>
                <p className="mt-3 text-3xl font-bold leading-none text-foreground">{month.occupancyRate === null ? "Unavailable" : `${month.occupancyRate}%`}</p>
                <p className="text-sm text-muted-foreground">Occupancy Rate</p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Filled Slots</p>
                    <p className="mt-0.5 font-semibold text-foreground">{month.occupiedSlots} of {month.totalPossibleSlots}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Revenue</p>
                    <p className="mt-0.5 whitespace-nowrap font-semibold text-foreground">Rp {month.revenue.toLocaleString("id-ID")}</p>
                  </div>
                </div>
                <p className="mt-4 whitespace-nowrap border-t border-primary/10 pt-3 text-xs text-muted-foreground">Data through {month.dataThrough}</p>
              </div>
            ))}
          </div>
          {!isLoadingCustomers && !latestCampaignPlayDate && monthlyPerformance.length === 0 && (
            <div className="rounded-xl border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">
              Historical campaign performance is unavailable because no valid play-date history exists.
            </div>
          )}
        </CardContent>
      </Card>
      )}


      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitleTooltip title="Recommended Customers" tooltip="Only customers who have actually booked the selected Campaign Day + Play Session before, and whose preferred court, target customer type, and RFM segment match the other filters, are shown — ranked by their entire booking history." />
          <CardDescription>
            Customers with a proven history of booking the selected Campaign Day and Play Session, filtered further by court, target customer, and segment.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="px-6 pb-6">
          <div className="flex flex-wrap items-center gap-2 pb-4">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => void copyAllRecommendedMessages()}
              disabled={!customers.length}
            >
              <Copy className="h-4 w-4" />
              Copy All Messages
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={exportRecommendedCustomers}
              disabled={!customers.length}
            >
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
            <Button
              size="sm"
              className="gap-2"
              onClick={openCampaignDialog}
              disabled={!customers.length}
            >
              <ShieldCheck className="h-4 w-4" />
              Create Campaign
            </Button>
          </div>
          {customerError ? (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4" />
              {customerError}
            </div>
          ) : isLoadingCustomers ? (
            <div className="flex min-h-32 items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading recommended customers...
            </div>
          ) : customers.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">
              No matching customers found for this session. Try adjusting the filters.
            </div>
          ) : (
            <div className="max-w-full overflow-x-auto rounded-2xl border border-border">
              <table className="min-w-[1900px] divide-y divide-border text-sm [&_td:not(:last-child)]:border-r [&_td:not(:last-child)]:border-border/70 [&_th:not(:last-child)]:border-r [&_th:not(:last-child)]:border-border/70">
                <thead>
                  <tr className="text-muted-foreground">
                    <th className="min-w-[150px] px-3 py-3 text-center align-middle font-semibold">Customer Name</th>
                    <th className="min-w-[135px] px-3 py-3 text-center align-middle font-semibold">Customer Type</th>
                    <th className="min-w-[125px] px-3 py-3 text-center align-middle font-semibold">Phone</th>
                    <th className="min-w-[190px] px-3 py-3 text-center align-middle font-semibold">Email</th>
                    <th className="min-w-[130px] px-3 py-3 text-center align-middle font-semibold">Preferred Session</th>
                    <th className="min-w-[120px] px-3 py-3 text-center align-middle font-semibold">Campaign Match</th>
                    <th className="min-w-[95px] px-3 py-3 text-center align-middle font-semibold">Court Count</th>
                    <th className="min-w-[120px] px-3 py-3 text-center align-middle font-semibold">Last Booking</th>
                    <th className="min-w-[125px] px-3 py-3 text-center align-middle font-semibold">Avg Spend</th>
                    <th className="min-w-[145px] px-3 py-3 text-center align-middle font-semibold">RFM Segment</th>
                    <th className="min-w-[135px] px-3 py-3 text-center align-middle font-semibold">Priority</th>
                    <th className="min-w-[220px] px-3 py-3 text-center align-middle font-semibold">Suggested Action</th>
                    <th className="min-w-[220px] px-3 py-3 text-center align-middle font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {customers.map((customer) => (
                    <tr key={customer.customerKey} className="align-top">
                      <td className="px-3 py-3 font-medium text-slate-900">
                        {customer.customerName || customer.customerKey}
                      </td>
                      <td className="px-3 py-3">{customer.customerTypeLabel}</td>
                      <td className="whitespace-nowrap px-3 py-3">{customer.phone || "-"}</td>
                      <td className="px-3 py-3">{customer.email || "-"}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-center">{customer.preferredSession || "-"}</td>
                      <td className="px-3 py-3 text-center">{customer.selectedSessionBookingCount}</td>
                      <td className="px-3 py-3 text-center">{customer.selectedCourtBookingCount}</td>
                      <td className="min-w-[120px] whitespace-nowrap px-3 py-3 text-center">{customer.lastBookingDate || "-"}</td>
                      <td className="min-w-[125px] whitespace-nowrap px-3 py-3 text-right">Rp {customer.avgSpend.toLocaleString()}</td>
                      <td className="px-3 py-3 text-center">{customer.rfmSegmentName || "Not segmented"}</td>
                      <td className="px-3 py-3 text-center">
                        <div className="space-y-1">
                          <Badge
                            variant="secondary"
                            className={customer.targetPriorityLabel === "High Priority"
                              ? "border border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100"
                              : "border border-border bg-muted text-muted-foreground hover:bg-muted"}
                          >
                            {customer.targetPriorityLabel}
                          </Badge>
                          <p className="text-xs text-muted-foreground">
                            Score: {customer.targetPriorityScore}
                          </p>
                        </div>
                      </td>
                      <td className="px-3 py-3">{customer.suggestedAction}</td>
                      <td className="px-3 py-3 text-center">
                        <div className="flex min-w-[220px] flex-col gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="justify-start gap-2"
                            onClick={() =>
                              void copyText(customer.phone, "Phone copied to clipboard.")
                            }
                          >
                            <Copy className="h-4 w-4" />
                            Copy Phone
                          </Button>
                          {buildWhatsappLink(customer.phone, customer.whatsappMessage) ? (
                            <Button variant="outline" size="sm" className="justify-start gap-2" asChild>
                              <a
                                href={buildWhatsappLink(customer.phone, customer.whatsappMessage) || "#"}
                                target="_blank"
                                rel="noreferrer"
                                onClick={() =>
                                  void copyText(
                                    customer.whatsappMessage,
                                    "WhatsApp message copied. Paste it if the app does not prefill."
                                  )
                                }
                              >
                                <MessageCircle className="h-4 w-4" />
                                Open WhatsApp
                              </a>
                            </Button>
                          ) : null}
                          <Button
                            size="sm"
                            className="justify-start gap-2"
                            onClick={() => setMessageDraftCustomer(customer)}
                          >
                            <Sparkles className="h-4 w-4" />
                            Generate Message
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="justify-start gap-2"
                            onClick={() => openGenAi(customer)}
                          >
                            <Sparkles className="h-4 w-4" />
                            Open AI Workspace
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="justify-start gap-2 text-red-600 hover:text-red-700"
                            onClick={() => void handleOptOutCustomer(customer)}
                          >
                            <UserX className="h-4 w-4" />
                            Opt Out
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          </div>
          {customerPagination && Math.ceil((customerPagination.totalCustomers || 0) / customerPageSize) > 1 ? (
            <div className="border-t border-border bg-background/80 px-6 py-3">
              <Pagination className="justify-between gap-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  Page {currentCustomerPage} of {Math.max(1, Math.ceil((customerPagination.totalCustomers || 0) / customerPageSize))}
                </div>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      aria-disabled={currentCustomerPage === 1}
                      onClick={(event) => {
                        event.preventDefault()
                        handleCustomerPageChange(currentCustomerPage - 1)
                      }}
                    />
                  </PaginationItem>
                  {Array.from({ length: Math.max(1, Math.ceil((customerPagination.totalCustomers || 0) / customerPageSize)) }, (_, index) => index + 1).map((page) => (
                    <PaginationItem key={page}>
                      <PaginationLink
                        href="#"
                        isActive={page === currentCustomerPage}
                        onClick={(event) => {
                          event.preventDefault()
                          handleCustomerPageChange(page)
                        }}
                      >
                        {page}
                      </PaginationLink>
                    </PaginationItem>
                  ))}
                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      aria-disabled={currentCustomerPage === Math.max(1, Math.ceil((customerPagination.totalCustomers || 0) / customerPageSize))}
                      onClick={(event) => {
                        event.preventDefault()
                        handleCustomerPageChange(currentCustomerPage + 1)
                      }}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(messageDraftCustomer)}
        onOpenChange={(open) => {
          if (!open) setMessageDraftCustomer(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Message Draft for {messageDraftCustomer?.customerName || messageDraftCustomer?.customerKey}
            </DialogTitle>
            <DialogDescription>
              AI-generated WhatsApp message based on this customer&apos;s segment, preferred session, and booking history.
            </DialogDescription>
          </DialogHeader>

          {isGeneratingDraftMessage ? (
            <div className="flex min-h-24 items-center justify-center gap-2 rounded-xl border border-border bg-secondary/20 p-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating message with AI...
            </div>
          ) : generateDraftMessageError ? (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {generateDraftMessageError}
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-secondary/20 p-4">
              <p className="whitespace-pre-line text-sm leading-6 text-slate-700">
                {generatedDraftMessage}
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              className="gap-2"
              disabled={isGeneratingDraftMessage || !messageDraftCustomer}
              onClick={() => messageDraftCustomer && void loadMessageDraft(messageDraftCustomer)}
            >
              <Sparkles className="h-4 w-4" />
              Regenerate
            </Button>
            <Button
              className="gap-2"
              disabled={isGeneratingDraftMessage || !generatedDraftMessage}
              onClick={() =>
                void copyText(generatedDraftMessage, "WhatsApp message copied to clipboard.")
              }
            >
              <Copy className="h-4 w-4" />
              Copy Message
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={campaignDialogOpen}
        onOpenChange={(open) => {
          setCampaignDialogOpen(open)
          if (!open) setCreateCampaignError(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Outreach Campaign</DialogTitle>
            <DialogDescription>
              Locks the current audience into a tracked campaign with unique promo codes and an optional holdout group.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm font-medium sm:col-span-2">
                <span>Campaign Name</span>
                <Input
                  value={campaignName}
                  onChange={(event) => setCampaignName(event.target.value)}
                  maxLength={160}
                />
              </label>
              <label className="space-y-2 text-sm font-medium">
                <span>Promo Code Prefix</span>
                <Input
                  value={promoCodePrefix}
                  onChange={(event) => setPromoCodePrefix(event.target.value.toUpperCase())}
                  maxLength={20}
                />
              </label>
              <label className="space-y-2 text-sm font-medium">
                <span>Campaign Budget (Rp)</span>
                <Input
                  type="number"
                  min="0"
                  step="1000"
                  value={costBudget}
                  onChange={(event) => setCostBudget(event.target.value)}
                />
              </label>
              <label className="space-y-2 text-sm font-medium">
                <span>Holdout Group (%)</span>
                <Input
                  type="number"
                  min="0"
                  max="50"
                  step="5"
                  value={controlPercent}
                  onChange={(event) => setControlPercent(event.target.value)}
                />
                <span className="block text-xs font-normal text-muted-foreground">
                  Applied only when the audience has at least 20 customers.
                </span>
              </label>
              <div className="space-y-1 rounded-xl border border-border bg-secondary/20 p-3 text-sm sm:col-span-2">
                <p className="font-medium">{formatIsoDateDisplay(campaignDate)} · {sessionName}</p>
                <p className="text-muted-foreground">
                  {courtType === "all" ? "All court types" : courtType} · {customerType === "all" ? "All customers" : customerType} · {segmentName === "all" ? "All RFM segments" : segmentName}
                </p>
                <p className="text-muted-foreground">{customers.length} recommended customers on this page will be included.</p>
              </div>
            </div>

            <label className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm">
              <input
                type="checkbox"
                checked={consentConfirmed}
                onChange={(event) => setConsentConfirmed(event.target.checked)}
                className="mt-0.5 h-4 w-4"
              />
              <span className="text-amber-900">
                I confirm these are existing customers who agreed to receive promotional WhatsApp messages, and the message includes an opt-out path.
              </span>
            </label>

            {createCampaignError ? (
              <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {createCampaignError}
              </div>
            ) : null}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCampaignDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              className="gap-2"
              disabled={isCreatingCampaign || !consentConfirmed || !campaignName.trim()}
              onClick={() => void handleCreateCampaign()}
            >
              {isCreatingCampaign ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Create Campaign
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={campaignWorkspaceOpen && Boolean(createdCampaign)}
        onOpenChange={setCampaignWorkspaceOpen}
      >
        <DialogContent className="max-h-[88vh] max-w-6xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Campaign Workspace</DialogTitle>
            <DialogDescription>
              {createdCampaign
                ? `${createdCampaign.campaign.name} · ${createdCampaign.recipientCount} recipients · window ${createdCampaign.performance.windowDays} days`
                : null}
            </DialogDescription>
          </DialogHeader>

          {createdCampaign ? (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border border-border bg-card p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Occupancy on date</p>
                  <p className="mt-1 text-xl font-bold">{createdCampaign.performance.occupancyRate ?? "-"}%</p>
                  <p className="text-xs text-muted-foreground">
                    Baseline {createdCampaign.performance.baselineOccupancyRate ?? "-"}%
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-card p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Incremental Bookings</p>
                  <p className="mt-1 text-xl font-bold">{createdCampaign.performance.estimatedIncrementalBookings}</p>
                  <p className="text-xs text-muted-foreground">
                    {createdCampaign.performance.treatmentBookings} treated vs {createdCampaign.performance.controlBookings} holdout
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-card p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Attributed Revenue</p>
                  <p className="mt-1 text-xl font-bold">Rp {createdCampaign.performance.attributedRevenue.toLocaleString("id-ID")}</p>
                  <p className="text-xs text-muted-foreground">{createdCampaign.performance.redemptionRate}% redemption</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Opt-out Rate</p>
                  <p className="mt-1 text-xl font-bold">{createdCampaign.performance.optOutRate}%</p>
                  <p className="text-xs text-muted-foreground">Response rate is not tracked yet</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" className="gap-2" onClick={() => void copyCampaignMessages()}>
                  <Copy className="h-4 w-4" />
                  Copy All Messages
                </Button>
                <Button variant="outline" size="sm" className="gap-2" onClick={exportCampaignRecipients}>
                  <Download className="h-4 w-4" />
                  Export Recipients
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => void refreshCreatedCampaign(createdCampaign.campaign.id)}
                >
                  <Loader2 className={recipientActionId ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
                  Refresh
                </Button>
              </div>

              <div className="max-h-[45vh] overflow-auto rounded-xl border border-border">
                <table className="min-w-[900px] divide-y divide-border text-sm">
                  <thead className="bg-secondary/30">
                    <tr className="text-left text-muted-foreground">
                      <th className="px-3 py-2 font-semibold">Customer</th>
                      <th className="px-3 py-2 font-semibold">Promo Code</th>
                      <th className="px-3 py-2 font-semibold">Status</th>
                      <th className="px-3 py-2 font-semibold">Message</th>
                      <th className="px-3 py-2 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(createdCampaign.recipients || []).map((recipient) => (
                      <tr key={recipient.id} className="align-top">
                        <td className="px-3 py-2">
                          <p className="font-medium">{recipient.customerName || recipient.customerKey}</p>
                          <p className="text-xs text-muted-foreground">{recipient.phone || "No phone"}</p>
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">{recipient.promoCode}</td>
                        <td className="px-3 py-2">
                          <Badge variant="secondary">
                            {recipient.isControl ? "holdout" : recipient.status}
                          </Badge>
                        </td>
                        <td className="max-w-[280px] px-3 py-2 text-xs text-muted-foreground">
                          {recipient.isControl ? "Holdout: no message is sent." : recipient.whatsappMessage}
                        </td>
                        <td className="px-3 py-2">
                          {recipient.isControl ? (
                            <span className="text-xs text-muted-foreground">Measurement only</span>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {recipient.whatsappUrl ? (
                                <Button size="sm" variant="outline" className="h-8 gap-1.5" asChild>
                                  <a href={recipient.whatsappUrl} target="_blank" rel="noreferrer">
                                    <MessageCircle className="h-3.5 w-3.5" />
                                    WhatsApp
                                  </a>
                                </Button>
                              ) : null}
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 gap-1.5"
                                disabled={recipientActionId === recipient.id || recipient.status === "sent"}
                                onClick={() => void handleRecipientStatus(recipient.id, "sent")}
                              >
                                <Check className="h-3.5 w-3.5" />
                                Sent
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 gap-1.5 text-red-600"
                                disabled={recipientActionId === recipient.id || recipient.status === "opted_out"}
                                onClick={() => void handleRecipientStatus(recipient.id, "opted_out")}
                              >
                                <UserX className="h-3.5 w-3.5" />
                                Opt Out
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {createdCampaign.performance.controlNote ? (
                <p className="text-xs text-amber-700">{createdCampaign.performance.controlNote}</p>
              ) : null}
              <p className="text-xs text-muted-foreground">
                {createdCampaign.performance.responseRateNote}
              </p>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}


