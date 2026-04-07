# TennisShoeHunter
**Full Project Documentation**
*v2.1 — 40-Retailer UK & EU Price Comparison*

| | |
|---|---|
| **Version** | v2.1 — 40-Retailer Allowlist |
| **Status** | In Development |
| **Audience** | Developer / AI Coding Assistant |
| **Last Updated** | 6 April 2026 |
| **Key Change** | User inputs CSF results; no quiz; shoe list + match scores |

---

## 1. Idea Clarity

| | |
|---|---|
| **Problem** | UK tennis players using courtshoefinder.com (CSF) get great shoe recommendations — but then face hours of manual price hunting across UK and European retailers, with no way to compare true landed costs including shipping and tax. |
| **User** | A UK-based tennis player who has already used courtshoefinder.com, has their recommended shoes and match scores in hand, and wants to instantly find the best-value deal with total cost transparency. |
| **Core Action** | User visits CSF, gets their recommended shoes + match scores → enters them into TennisShoeHunter → app searches all major UK and EU tennis retailers → ranks results by true GBP landed cost. |
| **Differentiator** | The only tool that takes your CSF results and turns them directly into a ranked, landed-cost price comparison across specialist tennis retailers — no quiz, no reverse engineering, just instant results. |

### Architecture Decision: Why Not Embed the CSF Quiz?

Earlier versions of this design considered replicating the courtshoefinder.com quiz or scraping it. This approach has been deliberately dropped in favour of the following flow:

- User goes to courtshoefinder.com themselves (free, always up to date, no maintenance burden)
- CSF gives the user a list of recommended shoes, each with a match score (out of 40)
- User enters their results into TennisShoeHunter — either by selecting from a pre-built shoe list or typing a model name
- App immediately fires price searches for those exact models

This is simpler to build, impossible to break via CSF site changes, and keeps the user in control of their own recommendation data.

---

## 2. Product Requirements Document (PRD)

### 2.1 Problem Statement

After using courtshoefinder.com, UK tennis players receive a list of recommended shoes with match scores but have no easy way to compare prices across UK and EU retailers, factor in shipping costs, or calculate the true GBP landed price. TennisShoeHunter solves this by accepting the user's CSF results directly and returning a fully ranked, landed-cost price comparison across all major tennis-specialist and general sports retailers that deliver to the UK.

### 2.2 Target User

| Attribute | Detail |
|---|---|
| Location | United Kingdom |
| Sport | Tennis (all levels); pickleball (secondary) |
| Starting point | Has already used courtshoefinder.com and has results in hand |
| Motivation | Wants to buy the right shoe at the best true cost, not just the lowest list price |
| Tech comfort | Comfortable with web apps; no coding knowledge required |
| Pain point | Manually searching 10+ retailers and calculating shipping + EU tax adjustments |

### 2.3 Core Features (MVP)

1. **Feature 1: CSF Results Input**
   A simple input screen where the user enters their CSF recommendations. Two methods: (A) select shoes from a pre-built searchable dropdown list of all shoes CSF can recommend, or (B) type a shoe name manually. For each shoe, user also enters the match score CSF gave (0–40). Up to 5 shoes can be entered.

2. **Feature 2: Shoe Selection List**
   A curated, maintained list of all tennis shoes that courtshoefinder.com can recommend, stored as a JSON file in the codebase. Includes brand, model name, and current/previous generation flag. Updated manually when CSF adds new shoes.

3. **Feature 3: Price Search — UK & EU Retailers**
   For each entered shoe, query all retailers on the allowlist (see Section 3.4). UK retailers return GBP prices directly. EU retailers require currency conversion, EU VAT removal, and UK import tax calculation.

4. **Feature 4: Landed Cost Calculator**
   Automatically computes the true GBP cost for every result: base price + shipping + tax adjustments. The £135 UK customs threshold determines whether EU VAT or UK import duty (3.7% footwear) + UK VAT (20%) applies.

