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
 * Normalise a string for fuzzy comparison: lowercase, strip punctuation, collapse whitespace.
 */
function normalize(str) {
  return str.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim()
}

/**
 * Check that every word in the model name appears somewhere in the product title.
 */
function matchesModel(title, model) {
  const normTitle = normalize(title)
  const modelWords = normalize(model).split(' ')
  return modelWords.every(word => normTitle.includes(word))
}

/**
 * Reject results with contradictory gender signals.
 * Titles with no gender keywords pass through (many listings omit gender).
 */
function matchesGender(title, gender) {
  if (!gender) return true
  const t = title.toLowerCase()
  const hasWomens = /\bwome?n'?s?\b/.test(t)
  const hasMens = /(?<!\bwo)\bme?n'?s?\b/.test(t)
  const hasKids = /\b(kids?|junior|youth|boys?|girls?)\b/.test(t)
  const g = gender.toLowerCase()
  if (g === 'mens') return !hasWomens
  if (g === 'womens') return !hasMens || hasWomens
  if (g === 'kids') return hasKids || (!hasMens && !hasWomens)
  return true
}

/**
 * Apply model-name and gender filters to shopping results, with debug logging.
 */
function filterShoppingResults(results, model, gender) {
  const filtered = results.filter(product => {
    const title = product.title ?? ''
    if (!matchesModel(title, model)) {
      console.warn(`[prices] Filtered out (model mismatch): "${title}"`)
      return false
    }
    if (!matchesGender(title, gender)) {
      console.warn(`[prices] Filtered out (gender mismatch): "${title}"`)
      return false
    }
    return true
  })
  console.warn(`[prices] ${model}: ${results.length} results → ${filtered.length} after relevance filtering`)
  return filtered
}

/**
 * Step 1: Google Shopping search — fetches 3 pages in parallel (~30 product variants).
 */
async function searchShopping(brand, model, apiKey, filters = {}) {
  const { gender, courtType, size } = filters
  const quotedModel = model.includes('"') ? model : `"${model}"`
  const parts = [brand, quotedModel]
  if (courtType && courtType !== 'All Court') parts.push(courtType)
  if (gender) parts.push(gender)
  if (size) parts.push(`UK ${size}`)
  parts.push('tennis shoe')

  const q = parts.join(' ')
  const pages = await Promise.allSettled(
    [0, 10, 20].map((start) =>
      getJson({ engine: 'google_shopping', q, gl: 'uk', hl: 'en', start, api_key: apiKey })
    )
  )
  return pages.flatMap((p) => p.status === 'fulfilled' ? (p.value.shopping_results ?? []) : [])
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
 * For a shoe, fetch all retailer offers across Shopping results (all pages, all colorways).
 * Returns a map of domain → { listedPrice, url } keeping the lowest price per retailer.
 */
async function getAllRetailerOffers(brand, model, apiKey, filters) {
  const shoppingResults = await searchShopping(brand, model, apiKey, filters)
  const filteredResults = filterShoppingResults(shoppingResults, model, filters.gender)

  // Deduplicate by page token before fetching immersive pages
  const seenTokens = new Set()
  const uniqueProducts = filteredResults.filter((p) => {
    if (!p.immersive_product_page_token) return false
    if (seenTokens.has(p.immersive_product_page_token)) return false
    seenTokens.add(p.immersive_product_page_token)
    return true
  })

  const storePages = await Promise.allSettled(
    uniqueProducts.map((p) => fetchStores(p.immersive_product_page_token, apiKey))
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
  const { shoes, gender, courtType, size } = req.body
  if (!Array.isArray(shoes) || shoes.length === 0) {
    return res.status(400).json({ error: 'Body must contain a non-empty shoes array' })
  }

  const filters = { gender, courtType, size }
  const apiKey = process.env.SERPAPI_KEY
  const { EUR_GBP, CHF_GBP, source } = await getRates()
  const exchangeRateFallback = source === 'fallback'

  const shoeResults = await Promise.all(
    shoes.map(async (shoe) => {
      const cacheKey = `${shoe.brand}::${shoe.model}::${gender || ''}::${courtType || ''}::${size || ''}`
      const cached = cache.get(cacheKey)
      if (cached) return { shoe, results: cached }

      let offersByDomain
      try {
        offersByDomain = await getAllRetailerOffers(shoe.brand, shoe.model, apiKey, filters)
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
