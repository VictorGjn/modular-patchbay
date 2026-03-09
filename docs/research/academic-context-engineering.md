# Academic Research: Context Engineering for AI Agents

> **Last updated:** 2026-03-09
> **Purpose:** State-of-the-art techniques to improve Modular's context engineering platform
> **Methodology:** Systematic search across arXiv, ACL, EMNLP, NeurIPS, ICLR proceedings

---

## Priority Matrix (Impact × Feasibility)

| Technique | Impact | Complexity | Priority |
|-----------|--------|------------|----------|
| Hierarchical Retrieval (RAPTOR/BookRAG) | High | Medium | ⭐⭐⭐⭐⭐ |
| Context Compression (LLMLingua-2) | High | Low | ⭐⭐⭐⭐⭐ |
| Biologically-Inspired Forgetting (FadeMem) | High | Medium | ⭐⭐⭐⭐⭐ |
| GraphRAG Community Summaries | High | High | ⭐⭐⭐⭐ |
| Attention-Aware Placement (Found in the Middle) | High | Low | ⭐⭐⭐⭐ |
| Structured Episodic Event Memory | High | Medium | ⭐⭐⭐⭐ |
| Multi-Head RAG | Medium | Medium | ⭐⭐⭐ |
| Virtual Context Management (MemGPT) | High | High | ⭐⭐⭐ |
| Structured Prompt Language (SPL) | Medium | Medium | ⭐⭐⭐ |
| Knowledge Augmented Generation (KAG) | High | High | ⭐⭐⭐ |
| Instruction Hierarchy Embeddings | Medium | High | ⭐⭐ |

---

## A. Advanced Retrieval & Context Assembly

### A1. RAPTOR: Recursive Abstractive Processing for Tree-Organized Retrieval

- **Paper:** Sarthi, Abdullah, Tuli, Khanna, Goldie, Manning (2024)
- **Link:** https://arxiv.org/abs/2401.18059
- **Venue:** ICLR 2024
- **Core idea:** Recursively embeds, clusters, and summarizes text chunks bottom-up into a tree structure. At inference, retrieves from multiple tree levels simultaneously, integrating information across different levels of abstraction. Achieves 20% improvement on QuALITY benchmark when paired with GPT-4.
- **Relevance to Modular:** **Direct validation of our Tree Indexing approach.** RAPTOR's bottom-up clustering + multi-level retrieval is complementary to Modular's top-down heading-based tree. Key insight: Modular should support BOTH top-down (heading hierarchy) AND bottom-up (clustering) tree construction. The multi-level retrieval at inference time maps directly to our Depth Filtering system — RAPTOR retrieves summaries at different granularities, just as Modular renders at Full/Detail/Summary/Headlines/Mention.
- **Implementation complexity:** Medium
- **Expected impact:** High — validates and extends our core architecture

### A2. BookRAG: Hierarchical Structure-aware Index-based Approach for RAG on Complex Documents

- **Paper:** (2025)
- **Link:** https://arxiv.org/abs/2512.xxxxx (Dec 2025, search result from arXiv)
- **Venue:** arXiv preprint
- **Core idea:** Exploits the inherent hierarchical structure of complex documents (chapters, sections, subsections) for retrieval, building structure-aware indices that respect document organization. Unlike flat chunk-based RAG, preserves parent-child relationships between document sections.
- **Relevance to Modular:** Nearly identical to our tree indexing. Key differences to study: how they handle cross-section references and how their hierarchy-aware retrieval scores differ from flat cosine similarity.
- **Implementation complexity:** Low (we already do this)
- **Expected impact:** Medium — confirms our approach, may offer scoring improvements

### A3. Beyond Chunking: Discourse-Aware Hierarchical Retrieval

- **Paper:** Chen, Yang, Li, Zhang, Hu, Zhang (2025)
- **Link:** https://arxiv.org/abs/2506.xxxxx (May 2025, revised Jan 2026)
- **Venue:** arXiv preprint
- **Core idea:** Moves beyond heuristic chunking by using discourse structure (rhetorical relations between text segments) to build hierarchical retrieval units. Recognizes that text has inherent logical structure beyond just headings — causal chains, elaboration, contrast — and uses these discourse relations for more intelligent chunking and retrieval.
- **Relevance to Modular:** Our tree indexing uses markdown headings; this suggests we should also consider **discourse relations** within sections. A section might contain a claim, its evidence, and a conclusion — these have different knowledge types. Could enhance our Knowledge Type System by auto-detecting discourse roles.
- **Implementation complexity:** Medium
- **Expected impact:** High — would improve both tree indexing and knowledge type classification