5. **Feature 5: Results Display**
   A results page showing one section per shoe, ordered by the user's match score (highest first). Within each shoe section, retailers are ranked by landed cost ascending. Columns: Retailer, Base Price, Shipping, Tax, Total Landed Cost, In Stock. An info tooltip explains the tax calculation for EU retailers.

### 2.4 Out of Scope (MVP)

- Replicating or scraping the courtshoefinder.com quiz — user does this themselves
- User accounts, saved searches, or price-drop alerts
- Non-tennis shoe categories
- Payment processing or affiliate checkout
- Native mobile apps (responsive web only)

### 2.5 Success Criteria

| Metric | Target |
|---|---|
| Time from entering shoes to seeing prices | Under 30 seconds |
| Retailers searched per shoe | Up to 40 (results only shown if shoe is found in stock) |
| Landed cost accuracy (EU retailers) | Within £2 of manually calculated equivalent |
| Shoe list completeness | Covers 100% of models CSF currently recommends |
| UK delivery confirmation | Every listed retailer verified to deliver to UK |
| Mobile usability | Fully usable on 375px viewport (iPhone SE) |

---

## 3. Technical Design

### 3.1 Tech Stack

| Layer | Choice & Rationale |
|---|---|
| Frontend | React (Vite) — fast dev, component-friendly, hot reload |
| Styling | Tailwind CSS — utility-first, responsive out of the box |
| Backend / API | Node.js + Express — lightweight, easy to host |
| Price lookup | SerpAPI (Google Shopping) — structured results without scraping complexity |
| Caching | In-memory TTL cache (node-cache) — avoids redundant API calls |
| Exchange rates | ExchangeRate-API (free tier) — live EUR/GBP, cached 1 hour |
| Hosting | Vercel (frontend) + Railway or Render (backend) |
| Data files | JSON files in /data — shoe list, retailer config (no database needed for MVP) |

### 3.2 Data Model

| Object | Fields | Notes |
|---|---|---|
| CsfEntry | brand, model, matchScore (0–40) | Entered by user from their CSF results |
| ShoeListItem | id, brand, model, generation, active | From /data/shoes.json — the master shoe list |
| RetailerConfig | domain, name, region, currency, euVatRate, shippingFlatRateGBP, freeShippingThresholdGBP, ukVatRegistered | From /data/retailers.json |
| PriceResult | retailer, region, basePriceGBP, shippingCostGBP, taxAdjustmentGBP, landedCostGBP, url, inStock | Computed per shoe+retailer |
| ShoeResult | csfEntry, priceResults[] | One per shoe; sorted by csfEntry.matchScore desc in UI |

### 3.3 App Flow

1. User visits TennisShoeHunter homepage
2. User is directed to courtshoefinder.com first if they haven't used it (link + brief explanation)
3. User returns and enters their CSF shoes: selects from dropdown or types model name, enters match score for each
4. User clicks 'Find Best Prices'
5. Frontend POSTs array of CsfEntry objects to `POST /api/prices`
6. Backend fires parallel price searches for all entered shoes across all retailers
7. Results stream back to frontend via polling or Server-Sent Events
8. Results page shows each shoe (ordered by match score), with retailer table sorted by landed cost

### 3.4 Retailer Allowlist

All 40 retailers below are searched for every shoe query. If a retailer does not stock the searched shoe, it is automatically omitted from results — it is never shown as 'not found'. Retailer config is stored in /data/retailers.json. Marked with * where EU VAT removal applies for UK buyers.

#### UK Tennis Specialists

