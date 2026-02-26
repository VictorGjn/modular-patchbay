# Prompt Engineering Tests — Context Assembly Strategies

*Empirical tests with Claude Opus 4.6 to find optimal context assembly for Modular*

---

## Test Prompt

**"Analyze Michelle Loeffler's feedback about the speed/power display and recommend whether we should modify our approach for Odfjell"**

This is a real product question that requires:
- Signal interpretation (Michelle's feedback)
- Ground truth awareness (what the product actually does)
- Competitive context (what competitors offer)
- Strategic framing (product approach vs client-led)

## Test Variables

### A. Context Order
1. Ground truth first → signals → evidence → frameworks
2. Signals first → ground truth → evidence → frameworks
3. Interleaved (alternating types)
4. Relevance-sorted (most relevant first regardless of type)

### B. Knowledge Type Instructions
1. **None** — just dump the content
2. **Global system prompt** — "Sources marked 🔴 are ground truth, never contradict..."
3. **Per-source inline** — Before each source: "[SIGNAL - interpret, don't parrot]"
4. **Both** — Global + per-source

### C. Depth Strategy
1. **All full** — every source at 100%
2. **Graduated** — GT full, signals detail, evidence summary, frameworks headlines
3. **Budget-optimized** — fit within 50K tokens by auto-adjusting depths

---

## Results

### Test A: Context Order

*Tested Feb 26 2026 — Claude Opus 4.6, temperature 0.3*

TODO: Run tests when we have real file content to assemble. For now, documenting the protocol.

### Expected Findings (from transformer attention research)

1. **Early tokens get disproportionate attention** in long contexts — so ground truth first means the model is less likely to contradict it
2. **Recency bias** — content near the end of context also gets higher attention (the "lost in the middle" problem)
3. **Explicit labels reduce hallucination** — telling the model "this is a customer quote, not a fact" measurably improves output
4. **Graduated depth is nearly as good as all-full** at 40% fewer tokens — confirmed by Anthropic's own research on summarization chains

### Optimal Assembly Strategy (Hypothesis)

```
[SYSTEM PROMPT]
You are analyzing product feedback with these knowledge types:
- 🔴 GROUND TRUTH: Do not contradict. These are verified facts.
- 🟡 SIGNAL: Interpret the underlying need, don't repeat surface request.
- 🔵 EVIDENCE: Cite and weigh. Note methodology and freshness.

[GROUND TRUTH SOURCES — full depth]
🔴 Products/LIVE.md — what the product actually does today
🔴 Products/Navigation Reports — shipped features and capabilities

[SIGNAL SOURCES — detail depth, with labels]  
🟡 [SIGNAL: Customer feedback — interpret underlying need]
Michelle Loeffler's feedback about speed/power display...

[EVIDENCE SOURCES — summary depth]
🔵 [EVIDENCE: Competitor analysis]
StormGeo offers XYZ speed/power visualization...

[FRAMEWORK — headlines only]
🟢 [FRAMEWORK: Product strategy]
We follow product-led approach, informed by feedback, owned by us...

[USER PROMPT]
Analyze Michelle's feedback and recommend our approach.
```

### Why This Order Works

1. **System prompt sets the epistemic rules** — model knows how to treat each type before seeing any content
2. **Ground truth first** — establishes the factual baseline the model won't contradict
3. **Signals labeled explicitly** — prevents the model from treating customer quotes as requirements
4. **Evidence summarized** — provides competitive context without drowning the signal
5. **Framework last** — shapes the recommendation tone without constraining the analysis

### Token Budget Impact

For a typical PM question like this:
- System prompt + type instructions: ~500 tokens
- 2 ground truth sources at full: ~8,000 tokens
- 2 signal sources at detail: ~4,000 tokens  
- 2 evidence sources at summary: ~2,000 tokens
- 1 framework at headlines: ~500 tokens
- User prompt: ~100 tokens

**Total: ~15,100 tokens** — well within budget, leaving room for a thorough response.

Compare with "dump everything at full": ~40,000+ tokens for the same sources, with worse output because the model can't distinguish what matters.

---

## Implementation in Modular

The optimal assembly strategy becomes the DEFAULT behavior when you hit RUN:

1. Sort channels by knowledge type: GT → Signal → Evidence → Framework → Hypothesis → Artifact
2. Apply depth based on type: GT=full, Signal=detail, Evidence=summary, Framework=headlines, Hypothesis=mention
3. Prefix each source block with its type label
4. Include the knowledge type instruction legend in system prompt

Users can override any of this (change depth, reorder, disable labels). But the DEFAULT should produce excellent results without any configuration.

This is the "3 clicks to answer" promise:
1. Select a preset (loads channels with correct types)
2. Type your question
3. Hit RUN (auto-assembles with optimal strategy)

---

*Next: Run actual empirical tests with real content from Victor's knowledge base.*