### A4. LLM-guided Hierarchical Retrieval

- **Paper:** Gupta, Chang, Bui, Hsieh, Dhillon (2025)
- **Link:** https://arxiv.org/abs/2510.xxxxx (Oct 2025)
- **Venue:** arXiv preprint
- **Core idea:** Uses an LLM to guide navigation through a hierarchical index at retrieval time, rather than using fixed similarity thresholds. The LLM reasons about which branches to explore deeper, creating an adaptive tree-walk retrieval process.
- **Relevance to Modular:** **This is essentially what we call Agent-Driven Navigation.** Validates our approach. Key takeaway: their LLM-guided tree walk outperforms both flat retrieval and fixed hierarchical retrieval. We should ensure our agent navigation is as sophisticated.
- **Implementation complexity:** Low (we already have this)
- **Expected impact:** Medium — validates existing approach

### A5. MoDora: Tree-Based Semi-Structured Document Analysis System

- **Paper:** Xu, Yao, Tang, Zhou, He, Yu, Xu, Wang, Li, He, Wu (2026)
- **Link:** https://arxiv.org/abs/2602.xxxxx (Feb 2026)
- **Venue:** arXiv preprint
- **Core idea:** A complete system for analyzing semi-structured documents by converting them to tree representations. Handles tables, lists, nested structures, and mixed-format content. Provides tree-based operations for querying and transforming document content.
- **Relevance to Modular:** Extends our markdown-centric tree indexing to handle more document formats. Key insight: semi-structured documents (JSON configs, API responses, HTML) need different tree parsing strategies than markdown.
- **Implementation complexity:** Medium
- **Expected impact:** Medium

### A6. LLMLingua-2: Data Distillation for Efficient Task-Agnostic Prompt Compression

- **Paper:** Pan, Wu, Jiang, Xia, Luo, Zhang, Lin, Rühle, Yang, Lin, Zhao, Qiu, Zhang (2024)
- **Link:** https://arxiv.org/abs/2403.12968
- **Venue:** ACL 2024 Findings
- **Core idea:** Formulates prompt compression as a **token classification** problem using a bidirectional Transformer encoder (XLM-RoBERTa). Trains via data distillation from a larger LLM. Achieves 2x-5x compression ratios while being 3x-6x faster than LLMLingua-1, with end-to-end latency improvements of 1.6x-2.9x. Uses bidirectional context (not just unidirectional self-information) for better compression decisions.
- **Relevance to Modular:** **Direct upgrade to our Context Compression pipeline.** Currently Modular does semantic dedup and filler removal; LLMLingua-2's token classification approach could provide more principled compression. Key insight: treating compression as classification (keep/drop per token) with a small encoder model is much faster than LLM-based summarization while preserving faithfulness.
- **Implementation complexity:** Low (use pre-trained model, available at aka.ms/LLMLingua-2)
- **Expected impact:** High — immediate improvement to context compression

### A7. LongLLMLingua: Accelerating and Enhancing LLMs in Long Context Scenarios

- **Paper:** Jiang et al. (2023, updated 2024)
- **Link:** https://arxiv.org/abs/2310.06839
- **Venue:** ACL 2024
- **Core idea:** Addresses three challenges of long-context LLMs: computational cost, performance degradation, and position bias. Compresses prompts by identifying and preserving key information density regions. Achieves up to 21.4% performance boost with 4x fewer tokens, and 94% cost reduction on some benchmarks.
- **Relevance to Modular:** Specifically designed for the scenario we face — long context with mixed-relevance information. The "key information density" metric could replace or supplement our current relevance scoring. The position-bias-aware compression aligns with our need for attention-aware context placement.
- **Implementation complexity:** Low
- **Expected impact:** High

### A8. Selective Context: Self-Information-Based Content Filtering

- **Paper:** Li (2023)
- **Link:** https://arxiv.org/abs/2304.12102
- **Venue:** arXiv preprint
- **Core idea:** Uses **self-information** (surprisal) from a language model to filter out low-information-content tokens/sentences. Tokens with low self-information are predictable and thus redundant. Simple, fast, and effective — a lightweight compression method that doesn't require training.
- **Relevance to Modular:** Could be used as a fast **pre-filter** before more expensive compression. Self-information is cheap to compute and provides a principled way to identify filler content. Could enhance our "filler removal" step in context compression.
- **Implementation complexity:** Low
- **Expected impact:** Medium

### A9. Multi-Head RAG (MRAG)