| Domain | Region | Currency | Free Ship | Notes |
|---|---|---|---|---|
| tennis-point.co.uk | UK | GBP | £50 | Largest EU tennis group's dedicated UK site |
| prodirectsport.com | UK | GBP | £50 | Official LTA retail partner; huge stock |
| allthingstennis.co.uk | UK | GBP | £50 | Leading UK independent tennis specialist |
| tennisnuts.com | UK | GBP | £50 | UK specialist; good clearance section |
| tennisplanet.co.uk | UK | GBP | £40 | UK tennis specialist (Etrias group) |
| stringersworld.com | UK | GBP | £40 | Racket sports specialist; ships worldwide |
| racketskingdom.com | UK | GBP | £60 | London-based tennis specialist |
| centralsports.co.uk | UK | GBP | £50 | Claims UK's biggest racket sports specialist |
| smashuk.co | UK | GBP | £40 | UK tennis specialist; good brand range |
| just-rackets.co.uk | UK | GBP | £50 | UK independent; ships to EU & worldwide |
| shop.wimbledon.com | UK | GBP | £40 | Official Wimbledon shop; curated shoe range |
| courtsideshop.co.uk | UK | GBP | £45 | UK tennis specialist; good value |

#### EU Tennis Specialists (ship to UK, VAT removal applies *)

| Domain | Region | Currency | Free Ship | Notes |
|---|---|---|---|---|
| tenniswarehouseeurope.com | EU/FR | EUR | €60 | * Major EU specialist; manages UK VAT at checkout |
| tennis-point.de | EU/DE | EUR | €60 | * German flagship; 19% DE VAT removed |
| tennis-point.fr | EU/FR | EUR | €60 | * French site of Tennis-Point group; 20% VAT |
| tennis-point.es | EU/ES | EUR | €60 | * Spanish site of Tennis-Point group; 21% VAT |
| tennis-point.it | EU/IT | EUR | €60 | * Italian site of Tennis-Point group; 22% VAT |
| tennispro.eu | EU/FR | EUR | €69 | * French tennis specialist; competitive pricing |
| extreme-tennis.eu | EU/FR | EUR | €69 | * French specialist; fast 24-48h dispatch |
| tennisfarm.co.uk | EU/DE | EUR | €55 | * German-based, UK-facing tennis store |
| tennis-zone.eu | EU/PL | EUR | €59 | * Polish specialist (Tennis Zone/Strefa Tenisa) |
| centralsports.co.uk | EU | EUR | €50 | EU arm of Central Sports; separate inventory |
| babolat.com | EU/FR | EUR | €80 | * Direct from brand; 20% FR VAT removed |
| wilson.com | EU/NL | EUR | €75 | * Wilson EU direct store; 21% NL VAT |
| head.com | EU/AT | EUR | €80 | * Head EU direct store; 20% AT VAT |
| asics.com | EU/NL | EUR | €60 | * ASICS EU direct; 21% NL VAT removed |
| new-balance.co.uk | UK | GBP | £60 | NB UK direct; full tennis range |

#### General UK Sports Retailers (broad stock, tennis section)

| Domain | Region | Currency | Free Ship | Notes |
|---|---|---|---|---|
| amazon.co.uk | UK | GBP | £25/Prime | Huge stock; always verify seller is Amazon itself |
| sportsdirect.com | UK | GBP | £75 | Large range; stock varies by model |
| jdsports.co.uk | UK | GBP | £70 | Mainly lifestyle tennis shoes; some performance |
| decathlon.co.uk | UK | GBP | £30 | Good value; stocks ASICS, Adidas, Artengo |
| johnlewis.com | UK | GBP | £70 | Curated range; reliable stock info |
| sportsshoes.com | UK | GBP | £50 | Multi-sport specialist; good shoe depth |
| wiggle.com | UK | GBP | £50 | Multi-sport; strong on select brands (ASICS etc) |
| activinstinct.co.uk | UK | GBP | £50 | Multi-sport specialist; competitive pricing |
| startfitness.co.uk | UK | GBP | £40 | Northern UK specialist; good shoe range |
| intersport.co.uk | UK | GBP | £50 | Intersport UK; wide multi-sport coverage |
| migros-sport.ch | EU/CH | CHF | CHF 50 | Swiss multi-sport; CHF pricing; verify UK ship |
| zalando.co.uk | UK | GBP | £20 | Fashion-forward; stocks Nike/Adidas tennis |
| asos.com | UK | GBP | £35 | Stocks some performance tennis shoes |

