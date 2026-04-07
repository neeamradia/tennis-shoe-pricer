import { landedCost } from './landedCost.js'

const EUR_GBP = 0.86
const CHF_GBP = 0.88

// ─── Retailer fixtures ───────────────────────────────────────────────────────

const prodirectsport = {
  domain: 'prodirectsport.com',
  region: 'UK',
  currency: 'GBP',
  euVatRate: 0,
  shippingFlatRateGBP: 4.99,
  freeShippingThresholdGBP: 50
}

const tennisnuts = {
  domain: 'tennisnuts.com',
  region: 'UK',
  currency: 'GBP',
  euVatRate: 0,
  shippingFlatRateGBP: 3.99,
  freeShippingThresholdGBP: 50
}

const tennisPointDe = {
  domain: 'tennis-point.de',
  region: 'EU',
  currency: 'EUR',
  euVatRate: 0.19,
  shippingFlatRateGBP: 5.99,
  freeShippingThresholdGBP: 52
}

const tennisPointFr = {
  domain: 'tennis-point.fr',
  region: 'EU',
  currency: 'EUR',
  euVatRate: 0.20,
  shippingFlatRateGBP: 5.99,
  freeShippingThresholdGBP: 52
}

const babolat = {
  domain: 'babolat.com',
  region: 'EU',
  currency: 'EUR',
  euVatRate: 0.20,
  shippingFlatRateGBP: 6.99,
  freeShippingThresholdGBP: 69
}

const migros = {
  domain: 'migros-sport.ch',
  region: 'CH',
  currency: 'CHF',
  euVatRate: 0.077,
  shippingFlatRateGBP: 9.99,
  freeShippingThresholdGBP: 44
}

// ─── Tests ───────────────────────────────────────────────────────────────────

// Test 1: UK specialist — price below free-shipping threshold (shipping charged)
test('UK specialist: charges shipping when below free-ship threshold', () => {
  // £39.99 at Pro:Direct (free ship at £50)
  const result = landedCost(39.99, prodirectsport, EUR_GBP, CHF_GBP)
  expect(result.basePriceGBP).toBe(39.99)
  expect(result.adjustedPrice).toBe(39.99)
  expect(result.taxAdjustmentGBP).toBe(0)
  expect(result.shippingCostGBP).toBe(4.99)
  expect(result.landedCostGBP).toBe(44.98)
})

// Test 2: UK specialist — price at or above free-shipping threshold (free shipping)
test('UK specialist: free shipping when at or above threshold', () => {
  // £89.99 at Tennis Nuts (free ship at £50)
  const result = landedCost(89.99, tennisnuts, EUR_GBP, CHF_GBP)
  expect(result.basePriceGBP).toBe(89.99)
  expect(result.adjustedPrice).toBe(89.99)
  expect(result.taxAdjustmentGBP).toBe(0)
  expect(result.shippingCostGBP).toBe(0)
  expect(result.landedCostGBP).toBe(89.99)
})

// Test 3: EU sub-£135 — shipping charged (adjusted price below free-ship threshold and customs threshold)
test('EU sub-£135: no tax, shipping charged when below free-ship threshold', () => {
  // €79.95 at tennis-point.de (DE VAT 19%)
  // basePriceGBP = 79.95 * 0.86 = 68.757
  // adjustedPrice = 68.757 / 1.19 = 57.778... → 57.78
  // taxAdjustment = 0 (below £135)
  // shipping = £5.99 (adjusted 57.78 < threshold 52? No, 57.78 > 52 → free)
  // Actually 57.78 >= 52, so free shipping. Let me use a lower price.
  // €59.99: basePriceGBP = 51.59, adjustedPrice = 51.59/1.19 = 43.35, shipping charged (43.35 < 52)
  const result = landedCost(59.99, tennisPointDe, EUR_GBP, CHF_GBP)
  const expectedBase = Math.round(59.99 * 0.86 * 100) / 100        // 51.59
  const expectedAdj = Math.round((expectedBase / 1.19) * 100) / 100 // 43.35
  expect(result.basePriceGBP).toBe(expectedBase)
  expect(result.adjustedPrice).toBe(expectedAdj)
  expect(result.taxAdjustmentGBP).toBe(0)
  expect(result.shippingCostGBP).toBe(5.99)
  expect(result.landedCostGBP).toBe(Math.round((expectedAdj + 5.99) * 100) / 100)
})

// Test 4: EU sub-£135 — free shipping (adjusted price above free-ship threshold, still below £135)
test('EU sub-£135: no tax, free shipping when above free-ship threshold', () => {
  // €99.95 at tennis-point.fr (FR VAT 20%)
  // basePriceGBP = 99.95 * 0.86 = 85.957 → 85.96
  // adjustedPrice = 85.96 / 1.20 = 71.633... → 71.63
  // taxAdjustment = 0 (71.63 < 135)
  // shipping = £0 (71.63 >= 52)
  const result = landedCost(99.95, tennisPointFr, EUR_GBP, CHF_GBP)
  const expectedBase = Math.round(99.95 * 0.86 * 100) / 100
  const expectedAdj = Math.round((expectedBase / 1.20) * 100) / 100
  expect(result.taxAdjustmentGBP).toBe(0)
  expect(result.shippingCostGBP).toBe(0)
  expect(result.landedCostGBP).toBe(expectedAdj)
})