- **Paper:** Besta, Kubicek, Gerstenberger et al. (2024)
- **Link:** https://arxiv.org/abs/2406.05085
- **Venue:** arXiv preprint
- **Core idea:** Uses multi-head attention activations (instead of standard decoder-layer embeddings) as retrieval keys. Different attention heads capture different semantic aspects of a query. This creates multi-aspect embeddings for both queries and documents, improving retrieval accuracy for complex queries by up to 20%.
- **Relevance to Modular:** When assembling context from multiple sources, some queries need information about different aspects (e.g., "how does the memory pipeline handle both facts and procedures?"). MRAG's multi-aspect retrieval could improve our source selection. Could be integrated into our relevance scoring.
- **Implementation complexity:** Medium
- **Expected impact:** Medium

### A10. Structured Prompt Language (SPL)

- **Paper:** Gong (2026)
- **Link:** https://arxiv.org/abs/2602.xxxxx (Feb 2026)
- **Venue:** arXiv preprint (44 pages)
- **Core idea:** A declarative, SQL-inspired language for managing LLM context. Treats LLMs as "generative knowledge bases" and provides structured operations for context assembly, filtering, and transformation. Provides formal semantics for prompt construction.
- **Relevance to Modular:** Fascinating parallel to what we're building. SPL provides a language for context operations; Modular provides a pipeline. Could inform our API design — giving users declarative control over context assembly rather than imperative configuration.
- **Implementation complexity:** Medium
- **Expected impact:** Medium — more architectural inspiration than direct technique

---

## B. Knowledge Representation for LLMs

### B1. GraphRAG: From Local to Global Query-Focused Summarization

- **Paper:** Edge et al. / Microsoft Research (2024)
- **Link:** https://arxiv.org/abs/2404.16130
- **Venue:** arXiv preprint (updated Feb 2025)
- **Core idea:** Two-stage graph-based RAG: (1) Extract entity knowledge graph from source documents, (2) Pre-generate community summaries for clusters of related entities using Leiden algorithm. For global queries, each community summary generates a partial response, which are then aggregated. Addresses RAG's failure on global/thematic questions over entire corpora.
- **Relevance to Modular:** GraphRAG's community summaries are analogous to our tree node summaries but organized by entity relationships rather than document structure. **Key technique to adopt:** pre-computing community-level summaries for knowledge that spans multiple documents. This would help Modular answer cross-document questions like "What are the main patterns across all our framework guidelines?"
- **Implementation complexity:** High (requires entity extraction pipeline + graph clustering)
- **Expected impact:** High — enables a class of queries we currently can't handle well

### B2. Core-based Hierarchies for Efficient GraphRAG

- **Paper:** (March 2026)
- **Link:** arXiv, March 2026
- **Venue:** arXiv preprint
- **Core idea:** Improves GraphRAG's efficiency by using k-core decomposition to build hierarchical community structures more efficiently than Leiden clustering. Cores naturally represent nested communities of increasing connectivity.
- **Relevance to Modular:** If we adopt GraphRAG, this provides a more efficient hierarchy construction method. The core-based approach produces a natural tree-like structure that could integrate with our existing tree indexing.
- **Implementation complexity:** Medium
- **Expected impact:** Medium (optimization of B1)

### B3. Knowledge Augmented Generation (KAG)

- **Paper:** Liang, Sun, Gui et al. / Ant Group (2024)
- **Link:** https://arxiv.org/abs/2409.13731
- **Venue:** arXiv preprint
- **Core idea:** Hybrid framework combining knowledge graphs and vector retrieval with five key innovations: (1) LLM-friendly knowledge representation, (2) mutual-indexing between KG and original chunks, (3) logical-form-guided hybrid reasoning engine, (4) knowledge alignment with semantic reasoning, (5) model capability enhancement. Achieves 19.6% improvement on 2WikiQA and 33.5% on HotpotQA over SOTA RAG.
- **Relevance to Modular:** The **mutual-indexing** concept is powerful — maintaining bidirectional links between structured knowledge (KG entities) and unstructured text (original chunks). This maps to our Knowledge Type System: ground-truth facts could be KG entities, while evidence/signals remain as text chunks, with mutual references between them. The logical-form-guided reasoning could enhance our agent navigation.
- **Implementation complexity:** High
- **Expected impact:** High — major improvement for multi-hop reasoning

### B4. HELP: HyperNode Expansion and Logical Path-Guided Evidence Localization for GraphRAG