### 3.5 Landed Cost Algorithm

Applied to every EU retailer result. UK retailer results need no adjustment.

| Step | Logic |
|---|---|
| 1. Currency conversion | If EUR: convert to GBP using cached live rate from ExchangeRate-API. basePriceGBP = listedEUR * EUR_GBP_rate. |
| 2. Remove EU VAT | EU retailers charge their local VAT in the listed price. UK buyers are not liable for EU VAT. adjustedPrice = basePriceGBP / (1 + euVatRate). e.g. for DE: / 1.19, for FR: / 1.20. |
| 3a. Order below £135 | No UK import duty. No border VAT. taxAdjustmentGBP = 0. This often makes EU prices very competitive. |
| 3b. Order above £135 | Apply UK import duty (3.7% footwear from EU). Then UK VAT (20%) on duty-inclusive value. duty = adjustedPrice * 0.037. ukVat = (adjustedPrice + duty) * 0.20. taxAdjustmentGBP = duty + ukVat. |
| 4. Shipping | Look up retailer's shippingFlatRateGBP. If adjustedPrice exceeds freeShippingThresholdGBP, set shipping to £0. |
| 5. Final cost | landedCostGBP = adjustedPrice + taxAdjustmentGBP + shippingCostGBP. This is the number shown and sorted by. |

### 3.6 The Shoe List (/data/shoes.json)

This JSON file is the master list of all shoes that CSF can recommend. The user selects from this list in the input screen. Example structure:

```json
{ "id": "asics-gel-resolution-9", "brand": "ASICS", "model": "Gel-Resolution 9", "generation": "current", "active": true }
```

Seed the list with all known CSF shoe recommendations. Key brands/models to include (non-exhaustive):

- **ASICS:** Gel-Resolution 9, Gel-Game 9, Solution Speed FF 3, Court FF 3
- **Nike:** Air Zoom Vapor Pro 2, Court Lite 4, React Vapor NXT
- **Adidas:** Barricade 13, CourtJam Control 3, Courtflash Speed
- **New Balance:** Fresh Foam Lav v2, 996v5, MC1006
- **Babolat:** Propulse Fury All Court, Jet Mach 3, SFX4
- **Wilson:** Rush Pro 4.0, Kaos Comp 3.0, Amplifeel 2.0
- **Head:** Sprint Pro 3.5, Revolt Pro 4.5, Brazer 3.0
- **K-Swiss:** Hypercourt Supreme 2, Express Light 3
- **Yonex:** Power Cushion Eclipsion 5, Sonicage 3
- **Mizuno:** Wave Exceed Tour 5, Break Shot 4

---

## 4. Development Tickets

Each ticket is scoped for a single AI coding session. Work through them in order — later tickets depend on earlier ones.

### Ticket 1 — Project Scaffold

**Goal:** Initialise a monorepo: /frontend (React + Vite + Tailwind), /backend (Node.js + Express). Add health check route. Confirm both run concurrently with a single dev command.

**Acceptance criteria:**
- `npm run dev` starts both servers concurrently
- Frontend loads at localhost:5173 with an `<h1>` heading 'TennisShoeHunter'
- `GET localhost:3001/api/health` returns `{ status: 'ok' }`

---

### Ticket 2 — Shoe List Data + Search Dropdown

**Goal:** Create /data/shoes.json containing at least 40 tennis shoe entries (brand, model, id, generation, active). Build a React component: a searchable dropdown that filters the list as the user types. Selecting a shoe fills a form field. User also inputs a match score (number 0-40).

