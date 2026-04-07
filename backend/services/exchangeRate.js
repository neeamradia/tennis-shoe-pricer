import NodeCache from 'node-cache'

const cache = new NodeCache({ stdTTL: 3600 }) // 1-hour TTL
const CACHE_KEY = 'exchange_rates'

const FALLBACK = { EUR_GBP: 0.86, CHF_GBP: 0.88 }

/**
 * Returns live EUR/GBP and CHF/GBP rates, cached for 1 hour.
 * Both rates are derived from a single API call (EUR base).
 * Falls back to hardcoded rates if the fetch fails.
 *
 * @returns {Promise<{ EUR_GBP: number, CHF_GBP: number, cachedAt: string, source: 'live'|'fallback' }>}
 */
export async function getRates() {
  const cached = cache.get(CACHE_KEY)
  if (cached) return cached

  try {
    const response = await fetch('https://open.er-api.com/v6/latest/EUR')
    if (!response.ok) throw new Error(`Exchange rate API responded with ${response.status}`)

    const data = await response.json()
    if (data.result !== 'success') throw new Error('Exchange rate API returned non-success result')

    const EUR_GBP = data.rates.GBP
    // Derive CHF→GBP: (1 EUR = X GBP) / (1 EUR = Y CHF) → 1 CHF = X/Y GBP
    const CHF_GBP = data.rates.GBP / data.rates.CHF

    const result = {
      EUR_GBP: Math.round(EUR_GBP * 100000) / 100000,
      CHF_GBP: Math.round(CHF_GBP * 100000) / 100000,
      cachedAt: new Date().toISOString(),
      source: 'live'
    }

    cache.set(CACHE_KEY, result)
    return result
  } catch (err) {
    console.warn(`[exchangeRate] Failed to fetch live rates: ${err.message}. Using fallback.`)
    return {
      ...FALLBACK,
      cachedAt: new Date().toISOString(),
      source: 'fallback'
    }
  }
}