- **Paper:** Huang, Liao, Yang, Hu, Hu, Wang, Yan (2026)
- **Link:** arXiv, Feb 2026
- **Venue:** arXiv preprint
- **Core idea:** Addresses GraphRAG's limitations by introducing hypernode expansion (grouping related entities into compound nodes) and logical path tracing (following reasoning chains through the graph to locate evidence). Reduces hallucination by grounding generation in verified graph paths.
- **Relevance to Modular:** The logical path-guided evidence localization could enhance our Knowledge Type System's fact verification. When the agent navigates our tree, it could trace logical paths between facts to verify consistency.
- **Implementation complexity:** High
- **Expected impact:** Medium

### B5. Pruning Minimal Reasoning Graphs for Efficient RAG

- **Paper:** Wang, Zhu, Yee, Gao, Huang, Xu, Galhotra (2026)
- **Link:** arXiv, Feb 2026
- **Venue:** arXiv preprint
- **Core idea:** Given a query, prunes the retrieved graph to its minimal reasoning subgraph — the smallest set of nodes and edges needed to answer the question. Reduces irrelevant context while preserving all necessary reasoning paths.
- **Relevance to Modular:** **Directly applicable to our context budget optimization.** When we have a tree of knowledge, we could compute the minimal subgraph needed for a given query and only render those branches. This is more principled than our current depth filtering.
- **Implementation complexity:** Medium
- **Expected impact:** High — more precise context assembly

---

## C. Agent Memory Systems

### C1. MemGPT: Towards LLMs as Operating Systems

- **Paper:** Packer, Wooders, Lin, Fang, Patil, Stoica, Gonzalez (2023)
- **Link:** https://arxiv.org/abs/2310.08560
- **Venue:** arXiv preprint (UC Berkeley)
- **Core idea:** Draws from OS virtual memory management to provide LLMs with the appearance of unlimited context. Implements a tiered memory hierarchy (main context = "RAM", external storage = "disk") with intelligent paging between tiers. Uses interrupts for control flow. Enables extended conversations and large document analysis within fixed context windows.
- **Relevance to Modular:** **MemGPT's architecture is the conceptual foundation for what Modular does.** Key techniques to adopt: (1) explicit memory tiers with different access speeds, (2) interrupt-driven control flow (agent decides when to page in/out), (3) self-directed memory editing. We should study their paging policies for when to promote/demote information between context tiers.
- **Implementation complexity:** High (full system design)
- **Expected impact:** High — architectural blueprint

### C2. FadeMem: Biologically-Inspired Forgetting for Efficient Agent Memory

- **Paper:** Wei, Peng, Dong, Xie, Wang (2026)
- **Link:** https://arxiv.org/abs/2601.18642
- **Venue:** arXiv preprint (Jan 2026)
- **Core idea:** Implements **adaptive exponential decay** across a dual-layer memory hierarchy, where retention is governed by three factors: semantic relevance, access frequency, and temporal patterns. Uses LLM-guided conflict resolution and memory fusion to consolidate related memories while letting irrelevant details fade. Achieves superior multi-hop reasoning with 45% storage reduction.
- **Relevance to Modular:** **This is the most directly applicable memory technique for us.** Our Memory Pipeline currently extracts facts and recalls by relevance, but lacks temporal decay and access-frequency weighting. FadeMem's three-factor decay (relevance × frequency × recency) could be implemented in our fact store. The "memory fusion" (merging related facts) addresses our deduplication needs.
- **Implementation complexity:** Medium
- **Expected impact:** High — immediate improvement to memory pipeline

### C3. Structured Episodic Event Memory (SEEM)

- **Paper:** Lu, Li, Shi, Wang, Wang, Hu (2026)
- **Link:** arXiv, Jan 2026 (revised Feb 2026)
- **Venue:** arXiv preprint
- **Core idea:** Current LLM memory approaches treat memories as flat key-value pairs. SEEM structures episodic memories as events with temporal ordering, causal relationships, and participant tracking. Memories are stored as structured event records with slots (who, what, when, where, why) rather than raw text or embeddings.
- **Relevance to Modular:** Our Memory Pipeline extracts "facts" — but SEEM suggests we should extract **structured events** with temporal and causal metadata. This would enable queries like "What happened before X?" or "What caused the decision to Y?" — much richer than our current relevance-based recall.
- **Implementation complexity:** Medium
- **Expected impact:** High — enables temporal/causal reasoning over memories

### C4. Nemori: Self-Organizing Agent Memory Inspired by Cognitive Science

