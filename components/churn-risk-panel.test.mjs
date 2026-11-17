import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const source = await readFile(new URL("./churn-risk-panel.tsx", import.meta.url), "utf8")
const api = await readFile(new URL("../lib/churn-risk.ts", import.meta.url), "utf8")
const sidebar = await readFile(new URL("./dashboard-sidebar.tsx", import.meta.url), "utf8")
const roles = await readFile(new URL("../lib/roles.ts", import.meta.url), "utf8")
const layout = await readFile(new URL("./dashboard-layout.tsx", import.meta.url), "utf8")

test("ChurnRiskPanel exposes model metrics and a Train Model action", () => {
  assert.match(source, /AUC \(Test\)/)
  assert.match(source, /from "@\/components\/ui\/card"/)
  assert.match(source, /<KpiCard/)
  assert.match(source, /Precision \/ Recall/)
  assert.match(source, /Train \/ Test Rows/)
  assert.match(source, />\s*Train Model/)
  assert.match(source, /trainChurnModel\(\)/)
})

test("ChurnRiskPanel's at-risk customer table has the expected columns", () => {
  const start = source.indexOf("<TableHeader>")
  const end = source.indexOf("</TableHeader>", start)
  const header = source.slice(start, end)
  for (const column of ["Customer", "Probability", "Risk", "Days Since Last Booking", "Top Drivers"]) {
    assert.match(header, new RegExp(`>${column}<`))
  }
})

test("ChurnRiskPanel shows per-customer top drivers with a direction indicator", () => {
  assert.match(source, /customer\.topDrivers\.map/)
  assert.match(source, /direction === "increases_risk"/)
  assert.match(source, /ArrowUpRight/)
  assert.match(source, /ArrowDownRight/)
})

test("ChurnRiskPanel shows a naive baseline accuracy next to Precision / Recall", () => {
  assert.match(source, /computeNaiveBaselineAccuracy/)
  assert.match(source, /always predict majority class/)
})

test("ChurnRiskPanel can send a reactivation campaign from the at-risk audience", () => {
  assert.match(source, /Send Reactivation Campaign/)
  assert.match(source, /createChurnReactivationCampaign\(/)
  assert.match(source, /consentConfirmed/)
  assert.match(source, /View in Campaign KPIs/)
})

test("lib/churn-risk.ts exposes the reactivation campaign API call", () => {
  assert.match(api, /\/churn-risk\/reactivation-campaign/)
  assert.match(api, /consentConfirmed: boolean/)
})

test("ChurnRiskPanel handles the insufficient_data and failed run states", () => {
  assert.match(source, /insufficient_data/)
  assert.match(source, /run\.status === "failed"/)
})

test("lib/churn-risk.ts exposes the train and latest-results API calls", () => {
  assert.match(api, /\/churn-risk\/train/)
  assert.match(api, /\/churn-risk\/latest/)
  assert.match(api, /riskLabel: "High" \| "Medium" \| "Low"/)
})

test("churn-risk page is registered in navigation, permissions, and the layout switch", () => {
  assert.match(sidebar, /"churn-risk"/)
  assert.match(roles, /"churn-risk"/)
  assert.match(layout, /case "churn-risk":/)
  assert.match(layout, /<ChurnRiskPanel onNavigate=\{onNavigate\} \/>/)
})
