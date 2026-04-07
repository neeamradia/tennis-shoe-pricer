import { useState, useEffect, useCallback } from 'react'

const API_BASE = import.meta.env.VITE_API_URL ?? ''
const REGION_FLAG = { UK: '🇬🇧', EU: '🇪🇺', CH: '🇨🇭' }

function TaxTooltip() {
  const [visible, setVisible] = useState(false)
  return (
    <span className="relative inline-flex items-center ml-1">
      <button
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
        className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 text-xs font-bold leading-none flex items-center justify-center cursor-help flex-shrink-0"
        aria-label="Tax info"
      >
        i
      </button>
      {visible && (
        <span className="absolute bottom-6 right-0 w-56 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 z-20 shadow-lg">
          EU VAT removed from listed price. UK import rules applied (duty 3.7% + VAT 20% if over £135 threshold).
        </span>
      )}
    </span>
  )
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 animate-pulse">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-6 bg-gray-200 rounded w-48" />
        <div className="h-6 bg-blue-100 rounded-full w-16" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <tbody>
            {[0, 1, 2].map((i) => (
              <tr key={i} className="border-t border-gray-100">
                {[1, 2, 3, 4, 5, 6].map((j) => (
                  <td key={j} className="py-3 px-2">
                    <div className="h-4 bg-gray-100 rounded w-full" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ShoeCard({ shoeResult, sortBy }) {
  const { shoe, results } = shoeResult

  const sorted = [...results].sort((a, b) =>
    sortBy === 'base' ? a.basePriceGBP - b.basePriceGBP : a.landedCostGBP - b.landedCostGBP
  )

  const googleShoppingUrl = `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(`${shoe.brand} ${shoe.model} tennis shoe`)}`

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-5">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <h2 className="text-base sm:text-lg font-semibold text-gray-900 break-words">
          {shoe.brand} {shoe.model}
        </h2>
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-blue-100 text-blue-800 whitespace-nowrap">
          {shoe.matchScore} / 50
        </span>
      </div>

      {results.length === 0 ? (
        <div className="text-sm text-gray-500 py-2">
          <p className="mb-2">No prices found for this shoe.</p>
          <a
            href={googleShoppingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline font-medium"
          >
            Search on Google Shopping →
          </a>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto -mx-4 sm:-mx-5 px-4 sm:px-5">
            <table className="w-full text-sm min-w-[480px]">
              <thead>
                <tr className="text-left text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
                  <th className="pb-2 pr-3 font-medium">Retailer</th>
                  <th className="pb-2 pr-3 font-medium">Region</th>
                  <th className="pb-2 pr-3 font-medium text-right">Base</th>
                  <th className="pb-2 pr-3 font-medium text-right">Ship</th>
                  <th className="pb-2 pr-3 font-medium text-right">Tax</th>
                  <th className="pb-2 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r, i) => {
                  const hasImportTax = r.region !== 'UK' && r.taxAdjustmentGBP > 0
                  return (
                    <tr
                      key={r.domain}
                      className={`border-t border-gray-100 ${i === 0 ? 'bg-green-50' : ''}`}
                    >
                      <td className="py-3 pr-3 max-w-[120px] sm:max-w-none">
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline font-medium break-words"
                        >
                          {r.retailer}
                        </a>
                      </td>
                      <td className="py-3 pr-3 text-base">
                        {REGION_FLAG[r.region] ?? r.region}
                      </td>
                      <td className="py-3 pr-3 text-right text-gray-700 whitespace-nowrap">
                        £{r.basePriceGBP.toFixed(2)}
                      </td>
                      <td className="py-3 pr-3 text-right text-gray-700 whitespace-nowrap">
                        {r.shippingCostGBP === 0 ? (
                          <span className="text-green-600 font-medium">Free</span>
                        ) : (
                          `£${r.shippingCostGBP.toFixed(2)}`
                        )}
                      </td>
                      <td className="py-3 pr-3 text-right text-gray-700 whitespace-nowrap">
                        {hasImportTax ? (
                          <span className="inline-flex items-center justify-end">
                            £{r.taxAdjustmentGBP.toFixed(2)}
                            <TaxTooltip />
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="py-3 text-right font-bold text-gray-900 whitespace-nowrap">
                        £{r.landedCostGBP.toFixed(2)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-gray-400">
            Prices may vary by colourway — click through to verify at retailer.
          </p>
        </>
      )}
    </div>
  )
}

export default function ResultsPage({ shoeList, onReset }) {
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [exchangeRateFallback, setExchangeRateFallback] = useState(false)
  const [sortBy, setSortBy] = useState('landed') // 'landed' | 'base'

  const doFetch = useCallback(() => {
    setLoading(true)
    setError(false)

    fetch(`${API_BASE}/api/prices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(shoeList),
    })
      .then((res) => {
        if (!res.ok) throw new Error('API error')
        return res.json()
      })
      .then(({ results: shoeResults, exchangeRateFallback: fallback }) => {
        const sorted = [...shoeResults].sort((a, b) => b.shoe.matchScore - a.shoe.matchScore)
        setResults(sorted)
        setExchangeRateFallback(fallback)
        setLoading(false)
      })
      .catch(() => {
        setError(true)
        setLoading(false)
      })
  }, [shoeList])

  useEffect(() => {
    doFetch()
  }, [doFetch])

  return (
    <div className="w-full max-w-3xl mx-auto px-4 pb-12">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <button
          onClick={onReset}
          className="text-sm text-blue-600 hover:underline font-medium"
        >
          ← Search Again
        </button>

        {!loading && !error && results && (
          <button
            onClick={() => setSortBy(sortBy === 'landed' ? 'base' : 'landed')}
            className="text-sm px-3 py-1.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors whitespace-nowrap"
          >
            Sort by: {sortBy === 'landed' ? 'Landed Cost' : 'Base Price'}
          </button>
        )}
      </div>

      {/* Exchange rate fallback banner */}
      {exchangeRateFallback && !loading && (
        <div className="mb-5 flex items-start gap-2 bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm rounded-lg px-4 py-3">
          <span className="mt-0.5 flex-shrink-0">⚠️</span>
          <span>EU prices use an estimated exchange rate. Verify the total at the retailer before purchasing.</span>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="text-center py-16">
          <p className="text-gray-600 mb-4">Something went wrong fetching prices.</p>
          <button
            onClick={doFetch}
            className="px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Skeleton loaders */}
      {loading && !error && (
        <div className="space-y-5">
          {shoeList.map((_, i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {/* Results */}
      {!loading && !error && results && (
        <div className="space-y-5">
          {results.map((shoeResult) => (
            <ShoeCard
              key={`${shoeResult.shoe.brand}-${shoeResult.shoe.model}`}
              shoeResult={shoeResult}
              sortBy={sortBy}
            />
          ))}
        </div>
      )}
    </div>
  )
}
