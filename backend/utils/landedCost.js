/**
 * Calculates the true GBP landed cost for a shoe from any retailer.
 *
 * @param {number} listedPrice - The price shown on the retailer's site (in retailer's currency)
 * @param {object} retailer    - A retailer config object from /data/retailers.json
 * @param {number} eurGbpRate  - Live EUR → GBP exchange rate (e.g. 0.86)
 * @param {number} chfGbpRate  - Live CHF → GBP exchange rate (e.g. 0.88)
 * @returns {{ basePriceGBP, adjustedPrice, taxAdjustmentGBP, shippingCostGBP, landedCostGBP }}
 */
export function landedCost(listedPrice, retailer, eurGbpRate, chfGbpRate) {
  // Step 1: Convert listed price to GBP
  let basePriceGBP
  if (retailer.currency === 'GBP') {
    basePriceGBP = listedPrice
  } else if (retailer.currency === 'EUR') {
    basePriceGBP = listedPrice * eurGbpRate
  } else if (retailer.currency === 'CHF') {
    basePriceGBP = listedPrice * chfGbpRate
  } else {
    throw new Error(`Unsupported currency: ${retailer.currency}`)
  }

  // Step 2: Remove EU/CH local VAT (UK buyers are not liable for foreign VAT)
  let adjustedPrice
  if (retailer.region === 'UK') {
    adjustedPrice = basePriceGBP
  } else {
    adjustedPrice = basePriceGBP / (1 + retailer.euVatRate)
  }

  // Step 3: Apply UK import rules based on the £135 customs threshold
  let taxAdjustmentGBP
  if (retailer.region === 'UK') {
    taxAdjustmentGBP = 0
  } else if (adjustedPrice < 135) {
    // Below threshold: no import duty, no UK VAT at border
    taxAdjustmentGBP = 0
  } else {
    // Above threshold: 3.7% footwear duty + 20% UK VAT on duty-inclusive value
    const duty = adjustedPrice * 0.037
    const ukVat = (adjustedPrice + duty) * 0.20
    taxAdjustmentGBP = duty + ukVat
  }

  // Step 4: Shipping — free if adjusted price meets the threshold
  let shippingCostGBP
  if (adjustedPrice >= retailer.freeShippingThresholdGBP) {
    shippingCostGBP = 0
  } else {
    shippingCostGBP = retailer.shippingFlatRateGBP
  }

  // Step 5: Final landed cost
  const landedCostGBP = adjustedPrice + taxAdjustmentGBP + shippingCostGBP

  return {
    basePriceGBP: round2(basePriceGBP),
    adjustedPrice: round2(adjustedPrice),
    taxAdjustmentGBP: round2(taxAdjustmentGBP),
    shippingCostGBP: round2(shippingCostGBP),
    landedCostGBP: round2(landedCostGBP)
  }
}

function round2(n) {
  return Math.round(n * 100) / 100
}