- **Paper:** Nan, Ma, Wu, Chen (2025)
- **Link:** arXiv, Aug 2025
- **Venue:** arXiv preprint
- **Core idea:** Implements cognitive science-inspired memory organization with self-organizing maps. Memories automatically cluster into semantic neighborhoods. Related memories strengthen connections (Hebbian learning), while unrelated ones drift apart. Maintains persistent memory across sessions.
- **Relevance to Modular:** The self-organizing aspect is interesting — rather than manually classifying knowledge types, let memories self-organize based on usage patterns and semantic similarity. Could evolve our Knowledge Type System from manual classification to learned categorization.
- **Implementation complexity:** Medium
- **Expected impact:** Medium

### C5. Mem-α: Learning Memory Construction via Reinforcement Learning

- **Paper:** Wang, Takanobu, Liang, Mao, Hu, McAuley, Wu (2025)
- **Link:** arXiv, Sep 2025
- **Venue:** arXiv preprint
- **Core idea:** Uses RL to learn what information to store in memory and how to organize it. The agent receives reward signals based on downstream task performance, learning to construct memories that maximize future utility. Instead of heuristic memory management, the system learns an optimal memory policy.
- **Relevance to Modular:** Could be used to **learn** optimal depth filtering policies. Instead of manually defining 5 depth levels, train an RL agent to learn what level of detail to include for different query types. The "memory construction policy" concept applies directly to our context assembly decisions.
- **Implementation complexity:** High
- **Expected impact:** High — moves from heuristic to learned optimization

### C6. TraceMem: Weaving Narrative Memory Schemata from Conversational Traces

- **Paper:** Shu, Liu, Zhang, Gao, Ma, Sun (2026)
- **Link:** arXiv, Feb 2026
- **Venue:** arXiv preprint
- **Core idea:** Extracts "narrative memory schemata" from conversation traces — recurring patterns, user preferences, and interaction scripts. Instead of storing individual facts, identifies templates and patterns that characterize a user's behavior and preferences.
- **Relevance to Modular:** Our Memory Pipeline extracts individual facts from conversations. TraceMem suggests we should also extract **patterns and schemata** — recurring themes, user preferences, common workflows. This is a higher-level memory type (procedural/schematic) that complements our fact-level storage.
- **Implementation complexity:** Medium
- **Expected impact:** Medium

### C7. Agent Drift: Quantifying Behavioral Degradation in Multi-Agent Systems

- **Paper:** (Jan 2026)
- **Link:** arXiv, Jan 2026
- **Venue:** arXiv preprint
- **Core idea:** Quantifies how agent behavior degrades over extended interactions — agents gradually lose adherence to their original instructions and develop "drift" in their behavior patterns. Proposes metrics for measuring drift and techniques for drift correction.
- **Relevance to Modular:** Directly relevant to our Framework Extraction pipeline. If agent behavior drifts from its guidelines over time, we need to periodically re-inject framework constraints. This paper provides metrics we could use to detect when an agent's context needs "refreshing" with its original persona/constraints.
- **Implementation complexity:** Low
- **Expected impact:** Medium

---

## D. Context Optimization

### D1. Lost in the Middle: How Language Models Use Long Contexts

- **Paper:** Liu, Lin, Hewitt, Paranjape, Bevilacqua, Petroni, Liang (2023)
- **Link:** https://arxiv.org/abs/2307.03172
- **Venue:** TACL 2023
- **Core idea:** Seminal finding that LLMs attend most to information at the **beginning and end** of the context window, with significant degradation for information in the middle. Performance follows a U-shaped curve with position. This "lost in the middle" effect persists even in models explicitly trained for long contexts.
- **Relevance to Modular:** **Critical for our context assembly.** When Modular renders context, high-priority information (ground-truth, system instructions) should be placed at the beginning or end of the prompt, never in the middle. This should inform our rendering order: system prompt → high-priority context → filler → important context → user query.
- **Implementation complexity:** Low (just reorder rendered output)
- **Expected impact:** High — easy win with immediate impact

### D2. Found in the Middle: Calibrating Positional Attention Bias

- **Paper:** Hsieh, Chuang, Li, Wang, Le, Kumar, Glass, Ratner, Lee, Krishna, Pfister (2024)
- **Link:** https://arxiv.org/abs/2406.xxxxx (Jun 2024)
- **Venue:** arXiv preprint (Google)
- **Core idea:** Goes beyond diagnosing the "lost in the middle" problem to actually **fixing** it. Proposes attention calibration techniques that reduce positional bias, allowing LLMs to attend more uniformly across positions. Involves scaling attention logits based on position to counteract learned positional biases.
- **Relevance to Modular:** If attention bias is being calibrated at the model level, our position-aware context placement strategy (D1) becomes less critical for newer models. But for current models, D1 remains essential. We should build adaptive placement that checks model capabilities.
- **Implementation complexity:** Low
- **Expected impact:** Medium

