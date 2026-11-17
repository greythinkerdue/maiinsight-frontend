"use client"

import { useCallback, useEffect, useState } from "react"
import { AlertTriangle, Loader2, RefreshCw, TrendingDown } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitleTooltip,
  StateCard,
  StatCard,
} from "@/components/ui/card"
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
  getChurnRiskLatest,
  trainChurnModel,
  type ChurnModelRun,
  type CustomerChurnScore,
} from "@/lib/churn-risk"

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

export function ChurnRiskPanel() {
  const [run, setRun] = useState<ChurnModelRun | null>(null)
  const [customers, setCustomers] = useState<CustomerChurnScore[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isTraining, setIsTraining] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [trainError, setTrainError] = useState<string | null>(null)
  const [riskLabelFilter, setRiskLabelFilter] = useState<string>("all")
  const [search, setSearch] = useState("")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")

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
        {trainButton}
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
            <StatCard
              label="AUC (test)"
              value={run.aucTest === null ? "n/a" : run.aucTest.toFixed(3)}
              badge={aucQuality ? <Badge variant={aucQuality.tone}>{aucQuality.label}</Badge> : undefined}
              subText="Area under the ROC curve, held-out time split"
            />
            <StatCard
              label="Precision / Recall"
              value={`${formatPercent(run.precisionTest)} / ${formatPercent(run.recallTest)}`}
              subText={`F1 ${run.f1Test === null ? "n/a" : run.f1Test.toFixed(3)} at threshold ${run.threshold}`}
            />
            <StatCard
              label="Train / Test Rows"
              value={`${run.trainSize} / ${run.testSize}`}
              subText="Time-based split: train strictly before test"
            />
            <StatCard
              label="Churn Rate (train / test)"
              value={`${formatPercent(run.trainPositiveRate)} / ${formatPercent(run.testPositiveRate)}`}
              subText={`Trained ${new Date(run.trainedAt).toLocaleString()}`}
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
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
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