// Test 5: EU over-£135 — duty + UK VAT applied, shipping charged
test('EU over-£135: duty + UK VAT applied, shipping charged when below threshold', () => {
  // €220 at tennis-point.de (DE VAT 19%, free ship threshold £52)
  // basePriceGBP = 220 * 0.86 = 189.20
  // adjustedPrice = 189.20 / 1.19 = 158.99...
  // duty = 158.99 * 0.037 = 5.88...; ukVat = (158.99 + 5.88) * 0.20 = 32.97...
  // taxAdjustment = 5.88 + 32.97 = 38.85 (approx)
  // shipping = £0 (adjustedPrice >> 52)
  const result = landedCost(220, tennisPointDe, EUR_GBP, CHF_GBP)
  const expectedBase = Math.round(220 * 0.86 * 100) / 100
  const expectedAdj = Math.round((expectedBase / 1.19) * 100) / 100
  const duty = expectedAdj * 0.037
  const ukVat = (expectedAdj + duty) * 0.20
  const expectedTax = Math.round((duty + ukVat) * 100) / 100
  expect(result.taxAdjustmentGBP).toBe(expectedTax)
  expect(result.shippingCostGBP).toBe(0) // well above £52 threshold
  expect(result.landedCostGBP).toBe(Math.round((expectedAdj + expectedTax) * 100) / 100)
})

// Test 6: EU over-£135 — duty + UK VAT applied, shipping also charged
test('EU over-£135: duty + UK VAT applied, shipping charged on lower-priced item', () => {
  // Use a price where adjusted is just above £135 but below free-ship threshold.
  // tennisPointFr: freeShipThreshold = £52, so any price above £52 adj gets free ship.
  // Use tennisPointDe with freeShipThreshold £52 and a price where adj > 135.
  // €200 at tennis-point.de: base = 172, adj = 144.54 — above £52, free shipping.
  // Hard to get a case where adj > 135 AND adj < 52 threshold. Let me create a custom retailer.
  const highThresholdRetailer = {
    ...tennisPointFr,
    freeShippingThresholdGBP: 200
  }
  // €200: base = 172, adj = 172/1.20 = 143.33 — above £135, below £200 threshold
  const result = landedCost(200, highThresholdRetailer, EUR_GBP, CHF_GBP)
  const expectedBase = Math.round(200 * 0.86 * 100) / 100
  const expectedAdj = Math.round((expectedBase / 1.20) * 100) / 100
  const duty = expectedAdj * 0.037
  const ukVat = (expectedAdj + duty) * 0.20
  const expectedTax = Math.round((duty + ukVat) * 100) / 100
  expect(result.taxAdjustmentGBP).toBe(expectedTax)
  expect(result.shippingCostGBP).toBe(highThresholdRetailer.shippingFlatRateGBP)
  expect(result.landedCostGBP).toBe(
    Math.round((expectedAdj + expectedTax + highThresholdRetailer.shippingFlatRateGBP) * 100) / 100
  )
})

// Test 7: Brand-direct EU (Babolat FR) — sub-£135, free shipping
test('brand-direct EU: Babolat FR sub-£135 with free shipping', () => {
  // €119.99 at babolat.com (FR VAT 20%, free ship threshold £69)
  // basePriceGBP = 119.99 * 0.86 = 103.19
  // adjustedPrice = 103.19 / 1.20 = 85.99
  // taxAdjustment = 0 (85.99 < 135)
  // shipping = £0 (85.99 >= 69)
  const result = landedCost(119.99, babolat, EUR_GBP, CHF_GBP)
  const expectedBase = Math.round(119.99 * 0.86 * 100) / 100
  const expectedAdj = Math.round((expectedBase / 1.20) * 100) / 100
  expect(result.basePriceGBP).toBe(expectedBase)
  expect(result.adjustedPrice).toBe(expectedAdj)
  expect(result.taxAdjustmentGBP).toBe(0)
  expect(result.shippingCostGBP).toBe(0)
  expect(result.landedCostGBP).toBe(expectedAdj)
})

// Test 8: CHF retailer (Migros Sport) — Swiss VAT (7.7%) removed, sub-£135
test('CHF retailer: Swiss VAT removed, correct GBP conversion', () => {
  // CHF 149 at migros-sport.ch (Swiss VAT 7.7%, free ship threshold £44)
  // basePriceGBP = 149 * 0.88 = 131.12
  // adjustedPrice = 131.12 / 1.077 = 121.74...
  // taxAdjustment = 0 (121.74 < 135)
  // shipping = £0 (121.74 >= 44)
  const result = landedCost(149, migros, EUR_GBP, CHF_GBP)
  const expectedBase = Math.round(149 * 0.88 * 100) / 100
  const expectedAdj = Math.round((expectedBase / 1.077) * 100) / 100
  expect(result.basePriceGBP).toBe(expectedBase)
  expect(result.adjustedPrice).toBe(expectedAdj)
  expect(result.taxAdjustmentGBP).toBe(0)
  expect(result.shippingCostGBP).toBe(0)
  expect(result.landedCostGBP).toBe(expectedAdj)
})