### D3. Positional Biases Shift as Inputs Approach Context Window Limits

- **Paper:** Veseli, Chibane, Toneva, Koller (2025)
- **Link:** arXiv, Aug 2025
- **Venue:** arXiv preprint
- **Core idea:** Discovers that positional bias patterns change as the input approaches the context window limit — the "sweet spots" for information placement shift depending on how full the context is. Near-full contexts show different attention patterns than half-full ones.
- **Relevance to Modular:** **Crucial refinement for our token budget optimization.** We can't just always put important info at the start/end — the optimal placement depends on total context length relative to the window. Modular should dynamically adjust placement strategy based on context fullness.
- **Implementation complexity:** Low
- **Expected impact:** High

### D4. Uncovering the Role of Initial Saliency in U-Shaped Attention Bias

- **Paper:** Qiang, Zhao, Wang, Qin, Liu (2025)
- **Link:** arXiv, Dec 2025
- **Venue:** arXiv preprint
- **Core idea:** Explains WHY the U-shaped attention bias exists — initial tokens receive disproportionate attention due to "initial saliency" effects in the softmax attention computation. Proposes scaling the initial token weight to mitigate this and improve long-text processing.
- **Relevance to Modular:** Mechanistic understanding of attention bias. If we're placing system prompts at the start (which receive outsized attention), this is actually beneficial for instruction following. But if we're placing context at the start, it may get "over-attended" relative to later context.
- **Implementation complexity:** Low (understanding, not implementation)
- **Expected impact:** Low (theoretical insight)

### D5. LOFT: Can Long-Context LMs Subsume Retrieval, RAG, SQL, and More?

