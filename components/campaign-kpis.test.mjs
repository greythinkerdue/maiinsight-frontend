import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const source = await readFile(new URL("./campaign-kpis.tsx", import.meta.url), "utf8")
const api = await readFile(new URL("../lib/targeting.ts", import.meta.url), "utf8")

test("OutreachPerformance exposes a typed liftSignificance result", () => {
  const start = api.indexOf("interface OutreachPerformance")
  const end = api.indexOf("}", start)
  const section = api.slice(start, end)
  assert.match(section, /liftSignificance:\s*\{/)
  assert.match(section, /pValue: number/)
  assert.match(section, /zScore: number/)
  assert.match(section, /significant: boolean/)
  assert.match(section, /confidenceIntervalPct: \[number, number\]/)
})

test("Incremental Bookings KPI renders significance alongside the holdout comparison", () => {
  const start = source.indexOf('label="Incremental Bookings"')
  const end = source.indexOf("/>", start)
  const card = source.slice(start, end)
  assert.match(card, /formatSignificance\(performance\.liftSignificance\)/)
  assert.match(card, /treated vs/)
})

test("formatSignificance reports both the significant and not-significant case", () => {
  const start = source.indexOf("const formatSignificance")
  const end = source.indexOf("\n}", start)
  const fn = source.slice(start, end)
  assert.match(fn, /significant \(p=/)
  assert.match(fn, /not significant \(p=/)
})
