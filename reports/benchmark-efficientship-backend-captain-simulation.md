# Complex Repo Benchmark — Captain Simulation Discovery

Repo: C:\Users\victo\repos\efficientship-backend
Date: 2026-03-03T22:28:44.747Z

## Goal
Compare feature discovery quality for **Captain Simulation** and dependencies using:
1) Bare repo context
2) Tree-indexed + focused + compressed context

Packing strategy: two-lane context (anchor lane + compressed background lane)

## Context Size
- Bare tokens: **3 588 529**
- Indexed knowledge tokens (global): **102 888**
- Focused corpus tokens (pre-compress): **568 437**
- Indexed/compressed tokens (final): **20 126**
- Context reduction vs bare: **99.4%**

## Signal Quality
### Bare repo agent
- Term hits: 251
- Matched terms: captain simulation, CAPTAIN_SIMULATION, jita segment, computeRoutePointsForJitaSegmentWithCaptainSimulator, reference-route-factory, generated-reports-v2.service, captainSimulatorBufferStrategy, JitaSegmentProfileComputationMode
- Required signal retention: 100%

### Indexed/compressed agent
- Term hits: 22
- Matched terms: CAPTAIN_SIMULATION, jita segment, computeRoutePointsForJitaSegmentWithCaptainSimulator, reference-route-factory, generated-reports-v2.service, captainSimulatorBufferStrategy, JitaSegmentProfileComputationMode
- Required signal retention: 100%

## Verdict
- Retention target (>95%): 100%
- Reduction target (>95%): 99.4%
- Status: PASS
