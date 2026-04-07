# TennisShoeHunter — Development Phases

## Phase 1 — Project Scaffold
Initialise the monorepo: `/frontend` (React + Vite + Tailwind) and `/backend` (Node.js + Express). Add a health check route. Confirm both servers start with a single `npm run dev` command.

- [x] Create root `package.json` with `concurrently` dev script
- [x] Scaffold `/frontend` with Vite + React + Tailwind; render `<h1>TennisShoeHunter</h1>` in `App.jsx`
- [x] Scaffold `/backend` with Express; add `GET /api/health` returning `{ status: 'ok' }`
- [x] Verify frontend loads at `localhost:5173` and backend responds at `localhost:3001`

---

## Phase 2 — Shoe List Data + Search Dropdown
Create the master shoe list JSON and build the shoe entry UI component.

- [x] Create `/data/shoes.json` with 40+ entries (id, brand, model, generation, active)
- [x] Seed with all key CSF brands: ASICS, Nike, Adidas, New Balance, Babolat, Wilson, Head, K-Swiss, Yonex, Mizuno, Diadora, Prince
- [x] Build `ShoeEntryForm` React component with searchable dropdown filtering shoes.json
- [x] Add match score input (0–40) per shoe; 'Add' button appends to local list (max 5)
- [x] Each list entry shows brand, model, score, and a remove button
- [x] 'Find Best Prices' button appears once at least 1 shoe is in the list

---

## Phase 3 — Retailer Config + Landed Cost Calculator
Create the retailer config JSON and implement the core pricing algorithm.

- [ ] Create `/data/retailers.json` with all 40 retailer entries (domain, name, type, region, currency, euVatRate, shippingFlatRateGBP, freeShippingThresholdGBP)
- [ ] Include UK tennis specialists (12), EU tennis specialists (13), general UK retailers (12), plus migros-sport.ch (CHF)
- [ ] Write `backend/utils/landedCost.js` exporting a pure `landedCost(listedPrice, retailer, eurGbpRate, chfGbpRate)` function
- [ ] Implement 5-step algorithm: currency conversion → EU VAT removal → UK customs threshold (£135) → import duty (3.7%) + UK VAT (20%) → shipping
- [ ] Write 8 Jest unit tests: 2 UK, 2 EU sub-£135, 2 EU over-£135, 1 brand-direct EU, 1 CHF

---

## Phase 4 — Exchange Rate Service
Build the live EUR/GBP rate fetcher with caching and fallback.

- [ ] Create `backend/services/exchangeRate.js` with `getEurGbpRate()` using node-cache (TTL 1 hour)
- [ ] Fetch from `open.er-api.com/v6/latest/EUR` on cache miss; extract `rates.GBP`
- [ ] Fall back to hardcoded rate `0.86` and log a warning if fetch fails
- [ ] Add `GET /api/exchange-rate` route returning `{ EUR_GBP, cachedAt, source: 'live'|'fallback' }`
- [ ] Verify two calls within 60 minutes only trigger one external request (check logs)

---

## Phase 5 — Price Search API Endpoint
Implement the core backend endpoint that queries SerpAPI across all 40 retailers.

- [ ] Create `POST /api/prices` accepting `[{ brand, model, matchScore }]`
- [ ] For each shoe: check node-cache (TTL 60 min); on miss, fire parallel SerpAPI Google Shopping queries per retailer using `site:` filter
- [ ] Apply `landedCost()` to each result; omit out-of-stock results
- [ ] Sort results by `landedCostGBP` ascending per shoe; cache the result array
- [ ] Return grouped response: `[{ shoe, results: [{ retailer, region, basePriceGBP, shippingCostGBP, taxAdjustmentGBP, landedCostGBP, url, inStock }] }]`
- [ ] Per-retailer errors must not fail the whole request (`Promise.allSettled`)

---

## Phase 6 — Results UI
Build the results display page with per-shoe cards and price tables.

- [ ] Build `ResultsPage` React component; receive API response and render one card per shoe ordered by `matchScore` descending
- [ ] Each card: shoe name, match score badge ('X / 40'), price table (Retailer | Region | Base Price | Shipping | Tax | Total Landed Cost)
- [ ] Region column: 🇬🇧 for UK retailers, 🇪🇺 for EU retailers
- [ ] EU rows with non-zero tax show an (i) tooltip: 'EU VAT removed; UK import rules applied (duty 3.7% + VAT 20% if over £135)'
- [ ] 'Sort by Landed Cost / Base Price' toggle
- [ ] Skeleton loader rows (3 placeholders) while API call is in progress
- [ ] Zero-result shoe card with Google Shopping fallback link
- [ ] 'Search Again' button to reset to entry screen
- [ ] Fully usable at 375px viewport (iPhone SE)

---

## Phase 7 — CSF Onboarding + Input Polish
Add the onboarding screen and tighten up the shoe entry form.

- [ ] Build `OnboardingScreen` component with two-step flow diagram (Visit CSF → Enter results here)
- [ ] 'Open Court Shoe Finder' button links to `https://courtshoefinder.com` in a new tab
- [ ] 'I have my results — let's go' button navigates to shoe entry form
- [ ] Update `ShoeEntryForm`: validate match score as integer 0–40, show inline error for out-of-range values
- [ ] Add tooltip on score field: 'Enter the score shown next to the shoe in Court Shoe Finder. Scores range from 0 to 40.'

---

## Phase 8 — Error Handling + Edge Cases
Harden the app against all failure states; final responsive QA pass.

- [ ] Backend: per-retailer SerpAPI failure → log and skip; all retailers fail → return `results: []`; exchange rate failure → use fallback 0.86 + set `exchangeRateFallback: true` in response
- [ ] Frontend: show yellow banner when `exchangeRateFallback` is true
- [ ] Frontend: full-page error state with 'Try Again' button on network failure
- [ ] Frontend: zero-result shoe card with pre-filled Google Shopping link
- [ ] Responsive QA: verify layout on iPhone SE (375px), iPad (768px), desktop (1440px)
- [ ] Final Tailwind pass — no text overflow, no broken layouts at any breakpoint
