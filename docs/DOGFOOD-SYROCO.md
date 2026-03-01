# Dogfood Spec — Syroco Agents

Four agent configurations for Modular Studio, using real Syroco context: maritime route optimization for chemical tanker fleets.

---

## 1. Route Optimizer

```yaml
name: route-optimizer
description: >
  Optimizes maritime routes for Odfjell chemical tanker fleet, balancing
  fuel efficiency, weather routing, and EU ETS carbon cost minimization.

sources:
  - type: api
    name: weather-routing
    endpoint: https://api.weatherrouting.io/v2/forecast
    refresh: 6h
  - type: api
    name: ais-positions
    endpoint: https://api.marinetraffic.com/v2/positions
    params:
      fleet: odfjell
  - type: file
    name: eu-ets-rates
    path: ./data/eu-ets-carbon-prices.csv
    refresh: daily
  - type: file
    name: fueleu-thresholds
    path: ./data/fueleu-maritime-ghg-intensity.yaml

pipeline:
  - step: ingest
    sources: [weather-routing, ais-positions, eu-ets-rates, fueleu-thresholds]
  - step: compress
    strategy: priority
    max_tokens: 12000
    priority: [ais-positions, weather-routing, eu-ets-rates]
  - step: reason
    prompt: >
      Given current vessel positions, 72h weather forecast, EU ETS carbon price
      of {{eu_ets_rate}} EUR/tCO2, and FuelEU Maritime GHG intensity target of
      {{fueleu_target}} gCO2eq/MJ: recommend optimal route adjustments for each
      vessel to minimize total cost (fuel + carbon).
    model: claude-sonnet-4-20250514
    temperature: 0.2

mcp_servers:
  - name: maritime-ais
    command: npx -y @maritime/ais-mcp
  - name: weather-ocean
    command: npx -y @meteo/ocean-forecast-mcp

export:
  format: yaml
  schedule: "0 */6 * * *"
  output: ./reports/route-recommendations.yaml
```

---

## 2. Fleet Monitor

```yaml
name: fleet-monitor
description: >
  Real-time monitoring of Odfjell fleet operations — vessel status,
  cargo utilization, port ETAs, and compliance alerts for chemical tankers.

sources:
  - type: api
    name: fleet-ais
    endpoint: https://api.marinetraffic.com/v2/fleet
    params:
      fleet: odfjell
      vessel_type: chemical_tanker
    refresh: 15m
  - type: api
    name: port-schedules
    endpoint: https://api.portcall.io/v1/schedule
  - type: file
    name: vessel-registry
    path: ./data/odfjell-fleet-registry.yaml
  - type: file
    name: cargo-manifest
    path: ./data/active-cargo-manifests.json
    refresh: 1h

pipeline:
  - step: ingest
    sources: [fleet-ais, port-schedules, vessel-registry, cargo-manifest]
  - step: filter
    depth: 2
    include_patterns: ["*.status", "*.eta", "*.cargo_util", "*.compliance"]
  - step: compress
    strategy: recency
    max_tokens: 8000
  - step: reason
    prompt: >
      Fleet status digest: for each active Odfjell vessel, report current
      position, next port ETA, cargo utilization %, and flag any IMO/MARPOL
      compliance concerns for chemical cargo. Highlight KCC combination
      carriers separately with dry/wet cargo split.
    model: claude-sonnet-4-20250514
    temperature: 0.1

knowledge_graph:
  entities: [vessel, port, cargo, regulation]
  relationships: [carries, docked_at, bound_for, subject_to]

export:
  format: json
  schedule: "*/15 * * * *"
  output: ./dashboards/fleet-status.json
```

---

## 3. Report Generator

```yaml
name: report-generator
description: >
  Weekly operational reports for Syroco leadership — route efficiency gains,
  fuel savings, EU ETS cost impact, and FuelEU Maritime compliance status.

sources:
  - type: file
    name: route-history
    path: ./data/route-history-weekly.parquet
  - type: file
    name: fuel-consumption
    path: ./data/fuel-logs-weekly.csv
  - type: file
    name: ets-transactions
    path: ./data/eu-ets-allowance-ledger.csv
  - type: api
    name: fueleu-compliance
    endpoint: https://api.syroco.internal/fueleu/status
  - type: file
    name: kcc-operations
    path: ./data/kcc-combination-carrier-logs.yaml

pipeline:
  - step: ingest
    sources: [route-history, fuel-consumption, ets-transactions, fueleu-compliance, kcc-operations]
  - step: compress
    strategy: summary
    max_tokens: 16000
  - step: reason
    prompt: >
      Generate a weekly operations report covering:
      1. Route optimization impact: avg nautical miles saved, % improvement
      2. Fuel savings: total MT saved, cost savings in EUR
      3. EU ETS: allowances consumed vs budget, projected annual cost
      4. FuelEU Maritime: current GHG intensity vs target, compliance gap
      5. KCC fleet: combination carrier utilization (dry/wet split), backhaul efficiency
      Format as executive summary with data tables.
    model: claude-sonnet-4-20250514
    temperature: 0.3

fact_insights:
  extract: true
  confidence_threshold: 0.85
  categories: [cost_saving, compliance, efficiency, risk]

export:
  format: [yaml, markdown]
  schedule: "0 8 * * MON"
  output: ./reports/weekly-ops-{{date}}.md
```

---

## 4. Competitor Intel

```yaml
name: competitor-intel
description: >
  Tracks competitor movements in chemical tanker and combination carrier
  markets — fleet expansions, newbuilds, route patterns, regulatory positioning.

sources:
  - type: api
    name: trade-winds
    endpoint: https://api.tradewinds.no/v1/news
    params:
      topics: [chemical_tanker, combination_carrier, fleet_renewal]
    refresh: daily
  - type: api
    name: clarksons-fleet
    endpoint: https://api.clarksons.net/v2/fleet-data
    params:
      segments: [chemical, combination]
  - type: file
    name: competitor-profiles
    path: ./data/competitor-profiles.yaml
    description: >
      Stolt-Nielsen, MOL Chemical, Navig8 Chemical, Team Tankers,
      KCC operators (Carisbrooke, JT Cement)
  - type: api
    name: newbuild-orders
    endpoint: https://api.clarksons.net/v2/orderbook
    params:
      type: [chemical_tanker, combination_carrier]

pipeline:
  - step: ingest
    sources: [trade-winds, clarksons-fleet, competitor-profiles, newbuild-orders]
  - step: filter
    depth: 3
    include_patterns: ["*.fleet_size", "*.newbuild", "*.route", "*.regulation"]
  - step: compress
    strategy: relevance
    max_tokens: 10000
    query: "chemical tanker market competitive landscape"
  - step: reason
    prompt: >
      Competitive intelligence brief:
      1. Fleet movements: any competitor fleet expansions or contractions
      2. Newbuild orders: new chemical tanker or combination carrier orders
      3. Route competition: overlapping routes with Odfjell on key trade lanes
      4. Regulatory edge: competitors' positioning on EU ETS, FuelEU Maritime,
         CII ratings — who is ahead/behind on decarbonization
      5. KCC market: combination carrier orderbook and utilization trends
      Flag actionable opportunities and threats.
    model: claude-sonnet-4-20250514
    temperature: 0.4

knowledge_graph:
  entities: [company, vessel_class, trade_route, regulation, newbuild_order]
  relationships: [operates, competes_with, ordered, complies_with]

export:
  format: yaml
  schedule: "0 9 * * MON"
  output: ./intel/competitor-brief-{{date}}.yaml
```
