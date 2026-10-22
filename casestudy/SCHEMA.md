# The case study bundle

A business case is one JSON document, the **case bundle**, drawn by
`casestudy/render.js` into 16:9 pages and printed to PDF by the
browser. It is built from the case study workbook (`scripts/lib/case-schema.js`
describes the sheets; `case-workbook.js` reads them) or by the CMS, and checked
by `scripts/lib/validate-case.js`.

Only `meta` and `options` are required. Every other block adds a section, and
the contents page numbers itself from what is there. No figure in the bundle is
a computed result: the prices, break-even, levers and the money rows of the
decision table all come out of `casestudy/costing.js` at render time, from the
option inputs, so changing one input changes every page that quotes it.

## Blocks

| Block | Sheet | What it is |
| --- | --- | --- |
| `meta` | Case | `title`, `kind`, `sub`, `asOf` (YYYY-MM), `place`, `city`, `by`, `tagline`, `backTitle`, `credits`, `currency` |
| `assumptions` | Assumptions | the costing method: `runningRate`, `lockinMonths`, `margin` (%), `sqftPerSeat`, `efficiency` (%), `brokeragePct`, `adsPerMonth`, `adsFloorPerMonth`, `adsNote`, `targetPrice`, `targetNote`, `rivalsLow`/`rivalsHigh` (%), `nationalLow`/`nationalHigh`, `walkMPerMin`, `notInSheet[]` |
| `options[]` | Options | each building: `id`, `name`, the money inputs `carpet`, `rentRate`, `rentBasis` (carpet or builtup), `efficiency`, `fitoutRate`, optional `runningRate`/`lockinMonths` overrides, and the asset facts (`fullName`, `developer`, `address`, `stage`, `built`, `reraId`, `reraDate`, `floors`, `offices`, `floorPlate`, `green`, `amenities`, `occupant`, `verdict`, `verdictText`, ...). Extra columns are kept and shown on the side-by-side table. |
| `access[]` | Access | `{option, name, mode, distanceM, line, note}`; walking time is distance ÷ `walkMPerMin` |
| `rivals[]` | Rivals | the competitor survey: `{operator, building, locality, grade, price, occLow, occHigh, near (bool), sameBuilding (option id), note}`. The next-door table, the corridor tables, the occupancy chart and the price ladder are all drawn from this one list. |
| `openings[]` | Openings | `{operator, seats, area, building, when, note}` |
| `kpis[]` | KPIs | `{section, value, label, sub, option}`; `section` is `cover`, `back` or a section key; `value` is a figure as written or a code: `price`, `priceLow`, `priceHigh`, `breakEven`, `seats`, `carpet`, `cost`, `commitment`, `rivals`, `rivalsMedian`, `rivalsRange`, `brokerage`, `ads` |
| `series[]` | Series | chart points `{chart, label, value, value2, flag, note}`; known charts: `vacancy`, `rent` (lines), `topBand` (band bars, `value`..`value2`), `absorptionShare`, `flexSeats` (bars), `operatorOccupancy` (horizontal bars with the break-even line); anything else is plain bars. `flag` projection draws dashed. |
| `deals[]` | Deals | `{who, area, rent, building, when, kind, note}` |
| `occupiers[]` | Occupiers | `{sector, share, within5[], within10[], fit, note}` |
| `pools[]` | Pools | `{title, chain[], text, kpi, kpiLabel}` |
| `points[]` | Points | numbered points `{section, n, title, text, kpi, kpiLabel, mitigate, chart}` for `market` (one page each, with its chart), `infrastructure`, `why`, `plan` (pipeline 1 gets its own page, split on "Curate:", "Activate:", ...), `risks` |
| `lists` | Lists | `{askFor[], firstCalls[], pack[], watchlist[], questions[], nextSteps[]}` |
| `decision[]` | Decision | `{question, answers: {optionId: text}, edge: optionId or "level", code}`; a `code` (`seats`, `cost`, `fitout`, `price`, `profit`, `breakEven`, `commitment`, `walk`) fills the answers from the costing |
| `copy` | Copy | `{key: [{text, role}]}`; `role` is `means` (a "what it means for us" line), `intro`, `note` or `read` (the decision's "our read"). Keys name a place on the pages: `readFirst`, `options`, `costing`, `earns`, `seat`, `occupancy`, `levers`, `assets`, `access`, `market`, `deals`, `catchment`, `pools`, `infrastructure`, `why`, `plan`, `pipelines`, `risks`, `rivals`, `corridor`, `openings`, `occupancyRivals`, `ladder`, `decision`. Where a key has no copy, the page writes a plain line from the numbers. |
| `sources` | Sources | `{key: [text]}`, the source line at the foot of each page, same keys as `copy` |
| `images` | Images | `{slot: {prompt, url, caption}}`; slots `cover`, `options`, `assets`, `market`, `infrastructure`, `why`, `plan`, `rivals`, `back`. A slot with no `url` is drawn as a plain band. The CMS generates pictures with Higgsfield from `prompt` plus the house style. |

## The costing (`casestudy/costing.js`)

    built-up        carpet ÷ efficiency
    rent a month    carpet × rate (on carpet) or built-up × rate (on built-up)
    fit-out         carpet × fit-out rate, recovered over the lock-in
    running         carpet × running rate
    cost            rent + fit-out ÷ lock-in + running
    billed          cost × (1 + margin)
    price a seat    billed ÷ (carpet ÷ sq ft a seat)
    break-even      cost ÷ billed  (= 1 ÷ (1 + margin), the same for every option)

plus the per-seat split, the price with brokerage and with ads, profit or loss
at any occupancy, the levers (rent lower, a rent-free month, cheaper fit-out,
no broker, the rent that reaches the target price) and the lock-in commitment.
`scripts/costing.test.js` holds every figure the Andheri Business Case Study
2026 prints and checks the engine produces it.

## Where it is served

    /<slug>/case            the published case study (the visitor's access
                            cookie for <slug> opens it; same credential as
                            the atlas of that slug)
    /<slug>/case?draft=1    the draft, for a signed-in admin
    /casestudy/             the Andheri example (casestudy/demo.js)

The page has one button, **Save as PDF**, which prints with the same CSS the
screen uses. `scripts/casestudy-pdf.js` does the same headlessly for CI and
for the repo's own documents.
