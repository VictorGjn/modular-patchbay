# Context Compression, Attention Optimization & Prompt Engineering Research

> State-of-the-art techniques for making LLM context more effective (2023–2026)
> Compiled: March 2026

---

## Table of Contents

1. [Context Compression Techniques](#1-context-compression-techniques)
2. [Attention & Placement Optimization](#2-attention--placement-optimization)
3. [Structured Prompting Research](#3-structured-prompting-research)
4. [Multi-Source Context Assembly](#4-multi-source-context-assembly)
5. [Industry Practices](#5-industry-practices)
6. [Context Failure Modes](#6-context-failure-modes)
7. [Top 10 Improvements for Modular](#top-10-improvements-for-modular)

---

## 1. Context Compression Techniques

### 1.1 LLMLingua (Microsoft Research)

- **Source:** [arXiv:2310.05736](https://arxiv.org/abs/2310.05736) — EMNLP 2023
- **Technique:** Coarse-to-fine prompt compression using perplexity-based token removal. Uses a small LM (e.g., GPT-2/LLaMA-7B) to score each token's perplexity, then removes low-information tokens. Three components: (1) **Budget Controller** that allocates compression ratios across prompt segments to maintain semantic integrity, (2) **Token-level Iterative Compression** that models interdependence between compressed contents, and (3) **Distribution Alignment** via instruction tuning to bridge the gap between the small scoring model and the target LLM.
- **Key Results:** Up to **20x compression** with minimal performance loss across GSM8K, BBH, ShareGPT, and Arxiv datasets.
- **How Modular should implement it:** Use a small local model (e.g., Phi-3-mini or LLaMA-3-8B) as a compression pre-processor. Before injecting knowledge patches into context, run the patch text through perplexity scoring and remove low-information tokens. This is especially valuable for large reference documents and tool outputs.
- **Priority:** **High**

### 1.2 LongLLMLingua (Microsoft Research)

- **Source:** [arXiv:2310.06839](https://arxiv.org/abs/2310.06839) — ACL 2024
- **Technique:** Extension of LLMLingua specifically designed for long-context scenarios and RAG. Key innovation: uses the **question/query as a conditioning signal** when computing perplexity — tokens that are informative given the question are preserved, while tokens irrelevant to the query are removed. Also addresses position bias (the "lost in the middle" problem) by reordering compressed content.
- **Key Results:** Up to **21.4% performance boost** with ~4x fewer tokens in GPT-3.5-Turbo. **94% cost reduction** on the LooGLE benchmark. 1.4x-2.6x end-to-end latency acceleration for 10k token prompts.
- **How Modular should implement it:** When assembling context from multiple knowledge sources for a user query, use query-aware compression. Score each knowledge chunk's relevance to the current query and compress/remove irrelevant portions before injection. This is the most directly applicable technique for Modular's patchbay architecture.
- **Priority:** **Critical**

### 1.3 Selective Context

- **Source:** [arXiv:2304.12102](https://arxiv.org/abs/2304.12102) — Li (2023)
- **Technique:** Uses **self-information** (negative log probability from a causal LM) to measure how informative each lexical unit (sentence/phrase) is. High self-information = surprising/informative content = keep it. Low self-information = predictable/redundant content = remove it. Operates at sentence or phrase level rather than token level.
- **Key Results:** Effective across summarization and QA tasks on academic papers, news articles, and conversation transcripts.
- **How Modular should implement it:** Use self-information scoring as a lightweight pre-filter before the more expensive LLMLingua compression. Good for initial pruning of verbose documents — remove the "fluff" sentences before detailed token-level compression.
- **Priority:** **Medium**

### 1.4 RECOMP (Carnegie Mellon)

- **Source:** [arXiv:2310.04408](https://arxiv.org/abs/2310.04408) — Xu et al. (2023)
- **Technique:** Compressive retrieval for in-context learning. Two compressor types: (1) **Extractive compressor** — selects useful sentences from retrieved documents, (2) **Abstractive compressor** — generates summaries by synthesizing information from multiple documents. Both are trained end-to-end to maximize downstream LLM task performance. Crucially, if retrieved docs are irrelevant, the compressor returns an **empty string** (selective augmentation — don't inject noise).
- **Key Results:** Achieves **6% compression rate** (94% reduction) with minimal performance loss. Compressors trained for one LM transfer to others.
- **How Modular should implement it:** Train or fine-tune a small extractive compressor for Modular's domain. When knowledge patches are retrieved, compress them before injection. The "empty string" mechanism is critical — if a patch isn't relevant to the current query, don't inject it at all. This prevents context confusion.
- **Priority:** **High**

### 1.5 FILM-7B / IN2 Training (Microsoft)

- **Source:** [arXiv:2404.16811](https://arxiv.org/abs/2404.16811) — An et al. (2024)
- **Technique:** Information-INtensive (IN2) training — a data-driven approach to overcome "lost-in-the-middle." Creates synthetic QA datasets where answers require fine-grained awareness of short segments (~128 tokens) scattered across long contexts (4K-32K tokens), plus integration of information from 2+ segments. Applied to Mistral-7B to create FILM-7B (Fill-in-the-Middle).
- **Key Results:** Robust information retrieval from any position in 32K context. +3.4 F1 on NarrativeQA while maintaining short-context performance.
- **How Modular should implement it:** Not directly applicable as a runtime technique, but the insight is important: place critical information at positions the model is trained to attend to. When choosing base models for Modular, prefer those trained with position-aware objectives.
- **Priority:** **Low** (architectural insight, not a runtime technique)

---

## 2. Attention & Placement Optimization

### 2.1 Lost in the Middle (Stanford/UC Berkeley)

- **Source:** [arXiv:2307.03172](https://arxiv.org/abs/2307.03172) — Liu et al. (TACL 2023)
- **Technique:** Empirical study demonstrating that LLMs exhibit a strong **U-shaped attention curve** — performance is highest when relevant information is at the **beginning or end** of input context, and degrades significantly when it's in the middle. This holds even for models specifically trained for long contexts. Tested on multi-document QA and key-value retrieval.
- **Key Finding:** Models attend most to the first and last positions. Middle positions can see >20% performance degradation.
- **How Modular should implement it:**
  - **Place the most critical knowledge patches at the beginning and end** of the assembled context
  - Put system instructions and the user's query at the END (closest to generation)
  - Put the most relevant knowledge at the BEGINNING
  - Put less critical/supporting information in the middle
  - Structure: `[Critical Knowledge] → [Supporting Context] → [Instructions + Query]`
- **Priority:** **Critical**

### 2.2 Attention Sinks / StreamingLLM (MIT)

- **Source:** [arXiv:2309.17453](https://arxiv.org/abs/2309.17453) — Xiao et al. (ICLR 2024)
- **Technique:** Discovered that initial tokens in a sequence receive disproportionately high attention scores — acting as "attention sinks" — even when they carry no semantic importance. This is an emergent property of softmax attention: the model needs somewhere to "dump" attention mass. StreamingLLM exploits this by keeping initial KV cache entries as anchors, enabling stable inference on infinite-length sequences. Adding a dedicated **placeholder token** during pre-training further improves streaming performance.
- **Key Results:** Stable language modeling with up to **4 million tokens**. Up to 22.2x speedup over sliding window recomputation.
- **How Modular should implement it:**
  - Always include a stable "anchor" prefix at the start of the context (system prompt serves this role naturally)
  - Don't remove or change the first few tokens of context between turns — they serve as attention anchors
  - Be aware that the system prompt's first tokens receive outsized attention — make them count
- **Priority:** **High**

### 2.3 Optimal Placement Strategy (Synthesis)

Based on the research above, the optimal context layout for Modular:

```
┌─────────────────────────────────────────────┐
│ POSITION 1 (HIGH ATTENTION - "Sink")        │
│ → System prompt / identity / core rules     │
│ → Most critical knowledge patch             │
├─────────────────────────────────────────────┤
│ POSITION 2 (LOWER ATTENTION - "Middle")     │
│ → Supporting documents                      │
│ → Historical context                        │
│ → Less critical patches                     │
│ → Tool descriptions                         │
├─────────────────────────────────────────────┤
│ POSITION 3 (HIGH ATTENTION - "Recency")     │
│ → User's current query                      │
│ → Task-specific instructions                │
│ → Output format requirements                │
│ → Chain-of-thought trigger                  │
└─────────────────────────────────────────────┘
```

- **Priority:** **Critical** — This should directly inform Modular's context assembly order.

---

## 3. Structured Prompting Research

### 3.1 XML-Structured Prompts (Anthropic Best Practices)

- **Source:** [Anthropic Prompting Best Practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices)
- **Technique:** Anthropic officially recommends XML tags for structuring prompts. Key practices:
  - Use `<instructions>`, `<context>`, `<input>`, `<example>`, `<documents>` tags
  - Nest tags for hierarchy: `<documents><document index="1"><source>...</source><document_content>...</document_content></document></documents>`
  - Use consistent, descriptive tag names
  - Wrap examples in `<example>` tags to separate from instructions
- **Does it generalize?** XML structuring helps Claude significantly. For other models (GPT-4, Gemini), markdown headers (`###`) and delimiters (`---`) work similarly. The principle is universal: **structured delimiters reduce ambiguity**. XML is Claude-optimal; markdown/JSON is more universal.
- **How Modular should implement it:**
  - Use XML tags as the primary structuring mechanism in assembled prompts
  - Each knowledge patch should be wrapped in `<knowledge source="patch-name">...</knowledge>` tags
  - Instructions in `<instructions>` tags, query in `<query>` tags
  - For multi-model support, have a tag-format adapter layer
- **Priority:** **Critical**

### 3.2 Long Context Prompting — Documents at Top, Query at Bottom

- **Source:** [Anthropic Best Practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices)
- **Technique:** Anthropic explicitly recommends: "Put longform data at the top. Place your long documents and inputs near the top of your prompt, above your query, instructions, and examples." Queries at the end improve response quality by **up to 30%** in tests, especially with complex, multi-document inputs.
- **Additional technique:** "Ground responses in quotes" — ask the model to quote relevant parts of documents before answering. This forces the model to locate and attend to specific information rather than generating from vague impressions.
- **How Modular should implement it:** This directly validates the placement strategy in 2.3. Additionally, for complex queries, add a "quote extraction" step: ask the model to first cite relevant passages from injected patches, then reason from those citations.
- **Priority:** **Critical**

### 3.3 Role Prompting vs. Instruction-Based

- **Source:** Multiple studies + Anthropic documentation
- **Technique:** Anthropic recommends role prompting via system prompt: "Setting a role in the system prompt focuses Claude's behavior and tone." Research shows:
  - **Role prompting** (e.g., "You are an expert data analyst") works best for establishing tone, expertise level, and behavioral constraints
  - **Instruction-based** prompting works best for specific task execution
  - **Best practice:** Combine both — role in system prompt, instructions in user message
  - Providing **context/motivation** behind instructions ("Your response will be read aloud by TTS") significantly improves compliance vs. bare rules ("Never use ellipses")
- **How Modular should implement it:** Use the patchbay to set role context based on the active patches. If a "code review" patch is active, the system prompt should include relevant role framing. Instructions should explain WHY, not just WHAT.
- **Priority:** **High**

### 3.4 Chain-of-Thought Placement

- **Source:** Multiple studies, Anthropic extended thinking documentation
- **Technique:** Where to place reasoning instructions matters:
  - CoT triggers should be **near the end of the prompt**, close to where generation begins
  - "Think step by step" at the end outperforms the same instruction at the beginning
  - For Claude, "extended thinking" / "interleaved thinking" provides native CoT without prompt engineering
  - When using manual CoT: place the instruction after all context and just before the expected output
- **How Modular should implement it:** Any reasoning/analysis instructions should be placed as the final instruction before the model generates. Don't bury "think carefully about this" in the middle of context.
- **Priority:** **Medium**

---

## 4. Multi-Source Context Assembly

### 4.1 Source Attribution & Document Structuring

- **Source:** Anthropic Best Practices + LangChain Context Engineering blog
- **Technique:** When combining multiple documents:
  - Wrap each in indexed `<document>` tags with explicit `<source>` metadata
  - Ask the model to **quote relevant passages** before answering (grounding)
  - This forces explicit source attribution and reduces hallucination
  - Example structure:
    ```xml
    <documents>
      <document index="1">
        <source>api-reference.md</source>
        <document_content>...</document_content>
      </document>
      <document index="2">
        <source>user-guide.md</source>
        <document_content>...</document_content>
      </document>
    </documents>
    ```
- **How Modular should implement it:** Every knowledge patch injected into context should have explicit source metadata. The assembly layer should number/index patches and include source identifiers. Optionally add a "cite your sources" instruction.
- **Priority:** **High**

### 4.2 Handling Contradictions Between Sources

- **Source:** Drew Breunig, "How Long Contexts Fail" (June 2025); Microsoft/Salesforce "Context Clash" paper (arXiv:2505.06120)
- **Technique:** **Context Clash** — when context contains contradictory information, models degrade dramatically. The Microsoft/Salesforce study found that "sharding" information across multiple turns caused a **39% average performance drop**, with even o3 dropping from 98.1 to 64.1. The problem: models make early assumptions and don't recover when contradicted later.
- **Key insight:** "LLMs often make assumptions in early turns and prematurely attempt to generate final solutions, on which they overly rely."
- **How Modular should implement it:**
  - **Pre-filter contradictions:** Before assembly, check if patches contradict each other. If they do, either resolve the contradiction or explicitly flag it in the prompt: "Note: sources disagree on X. Source A says Y, Source B says Z."
  - **Prefer single-shot assembly:** Assemble all context at once rather than adding it incrementally across turns
  - **Add contradiction-awareness instructions:** "If sources disagree, note the disagreement and explain which source is more likely correct and why."
  - **Version control patches:** Prefer newest/most authoritative source when conflicts exist
- **Priority:** **Critical**

### 4.3 Optimal Ordering of Multiple Sources

- **Source:** Synthesis of Lost in the Middle + LongLLMLingua + Anthropic best practices
- **Technique:** When assembling multiple knowledge sources:
  1. **Most relevant source first** (high attention at start)
  2. **Supporting/secondary sources in middle** (lower attention zone)
  3. **Query and instructions last** (high attention at end — 30% improvement)
  4. **Compressed/summarized versions** preferred over raw documents
  5. Use **query-aware relevance scoring** (LongLLMLingua approach) to determine order
- **How Modular should implement it:** The patchbay assembly pipeline should: (1) Score each patch's relevance to current query, (2) Sort by relevance, (3) Place top patch first, (4) Compress middle patches more aggressively, (5) Place query last.
- **Priority:** **Critical**

---

## 5. Industry Practices

### 5.1 Anthropic's Multi-Agent Research System

- **Source:** [Anthropic Engineering Blog — How We Built Our Multi-Agent Research System](https://www.anthropic.com/engineering/multi-agent-research-system)
- **Key Practices:**
  - **Orchestrator-worker pattern:** Lead agent (Claude Opus 4) decomposes queries, spawns specialized subagents (Claude Sonnet 4) for parallel exploration
  - **Context as compression:** "The essence of search is compression: distilling insights from a vast corpus." Subagents compress information before passing to lead agent.
  - **Memory/Scratchpad for persistence:** "The LeadResearcher begins by thinking through the approach and saving its plan to Memory to persist the context, since if the context window exceeds 200,000 tokens it will be truncated"
  - **Prompt engineering as primary lever:** Each subagent gets detailed objectives, output formats, guidance on tools, and clear task boundaries
  - **Token economics:** Multi-agent uses ~15x more tokens than chat. Single agent uses ~4x more. Architecture must justify cost.
  - **90.2% improvement** of multi-agent Opus+Sonnet over single-agent Opus on research eval
  - **Token usage explains 80% of performance variance** on BrowseComp

### 5.2 Cognition (Devin) — Context Engineering Principles

- **Source:** [Cognition Blog — Don't Build Multi-Agents](https://cognition.ai/blog/dont-build-multi-agents)
- **Key Practices:**
  - **"Context engineering is effectively the #1 job of engineers building AI agents"**
  - **Principle 1: Share full agent traces, not just individual messages.** Subagents need the complete context of prior decisions, not just their subtask description.
  - **Principle 2: Actions carry implicit decisions.** When agents act independently without seeing each other's work, their implicit assumptions conflict.
  - **Prefer single-threaded agents** for most tasks — continuous context prevents miscommunication
  - **For long-duration tasks:** Use a dedicated **compression LLM** that distills action history into key details, events, and decisions. Cognition **fine-tuned a smaller model** specifically for this summarization task.
  - **Anti-pattern:** Multi-agent architectures where subagents work in isolation without shared context
- **How Modular should implement it:** Keep context continuous within a session. When compression is needed, use a specialized summarizer (could be a smaller fine-tuned model) rather than truncating. Share full traces between components.
- **Priority:** **Critical**

### 5.3 Cursor/Copilot — Code Context Assembly

- **Source:** LangChain Context Engineering blog, Cursor/Windsurf documentation
- **Key Practices:**
  - **Rules files** (CLAUDE.md, .cursor/rules, .windsurf/rules) serve as always-loaded procedural memory
  - **Multi-signal retrieval:** Combine embedding search + AST parsing + grep/file search + knowledge graph retrieval + re-ranking
  - **Semantic chunking:** Parse code along semantically meaningful boundaries (functions, classes, modules) rather than fixed-size chunks
  - **Re-ranking step:** All retrieved context is ranked by relevance before injection
  - As Windsurf notes: "Embedding search becomes unreliable as codebase size grows" — must combine multiple retrieval techniques
- **How Modular should implement it:** The patchbay should support multiple retrieval strategies per patch type. Code patches need AST-aware chunking. Document patches need semantic chunking. All patches go through relevance re-ranking before assembly.
- **Priority:** **High**

### 5.4 Karpathy on Context Engineering

- **Source:** [Karpathy on X](https://x.com/karpathy/status/1937902205765607626), LangChain blog
- **Key Quote:** Context engineering is the *"delicate art and science of filling the context window with just the right information for the next step."*
- **Framework:** LLMs are like a new operating system. The context window is RAM. Just as an OS curates what fits in RAM, context engineering curates what fits in the context window.
- **Implications for Modular:** The patchbay IS context engineering infrastructure. Each patch is like a memory page loaded into RAM. The assembly process is the "OS scheduler" deciding what gets loaded for each inference step.
- **Priority:** **High** (conceptual alignment)

### 5.5 Tobi Lütke (Shopify) on Context Engineering

- **Source:** Referenced in LangChain blog; widely discussed in 2025 AI discourse
- **Key Concept:** Lütke popularized the term "context engineering" as a discipline beyond "prompt engineering." While prompt engineering focuses on writing good instructions, context engineering is about **the entire pipeline** of getting the right information to the model at the right time — including retrieval, compression, ordering, and dynamic assembly.
- **Implications:** Modular's patchbay architecture is essentially a context engineering framework. This validates the architectural approach.

---

## 6. Context Failure Modes

### Source: Drew Breunig — "How Long Contexts Fail" (June 2025)

Four critical failure modes that Modular must defend against:

### 6.1 Context Poisoning
- **What:** A hallucination or error enters the context and gets repeatedly referenced
- **Example:** Gemini 2.5 playing Pokémon hallucinated game state, poisoning goals/strategy
- **Modular defense:** Validate patch content before injection. Add "source freshness" metadata. Implement context reset mechanisms.

### 6.2 Context Distraction
- **What:** Context grows so long the model over-focuses on it, neglecting training knowledge
- **Evidence:** Gemini agent beyond 100k tokens favored repeating past actions over synthesizing new plans. Databricks found correctness drops at ~32k for Llama 3.1 405b.
- **Modular defense:** Enforce context budget limits. Compress aggressively. Prefer fewer, higher-quality patches over many low-quality ones.

### 6.3 Context Confusion
- **What:** Superfluous content (especially tool descriptions) confuses the model
- **Evidence:** Berkeley Function-Calling Leaderboard shows all models perform worse with more tools. Llama 3.1 8b fails with 46 tools but succeeds with 19.
- **Modular defense:** Only inject patches relevant to the current task. Use RAG over tool descriptions to load only relevant ones. Limit active patches.

### 6.4 Context Clash
- **What:** Information in context contradicts itself
- **Evidence:** Sharded prompts cause 39% average performance drop; o3 drops from 98.1 to 64.1
- **Modular defense:** Detect contradictions between patches. Resolve or explicitly flag them. Prefer single-shot context assembly.

---

## Top 10 Improvements for Modular

Ranked by impact and feasibility:

### 1. 🔴 Implement Position-Aware Context Assembly
**Impact: Critical | Effort: Low**
Apply "Lost in the Middle" findings immediately. Structure assembled context as: `[Most relevant patches] → [Supporting context] → [User query + Instructions]`. This alone can improve response quality by 20-30%.

### 2. 🔴 Add Query-Aware Patch Relevance Scoring
**Impact: Critical | Effort: Medium**
Before assembly, score each patch's relevance to the current query (inspired by LongLLMLingua). Only inject patches above a relevance threshold. Order by relevance score. Prevents context confusion and context clash.

### 3. 🔴 XML-Tag Structured Assembly
**Impact: Critical | Effort: Low**
Wrap every injected patch in XML tags with source metadata: `<knowledge source="patch-name" type="api-docs" relevance="0.92">`. Use `<instructions>`, `<query>`, `<context>` wrappers. Universal improvement across models.

### 4. 🔴 Context Budget Controller
**Impact: Critical | Effort: Medium**
Implement a budget controller (inspired by LLMLingua) that allocates token budget across patches based on relevance and priority. Enforce hard limits per patch category. Compress aggressively when approaching budget limits. Prevents context distraction.

### 5. 🟠 Contradiction Detection & Resolution
**Impact: High | Effort: Medium**
Before assembly, detect if patches contradict each other. Options: (a) Remove the less authoritative source, (b) Add explicit "sources disagree" annotation, (c) Prefer newest source. Prevents context clash (39% performance degradation).

### 6. 🟠 Extractive Compression for Verbose Patches
**Impact: High | Effort: Medium-High**
Implement RECOMP-style extractive compression. For each patch, extract only the sentences relevant to the current query. Can achieve 94% size reduction with minimal quality loss. Critical for tool outputs and large documents.

### 7. 🟠 Scratchpad / Memory Persistence
**Impact: High | Effort: Medium**
Inspired by Anthropic and Cognition. When context exceeds limits, summarize and persist key decisions/findings to a scratchpad rather than truncating. Use a specialized summarizer (not just "take the last N messages").

### 8. 🟡 Grounding via Quote Extraction
**Impact: Medium | Effort: Low**
Add instructions asking the model to "first quote relevant passages from the provided knowledge, then answer based on those quotes." Improves accuracy and provides natural source attribution. Anthropic-recommended technique.

### 9. 🟡 Dynamic Patch Loading (RAG over Patches)
**Impact: Medium | Effort: High**
Instead of statically loading all active patches, use embedding-based retrieval to dynamically load only relevant chunks per query. Similar to how Cursor combines multiple retrieval signals. Important as patch count grows.

### 10. 🟡 Context Health Monitoring
**Impact: Medium | Effort: Medium**
Monitor for context failure modes in real-time: detect potential poisoning (repeated hallucinated facts), distraction (context > model's effective limit), confusion (too many tool descriptions), and clash (contradictory information). Alert or auto-correct.

---

## Summary Matrix

| Technique | Source | Compression Rate | Performance Impact | Modular Applicability |
|-----------|--------|-----------------|-------------------|----------------------|
| LLMLingua | Microsoft | Up to 20x | Minimal loss | High — pre-process patches |
| LongLLMLingua | Microsoft | 4x | +21.4% boost | Critical — query-aware |
| Selective Context | Li (2023) | ~5x | Moderate | Medium — pre-filter |
| RECOMP | CMU | Up to 94% reduction | Minimal loss | High — extractive compression |
| Lost in the Middle | Stanford | N/A (placement) | +20-30% | Critical — assembly order |
| Attention Sinks | MIT | N/A (architecture) | Stability | High — anchor tokens |
| FILM-7B | Microsoft | N/A (training) | +3.4 F1 | Low — model selection |
| XML Structuring | Anthropic | N/A (format) | Significant | Critical — tag everything |
| Quote Grounding | Anthropic | N/A (technique) | +accuracy | Medium — add instructions |
| Context Clash Defense | MS/Salesforce | N/A (defense) | Prevents 39% drop | Critical — detect contradictions |

---

## Key References

1. Jiang et al. "LLMLingua: Compressing Prompts for Accelerated Inference" — EMNLP 2023 — [arXiv:2310.05736](https://arxiv.org/abs/2310.05736)
2. Jiang et al. "LongLLMLingua: Accelerating and Enhancing LLMs in Long Context Scenarios" — ACL 2024 — [arXiv:2310.06839](https://arxiv.org/abs/2310.06839)
3. Li. "Selective Context: Enhancing Context Efficiency with Self-Information-Based Filtering" — 2023 — [arXiv:2304.12102](https://arxiv.org/abs/2304.12102)
4. Xu et al. "RECOMP: Improving Retrieval-Augmented LMs with Compression and Selective Augmentation" — 2023 — [arXiv:2310.04408](https://arxiv.org/abs/2310.04408)
5. Liu et al. "Lost in the Middle: How Language Models Use Long Contexts" — TACL 2023 — [arXiv:2307.03172](https://arxiv.org/abs/2307.03172)
6. Xiao et al. "Efficient Streaming Language Models with Attention Sinks" — ICLR 2024 — [arXiv:2309.17453](https://arxiv.org/abs/2309.17453)
7. An et al. "Make Your LLM Fully Utilize the Context (FILM-7B)" — 2024 — [arXiv:2404.16811](https://arxiv.org/abs/2404.16811)
8. Anthropic. "Prompting Best Practices" — [platform.claude.com](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices)
9. Anthropic. "How We Built Our Multi-Agent Research System" — [anthropic.com/engineering](https://www.anthropic.com/engineering/multi-agent-research-system)
10. Anthropic. "Building Effective Agents" — [anthropic.com/engineering](https://www.anthropic.com/engineering/building-effective-agents)
11. Cognition. "Don't Build Multi-Agents" — [cognition.ai/blog](https://cognition.ai/blog/dont-build-multi-agents)
12. Breunig. "How Long Contexts Fail" — June 2025 — [dbreunig.com](https://www.dbreunig.com/2025/06/22/how-contexts-fail-and-how-to-fix-them.html)
13. LangChain. "Context Engineering for Agents" — [blog.langchain.com](https://blog.langchain.com/context-engineering-for-agents/)
14. Karpathy. Context engineering definition — [X/Twitter](https://x.com/karpathy/status/1937902205765607626)
15. Microsoft/Salesforce. "Context Clash" study — arXiv:2505.06120