**Acceptance criteria:**
- shoes.json has at least 40 entries with correct schema
- Typing 'asics' filters the dropdown to only ASICS shoes
- Selecting a shoe + entering a score adds it to a local list (max 5 entries)
- Each list entry shows: brand, model, score, and a remove button
- A 'Find Best Prices' button appears once at least 1 shoe is in the list

---

### Ticket 3 — Retailer Config + Landed Cost Calculator

**Goal:** Create /data/retailers.json with all 40 retailers from Section 3.4. Write a pure function `landedCost(basePriceGBP, retailer, eurGbpRate)` that implements the 5-step algorithm from Section 3.5. Handle EUR, GBP, and CHF currencies. Cover sub-£135 and over-£135 scenarios.

**Acceptance criteria:**
- retailers.json has all 40 entries with correct schema
- `landedCost()` tested with at least 6 cases: 2 UK retailers, 2 EU retailers sub-£135, 2 EU retailers over-£135
- Function is pure (no side effects) and exported from a `utils/landedCost.js` module

---

### Ticket 4 — Exchange Rate Service

**Goal:** Create a backend service `getEurGbpRate()` that fetches the live EUR/GBP rate from ExchangeRate-API and caches it for 60 minutes using node-cache.

**Acceptance criteria:**
- `GET /api/exchange-rate` returns `{ EUR_GBP: 0.XXXX, cachedAt: ISO_timestamp }`
- Calling the endpoint twice within 60 minutes only fires one external API request (verify via logs)
- If ExchangeRate-API is unavailable, falls back to a hardcoded rate of 0.86 and logs a warning

---

### Ticket 5 — Price Search API Endpoint

**Goal:** Create `POST /api/prices` that accepts an array of CsfEntry objects. For each shoe, fire parallel SerpAPI Google Shopping queries targeting each retailer's domain. Apply the landed cost calculator to each result. Return all results grouped by shoe, sorted by landedCostGBP ascending within each shoe group.

**Acceptance criteria:**
- `POST /api/prices` with body `[{ brand: 'ASICS', model: 'Gel-Resolution 9', matchScore: 38 }]` returns results within 20s
- Each result has: retailer, region, basePriceGBP, shippingCostGBP, taxAdjustmentGBP, landedCostGBP, url, inStock
- EU results have non-zero taxAdjustmentGBP where applicable
- Results cached per shoe model for 60 minutes
- If a retailer returns no result, it is omitted (not an error)

---

### Ticket 6 — Results UI

**Goal:** Build the results page. Show one card per shoe, ordered by matchScore descending. Each card has the shoe name, match score badge, and a price table sorted by landedCostGBP. Include skeleton loaders while results are loading. Add a tooltip on the Tax column explaining the calculation.

**Acceptance criteria:**
- Shoes with higher match scores appear first
- Each price row shows: retailer name, region flag emoji (UK: 🇬🇧, EU: 🇪🇺), base price, shipping, tax adjustment, total landed cost
- EU rows show a small info icon that opens: 'EU VAT removed; UK import rules applied'
- 'Sort by Base Price' toggle switches between base and landed cost sorting
- Skeleton loaders display while API call is in progress
- 'Search Again' button resets to the input screen
- Fully usable on 375px mobile viewport

---

### Ticket 7 — CSF Onboarding & Input Polish

**Goal:** Add a friendly onboarding step before the shoe entry screen. Explain what courtshoefinder.com is, provide a direct link to it, and instruct the user to return with their results. Add input validation and a 'How to read your CSF results' tooltip.

**Acceptance criteria:**
- Homepage shows a two-step flow diagram: Step 1 = Visit CSF, Step 2 = Enter results here
- 'Open Court Shoe Finder' button links to courtshoefinder.com in a new tab
- 'I have my results' button reveals the shoe entry form
- Match score field validates 0–40 and shows an error for values outside this range
- A tooltip on the score field says: 'Enter the match score shown next to each shoe in Court Shoe Finder. Scores go from 0 to 40.'

