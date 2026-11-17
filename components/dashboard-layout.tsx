"use client"

import { useState } from "react"

import { DashboardSidebar, type PageId } from "./dashboard-sidebar"
import { DashboardHeader } from "./dashboard-header"
import { AnalyticsDashboard } from "./analytics-dashboard"
import { SegmentVisualization } from "./segment-visualization"
import { DataManagement } from "./data-management"
import { LowOccupancyTargeting } from "./low-occupancy-targeting"
import { GenAIWorkspace } from "./genai-workspace"
import { CampaignKpis } from "./campaign-kpis"
import { ChurnRiskPanel } from "./churn-risk-panel"
import { InstaSightHub } from "./instasight-hub"
import { ActivityLogs } from "./activity-logs"
import { SystemSettings } from "./system-settings"
import { ManagementReport } from "./management-report"
import { MetaAudience } from "./meta.audiance"
import { UserRole } from "@/lib/roles"

interface DashboardLayoutProps {
  currentPage: PageId
  onNavigate: (page: PageId) => void
  onLogout: () => void
  userRole: UserRole
}

export function DashboardLayout({
  currentPage,
  onNavigate,
  onLogout,
  userRole,
}: DashboardLayoutProps) {
  const [performanceView, setPerformanceView] = useState<"performance" | "audience">("performance")

  const renderPage = () => {
    switch (currentPage) {
      case "dashboard":
        return <AnalyticsDashboard />
      case "segments":
        return <SegmentVisualization onNavigate={onNavigate} />
      case "data":
        return <DataManagement />
      case "targeting":
        return <LowOccupancyTargeting onNavigate={onNavigate} />
      case "genai":
        return <GenAIWorkspace />
      case "campaign-kpis":
        return <CampaignKpis />
      case "churn-risk":
        return <ChurnRiskPanel />
      case "instasight":
        return performanceView === "audience" ? (
          <MetaAudience onBack={() => setPerformanceView("performance")} />
        ) : (
          <InstaSightHub onViewAudience={() => setPerformanceView("audience")} />
        )
      case "reports":
        return <ManagementReport />
      case "history":
        return <ActivityLogs />
      case "settings":
        return <SystemSettings />
      default:
        return <AnalyticsDashboard />
    }
  }

  return (
    <div className="relative flex h-screen overflow-hidden bg-[radial-gradient(circle_at_top,#ffffff_0%,#f4f7f6_46%,#eef2f1_100%)]">
      <DashboardSidebar
        currentPage={currentPage}
        onNavigate={onNavigate}
        userRole={userRole}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <DashboardHeader
          currentPage={currentPage}
          onNavigate={onNavigate}
          onLogout={onLogout}
          userRole={userRole}
        />
        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1400px] px-5 py-3 sm:px-6 sm:py-4 md:py-5 lg:px-8 lg:py-6">{renderPage()}</div>
        </main>
      </div>
    </div>
  )
}