- **Paper:** Lee, Chen, Dai, Dua, Sachan, Boratko et al. / Google DeepMind (2024)
- **Link:** https://arxiv.org/abs/2406.13121
- **Venue:** arXiv preprint
- **Core idea:** Evaluates whether stuffing everything into a long context window can replace retrieval/RAG. Finds that LCLMs can rival SOTA retrieval systems without explicit training, but struggle with compositional reasoning. Crucially: **prompting strategies significantly influence performance** — how you organize information in the context window matters as much as what you include.
- **Relevance to Modular:** Validates that context engineering (how you organize and present information) matters even when models have huge context windows. Even with 1M token windows, there's still value in structured context assembly — you can't just dump everything in.
- **Implementation complexity:** N/A (validation study)
- **Expected impact:** High (strategic validation of Modular's entire approach)

### D6. HELMET: How to Evaluate Long-Context Models Effectively and Thoroughly

- **Paper:** Yen et al. / Princeton NLP (2024)
- **Link:** https://arxiv.org/abs/2410.02694
- **Venue:** ICLR 2025
- **Core idea:** Comprehensive benchmark for LCLMs showing that (1) synthetic tasks like NIAH don't predict real performance, (2) different task categories show distinct trends, (3) open-source models lag behind closed ones for full-context reasoning. RAG tasks best predict downstream performance.
- **Relevance to Modular:** Provides evaluation methodology for our context engineering. We should benchmark Modular's context assembly against raw context stuffing using HELMET's task categories, particularly the full-context reasoning tasks where structured assembly should shine.
- **Implementation complexity:** Low (evaluation framework)
- **Expected impact:** Medium (testing, not feature)

### D7. Infini-attention: Efficient Infinite Context Transformers

- **Paper:** Munkhdalai et al. / Google (2024)
- **Link:** https://arxiv.org/abs/2404.07143
- **Venue:** arXiv preprint
- **Core idea:** Incorporates compressive memory directly into the attention mechanism. Combines masked local attention with long-term linear attention in a single Transformer block. Enables processing of infinitely long inputs with bounded memory. Tested on 1M-length sequences.
- **Relevance to Modular:** As models adopt compressive memory natively, Modular's role shifts from "fitting within context limits" to "optimizing what the model attends to." Even with infinite context, structured organization improves performance (see D5). But we should design for a future where context windows are less of a hard constraint.
- **Implementation complexity:** N/A (model architecture)
- **Expected impact:** Medium (strategic planning)

---

## E. Emerging Techniques (2024-2026)

### E1. Instructional Segment Embedding: Improving LLM Safety with Instruction Hierarchy

- **Paper:** Wu, Zhang, Song, Xu, Zhao, Agrawal, Indurthi, Xiang, Mittal, Zhou (2024)
- **Link:** arXiv, Oct 2024
- **Venue:** ICLR 2025
- **Core idea:** Introduces segment-level embeddings that differentiate between different types of instructions in the prompt — system prompts, user messages, tool outputs, etc. The model learns that system-level instructions have higher priority than user-level ones, creating an explicit **instruction hierarchy** within the context.
- **Relevance to Modular:** **Directly applicable to our Framework Extraction.** When we inject persona constraints, system guidelines, and user context into the prompt, we should leverage instruction hierarchy to ensure higher-priority information (ground-truth, system constraints) takes precedence. Our Knowledge Type System (ground-truth > signal > evidence > hypothesis) maps naturally to instruction priority levels.
- **Implementation complexity:** High (requires model-level support or careful prompt engineering to simulate)
- **Expected impact:** Medium

### E2. Tree of Agents: Multi-Perspective Reasoning for Long-Context

- **Paper:** Yu, Xu, Deng, Li, Tian (2025)
- **Link:** arXiv, Sep 2025
- **Venue:** arXiv preprint
- **Core idea:** Uses a tree of agents to decompose long-context tasks. Each agent handles a portion of the context, and agents are organized hierarchically — leaf agents process chunks, parent agents synthesize children's outputs, and the root agent produces the final answer. This tree structure mirrors document hierarchy and enables multi-perspective reasoning.
- **Relevance to Modular:** Suggests that for very large knowledge bases, we could use **hierarchical agents** — one agent per tree branch, with a coordinator agent synthesizing across branches. This is the multi-agent version of our current single-agent tree navigation.
- **Implementation complexity:** High
- **Expected impact:** Medium

### E3. ToM: Tree-oriented MapReduce for Long-Context Reasoning

- **Paper:** Guo, Li, Wu, Wang, Li, Zhang, Zhao, Yang (2025)
- **Link:** arXiv, Nov 2025
- **Venue:** arXiv preprint
- **Core idea:** Applies MapReduce paradigm to long-context reasoning using tree structure. The "Map" phase processes individual chunks in parallel; the "Reduce" phase aggregates results hierarchically through a tree. Overcomes LLM context window limits while maintaining reasoning quality.
- **Relevance to Modular:** For extremely large knowledge bases that exceed even our tree-indexed context budget, we could use tree-oriented MapReduce as a fallback: process each branch independently, then merge results. This extends our system's scalability.
- **Implementation complexity:** Medium
- **Expected impact:** Medium

### E4. Context Engineering as a Discipline

While not a single paper, several key voices have defined "context engineering" as a practice:

- **Andrej Karpathy** (2024-2025): Coined widespread use of "context engineering" — the art and science of filling the context window with the right information at the right time. Emphasized that prompt engineering is just a subset; true context engineering involves dynamic, multi-source assembly.
- **Shopify CEO Tobi Lütke** (2025): Called context engineering "the most important skill for working with AI" — stressed that the real leverage is in what goes INTO the prompt, not just how you phrase the question.
- **LangChain** (2025-2026): Published extensively on context engineering patterns, including dynamic context assembly, conversation memory management, and tool-result integration.

**Relevance to Modular:** This industry trend validates Modular's entire product thesis. The market is recognizing that context assembly is a distinct discipline requiring dedicated tooling. We're building the platform for this emerging practice.

---

## F. Cross-Cutting Insights & Recommendations

### F1. Highest-Priority Implementations

1. **Attention-Aware Rendering Order** (D1, D3) — Low complexity, high impact. Reorder Modular's rendered output to place high-priority content at prompt start/end. Adapt placement based on context fullness. **Implement this week.**

2. **LLMLingua-2 Integration** (A6) — Low complexity, high impact. Replace or supplement our filler removal with LLMLingua-2's token classification model. Pre-trained model available. **Implement this sprint.**

3. **FadeMem-style Decay** (C2) — Medium complexity, high impact. Add temporal decay + access frequency to our fact store's relevance scoring. Simple exponential decay function. **Implement this month.**

4. **Structured Event Memory** (C3) — Medium complexity, high impact. Extend fact extraction to extract structured events (who/what/when/where/why). Enables temporal queries. **Plan for next quarter.**

5. **Minimal Reasoning Subgraph** (B5) — Medium complexity, high impact. Given a query, compute the minimal tree branches needed rather than using fixed depth filtering. **Plan for next quarter.**

### F2. Key Architectural Insights

- **Tree indexing is validated** by RAPTOR, BookRAG, MoDora, and LLM-guided Hierarchical Retrieval. We're on the right track.
- **Knowledge Type System is unique** — no direct academic equivalent found. The closest is epistemic logic research, but nobody is classifying retrieved content by reliability type for LLM context assembly. This is a differentiator.
- **Depth Filtering should become adaptive** — use RL (Mem-α) or attention-aware heuristics rather than fixed 5-level system.
- **Memory Pipeline needs temporal/causal structure** — flat fact stores are being superseded by structured event memories.
- **Graph-based approaches complement tree approaches** — our document-structure tree + a cross-document entity graph would be very powerful.

### F3. What No One Else Is Doing

Based on this research, Modular's unique contributions that lack academic parallels:

1. **Knowledge Type System** — No one else classifies context by epistemic status (ground-truth vs hypothesis)
2. **Dynamic Tool Guides** — Context-aware tool documentation is under-researched
3. **Framework Extraction from AGENTS.md** — Parsing guidelines into persona/constraints/workflow is novel
4. **Combined tree-indexing + depth-filtering + knowledge-typing** — The full pipeline is unique

These are potential areas for our own research publications or patent filings.

---

## References (Alphabetical)

1. Besta et al. "Multi-Head RAG: Solving Multi-Aspect Problems with LLMs" (2024) arXiv:2406.05085
2. Chen et al. "Beyond Chunking: Discourse-Aware Hierarchical Retrieval" (2025) arXiv
3. Edge et al. "From Local to Global: A Graph RAG Approach to Query-Focused Summarization" (2024) arXiv:2404.16130
4. Gupta et al. "LLM-guided Hierarchical Retrieval" (2025) arXiv
5. Hsieh et al. "Found in the Middle: Calibrating Positional Attention Bias" (2024) arXiv
6. Jiang et al. "LongLLMLingua: Accelerating and Enhancing LLMs in Long Context Scenarios" (2023) arXiv:2310.06839, ACL 2024
7. Lee et al. "LOFT: Can Long-Context Language Models Subsume Retrieval, RAG, SQL, and More?" (2024) arXiv:2406.13121
8. Li. "Selective Context: Self-Information-Based Content Filtering" (2023) arXiv:2304.12102
9. Liang et al. "Knowledge Augmented Generation (KAG)" (2024) arXiv:2409.13731
10. Liu et al. "Lost in the Middle: How Language Models Use Long Contexts" (2023) arXiv:2307.03172, TACL 2023
11. Lu et al. "Structured Episodic Event Memory" (2026) arXiv
12. Munkhdalai et al. "Infini-attention: Efficient Infinite Context Transformers" (2024) arXiv:2404.07143
13. Nan et al. "Nemori: Self-Organizing Agent Memory" (2025) arXiv
14. Packer et al. "MemGPT: Towards LLMs as Operating Systems" (2023) arXiv:2310.08560
15. Pan et al. "LLMLingua-2: Data Distillation for Efficient Task-Agnostic Prompt Compression" (2024) arXiv:2403.12968, ACL 2024
16. Sarthi et al. "RAPTOR: Recursive Abstractive Processing for Tree-Organized Retrieval" (2024) arXiv:2401.18059, ICLR 2024
17. Shu et al. "TraceMem: Weaving Narrative Memory Schemata" (2026) arXiv
18. Veseli et al. "Positional Biases Shift as Inputs Approach Context Window Limits" (2025) arXiv
19. Wang et al. "Mem-α: Learning Memory Construction via Reinforcement Learning" (2025) arXiv
20. Wang et al. "Pruning Minimal Reasoning Graphs for Efficient RAG" (2026) arXiv
21. Wei et al. "FadeMem: Biologically-Inspired Forgetting for Efficient Agent Memory" (2026) arXiv:2601.18642
22. Wu et al. "Instructional Segment Embedding: Instruction Hierarchy" (2024) arXiv, ICLR 2025
23. Xu et al. "MoDora: Tree-Based Semi-Structured Document Analysis" (2026) arXiv
24. Yen et al. "HELMET: How to Evaluate Long-Context Models Effectively" (2024) arXiv:2410.02694, ICLR 2025
25. Gong. "Structured Prompt Language (SPL)" (2026) arXiv
26. Guo et al. "ToM: Tree-oriented MapReduce for Long-Context Reasoning" (2025) arXiv
27. Yu et al. "Tree of Agents: Multi-Perspective Reasoning" (2025) arXiv
28. Huang et al. "HELP: HyperNode Expansion and Logical Path-Guided Evidence Localization" (2026) arXiv
29. Qiang et al. "Uncovering the Role of Initial Saliency in U-Shaped Attention Bias" (2025) arXiv