---

### Ticket 8 — Error Handling & Edge Cases

**Goal:** Handle all failure states gracefully. Ensure the app never shows a blank or broken state.

**Acceptance criteria:**
- If a shoe returns 0 retailer results, show: 'No prices found for this shoe — try searching on Google Shopping' with a pre-filled link
- If the API call fails entirely, show a retry button
- If exchange rate fetch fails, results still display with a banner: 'EU prices use estimated exchange rate — verify at retailer'
- All text readable, no layout breaks on iPhone SE, iPad, and 1440px desktop

---

## 5. AI Prompt Templates

Use each prompt below when coding the corresponding ticket with Claude Code. Always paste the prompt in full, and include any relevant code or JSON already written as additional context.

### Prompt — Ticket 1: Project Scaffold

```
Create a monorepo with two folders:
/frontend — React app using Vite and Tailwind CSS
/backend — Node.js app using Express

In /frontend, App.jsx should render a single <h1> saying 'TennisShoeHunter'.
In /backend, server.js should have one route: GET /api/health returning { status: 'ok' }.
Add a root package.json with a 'dev' script using the 'concurrently' package to start both servers simultaneously.
Frontend on port 5173, backend on port 3001.
Show full file contents for every file created, including package.json files.
```

### Prompt — Ticket 2: Shoe List + Search Dropdown

```
Create /data/shoes.json — an array of at least 40 tennis shoe objects, each with:
{ id, brand, model, generation (current|previous), active (true|false) }
Include shoes from: ASICS, Nike, Adidas, New Balance, Babolat, Wilson, Head, K-Swiss, Yonex, Mizuno, Diadora, Prince.

Then build a React component ShoeEntryForm that:
1. Shows a searchable text input that filters shoes.json as the user types
2. Displays a dropdown of matching results (brand + model)
3. On selection, records the shoe and shows a number input for match score (0-40)
4. An 'Add' button appends { brand, model, matchScore } to a local list (max 5 items)
5. Each list item has a remove (x) button
6. A 'Find Best Prices' button appears once the list has at least 1 item
Use React state only — no external libraries needed.
```

### Prompt — Ticket 3: Retailer Config + Landed Cost Calculator

