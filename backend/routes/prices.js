import { Router } from 'express'
import { getJson } from 'serpapi'
import NodeCache from 'node-cache'
import { createRequire } from 'module'
import { landedCost } from '../utils/landedCost.js'
import { getRates } from '../services/exchangeRate.js'

const require = createRequire(import.meta.url)
const retailers = require('../../data/retailers.json')

// domain → retailer config lookup
const retailerByDomain = Object.fromEntries(retailers.map((r) => [r.domain, r]))

const router = Router()
const cache = new NodeCache({ stdTTL: 3600 }) // 60-min TTL per shoe

/**
 * Extract root domain from a URL, stripping www.
 * e.g. "https://www.tennis-point.co.uk/foo" → "tennis-point.co.uk"
 */
function extractDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

/**
 * Step 1: Google Shopping search — returns up to 5 product results for the shoe.
 */
async function searchShopping(brand, model, apiKey) {
  const result = await getJson({
    engine: 'google_shopping',
    q: `${brand} ${model} tennis shoe`,
    gl: 'uk',
    hl: 'en',
    api_key: apiKey
  })
  return result.shopping_results ?? []
}

/**
 * Step 2: Immersive product page — returns all individual retailer offers for one product.
 */
async function fetchStores(pageToken, apiKey) {
  const result = await getJson({
    engine: 'google_immersive_product',
    page_token: pageToken,
    api_key: apiKey
  })
  return result.product_results?.stores ?? []
}

/**
 * For a shoe, fetch all retailer offers across the top Shopping results.
 * Returns a map of domain → { listedPrice, url } keeping the lowest price per retailer.
 */
async function getAllRetailerOffers(brand, model, apiKey) {
  const shoppingResults = await searchShopping(brand, model, apiKey)

  // Fetch stores for each product in parallel (up to top 5 results)
  const topProducts = shoppingResults.slice(0, 5)
  const storePages = await Promise.allSettled(
    topProducts
      .filter((p) => p.immersive_product_page_token)
      .map((p) => fetchStores(p.immersive_product_page_token, apiKey))
  )

  // Aggregate all stores; keep lowest listed price per domain
  const bestByDomain = {}
  for (const page of storePages) {
    if (page.status !== 'fulfilled') continue
    for (const store of page.value) {
      const url = store.link ?? ''
      const domain = extractDomain(url)
      if (!domain) continue

      const retailer = retailerByDomain[domain]
      if (!retailer) continue

      const inStock = store.details_and_offers?.some((d) =>
        /in stock/i.test(d)
      ) ?? true // assume in stock if not explicitly stated

      if (!inStock) continue

      const listedPrice = store.extracted_price ?? parseFloat(String(store.price ?? '').replace(/[^0-9.]/g, ''))
      if (!listedPrice || isNaN(listedPrice)) continue

      if (!bestByDomain[domain] || listedPrice < bestByDomain[domain].listedPrice) {
        bestByDomain[domain] = { listedPrice, url, retailer }
      }
    }
  }

  return bestByDomain
}

router.post('/', async (req, res) => {
  const shoes = req.body
  if (!Array.isArray(shoes) || shoes.length === 0) {
    return res.status(400).json({ error: 'Body must be a non-empty array of shoes' })
  }

  const apiKey = process.env.SERPAPI_KEY
  const { EUR_GBP, CHF_GBP, source } = await getRates()
  const exchangeRateFallback = source === 'fallback'

  const shoeResults = await Promise.all(
    shoes.map(async (shoe) => {
      const cacheKey = `${shoe.brand}::${shoe.model}`
      const cached = cache.get(cacheKey)
      if (cached) return { shoe, results: cached }

      let offersByDomain
      try {
        offersByDomain = await getAllRetailerOffers(shoe.brand, shoe.model, apiKey)
      } catch (err) {
        console.error(`[prices] Search failed for ${shoe.brand} ${shoe.model}: ${err.message}`)
        return { shoe, results: [] }
      }

      const results = Object.values(offersByDomain)
        .map(({ listedPrice, url, retailer }) => {
          const costs = landedCost(listedPrice, retailer, EUR_GBP, CHF_GBP)
          return {
            retailer: retailer.name,
            domain: retailer.domain,
            region: retailer.region,
            currency: retailer.currency,
            listedPrice,
            ...costs,
            url,
            inStock: true
          }
        })
        .sort((a, b) => a.landedCostGBP - b.landedCostGBP)

      cache.set(cacheKey, results)
      return { shoe, results }
    })
  )

  res.json({ exchangeRateFallback, results: shoeResults })
})

export default router
