# Maritime Context Engineering Benchmark - Synthesis Report

## Scope
- Repositories benchmarked: 4
- Total evaluation queries: 12
- Domains: weather routing, voyage optimization, maritime operations optimization

## 5-Point Evaluation Map Outcomes

### 1) Generalization eval matrix
- Artifact: `generalization_eval_matrix.csv`
- Mean coverage gain (after - baseline): **0.3485**
- Improvement observed across all repositories with feature-specific query sets.

### 2) Adaptive retrieval policy assessment
- Policy: budget allocation by uncertainty (8 / 14 / 20 chunks)
- Artifact linkage: `before_after_metrics.csv` (columns `uncertainty`, `adaptive_budget`)
- Mean context reduction vs baseline: **-26.52%** while preserving or increasing dependency coverage.

### 3) Verifier/Critic lane for missing dependencies
- Artifact: `adaptive_policy_and_verifier.csv`
- Mechanism: compare retrieved files against depth-2 dependency oracle per feature; emit missing dependency list.

### 4) Decision-grade observability
- Artifact: `observability_chunk_contribution.csv`
- Metrics: chunk relevance, coverage drop under ablation, retention loss attribution.
- This enables ranking chunks by causal value rather than raw similarity.

### 5) Competitive baseline framing
- Artifact: `competitive_baseline_proxy.json`
- Baseline proxy included: BM25 fixed budget, compressed+graphRAG adaptive strategy.
- Note: direct competitor runtimes were not executed on this host; proxy framing provides practical comparative grounding.

## Recommendations
1. Adopt compressed summary + dependency expansion as default retrieval path for code-intense maritime planning systems.
2. Keep verifier lane mandatory for safety-critical route decisions to surface missing modules before answer generation.
3. Use uncertainty-gated budgeting to cut context size while retaining dependency coverage.
4. Integrate observability metrics into CI to detect regressions in retrieval quality when repositories evolve.

## Reproducibility
- Script: `scripts/maritime_context_benchmark.py`
- Run command: `python scripts/maritime_context_benchmark.py`
- Runtime: 44.94 seconds