```
Create /data/retailers.json — an array of 40 retailer objects, each with:
{ domain, name, type ('tennis-specialist'|'general-sport'|'brand-direct'), region ('UK'|'EU'), currency ('GBP'|'EUR'|'CHF'), euVatRate (0 for UK; e.g. 0.19 DE, 0.20 FR/AT, 0.21 ES/NL, 0.22 IT), shippingFlatRateGBP, freeShippingThresholdGBP }

UK Tennis Specialists (region: UK, currency: GBP, euVatRate: 0):
tennis-point.co.uk (free £50), prodirectsport.com (free £50), allthingstennis.co.uk (free £50), tennisnuts.com (free £50), tennisplanet.co.uk (free £40), stringersworld.com (free £40), racketskingdom.com (free £60), centralsports.co.uk (free £50), smashuk.co (free £40), just-rackets.co.uk (free £50), shop.wimbledon.com (free £40), courtsideshop.co.uk (free £45), new-balance.co.uk (free £60)

EU Tennis Specialists (region: EU, currency: EUR, euVatRate as noted):
tenniswarehouseeurope.com (FR, 0.20, free €60), tennis-point.de (DE, 0.19, free €60), tennis-point.fr (FR, 0.20, free €60), tennis-point.es (ES, 0.21, free €60), tennis-point.it (IT, 0.22, free €60), tennispro.eu (FR, 0.20, free €69), extreme-tennis.eu (FR, 0.20, free €69), tennisfarm.co.uk (DE, 0.19, free €55), tennis-zone.eu (PL, 0.23, free €59), babolat.com (FR, 0.20, free €80), wilson.com (NL, 0.21, free €75), head.com (AT, 0.20, free €80), asics.com (NL, 0.21, free €60)

General UK Sports Retailers (region: UK, currency: GBP, euVatRate: 0):
amazon.co.uk (free £25), sportsdirect.com (free £75), jdsports.co.uk (free £70), decathlon.co.uk (free £30), johnlewis.com (free £70), sportsshoes.com (free £50), wiggle.com (free £50), activinstinct.co.uk (free £50), startfitness.co.uk (free £40), intersport.co.uk (free £50), zalando.co.uk (free £20), asos.com (free £35)

Also add migros-sport.ch (CH, CHF, euVatRate: 0.077, free CHF50) — handle CHF as a separate currency requiring CHF_GBP conversion (similar to EUR_GBP).

Then write utils/landedCost.js exporting a pure function:
landedCost(listedPrice, retailer, eurGbpRate, chfGbpRate)

Algorithm:
1. Currency conversion: GBP -> no conversion. EUR -> * eurGbpRate. CHF -> * chfGbpRate.
2. If EU/CH retailer: remove local VAT: adjusted = basePriceGBP / (1 + euVatRate)
3. UK import rules:
   If adjusted < 135: taxAdjustment = 0
   If adjusted >= 135: duty = adjusted * 0.037; ukVat = (adjusted + duty) * 0.20; taxAdjustment = duty + ukVat
4. Shipping: if adjusted >= freeShippingThresholdGBP => £0, else shippingFlatRateGBP
5. landedCostGBP = adjusted + taxAdjustment + shippingCostGBP

Return: { basePriceGBP, adjustedPrice, taxAdjustmentGBP, shippingCostGBP, landedCostGBP }
Write 8 Jest unit tests: 2 UK specialist, 2 EU sub-£135, 2 EU over-£135, 1 brand-direct EU, 1 CHF retailer.
```

### Prompt — Ticket 4: Exchange Rate Service

```
In the Express backend, create services/exchangeRate.js exporting:
async function getEurGbpRate()

It should:
1. Use node-cache to cache the rate for 3600 seconds (1 hour)
2. On cache miss, fetch from ExchangeRate-API: GET https://open.er-api.com/v6/latest/EUR
   Extract rates.GBP from the response
3. On fetch failure, log a warning and return 0.86 as fallback
4. Cache the live rate before returning it

Also add a route:
GET /api/exchange-rate
Returns: { EUR_GBP: rate, cachedAt: new Date().toISOString(), source: 'live'|'fallback' }
```

### Prompt — Ticket 5: Price Search API

```
Create route POST /api/prices in Express.
Request body: array of { brand, model, matchScore }

For each shoe:
1. Check node-cache for cached results (key: brand+model, TTL: 60 min)
2. On cache miss: use SerpAPI (npm package 'serpapi') to search Google Shopping.
   Query: '{brand} {model} tennis shoe'
   Fire one search per retailer domain using the 'site:' filter.
   Run all retailer searches in parallel using Promise.allSettled()
3. For each result, call landedCost() from utils/landedCost.js
4. Return only results where inStock is true or unknown (never show out-of-stock)
5. Sort results by landedCostGBP ascending
6. Cache the result array per shoe

Response shape:
[
  {
    shoe: { brand, model, matchScore },
    results: [
      { retailer, region, basePriceGBP, shippingCostGBP, taxAdjustmentGBP, landedCostGBP, url, inStock }
    ]
  }
]

SERPAPI_KEY is in process.env.
Handle errors per-retailer — a failed search for one retailer should not fail the whole request.
```

### Prompt — Ticket 6: Results UI

