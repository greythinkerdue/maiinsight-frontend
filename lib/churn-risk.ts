import { getApiUrl } from "@/lib/api"
import { getAuthHeaders } from "@/lib/roles"

export interface ChurnModelRun {
  id: number
  trainedAt: string
  status: "running" | "completed" | "insufficient_data" | "failed"
  errorMessage: string | null
  featureNames: string[] | null
  threshold: number
  trainSize: number
  testSize: number
  trainPositiveRate: number | null
  testPositiveRate: number | null
  aucTest: number | null
  precisionTest: number | null
  recallTest: number | null
  f1Test: number | null
}

export interface CustomerChurnScore {
  customerKey: string
  customerName: string | null
  churnProbability: number
  riskLabel: "High" | "Medium" | "Low"
  featuresSnapshot: Record<string, number> | null
}

export interface ChurnRiskLatestResponse {
  run: ChurnModelRun | null
  customers: CustomerChurnScore[]
  totalCustomers: number
  pagination: {
    limit: number
    offset: number
    returned: number
    totalCustomers: number
    hasMore: boolean
  }
}

interface ApiEnvelope<T> {
  success: boolean
  message?: string
  error?: string
  data?: T
}

const buildQuery = (params: Record<string, string | number | boolean | null | undefined>) => {
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

export const trainChurnModel = async () => {
  const response = await fetch(getApiUrl("/churn-risk/train"), {
    method: "POST",
    cache: "no-store",
    headers: getAuthHeaders(),
  })

  return readApiResponse<{ run: ChurnModelRun }>(response)
}

export const getChurnRiskLatest = async (
  params: {
    riskLabel?: "High" | "Medium" | "Low"
    search?: string
    sortBy?: "customer" | "probability" | "riskLabel"
    sortDirection?: "asc" | "desc"
    limit?: number
    offset?: number
  } = {}
) => {
  const query = buildQuery(params)
  const response = await fetch(getApiUrl(`/churn-risk/latest${query}`), {
    method: "GET",
    cache: "no-store",
    headers: getAuthHeaders(),
  })

  return readApiResponse<ChurnRiskLatestResponse>(response)
}
