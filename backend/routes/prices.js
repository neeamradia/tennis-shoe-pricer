import { Router } from 'express'
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
 * Fetch 3 pages of Google Shopping results from Zenserp in parallel (~30 products).
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
    [1, 2, 3].map((page) => {
      const url = new URL('https://api.scaleserp.com/search')
      url.searchParams.set('api_key', apiKey)
      url.searchParams.set('q', q)
      url.searchParams.set('search_type', 'shopping')
      url.searchParams.set('gl', 'uk')
      url.searchParams.set('hl', 'en')
      url.searchParams.set('page', String(page))
      return fetch(url.toString()).then(r => r.json())
    })
  )
  return pages.flatMap((p) => p.status === 'fulfilled' ? (p.value.shopping_results ?? []) : [])
}

const TLD_PATTERN = /\.(co\.uk|com|de|fr|es|it|ch|nl|be|at|pl|pt|se|dk|fi|no|ie)$/i

/**
 * Resolve a ScaleSerp merchant name to a retailer config.
 * 1. If the name looks like a domain (e.g. "Tennis-Point.co.uk"), extract and look up directly.
 * 2. Otherwise normalize and fuzzy-match against retailer display names.
 */
function merchantToRetailer(merchantName) {
  if (!merchantName) return null

  if (TLD_PATTERN.test(merchantName)) {
    const domain = merchantName.toLowerCase().replace(/^www\./, '')
    return retailerByDomain[domain] ?? null
  }

  // Handle ScaleSerp names like "ClubRacketscom" (dot missing before "com")
  if (/[a-z]com$/i.test(merchantName) && !merchantName.includes('.')) {
    const guessedDomain = merchantName.toLowerCase().replace(/com$/, '.com')
    const r = retailerByDomain[guessedDomain]
    if (r) return r
  }

  const normMerchant = normalize(merchantName)
  const compactMerchant = normMerchant.replace(/\s+/g, '')
  for (const retailer of retailers) {
    const normName = normalize(retailer.name)
    if (normName.includes(normMerchant) || normMerchant.includes(normName) ||
        normName.replace(/\s+/g, '') === compactMerchant) {
      return retailer
    }
  }

  return null
}

/**
 * For a shoe, fetch all retailer offers from Shopping results.
 * Resolves retailers via merchant name — no second-phase API call needed.
 * Returns a map of domain → { listedPrice, url } keeping the lowest price per retailer.
 */
async function getAllRetailerOffers(brand, model, apiKey, filters) {
  const shoppingResults = await searchShopping(brand, model, apiKey, filters)
  const filteredResults = filterShoppingResults(shoppingResults, model, filters.gender)

  const bestByDomain = {}
  for (const product of filteredResults) {
    const retailer = merchantToRetailer(product.merchant)
    if (!retailer) {
      console.warn(`[prices] No retailer match for merchant: "${product.merchant}"`)
      continue
    }

    const listedPrice = typeof product.price === 'number'
      ? product.price
      : parseFloat(String(product.price ?? '').replace(/[^0-9.]/g, ''))
    if (!listedPrice || isNaN(listedPrice)) continue

    const domain = retailer.domain
    const url = `https://${domain}`
    if (!bestByDomain[domain] || listedPrice < bestByDomain[domain].listedPrice) {
      bestByDomain[domain] = { listedPrice, url, retailer }
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
  const apiKey = process.env.SCALESERP_KEY
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