```
Build a React component ResultsPage that receives the API response from Ticket 5.

Layout:
- One card per shoe, ordered by matchScore descending
- Each card shows: shoe name (large), a score badge showing 'X / 40' in blue
- Below the badge: a table with columns: Retailer | Region | Base Price | Shipping | Tax | Total Landed Cost
- Region column: use flag emojis — UK stores get the GB flag 🇬🇧, EU stores get EU flag 🇪🇺
- 'Total Landed Cost' column is highlighted in bold
- EU rows with non-zero tax show a small (i) icon. On hover/tap, tooltip says:
  'EU VAT removed from listed price. UK import rules applied (duty 3.7% + VAT 20% if over £135 threshold).'
- Toggle button: 'Sort by: Landed Cost / Base Price' — switches sort mode
- Skeleton loader rows (3 placeholder rows) shown while loading
- If a shoe has 0 results, show: 'No prices found — Search on Google Shopping' (link opens Google Shopping search for that shoe in a new tab)
- 'Search Again' button at top resets to the shoe entry screen

Use Tailwind CSS. Must be fully usable on 375px viewport.
```

### Prompt — Ticket 7: CSF Onboarding

```
Build a React component OnboardingScreen that appears before the shoe entry form.

It should show:
1. A short headline: 'Find the best UK price for your Court Shoe Finder results'
2. A two-step visual flow:
   Step 1: Visit courtshoefinder.com and get your shoe recommendations
   Step 2: Enter your results here — we find the best UK price
3. An 'Open Court Shoe Finder' button — links to https://courtshoefinder.com in a new tab
4. An 'I have my results — let's go' button that navigates to the shoe entry form

In the ShoeEntryForm from Ticket 2, update the match score input:
- Validate: must be 0–40, integer, required
- Add a tooltip/helper text: 'Enter the score shown next to the shoe in Court Shoe Finder. Scores range from 0 to 40.'
- Show an inline error if the user enters a value outside 0–40

Use Tailwind CSS. Keep the design clean and mobile-friendly.
```

### Prompt — Ticket 8: Error Handling

```
Add robust error handling across the TennisShoeHunter app.

Backend:
- If SerpAPI call fails for one retailer: log the error, skip that retailer, continue with others
- If all retailer searches fail for a shoe: return the shoe with results: []
- If exchange rate fetch fails: use fallback rate 0.86, add flag { exchangeRateFallback: true } to the response

Frontend:
- If exchangeRateFallback is true, show a yellow banner: 'EU prices use an estimated exchange rate. Verify total at retailer.'
- If the whole /api/prices call fails (network error etc): show a full-page error state with a 'Try Again' button that retries the same request
- If a shoe returns 0 results: show a card with message and Google Shopping link
- Ensure layout is correct on iPhone SE (375px), iPad (768px), desktop (1440px)
- Run a final pass to ensure all Tailwind classes are responsive and no text overflows
```

---

## 6. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| CSF adds new shoes not in our list | User can't find their recommended shoe in dropdown | Include manual text entry as fallback; review CSF monthly and update shoes.json |
| CSF changes its scoring system (currently 0-40) | Score input validation breaks | Validate server-side only loosely; make max score configurable in a constants file |
| SerpAPI returns wrong product for a model name | Incorrect prices shown | Include brand in search query; show retailer link so user can verify |
| SerpAPI rate limits or costs rise | Price search fails or becomes expensive | Cache aggressively (60 min); consider direct retailer scraping as backup |
| EU retailer does not auto-remove VAT at checkout | User pays more than our estimate | Add clear disclaimer on all EU results: 'VAT refund applied at checkout — verify before purchase' |
| EUR/GBP rate moves significantly intra-hour | EU prices slightly inaccurate | Show 'estimated' label on all EU prices; cache rate max 1 hour |
| UK customs rules change (£135 threshold, duty %) | Landed cost wrong for EU orders | Isolate all tax logic in landedCost.js — single file to update when rules change |
| Retailer stops shipping to UK | Non-delivering retailer shown | Review allowlist quarterly; add in-app 'Report broken link' button |

---

*End of Document — TennisShoeHunter v2.1*
