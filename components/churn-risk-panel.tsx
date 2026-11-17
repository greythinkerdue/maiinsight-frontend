"use client"

import { useCallback, useEffect, useState } from "react"
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Check,
  ListChecks,
  Loader2,
  Percent,
  RefreshCw,
  Send,
  Target,
  TrendingDown,
  Users,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitleTooltip,
  KpiCard,
  StateCard,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  createChurnReactivationCampaign,
  getChurnRiskLatest,
  trainChurnModel,
  type ChurnModelRun,
  type CustomerChurnScore,
} from "@/lib/churn-risk"
import type { PageId } from "@/components/dashboard-sidebar"

interface ChurnRiskPanelProps {
  onNavigate: (page: PageId) => void
}

const RISK_BADGE_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  High: "destructive",
  Medium: "secondary",
  Low: "outline",
}

const formatPercent = (value: number | null) =>
  value === null || value === undefined ? "Not available" : `${(value * 100).toFixed(1)}%`

const describeAucQuality = (auc: number | null) => {
  if (auc === null) return null
  if (auc >= 0.75) return { label: "Good", tone: "default" as const }
  if (auc >= 0.6) return { label: "Fair", tone: "secondary" as const }
  return { label: "Weak", tone: "destructive" as const }
}

// AUC is base-rate-independent, but the raw churn rate is still useful
// context: if 80% of customers already churn, a model that just always
// predicts "churn" would be "right" 80% of the time on accuracy alone.
const computeNaiveBaselineAccuracy = (testPositiveRate: number | null) =>
  testPositiveRate === null ? null : Math.max(testPositiveRate, 1 - testPositiveRate)

