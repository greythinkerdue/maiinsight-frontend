"use client"

import { useCallback, useEffect, useState } from "react"
import {
  AlertCircle,
  Ban,
  BarChart3,
  Check,
  CheckCircle2,
  Copy,
  Download,
  Info,
  Loader2,
  MessageCircle,
  RefreshCw,
  Search,
  Send,
  TrendingUp,
  UserX,
  Users,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getStoredRole, USER_ROLES } from "@/lib/roles"
import {
  getCampaignKpis,
  getOutreachCampaign,
  listOutreachSuppressions,
  removeOutreachSuppression,
  runAutoDraftScan,
  sendOutreachCampaignMessages,
  updateOutreachCampaignStatus,
  updateOutreachRecipientStatus,
  type AutoDraftScanResult,
  type CampaignKpiOverview,
  type OutreachCampaignDetail,
  type OutreachRecipientStatus,
  type OutreachSendResult,
  type OutreachSuppression,
} from "@/lib/targeting"

const STATUS_BADGE_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "outline",
  active: "default",
  completed: "secondary",
  archived: "destructive",
}

const formatCurrency = (value: number | null) =>
  value === null || value === undefined
    ? "Not tracked"
    : `Rp ${Number(value).toLocaleString("id-ID")}`

const formatPercent = (value: number | null) =>
  value === null || value === undefined ? "Not tracked" : `${Number(value).toFixed(1)}%`

const formatDate = (value: string | null) => {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date)
}

function KpiCard({
  label,
  value,
  detail,
  tone = "default",
}: {
  label: string
  value: string
  detail: string
  tone?: "default" | "warning" | "muted"
}) {
  return (
    <div
      className={
        tone === "warning"
          ? "rounded-2xl border border-amber-200 bg-amber-50/60 p-4"
          : tone === "muted"
            ? "rounded-2xl border border-border bg-secondary/20 p-4"
            : "rounded-2xl border border-border bg-card p-4"
      }
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1.5 text-2xl font-bold text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  )
}