export function ChurnRiskPanel({ onNavigate }: ChurnRiskPanelProps) {
  const [run, setRun] = useState<ChurnModelRun | null>(null)
  const [customers, setCustomers] = useState<CustomerChurnScore[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isTraining, setIsTraining] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [trainError, setTrainError] = useState<string | null>(null)
  const [riskLabelFilter, setRiskLabelFilter] = useState<string>("all")
  const [search, setSearch] = useState("")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")

  const [campaignDialogOpen, setCampaignDialogOpen] = useState(false)
  const [campaignRiskLabel, setCampaignRiskLabel] = useState<"High" | "Medium" | "Low">("High")
  const [campaignName, setCampaignName] = useState("")
  const [promoCodePrefix, setPromoCodePrefix] = useState("WINBACK")
  const [campaignDate, setCampaignDate] = useState("")
  const [costBudget, setCostBudget] = useState("0")
  const [controlPercent, setControlPercent] = useState("10")
  const [consentConfirmed, setConsentConfirmed] = useState(false)
  const [isCreatingCampaign, setIsCreatingCampaign] = useState(false)
  const [createCampaignError, setCreateCampaignError] = useState<string | null>(null)
  const [createdCampaign, setCreatedCampaign] = useState<{ name: string; recipientCount: number } | null>(null)

  const loadLatest = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)
    try {
      const response = await getChurnRiskLatest({
        riskLabel: riskLabelFilter === "all" ? undefined : (riskLabelFilter as "High" | "Medium" | "Low"),
        search: search || undefined,
        sortBy: "probability",
        sortDirection,
        limit: 50,
      })
      setRun(response.run)
      setCustomers(response.customers)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Failed to load churn risk data.")
    } finally {
      setIsLoading(false)
    }
  }, [riskLabelFilter, search, sortDirection])

  useEffect(() => {
    loadLatest()
  }, [loadLatest])

  const handleTrain = async () => {
    setIsTraining(true)
    setTrainError(null)
    try {
      await trainChurnModel()
      await loadLatest()
    } catch (error) {
      setTrainError(error instanceof Error ? error.message : "Model training failed.")
    } finally {
      setIsTraining(false)
    }
  }

  const openCampaignDialog = () => {
    const defaultRisk = riskLabelFilter === "all" ? "High" : (riskLabelFilter as "High" | "Medium" | "Low")
    setCampaignRiskLabel(defaultRisk)
    setCampaignName(`Churn Reactivation - ${defaultRisk} Risk`)
    setPromoCodePrefix("WINBACK")
    setCampaignDate("")
    setCostBudget("0")
    setControlPercent("10")
    setConsentConfirmed(false)
    setCreateCampaignError(null)
    setCreatedCampaign(null)
    setCampaignDialogOpen(true)
  }

  const handleCreateCampaign = async () => {
    setIsCreatingCampaign(true)
    setCreateCampaignError(null)
    try {
      const result = await createChurnReactivationCampaign({
        riskLabel: campaignRiskLabel,
        name: campaignName.trim() || undefined,
        campaignDate: campaignDate || undefined,
        promoCodePrefix,
        costBudget: Number(costBudget) || 0,
        controlPercent: Number(controlPercent) || 0,
        consentConfirmed,
      })
      setCreatedCampaign({
        name: result.campaign.name,
        recipientCount: result.campaign.recipientCount,
      })
    } catch (error) {
      setCreateCampaignError(error instanceof Error ? error.message : "Failed to create campaign.")
    } finally {
      setIsCreatingCampaign(false)
    }
  }

  const trainButton = (
    <Button onClick={handleTrain} disabled={isTraining}>
      {isTraining ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Training...
        </>
      ) : (
        <>
          <RefreshCw className="mr-2 h-4 w-4" /> Train Model
        </>
      )}
    </Button>
  )

  const aucQuality = describeAucQuality(run?.aucTest ?? null)
  const baselineAccuracy = computeNaiveBaselineAccuracy(run?.testPositiveRate ?? null)
  const canSendCampaign = run?.status === "completed" && customers.length > 0

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <TrendingDown className="h-6 w-6 text-primary" /> Churn Risk
          </h2>
          <p className="text-sm text-muted-foreground">
            Predicts the probability that a currently active customer stops booking in the next 90
            days, from a logistic regression trained on historical monthly snapshots.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={openCampaignDialog} disabled={!canSendCampaign}>
            <Send className="mr-2 h-4 w-4" /> Send Reactivation Campaign
          </Button>
          {trainButton}
        </div>
      </div>

      {trainError && (
        <p className="text-sm text-destructive">{trainError}</p>
      )}

      {isLoading ? (
        <StateCard state="loading" title="Loading churn risk data..." />
      ) : loadError ? (
        <StateCard state="error" title="Could not load churn risk data" description={loadError} action={trainButton} />
      ) : !run ? (
        <StateCard
          state="empty"
          icon={AlertTriangle}
          title="No churn-risk model trained yet"
          description="Train a model to score currently active customers by their probability of lapsing in the next 90 days."
          action={trainButton}
        />
      ) : run.status === "insufficient_data" ? (
        <StateCard
          state="warning"
          title="Not enough historical data to train a reliable model"
          description={run.errorMessage || undefined}
          action={trainButton}
        />
      ) : run.status === "failed" ? (
        <StateCard
          state="error"
          title="The last training run failed"
          description={run.errorMessage || undefined}
          action={trainButton}
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="AUC (Test)"
              value={run.aucTest === null ? "n/a" : run.aucTest.toFixed(3)}
              icon={Target}
              changeLabel="Area under the ROC curve, held-out time split"
              tooltip="Area under the ROC curve on the held-out test split. 0.5 means the model is no better than random guessing; 1.0 means perfect separation between churners and non-churners."
            >
              {aucQuality && (
                <Badge variant={aucQuality.tone} className="mt-2">
                  {aucQuality.label}
                </Badge>
              )}
            </KpiCard>
            <KpiCard
              label="Precision / Recall"
              value={`${formatPercent(run.precisionTest)} / ${formatPercent(run.recallTest)}`}
              icon={Percent}
              changeLabel={`F1 ${run.f1Test === null ? "n/a" : run.f1Test.toFixed(3)} at threshold ${run.threshold}`}
              tooltip="Precision: of customers flagged at-risk, how many actually churned. Recall: of customers who actually churned, how many the model caught. Both measured on the held-out test split."
            >
              {baselineAccuracy !== null && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Naive &quot;always predict majority class&quot; baseline: {formatPercent(baselineAccuracy)} accuracy —
                  AUC above is base-rate-independent, so it&apos;s the fairer comparison.
                </p>
              )}
            </KpiCard>
            <KpiCard
              label="Train / Test Rows"
              value={`${run.trainSize} / ${run.testSize}`}
              icon={ListChecks}
              changeLabel="Time-based split: train strictly before test"
              tooltip="Number of labeled historical snapshots used to train vs. evaluate the model. The split is time-based: every training row is chronologically before every test row, to avoid leaking future information."
            />
            <KpiCard
              label="Churn Rate (Train / Test)"
              value={`${formatPercent(run.trainPositiveRate)} / ${formatPercent(run.testPositiveRate)}`}
              icon={Users}
              changeLabel={`Trained ${new Date(run.trainedAt).toLocaleString()}`}
              tooltip="Share of snapshots labeled as churned in each split. A high base rate like this one means raw accuracy can be misleading — compare it against the naive-baseline note under Precision / Recall."
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitleTooltip
                title="At-Risk Customers"
                tooltip="Currently active customers scored by the deployed model, refit on the full historical dataset for best accuracy."
              />
              <CardDescription>
                Probability of no booking in the next 90 days. High ≥ 70%, Medium ≥ 40%.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <Input
                  placeholder="Search customer..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="max-w-xs"
                />
                <Select value={riskLabelFilter} onValueChange={setRiskLabelFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Risk level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All risk levels</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="Low">Low</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSortDirection((current) => (current === "desc" ? "asc" : "desc"))}
                >
                  Probability {sortDirection === "desc" ? "High to Low" : "Low to High"}
                </Button>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Probability</TableHead>
                    <TableHead>Risk</TableHead>
                    <TableHead>Days Since Last Booking</TableHead>
                    <TableHead>Top Drivers</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                        No customers match the current filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    customers.map((customer) => (
                      <TableRow key={customer.customerKey}>
                        <TableCell>{customer.customerName || customer.customerKey}</TableCell>
                        <TableCell>{formatPercent(customer.churnProbability)}</TableCell>
                        <TableCell>
                          <Badge variant={RISK_BADGE_VARIANT[customer.riskLabel] || "outline"}>
                            {customer.riskLabel}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {customer.featuresSnapshot?.recencyDays !== undefined
                            ? Math.round(customer.featuresSnapshot.recencyDays)
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {customer.topDrivers.length === 0 ? (
                              <span className="text-xs text-muted-foreground">-</span>
                            ) : (
                              customer.topDrivers.map((driver) => (
                                <span
                                  key={driver.label}
                                  className="inline-flex items-center gap-1 text-xs text-muted-foreground"
                                >
                                  {driver.direction === "increases_risk" ? (
                                    <ArrowUpRight className="h-3 w-3 text-destructive" />
                                  ) : (
                                    <ArrowDownRight className="h-3 w-3 text-emerald-600" />
                                  )}
                                  {driver.label}
                                </span>
                              ))
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      <Dialog
        open={campaignDialogOpen}
        onOpenChange={(open) => {
          setCampaignDialogOpen(open)
          if (!open) setCreateCampaignError(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Reactivation Campaign</DialogTitle>
            <DialogDescription>
              {createdCampaign
                ? "Campaign created. You can manage sending and track results from Campaign KPIs."
                : "Builds a WhatsApp outreach campaign from the latest churn model's at-risk customers, with the same holdout-group and consent safeguards as other campaigns."}
            </DialogDescription>
          </DialogHeader>

          {createdCampaign ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-secondary/20 p-3 text-sm">
                <p className="font-medium">{createdCampaign.name}</p>
                <p className="text-muted-foreground">{createdCampaign.recipientCount} recipients</p>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setCampaignDialogOpen(false)}>
                  Close
                </Button>
                <Button
                  className="gap-2"
                  onClick={() => {
                    setCampaignDialogOpen(false)
                    onNavigate("campaign-kpis")
                  }}
                >
                  View in Campaign KPIs
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-sm font-medium sm:col-span-2">
                  <span>Campaign Name</span>
                  <Input value={campaignName} onChange={(event) => setCampaignName(event.target.value)} maxLength={160} />
                </label>
                <label className="space-y-2 text-sm font-medium">
                  <span>Risk Level</span>
                  <Select value={campaignRiskLabel} onValueChange={(value) => setCampaignRiskLabel(value as "High" | "Medium" | "Low")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="High">High</SelectItem>
                      <SelectItem value="Medium">Medium</SelectItem>
                      <SelectItem value="Low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </label>
                <label className="space-y-2 text-sm font-medium">
                  <span>Campaign Date</span>
                  <Input type="date" value={campaignDate} onChange={(event) => setCampaignDate(event.target.value)} />
                  <span className="block text-xs font-normal text-muted-foreground">Defaults to tomorrow if left blank.</span>
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
                  <Input type="number" min="0" step="1000" value={costBudget} onChange={(event) => setCostBudget(event.target.value)} />
                </label>
                <label className="space-y-2 text-sm font-medium sm:col-span-2">
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
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