export function CampaignKpis() {
  const role = getStoredRole()
  const isItSupport = role === USER_ROLES.IT_SUPPORT

  const [overview, setOverview] = useState<CampaignKpiOverview | null>(null)
  const [suppressions, setSuppressions] = useState<OutreachSuppression[]>([])
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  const [isScanning, setIsScanning] = useState(false)
  const [scanResult, setScanResult] = useState<AutoDraftScanResult | null>(null)

  const [activateDialogOpen, setActivateDialogOpen] = useState(false)
  const [activateConsentChecked, setActivateConsentChecked] = useState(false)
  const [isActivating, setIsActivating] = useState(false)
  const [activateError, setActivateError] = useState<string | null>(null)

  const [isSending, setIsSending] = useState(false)
  const [sendResult, setSendResult] = useState<OutreachSendResult | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)

  const [workspaceOpen, setWorkspaceOpen] = useState(false)
  const [workspaceCampaign, setWorkspaceCampaign] = useState<OutreachCampaignDetail | null>(null)
  const [isLoadingWorkspace, setIsLoadingWorkspace] = useState(false)
  const [recipientActionId, setRecipientActionId] = useState<number | null>(null)

  const loadOverview = useCallback(async (campaignId?: number) => {
    setIsLoading(true)
    setError(null)
    try {
      const [kpiResult, suppressionResult] = await Promise.all([
        getCampaignKpis(campaignId),
        listOutreachSuppressions(),
      ])
      setOverview(kpiResult)
      setSuppressions(suppressionResult.suppressions)
      setSelectedCampaignId(
        campaignId ? String(campaignId) : kpiResult.selected ? String(kpiResult.selected.campaign.id) : ""
      )
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load campaign KPIs.")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadOverview()
  }, [loadOverview])

  const handleSelectCampaign = (value: string) => {
    setSelectedCampaignId(value)
    void loadOverview(Number(value))
  }

  const handleRemoveSuppression = async (customerKey: string) => {
    const confirmed = window.confirm(
      `Allow ${customerKey} to receive promotional messages again? Only do this if they explicitly asked to opt back in.`
    )
    if (!confirmed) return

    try {
      await removeOutreachSuppression(customerKey)
      setSuppressions((current) => current.filter((row) => row.customerKey !== customerKey))
      setStatusMessage("Opt-out removed.")
    } catch (removeError) {
      setStatusMessage(
        removeError instanceof Error ? removeError.message : "Failed to remove the opt-out."
      )
    }
  }

  const handleRunAutoScan = async () => {
    setIsScanning(true)
    setScanResult(null)
    try {
      const result = await runAutoDraftScan()
      setScanResult(result)
      setStatusMessage(
        result.created.length > 0
          ? `${result.created.length} draft campaign(s) created for next week's low-occupancy slots.`
          : "No new low-occupancy slots qualified for a draft this scan."
      )
      if (result.created.length > 0) {
        await loadOverview(result.created[0].campaignId)
      }
    } catch (scanError) {
      setStatusMessage(scanError instanceof Error ? scanError.message : "Scan could not run.")
    } finally {
      setIsScanning(false)
    }
  }

  const openActivateDialog = () => {
    setActivateConsentChecked(false)
    setActivateError(null)
    setActivateDialogOpen(true)
  }

  const confirmActivate = async () => {
    if (!overview?.selected) return
    setIsActivating(true)
    setActivateError(null)
    try {
      await updateOutreachCampaignStatus(overview.selected.campaign.id, "active", activateConsentChecked)
      setActivateDialogOpen(false)
      setStatusMessage("Campaign activated. It can now be sent.")
      await loadOverview(overview.selected.campaign.id)
    } catch (activateErr) {
      setActivateError(
        activateErr instanceof Error ? activateErr.message : "Campaign could not be activated."
      )
    } finally {
      setIsActivating(false)
    }
  }

  const handleSendMessages = async () => {
    if (!overview?.selected) return
    setIsSending(true)
    setSendError(null)
    setSendResult(null)
    try {
      const result = await sendOutreachCampaignMessages(overview.selected.campaign.id)
      setSendResult(result)
      await loadOverview(overview.selected.campaign.id)
    } catch (sendErr) {
      setSendError(sendErr instanceof Error ? sendErr.message : "Messages could not be sent.")
    } finally {
      setIsSending(false)
    }
  }

  const openWorkspace = async (campaignId: number) => {
    setWorkspaceOpen(true)
    setIsLoadingWorkspace(true)
    try {
      const detail = await getOutreachCampaign(campaignId)
      setWorkspaceCampaign(detail)
    } catch (workspaceError) {
      setStatusMessage(
        workspaceError instanceof Error ? workspaceError.message : "Failed to load campaign recipients."
      )
      setWorkspaceOpen(false)
    } finally {
      setIsLoadingWorkspace(false)
    }
  }

  const refreshWorkspace = async () => {
    if (!workspaceCampaign) return
    try {
      const detail = await getOutreachCampaign(workspaceCampaign.campaign.id)
      setWorkspaceCampaign(detail)
    } catch {
      // Keep the current snapshot if the refresh fails.
    }
  }

  const handleWorkspaceRecipientStatus = async (recipientId: number, status: OutreachRecipientStatus) => {
    if (!workspaceCampaign) return
    setRecipientActionId(recipientId)
    try {
      await updateOutreachRecipientStatus(workspaceCampaign.campaign.id, recipientId, status)
      await refreshWorkspace()
      await loadOverview(workspaceCampaign.campaign.id)
    } catch (statusError) {
      setStatusMessage(
        statusError instanceof Error ? statusError.message : "Failed to update the recipient."
      )
    } finally {
      setRecipientActionId(null)
    }
  }

  const copyWorkspaceMessages = async () => {
    const messages = (workspaceCampaign?.recipients || [])
      .filter((recipient) => !recipient.isControl && recipient.whatsappMessage)
      .map((recipient) => recipient.whatsappMessage)
      .join("\n\n---\n\n")
    if (typeof navigator === "undefined" || !messages) return
    await navigator.clipboard.writeText(messages)
    setStatusMessage("All non-control WhatsApp messages copied.")
  }

  const exportWorkspaceRecipients = () => {
    if (!workspaceCampaign) return
    const header = ["customerKey", "customerName", "phone", "promoCode", "status", "isControl"]
    const rows = (workspaceCampaign.recipients || []).map((recipient) => [
      recipient.customerKey,
      recipient.customerName || "",
      recipient.phone || "",
      recipient.promoCode,
      recipient.status,
      recipient.isControl ? "holdout" : "treatment",
    ])
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `${workspaceCampaign.campaign.name.replace(/[^a-z0-9]+/gi, "-")}-recipients.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const selected = overview?.selected || null
  const performance = selected?.performance || null
  const selectedIsControlAware = (performance?.controlSize || 0) >= 5

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Campaign KPIs</h1>
          <p className="mt-1 text-base text-muted-foreground">
            Measurement for outreach campaigns: occupancy, incremental bookings, promo redemption, and opt-outs.
            KPIs that are not measurable from current data are marked as not tracked.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {overview?.campaigns.length ? (
            <Select value={selectedCampaignId} onValueChange={handleSelectCampaign}>
              <SelectTrigger className="h-10 w-[280px] rounded-xl border border-border/70 bg-background px-3">
                <SelectValue placeholder="Select campaign" />
              </SelectTrigger>
              <SelectContent position="popper" className="w-[var(--radix-select-trigger-width)]">
                {overview.campaigns.map((campaign) => (
                  <SelectItem key={campaign.id} value={String(campaign.id)}>
                    {campaign.name} · {formatDate(campaign.campaignDate)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          <Button
            variant="outline"
            className="h-10 gap-2"
            onClick={() => void loadOverview(selected ? selected.campaign.id : undefined)}
            disabled={isLoading}
          >
            <RefreshCw className={isLoading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            Refresh
          </Button>
          {isItSupport ? (
            <Button
              variant="outline"
              className="h-10 gap-2"
              onClick={() => void handleRunAutoScan()}
              disabled={isScanning}
            >
              {isScanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Scan Low-Occupancy Slots
            </Button>
          ) : null}
        </div>
      </div>

      {scanResult ? (
        <p className="text-xs text-muted-foreground">
          Last scan: {scanResult.created.length} draft(s) created across the next {scanResult.scannedDays} days
          (threshold {scanResult.occupancyThreshold}% baseline occupancy, min audience {scanResult.minAudience}).
        </p>
      ) : null}

      {statusMessage ? (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-3 text-sm text-primary">{statusMessage}</CardContent>
        </Card>
      ) : null}

      {error ? (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      ) : null}

      {isLoading && !overview ? (
        <Card>
          <CardContent className="flex min-h-40 items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading campaign KPIs...
          </CardContent>
        </Card>
      ) : !selected || !performance ? (
        <Card>
          <CardContent className="space-y-3 py-8 text-center">
            <BarChart3 className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">No outreach campaigns have been created yet.</p>
            <p className="text-sm text-muted-foreground">
              Create a campaign from Fill Sessions to start tracking occupancy and incremental bookings.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Occupancy on Campaign Date"
              value={formatPercent(performance.occupancyRate)}
              detail={
                performance.baselineOccupancyRate === null
                  ? "No historical baseline for this weekday/session yet."
                  : `Baseline ${formatPercent(performance.baselineOccupancyRate)} · lift ${
                      performance.occupancyLiftPct === null
                        ? "not available"
                        : formatPercent(performance.occupancyLiftPct)
                    }`
              }
            />
            <KpiCard
              label="Incremental Bookings"
              value={String(performance.estimatedIncrementalBookings)}
              detail={
                selectedIsControlAware
                  ? `${formatPercent(performance.conversionRate)} treated vs ${formatPercent(
                      performance.controlConversionRate
                    )} holdout`
                  : "Holdout group too small to isolate lift; treat as directional."
              }
              tone={selectedIsControlAware ? "default" : "warning"}
            />
            <KpiCard
              label="Attributed Revenue"
              value={formatCurrency(performance.attributedRevenue)}
              detail={`${performance.attributedBookingCount} promo-coded bookings · ${formatPercent(
                performance.redemptionRate
              )} redemption`}
            />
            <KpiCard
              label="Cost per Booking"
              value={formatCurrency(performance.costPerBooking)}
              detail={
                performance.costBudget > 0
                  ? `Budget ${formatCurrency(performance.costBudget)} · ROAS ${
                      performance.returnOnCampaignSpend === null
                        ? "n/a"
                        : `${performance.returnOnCampaignSpend.toFixed(2)}x`
                    }`
                  : "Set a campaign budget when creating a campaign to enable this KPI."
              }
              tone={performance.costBudget > 0 ? "default" : "muted"}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Response Rate"
              value="Not tracked"
              detail={performance.responseRateNote}
              tone="muted"
            />
            <KpiCard
              label="Opt-out Rate"
              value={formatPercent(performance.optOutRate)}
              detail={`${performance.optedOutCount} of ${performance.audienceSize} recipients`}
              tone={performance.optOutRate >= 5 ? "warning" : "default"}
            />
            <KpiCard
              label="Audience vs Empty Slots"
              value={`${performance.audienceSize} / ${performance.emptySlots}`}
              detail={
                performance.audienceCoverage?.note ||
                "Coverage could not be computed for this campaign date."
              }
              tone={
                performance.audienceCoverage?.coverageStatus === "insufficient"
                  ? "warning"
                  : "default"
              }
            />
            <KpiCard
              label="Cannibalization"
              value={formatPercent(performance.cannibalizationRate)}
              detail="Converted customers who booked without the promo code. High values mean the campaign may be paying for demand that already existed."
              tone={performance.cannibalizationRate >= 50 ? "warning" : "default"}
            />
          </div>

          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Users className="h-5 w-5 text-primary" />
                  Campaign Summary
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant={STATUS_BADGE_VARIANT[selected.campaign.status] || "secondary"}>
                    {selected.campaign.status}
                  </Badge>
                  {selected.campaign.status === "draft" ? (
                    <Button size="sm" className="gap-1.5" onClick={openActivateDialog}>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Review &amp; Activate
                    </Button>
                  ) : selected.campaign.status === "active" ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        onClick={() => void openWorkspace(selected.campaign.id)}
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        View Recipients &amp; Send Links
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        onClick={() => void handleSendMessages()}
                        disabled={isSending || performance.pendingCount === 0}
                      >
                        {isSending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                        Send via WhatsApp ({performance.pendingCount} pending)
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
              <CardDescription>
                {selected.campaign.name} · {formatDate(String(selected.campaign.campaignDate))} ·{" "}
                {selected.campaign.sessionName} · {selected.campaign.courtType}
              </CardDescription>
              {selected.campaign.status === "draft" ? (
                <p className="rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs text-amber-800">
                  This campaign was auto-drafted from the weekly low-occupancy scan. Nothing has been sent — review
                  the audience and confirm consent before activating it.
                </p>
              ) : null}
              {sendResult ? (
                <p className="rounded-xl border border-border bg-secondary/20 px-3 py-2 text-xs text-muted-foreground">
                  Last send: {sendResult.sent} sent · {sendResult.failed} failed · {sendResult.skippedNoPhone} skipped (no phone).
                  {sendResult.errors.length > 0 ? ` First error: ${sendResult.errors[0].error}` : ""}
                </p>
              ) : null}
              {sendError ? (
                <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{sendError}</p>
              ) : null}
            </CardHeader>
            <CardContent className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-border p-3">
                <p className="text-xs text-muted-foreground">Audience</p>
                <p className="mt-1 font-semibold">{performance.audienceSize} recipients</p>
                <p className="text-xs text-muted-foreground">
                  {performance.treatmentSize} treated · {performance.controlSize} holdout
                </p>
              </div>
              <div className="rounded-xl border border-border p-3">
                <p className="text-xs text-muted-foreground">Outreach progress</p>
                <p className="mt-1 font-semibold">
                  {performance.sentCount} sent · {performance.pendingCount} pending
                </p>
                <p className="text-xs text-muted-foreground">
                  Mark recipients as sent inside the Fill Sessions campaign workspace.
                </p>
              </div>
              <div className="rounded-xl border border-border p-3">
                <p className="text-xs text-muted-foreground">Booking window</p>
                <p className="mt-1 font-semibold">{performance.windowDays} days from campaign date</p>
                <p className="text-xs text-muted-foreground">
                  {performance.treatmentBookings} treated bookings · {performance.controlBookings} holdout bookings
                </p>
              </div>
              <div className="rounded-xl border border-border p-3">
                <p className="text-xs text-muted-foreground">Promo prefix</p>
                <p className="mt-1 font-semibold">{selected.campaign.promoCodePrefix}</p>
                <p className="text-xs text-muted-foreground">
                  Redemption is matched from imported transaction promo fields.
                </p>
              </div>
            </CardContent>
          </Card>

          {performance.possibleUnmatchedConversions.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Search className="h-5 w-5 text-primary" />
                  Unmatched Promo Check ({performance.possibleUnmatchedConversions.length})
                </CardTitle>
                <CardDescription>{performance.possibleUnmatchedConversionsNote}</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <table className="min-w-[600px] divide-y divide-border text-sm">
                  <thead className="bg-secondary/30 text-left text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Customer</th>
                      <th className="px-4 py-3 font-semibold">Promo Code</th>
                      <th className="px-4 py-3 font-semibold">Bookings</th>
                      <th className="px-4 py-3 font-semibold">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {performance.possibleUnmatchedConversions.map((row) => (
                      <tr key={row.customerKey}>
                        <td className="px-4 py-3 font-medium">{row.customerName}</td>
                        <td className="px-4 py-3 font-mono text-xs">{row.promoCode}</td>
                        <td className="px-4 py-3">{row.bookingCount}</td>
                        <td className="px-4 py-3">{formatCurrency(row.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingUp className="h-5 w-5 text-primary" />
                KPI Definitions
              </CardTitle>
              <CardDescription>What each number means and what is still missing.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              {(overview?.kpiDefinitions || []).map((definition) => (
                <div key={definition.key} className="rounded-xl border border-border p-3">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    {definition.label}
                    {definition.key === "responseRate" ? (
                      <Badge variant="secondary" className="text-[10px] uppercase">
                        Not tracked
                      </Badge>
                    ) : null}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{definition.description}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Campaign History</CardTitle>
              <CardDescription>All campaigns, newest first.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <table className="min-w-[900px] divide-y divide-border text-sm">
                <thead className="bg-secondary/30 text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Campaign</th>
                    <th className="px-4 py-3 font-semibold">Date</th>
                    <th className="px-4 py-3 font-semibold">Session</th>
                    <th className="px-4 py-3 font-semibold">Segment</th>
                    <th className="px-4 py-3 font-semibold">Recipients</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {overview?.campaigns.map((campaign) => (
                    <tr
                      key={campaign.id}
                      className={campaign.id === selected.campaign.id ? "bg-primary/5" : undefined}
                    >
                      <td className="px-4 py-3 font-medium">{campaign.name}</td>
                      <td className="px-4 py-3">{formatDate(String(campaign.campaignDate))}</td>
                      <td className="px-4 py-3">{campaign.sessionName}</td>
                      <td className="px-4 py-3">{campaign.segmentName || "All segments"}</td>
                      <td className="px-4 py-3">{campaign.recipientCount}</td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary">{campaign.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Ban className="h-5 w-5 text-primary" />
            Opt-out List
          </CardTitle>
          <CardDescription>
            Customers here are excluded from every future campaign. Only remove an opt-out when the customer explicitly asks to receive messages again.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {suppressions.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">
              No customers have opted out.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="min-w-[600px] divide-y divide-border text-sm">
                <thead className="bg-secondary/30 text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Customer Key</th>
                    <th className="px-4 py-3 font-semibold">Reason</th>
                    <th className="px-4 py-3 font-semibold">Added</th>
                    <th className="px-4 py-3 font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {suppressions.map((row) => (
                    <tr key={row.id}>
                      <td className="px-4 py-3 font-mono text-xs">{row.customerKey}</td>
                      <td className="px-4 py-3">{row.reason || "-"}</td>
                      <td className="px-4 py-3">{formatDate(row.createdAt)}</td>
                      <td className="px-4 py-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void handleRemoveSuppression(row.customerKey)}
                        >
                          Remove
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Response rate requires a WhatsApp Business API or manual reply logging; MaiinSight does not receive WhatsApp replies today.
          </p>
        </CardContent>
      </Card>

      <Dialog open={activateDialogOpen} onOpenChange={setActivateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Activate Draft Campaign</DialogTitle>
            <DialogDescription>
              {selected
                ? `${selected.campaign.name} will become active for ${performance?.audienceSize ?? 0} recipients. Review the audience in Fill Sessions before sending.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          {activateError ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {activateError}
            </p>
          ) : null}
          <label className="flex items-start gap-2 rounded-xl border border-border bg-secondary/20 p-3 text-sm">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={activateConsentChecked}
              onChange={(event) => setActivateConsentChecked(event.target.checked)}
            />
            I confirm these are existing customers who agreed to receive promotional WhatsApp messages, and the
            message includes an opt-out path.
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setActivateDialogOpen(false)} disabled={isActivating}>
              Cancel
            </Button>
            <Button onClick={() => void confirmActivate()} disabled={isActivating || !activateConsentChecked}>
              {isActivating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Activate Campaign
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={workspaceOpen} onOpenChange={setWorkspaceOpen}>
        <DialogContent className="max-h-[88vh] max-w-6xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Campaign Workspace</DialogTitle>
            <DialogDescription>
              {workspaceCampaign
                ? `${workspaceCampaign.campaign.name} · ${workspaceCampaign.recipientCount} recipients`
                : "Loading recipients..."}
            </DialogDescription>
          </DialogHeader>

          {isLoadingWorkspace && !workspaceCampaign ? (
            <div className="flex min-h-32 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : workspaceCampaign ? (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" className="gap-2" onClick={() => void copyWorkspaceMessages()}>
                  <Copy className="h-4 w-4" />
                  Copy All Messages
                </Button>
                <Button variant="outline" size="sm" className="gap-2" onClick={exportWorkspaceRecipients}>
                  <Download className="h-4 w-4" />
                  Export Recipients
                </Button>
                <Button variant="outline" size="sm" className="gap-2" onClick={() => void refreshWorkspace()}>
                  <RefreshCw className="h-4 w-4" />
                  Refresh
                </Button>
              </div>

              <div className="max-h-[50vh] overflow-auto rounded-xl border border-border">
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
                    {(workspaceCampaign.recipients || []).map((recipient) => (
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
                                onClick={() => void handleWorkspaceRecipientStatus(recipient.id, "sent")}
                              >
                                <Check className="h-3.5 w-3.5" />
                                Sent
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 gap-1.5 text-red-600"
                                disabled={recipientActionId === recipient.id || recipient.status === "opted_out"}
                                onClick={() => void handleWorkspaceRecipientStatus(recipient.id, "opted_out")}
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
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
