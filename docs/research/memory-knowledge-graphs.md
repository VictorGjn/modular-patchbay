# State-of-the-Art: Agent Memory Systems, Knowledge Graphs & Epistemic Reasoning

**Research Date:** 2026-03-09  
**Scope:** PhD-level survey of memory architectures for LLM-based agents  
**Purpose:** Inform Modular v2 memory pipeline design

---

## Table of Contents

1. [Agent Memory Architectures](#1-agent-memory-architectures)
2. [Knowledge Graph + LLM Integration](#2-knowledge-graph--llm-integration)
3. [Epistemic Reasoning & Knowledge Classification](#3-epistemic-reasoning--knowledge-classification)
4. [Memory Consolidation & Forgetting](#4-memory-consolidation--forgetting)
5. [Cross-Session Learning](#5-cross-session-learning)
6. [Memory Architecture Proposal for Modular v2](#memory-architecture-proposal-for-modular-v2)

---

## 1. Agent Memory Architectures

### 1.1 MemGPT / Letta — Virtual Context Management

**Paper:** "MemGPT: Towards LLMs as Operating Systems"  
**Authors:** Charles Packer, Vivian Fang, Shishir G. Patil, Kevin Lin, Sarah Wooders, Joseph E. Gonzalez  
**Year:** 2023 (arXiv:2310.08560)  
**Link:** https://arxiv.org/abs/2310.08560

**Core Contribution:** Treats the LLM's limited context window like virtual memory in an OS. Just as operating systems page data between RAM and disk to give the illusion of unlimited memory, MemGPT pages information between a "main context" (the LLM's active prompt) and "external context" (a database or file store).

**How It Works:**
- **Hierarchical Memory Tiers:**
  - **Main Context (Working Memory):** The current LLM prompt — fast, limited capacity
  - **External Context (Archival Storage):** Persistent database — unlimited capacity, higher latency
  - **Recall Storage:** Searchable conversation history
- **Self-Directed Memory Management:** The LLM itself decides when to:
  - `core_memory_append` / `core_memory_replace` — modify its own system prompt
  - `archival_memory_insert` / `archival_memory_search` — store/retrieve from long-term
  - `conversation_search` — search past conversation history
- **Interrupt System:** Borrowed from OS design. The agent yields control and can be "interrupted" by user input, heartbeat events, or timer-based triggers
- **Function Calling as Syscalls:** Memory operations are exposed as function calls, making the LLM an "operating system" managing its own memory

**Modular Integration:**
- **Immediate:** Adopt the tiered memory concept. Current Modular fact storage maps to "archival storage." Add a "working memory" tier that represents the agent's current session context — a mutable scratchpad the LLM can edit within its own prompt.
- **Key insight:** Let the LLM decide what to remember, not just extract facts post-hoc. Give agents `remember(fact)` and `forget(fact)` tool calls.
- **Complexity:** Medium
- **Impact:** High

---

### 1.2 Mem0 — Production Memory Layer for AI Agents

**Paper:** "Mem0: Building Production-Ready AI Agents with Scalable Long-Term Memory"  
**Authors:** Mem0.ai team (Taranjeet Singh et al.)  
**Year:** 2025 (arXiv:2504.19413)  
**Link:** https://arxiv.org/abs/2504.19413

**Core Contribution:** A production-grade memory service that dynamically extracts, consolidates, and retrieves salient information from conversations. Introduces graph-based memory representations for capturing relational structures. Achieves 26% improvement over OpenAI's memory on LLM-as-Judge metric, with 91% lower p95 latency and 90%+ token savings vs full-context approaches.

**How It Works:**
- **Memory Layers:**
  - **Conversation Memory:** In-flight messages in current turn
  - **Session Memory:** Short-lived facts for current task/channel
  - **User Memory:** Long-lived knowledge tied to a person
  - **Organizational Memory:** Shared context across agents/teams
- **Capture → Promote → Retrieve Pipeline:**
  1. Messages enter conversation layer during active turn
  2. Relevant details promoted to session or user memory based on metadata
  3. Search pipeline pulls from all layers, ranking user memories first
- **Graph Memory (Enhanced Variant):**
  - Captures complex relational structures between conversational elements
  - ~2% higher overall score than base vector-only config
  - Enables multi-hop reasoning across memory items
- **Conflict Resolution:** LLM-based deduplication and update logic — new facts supersede old contradictory ones
- **Benchmarks:** Tested on LOCOMO across single-hop, temporal, multi-hop, and open-domain questions

**Modular Integration:**
- **Adopt the layered memory model.** Current per-domain fact storage is too flat. Add session-scoped, user-scoped, and agent-scoped layers.
- **Graph memory is the upgrade path.** Start with vector similarity (cheap), add graph relationships as complexity grows.
- **The "promote" concept is key** — not all conversation details deserve long-term storage. Use LLM judgment to decide promotion.
- **Complexity:** Medium
- **Impact:** High

---

### 1.3 Generative Agents — Memory Stream, Reflection, Planning

**Paper:** "Generative Agents: Interactive Simulacra of Human Behavior"  
**Authors:** Joon Sung Park, Joseph C. O'Brien, Carrie J. Cai, Meredith Ringel Morris, Percy Liang, Michael S. Bernstein  
**Year:** 2023 (arXiv:2304.03442)  
**Link:** https://arxiv.org/abs/2304.03442

**Core Contribution:** The seminal paper on agent memory. Introduced a three-part cognitive architecture: **observation → reflection → planning**. Agents in a Sims-like world autonomously spread party invitations, formed relationships, and coordinated schedules — all from a single seed prompt.

**How It Works:**
- **Memory Stream:** A comprehensive timestamped log of all observations (what the agent saw, heard, did). Each entry has:
  - Natural language description
  - Creation timestamp
  - Last access timestamp
  - Importance score (1-10, rated by LLM)
- **Retrieval Function:** Scores memories by three factors:
  - **Recency** (exponential decay on last access time)
  - **Importance** (LLM-rated significance, 1-10)
  - **Relevance** (embedding cosine similarity to current query)
  - Final score = α·recency + β·importance + γ·relevance
- **Reflection:** Periodically, when accumulated importance exceeds a threshold, the agent generates higher-order "reflections" — abstract insights synthesized from multiple memories:
  - "I notice I've been spending a lot of time at the café" → reflection
  - Reflections become new memory entries that can themselves be reflected upon
  - Creates a **hierarchy of abstraction** over time
- **Planning:** Long-range plans decomposed into hourly schedules, adjusted reactively based on observations

**Modular Integration:**
- **The reflection mechanism is the single most important technique to adopt.** Current fact extraction is observation-level only. Adding periodic reflection — "what patterns do I see across these facts?" — would create emergent higher-order knowledge.
- **Importance scoring is cheap and powerful.** Have the LLM rate each extracted fact 1-10. Use this for prioritized recall and forgetting.
- **The three-factor retrieval formula** (recency × importance × relevance) should replace simple text matching.
- **Complexity:** Medium
- **Impact:** Very High

---

### 1.4 Voyager — Skill Library and Lifelong Learning

**Paper:** "Voyager: An Open-Ended Embodied Lifelong Learning Agent in Minecraft"  
**Authors:** Guanzhi Wang, Yuqi Xie, Yunfan Jiang, Ajay Mandlekar, Chaowei Xiao, Yuke Zhu, Linxi Fan, Anima Anandkumar  
**Year:** 2023 (arXiv:2305.16291)  
**Link:** https://arxiv.org/abs/2305.16291

**Core Contribution:** First LLM-powered agent that continuously learns new skills in Minecraft. Key innovation: a **skill library** — reusable code programs that compound the agent's abilities and prevent catastrophic forgetting. Obtained 3.3x more unique items and unlocked milestones 15.3x faster than prior SOTA.

**How It Works:**
- **Three Components:**
  1. **Automatic Curriculum:** LLM proposes progressively harder tasks based on current capabilities
  2. **Skill Library:** A growing collection of executable JavaScript programs
     - Each skill has: name, description, code, and embedding
     - Skills are retrieved by embedding similarity when facing new tasks
     - Skills are **compositional** — complex skills call simpler ones
     - Skills are **verified** — only added after successful execution + self-verification
  3. **Iterative Prompting:** Environment feedback → execution errors → self-verification → refinement loop
- **No Weight Updates:** Everything through in-context learning with GPT-4 blackbox queries
- **Transfer:** Skill library transfers to new Minecraft worlds — prior skills generalize

**Modular Integration:**
- **The skill library pattern maps directly to agent capabilities.** Instead of storing just facts, store *proven procedures*: "when user asks X, do Y" as verified patterns.
- **Compositional skills** — higher-order procedures built from primitives — maps to building complex multi-step agent behaviors from simpler tool calls.
- **Verification before storage** — only persist skills that actually worked.
- **Complexity:** Medium
- **Impact:** High (for agentic behavior, not just memory)

---

### 1.5 RAISE — Dual-Component Memory for Conversational Agents

**Paper:** "RAISE: Reasoning and Acting through Scratchpad and Examples"  
**Authors:** Liangyu Chen et al.  
**Year:** 2024 (arXiv:2401.02777)  
**Link:** https://arxiv.org/abs/2401.02777

**Core Contribution:** Enhances the ReAct framework with a dual-component memory system mirroring human short-term and long-term memory, plus a comprehensive agent construction pipeline (Conversation Selection → Scene Extraction → CoT Completion → Scene Augmentation → Training).

**How It Works:**
- **Short-Term Memory (Scratchpad):** Active working context for current conversation turn — recent messages, tool outputs, intermediate reasoning
- **Long-Term Memory (Examples):** A library of curated conversation-action pairs retrieved for few-shot prompting
- **Construction Pipeline:** Automatically builds training data from real conversations:
  1. Select representative conversations
  2. Extract key "scenes" (decision points)
  3. Complete chain-of-thought reasoning for each scene
  4. Augment with variations
  5. Fine-tune the base LLM

**Modular Integration:**
- **Scratchpad concept** maps well to per-session working memory. Agents should have a mutable scratchpad cleared between sessions but available during.
- **The scene extraction pipeline** is interesting for building agent training data from real conversations.
- **Complexity:** Medium
- **Impact:** Medium

---

### 1.6 Reflexion — Self-Reflection and Episodic Memory

**Paper:** "Reflexion: Language Agents with Verbal Reinforcement Learning"  
**Authors:** Noah Shinn, Federico Cassano, Ashwin Gopinath, Karthik R. Narasimhan, Shunyu Yao  
**Year:** 2023 (arXiv:2303.11366)  
**Link:** https://arxiv.org/abs/2303.11366

**Core Contribution:** Reinforcement learning for LLMs without weight updates. Instead of gradient-based learning, agents write verbal self-reflections after failures and store them in an episodic memory buffer. Achieved 91% pass@1 on HumanEval (vs GPT-4's 80% at the time).

**How It Works:**
- **Trial Loop:**
  1. Agent attempts task
  2. Receives feedback (success/failure + details)
  3. Generates verbal self-reflection: "I failed because X. Next time I should Y."
  4. Reflection stored in episodic memory buffer
  5. On next attempt, past reflections included in prompt
- **Memory Buffer:** Sliding window of recent reflections (typically last 3)
- **Key Insight:** Linguistic feedback is more informative than scalar rewards. The agent can express *why* it failed and *what to do differently*.

**Modular Integration:**
- **Self-reflection after errors is directly applicable.** When an agent action fails, generate a reflection and store it. Next time similar context appears, retrieve the reflection.
- **This is the mechanism for agents to *learn from mistakes* across sessions.**
- **Lightweight to implement** — just another type of memory entry with a "reflection" tag.
- **Complexity:** Low
- **Impact:** High

---

### 1.7 MemoryBank — Ebbinghaus Forgetting Curve

**Paper:** "MemoryBank: Enhancing Large Language Models with Long-Term Memory"  
**Authors:** Wanjun Zhong, Lianghong Guo, Qiqi Gao, He Ye, Yanlin Wang  
**Year:** 2023 (arXiv:2305.10250)  
**Link:** https://arxiv.org/abs/2305.10250

**Core Contribution:** Applies the Ebbinghaus forgetting curve to AI memory — memories decay over time but are reinforced when accessed. The system selectively forgets unimportant memories while strengthening frequently-accessed ones, mimicking human memory consolidation.

**How It Works:**
- **Memory Storage:** Each memory has:
  - Content (natural language)
  - Timestamp of creation
  - Last access timestamp
  - Access count
  - Importance score
- **Forgetting Curve:** Memory strength = importance × e^(-λt/access_count)
  - λ = forgetting rate constant
  - t = time since last access
  - access_count = reinforcement factor
- **Memory Update Cycle:**
  1. After each conversation, extract key information
  2. Update existing memories (reinforce if re-accessed)
  3. Decay all memories based on elapsed time
  4. Prune memories below strength threshold
- **User Modeling:** Synthesizes personality profiles from accumulated memories

**Modular Integration:**
- **The forgetting curve is essential for production systems.** Without it, memory grows unboundedly.
- **Add `strength` field to every fact:** strength = importance × decay_factor(time_since_last_access, access_count)
- **Periodic pruning:** In maintenance cycles, remove facts below threshold.
- **Reinforcement on access:** When a fact is retrieved and used, bump its strength.
- **Complexity:** Low
- **Impact:** High

---

### 1.8 Zep / Graphiti — Temporal Knowledge Graphs for Agent Memory

**Paper:** "Zep: A Temporal Knowledge Graph Architecture for Agent Memory"  
**Authors:** Preston Rasmussen et al.  
**Year:** 2025 (arXiv:2501.13956)  
**Link:** https://arxiv.org/abs/2501.13956

**Core Contribution:** Outperforms MemGPT on the Deep Memory Retrieval benchmark (94.8% vs 93.4%). Key innovation: **Graphiti**, a temporally-aware knowledge graph engine that dynamically synthesizes both unstructured conversational data and structured business data while maintaining historical relationships. Achieves 18.5% accuracy improvement on LongMemEval with 90% latency reduction.

**How It Works:**
- **Graphiti Engine:**
  - Dynamically builds a temporal knowledge graph from conversations
  - Entities become nodes, relationships become edges
  - Every edge has temporal metadata: when it was established, modified, or invalidated
  - Supports both unstructured (conversations) and structured (business data) ingestion
- **Temporal Reasoning:**
  - Can answer "What did user prefer last month vs now?"
  - Tracks relationship evolution over time
  - Handles contradictions by maintaining temporal validity windows
- **Hybrid Retrieval:**
  - Graph traversal for relational queries
  - Vector similarity for semantic queries
  - Combined ranking for final results
- **Benchmarks:** Superior on enterprise-critical tasks: cross-session synthesis, long-term context maintenance

**Modular Integration:**
- **This is the most production-proven graph memory approach.** Graphiti's temporal awareness solves the "stale facts" problem.
- **Every fact should have valid_from/valid_until timestamps.** Contradictions resolved by temporal ordering.
- **Graph relationships between facts** enable multi-hop reasoning: "Victor → works_at → Syroco → builds → speed_sailing_boats"
- **Complexity:** High
- **Impact:** Very High

---

### 1.9 Infini-Attention — Compressive Memory in Transformers

**Paper:** "Leave No Context Behind: Efficient Infinite Context Transformers with Infini-attention"  
**Authors:** Tsendsuren Munkhdalai, Manaal Faruqui, Siddharth Gopal  
**Year:** 2024 (arXiv:2404.07143)  
**Link:** https://arxiv.org/abs/2404.07143

**Core Contribution:** Architectural-level solution: adds a compressive memory module directly into the attention mechanism. Each attention block maintains both local (standard) attention and long-term linear attention. Handles 1M+ token sequences with bounded memory.

**How It Works:**
- **Dual Attention:** Each transformer block has:
  - Standard masked attention for local context
  - Compressive memory (linear attention) for long-range context
  - Learned gating to blend both signals
- **Memory Update:** As tokens flow through, the compressive memory accumulates a compressed representation of all past tokens
- **Bounded Memory:** Memory size is fixed regardless of sequence length

**Modular Integration:**
- **Not directly applicable to Modular** (requires model architecture changes), but the *concept* of compressive memory is important.
- **Lesson:** Long context is not free. Even at the model level, the solution is compression and selective retention — validating our need for fact extraction + summarization at the application layer.
- **Complexity:** N/A (model-level)
- **Impact:** Conceptual

---

## 2. Knowledge Graph + LLM Integration

### 2.1 GraphRAG — Community Detection + Summarization

**Paper:** "From Local to Global: A Graph RAG Approach to Query-Focused Summarization"  
**Authors:** Darren Edge, Ha Trinh, Newman Cheng, Joshua Bradley, Alex Chao, Apurva Mody, Steven Truitt, Jonathan Larson (Microsoft Research)  
**Year:** 2024 (arXiv:2404.16130)  
**Link:** https://arxiv.org/abs/2404.16130

**Core Contribution:** Solves the "global question" problem that standard RAG fails at. Instead of retrieving individual chunks, builds an entity knowledge graph with community detection, then generates community-level summaries. Enables questions like "What are the main themes?" over million-token corpora.

**How It Works:**
- **Two-Stage Indexing:**
  1. **Entity Extraction:** LLM extracts entities and relationships from source documents → knowledge graph
  2. **Community Detection:** Leiden algorithm groups closely-related entities into communities at multiple hierarchical levels
  3. **Community Summarization:** LLM generates natural language summaries for each community
- **Query Processing:**
  1. Map question to relevant communities
  2. Each community summary generates a partial response
  3. All partial responses aggregated into final answer
- **Hierarchical:** Communities at different granularity levels answer different types of questions

**Modular Integration:**
- **Community detection over accumulated facts** would enable emergent topic clustering. As an agent accumulates hundreds of facts, automatically group them into "communities" (topics, themes, domains).
- **Community summaries become navigable high-level knowledge.** Instead of searching through 1000 facts, first identify relevant communities, then drill into specific facts.
- **This maps directly to tree-indexed markdown with graph enhancement:** markdown sections ≈ communities, cross-references ≈ graph edges.
- **Complexity:** Medium-High
- **Impact:** High

---

### 2.2 Think-on-Graph (ToG) — Interactive KG Reasoning

**Paper:** "Think-on-Graph: Deep and Responsible Reasoning of Large Language Model on Knowledge Graph"  
**Authors:** Jiashuo Sun et al.  
**Year:** 2023, accepted ICLR 2024 (arXiv:2307.07697)  
**Link:** https://arxiv.org/abs/2307.07697

**Core Contribution:** LLM as an agent that interactively explores a knowledge graph via beam search. Iteratively discovers reasoning paths, achieving SOTA on 6/9 benchmarks without any training. Small LLMs with ToG can exceed GPT-4 alone.

**How It Works:**
- **Iterative Beam Search on KG:**
  1. Given question, identify starting entities
  2. LLM evaluates neighboring relations and entities (beam search)
  3. Select most promising paths
  4. Continue exploration until answer found or depth limit reached
- **Key Properties:**
  - **Knowledge Traceability:** Every answer has a traceable path through the KG
  - **Knowledge Correctability:** Experts can correct graph edges, improving future answers
  - **Plug-and-Play:** Works with any LLM and any KG

**Modular Integration:**
- **For Modular's fact store: enable graph traversal.** When recalling facts, don't just vector-search — also traverse related facts (facts about the same entity, linked domains, etc.)
- **The traceability property is valuable:** every recalled fact should cite its source/origin.
- **Complexity:** Medium
- **Impact:** Medium

---

### 2.3 KAPING — Knowledge Graph Augmented Prompting

**Paper:** "Knowledge-Augmented Language Model Prompting for Zero-Shot Knowledge Graph Question Answering"  
**Authors:** Jinheon Baek, Alham Fikri Aji, Amir Saffari  
**Year:** 2023 (arXiv:2306.04136)  
**Link:** https://arxiv.org/abs/2306.04136

**Core Contribution:** Simplest possible KG+LLM integration: retrieve relevant KG facts by semantic similarity to the question, prepend them to the prompt. Zero-shot, no training. Up to 48% improvement over baselines.

**How It Works:**
1. Embed the user question
2. Retrieve top-k semantically similar KG triples (subject, predicate, object)
3. Format triples as natural language
4. Prepend to the LLM prompt
5. Generate answer

**Modular Integration:**
- **This is essentially what Modular already does** with fact recall — retrieve relevant facts, inject into prompt.
- **Enhancement:** Structure facts as triples (entity → relationship → value) rather than flat key-value pairs. This enables graph operations later while remaining backward-compatible.
- **Complexity:** Low
- **Impact:** Medium (already partially implemented)

---

### 2.4 Reasoning on Graphs (RoG) — Plan-Retrieve-Reason

**Paper:** "Reasoning on Graphs: Faithful and Interpretable Large Language Model Reasoning"  
**Authors:** Linhao Luo et al.  
**Year:** 2023, accepted ICLR 2024 (arXiv:2310.01061)  
**Link:** https://arxiv.org/abs/2310.01061

**Core Contribution:** Three-phase framework: (1) generate relation path plans grounded by KG structure, (2) retrieve valid reasoning paths from KG, (3) LLM reasons over retrieved paths. Achieves faithful, interpretable reasoning with SOTA on KGQA benchmarks.

**How It Works:**
- **Planning:** LLM generates candidate relation paths (e.g., "person → works_at → company → located_in → ?")
- **Retrieval:** Paths validated against actual KG structure — only real paths kept
- **Reasoning:** LLM reasons over valid paths to generate answer
- **Distillation:** Can train smaller models to do the planning step

**Modular Integration:**
- **Useful when fact relationships become complex.** For simple fact recall, KAPING suffices. For multi-hop questions ("Where does Victor's company build boats?"), this structured path approach is superior.
- **Complexity:** High
- **Impact:** Medium (only needed at scale)

---

### 2.5 Enhancing Tree-Indexed Markdown with Graph Relationships

Current Modular approach uses tree-structured markdown files for knowledge organization. Here's how to enhance it:

**Current State (Tree):**
```
domain/
  topic-a/
    facts.md
  topic-b/
    facts.md
```

**Enhanced State (Tree + Graph):**
```
domain/
  topic-a/
    facts.md          # Individual facts with embeddings
    relations.md      # Links to related topics/facts
  topic-b/
    facts.md
  _graph.json         # Explicit relationship index
  _communities.json   # Auto-detected topic clusters
```

**Key Enhancements:**
1. **Cross-references between facts:** Each fact can link to related facts in other domains
2. **Entity index:** A reverse index from entities to all facts mentioning them
3. **Community detection:** Periodically cluster related facts across domains
4. **Temporal ordering:** Facts ordered by creation/validity timestamps

This preserves the human-readable markdown format while adding graph capabilities through index files.

---

## 3. Epistemic Reasoning & Knowledge Classification

### 3.1 Epistemic Markers and Certainty Detection

**Research Area:** Computational linguistics has extensive work on detecting epistemic markers — linguistic cues indicating the speaker's certainty level.

**Key Markers:**
- **High certainty:** "definitely," "certainly," "I know," "it is," "always"
- **Medium certainty:** "probably," "likely," "I think," "usually," "tends to"
- **Low certainty:** "maybe," "possibly," "I'm not sure," "might," "sometimes"
- **Hedging:** "sort of," "kind of," "arguably," "in some sense"
- **Evidential markers:** "I heard," "reportedly," "according to," "studies show"

**Automatic Detection Approaches:**
- Rule-based: Match against hedge word lists (cheapest, surprisingly effective)
- LLM-based: Ask the LLM to classify certainty level when extracting facts
- Hybrid: Rules for common patterns, LLM for ambiguous cases

**Modular Integration:**
- When extracting facts from conversations, detect epistemic markers to auto-classify certainty
- User says "I think Victor prefers dark mode" → certainty: medium, type: signal
- User says "Victor's timezone is Europe/Paris" → certainty: high, type: ground-truth
- **Complexity:** Low
- **Impact:** High

---

### 3.2 Mapping to Modular's Knowledge Type System

Current system: `ground-truth | signal | evidence | framework | hypothesis`

**Proposed Enhanced Classification:**

| Type | Certainty | Source | Persistence | Example |
|------|-----------|--------|-------------|---------|
| **ground-truth** | >0.95 | Direct observation, explicit statement | Permanent until contradicted | "User's name is Victor" |
| **signal** | 0.7-0.95 | Inferred from behavior, patterns | Decays slowly | "User prefers morning meetings" |
| **evidence** | 0.5-0.7 | Supporting data, correlations | Decays moderately | "User mentioned React 3 times" |
| **framework** | N/A (structural) | Synthesized understanding | Updated on reflection | "User is a PM who builds side projects" |
| **hypothesis** | 0.3-0.5 | Speculation, weak signals | Decays quickly | "User might be interested in sailing" |
| **reflection** | Varies | Agent self-generated | Updated on new reflections | "I notice Victor asks about X when Y" |

**Enhancement: Add numeric confidence scores** alongside categorical types. This enables:
- Threshold-based recall (only inject facts above X confidence)
- Bayesian updating (new evidence strengthens/weakens existing facts)
- Sorted display (most confident facts first)

---

### 3.3 Bayesian Knowledge Updates

**Approach:** Treat fact confidence as a probability that can be updated with new evidence.

```
P(fact | new_evidence) = P(new_evidence | fact) × P(fact) / P(new_evidence)
```

**Simplified for Modular:**
- Each fact has a `confidence: 0.0-1.0` score
- Corroborating evidence: `confidence = min(1.0, confidence + 0.1)`
- Contradicting evidence: `confidence = max(0.0, confidence - 0.2)` (contradictions weighted heavier)
- Time decay: `confidence *= decay_rate^(days_since_last_access)`
- Explicit confirmation: `confidence = 0.95`

**Source Credibility Weighting:**
- Direct user statement: weight = 1.0
- Inferred from behavior: weight = 0.7
- Second-hand information: weight = 0.5
- Speculation: weight = 0.3

`effective_confidence = base_confidence × source_weight`

**Complexity:** Low  
**Impact:** Medium-High

---

### 3.4 Epistemic Reasoning in Practice

**Key Papers:**
- De Marneffe et al. (2012) — "Did it happen? The pragmatic complexity of veridicality assessment" — establishing factuality of events from text
- Saurí & Pustejovsky (2009) — "FactBank" — annotated corpus of event factuality
- Rubin (2010) — "Epistemic modality: From uncertainty to certainty in the context of information seeking" — certainty classification framework

**Practical Recommendations for Modular:**
1. **At extraction time:** Classify each fact with an epistemic type + confidence score
2. **At recall time:** Surface confidence to the agent ("I'm 80% sure Victor prefers dark mode")
3. **At contradiction time:** Don't just overwrite — record the contradiction, adjust confidences
4. **At reflection time:** Review low-confidence facts, seek confirmation or discard

---

## 4. Memory Consolidation & Forgetting

### 4.1 Ebbinghaus Forgetting Curve — Applied to AI

**Original Research:** Hermann Ebbinghaus, 1885  
**AI Application:** MemoryBank (2023), various cognitive architectures

**The Curve:**
```
R(t) = e^(-t/S)
```
Where R = retention, t = time since last review, S = memory strength

**For AI Agents:**
- **S (memory strength)** is a function of:
  - Importance score (LLM-rated)
  - Access count (how often retrieved)
  - Recency of last access
  - Emotional/contextual salience

**Implementation:**
```python
def memory_strength(fact):
    base_importance = fact.importance  # 0.0-1.0
    time_decay = exp(-days_since_access / (30 * access_count))
    return base_importance * time_decay

# Prune facts where strength < 0.1
# Reinforce: on access, reset days_since_access, increment access_count
```

**Complexity:** Low  
**Impact:** High (prevents unbounded growth)

---

### 4.2 Sleep-Like Consolidation

**Inspired by:** Neuroscience research on memory consolidation during sleep (Diekelmann & Born, 2010)

**Key Insight:** The brain doesn't just passively decay memories. During sleep, it actively:
1. **Replays** important experiences
2. **Integrates** new memories with existing knowledge
3. **Abstracts** patterns from specific episodes
4. **Prunes** redundant or unimportant details

**For AI Agents — "Sleep Cycle" / Consolidation Job:**
1. **Replay:** Review recent session transcripts
2. **Extract:** Pull out new facts, skills, patterns
3. **Integrate:** Check against existing knowledge — update, merge, or conflict
4. **Abstract:** Generate reflections from accumulated evidence
5. **Prune:** Remove facts below strength threshold, merge duplicates

**When to Run:** Heartbeat cycles, end-of-day cron, or after N sessions

**Modular Integration:**
- **This is the consolidation pipeline.** Run periodically (daily or on heartbeat) to:
  - Merge duplicate facts
  - Generate reflections from accumulated signals
  - Promote frequent signals to ground-truth
  - Decay and prune weak facts
  - Update community summaries
- **Complexity:** Medium
- **Impact:** Very High

---

### 4.3 Hierarchical Memory — Cache Architecture

**Inspired by:** CPU memory hierarchy (L1/L2/L3 cache + RAM + disk)

| Tier | AI Equivalent | Capacity | Speed | Persistence |
|------|--------------|----------|-------|-------------|
| L1 Cache | System prompt / working memory | ~4K tokens | Instant | Session only |
| L2 Cache | Recent facts (hot) | ~100 facts | Fast retrieval | Days-weeks |
| L3 Cache | All facts (warm) | ~10K facts | Indexed search | Months |
| RAM | Archival storage | Unlimited | Slower search | Permanent |
| Disk | Raw conversation logs | Unlimited | Batch scan only | Permanent |

**Key Principles:**
- **Promotion:** Frequently accessed facts move to hotter tiers
- **Demotion:** Rarely accessed facts sink to colder tiers
- **Prefetching:** At session start, anticipate needed facts and pre-load to L1/L2
- **Write-back:** Changes in L1 propagate to colder tiers during consolidation

**Modular Integration:**
- **Tier 1 (Working Memory):** Agent's current prompt context — most relevant facts pre-loaded
- **Tier 2 (Hot Facts):** Recently accessed, high-importance facts — retrieved on demand via fast lookup
- **Tier 3 (Warm Facts):** All facts — retrieved via embedding search
- **Tier 4 (Cold Storage):** Raw conversation transcripts — only accessed during consolidation
- **Complexity:** Medium
- **Impact:** High

---

### 4.4 Importance-Weighted Forgetting

**Key Question:** What should an agent forget?

**Never Forget:**
- User identity and core preferences
- Explicitly stated instructions
- Safety-critical information
- Corrected mistakes (to avoid repeating them)

**Gradually Forget:**
- Contextual details ("user was in a hurry today")
- Temporary preferences ("use shorter responses for now")
- Ambient observations ("user mentioned rain")

**Actively Prune:**
- Superseded information (old preferences replaced by new ones)
- Redundant facts (duplicates or near-duplicates)
- Low-confidence hypotheses that were never confirmed

**Implementation:**
```python
def should_forget(fact, current_time):
    if fact.type == 'ground-truth' and fact.confidence > 0.9:
        return False  # Never forget confirmed ground truth
    if fact.is_correction:
        return False  # Never forget learned mistakes
    strength = memory_strength(fact, current_time)
    return strength < FORGET_THRESHOLD
```

---

## 5. Cross-Session Learning

### 5.1 Skill Extraction vs Fact Extraction

**Two fundamentally different types of cross-session knowledge:**

| Aspect | Fact Extraction | Skill Extraction |
|--------|----------------|------------------|
| **What** | "Victor prefers dark mode" | "When user asks for a summary, use bullet points" |
| **Format** | Entity-attribute-value triple | Condition → action pattern |
| **Storage** | Knowledge graph / fact store | Skill library / procedure store |
| **Retrieval** | By entity or semantic similarity | By situation matching |
| **Update** | Overwrite with newer fact | Refine based on feedback |
| **Example** | ground-truth, signal, evidence | framework, reflection |

**Modular should extract both:**
1. **Facts:** What is true about the world, the user, the domain
2. **Skills:** What works well, what to avoid, how to handle situations

---

### 5.2 Pattern Recognition Across Conversations

**Approach: Periodic Pattern Mining**

After N sessions, run a reflection pass:
1. **Aggregate** all recent facts and observations
2. **Cluster** by topic (simple: by domain; advanced: by embedding similarity)
3. **Summarize** each cluster: "What patterns do I see?"
4. **Extract skills:** "What approaches worked/failed repeatedly?"
5. **Store** as reflection-type entries

**Example Output:**
```markdown
## Reflection: 2025-03-09

### Pattern: Victor's Project Communication
Over the last 2 weeks, Victor has asked 5 times about formatting
messages for the ORGA WhatsApp group. He prefers:
- French language always
- Casual but informative tone
- Bullet points over paragraphs
- Include dates and deadlines prominently

### Skill Extracted:
When composing messages for ORGA group:
1. Write in French
2. Use bullet format
3. Lead with dates/deadlines
4. Keep under 500 characters
```

---

### 5.3 Progressive Knowledge Refinement

**The Knowledge Maturity Lifecycle:**

```
observation → hypothesis → signal → evidence → ground-truth
                ↓ (if disconfirmed)
              discarded
```

1. **First mention:** Store as hypothesis (confidence: 0.3)
2. **Second mention:** Promote to signal (confidence: 0.6)
3. **Explicit confirmation:** Promote to evidence (confidence: 0.8)
4. **Repeated consistent use:** Promote to ground-truth (confidence: 0.95)
5. **Contradiction:** Demote or replace with new information

**This is Bayesian updating in practice** — each observation adjusts our belief.

---

## Memory Architecture Proposal for Modular v2

### Overview

Based on this research, here is a concrete architecture proposal for evolving Modular's memory system.

### Architecture: Layered Memory with Temporal Knowledge Graph

```
┌─────────────────────────────────────────────┐
│                 AGENT PROMPT                 │
│  ┌─────────────────────────────────────────┐ │
│  │ Working Memory (L1)                     │ │
│  │ - System prompt + personality           │ │
│  │ - Pre-loaded hot facts (top 10-20)      │ │
│  │ - Current session scratchpad            │ │
│  │ - Active reflections                    │ │
│  └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
                      ↕ retrieve/store
┌─────────────────────────────────────────────┐
│            MEMORY LAYER (L2/L3)             │
│  ┌──────────────┐  ┌────────────────────┐   │
│  │  Fact Store   │  │  Relation Index    │   │
│  │  (per entity) │←→│  (graph edges)     │   │
│  │              │  │                    │   │
│  │ - content    │  │ - entity_a → rel   │   │
│  │ - type       │  │   → entity_b       │   │
│  │ - confidence │  │ - valid_from/until  │   │
│  │ - importance │  │                    │   │
│  │ - created_at │  └────────────────────┘   │
│  │ - accessed_at│                           │
│  │ - access_cnt │  ┌────────────────────┐   │
│  │ - strength   │  │  Skill Library     │   │
│  │ - source     │  │                    │   │
│  │ - embedding  │  │ - condition        │   │
│  └──────────────┘  │ - action           │   │
│                    │ - success_count    │   │
│  ┌──────────────┐  │ - verified         │   │
│  │ Reflections  │  └────────────────────┘   │
│  │              │                           │
│  │ - insight    │  ┌────────────────────┐   │
│  │ - evidence   │  │  Community Index   │   │
│  │ - generated  │  │                    │   │
│  │ - confidence │  │ - topic clusters   │   │
│  └──────────────┘  │ - summaries        │   │
│                    └────────────────────┘   │
└─────────────────────────────────────────────┘
                      ↕ consolidation
┌─────────────────────────────────────────────┐
│          COLD STORAGE (L4)                  │
│  Raw conversation transcripts               │
│  Archived/pruned facts                      │
│  Historical reflections                     │
└─────────────────────────────────────────────┘
```

### Phase 1: Enhanced Fact Model (Complexity: Low, Impact: High)

**Current → New fact schema:**

```typescript
// Current
interface Fact {
  key: string;
  value: string;
  type: 'ground-truth' | 'signal' | 'evidence' | 'framework' | 'hypothesis';
  domain: string;
}

// Proposed v2
interface Fact {
  id: string;                    // Unique identifier
  content: string;               // Natural language fact
  type: EpistemicType;           // ground-truth | signal | evidence | framework | hypothesis | reflection
  confidence: number;            // 0.0 - 1.0
  importance: number;            // 0.0 - 1.0 (LLM-rated)
  
  // Temporal
  created_at: Date;
  accessed_at: Date;
  valid_from?: Date;
  valid_until?: Date;            // null = still valid
  access_count: number;
  
  // Provenance
  source: string;                // conversation_id, reflection_id, manual
  source_confidence: number;     // weight based on source type
  
  // Retrieval
  embedding: number[];           // For semantic search
  entities: string[];            // Extracted entity names
  domain: string;
  tags: string[];
  
  // Computed
  strength: number;              // importance × decay(time, access_count)
}
```

**Implementation Steps:**
1. Add `confidence`, `importance`, `created_at`, `accessed_at`, `access_count` fields
2. Compute `strength` on retrieval: `importance × e^(-days_since_access / (30 × access_count))`
3. Rank retrieved facts by: `α·relevance + β·strength + γ·recency`
4. Prune facts where `strength < 0.1` during maintenance

---

### Phase 2: Three-Factor Retrieval (Complexity: Low, Impact: High)

**Replace simple text matching with the Generative Agents formula:**

```python
def retrieve_facts(query, agent_id, domain, top_k=10):
    candidates = get_all_facts(agent_id, domain)
    
    for fact in candidates:
        # 1. Relevance (semantic similarity)
        relevance = cosine_similarity(embed(query), fact.embedding)
        
        # 2. Recency (exponential decay)
        hours_ago = (now - fact.accessed_at).total_hours()
        recency = 0.99 ** hours_ago  # decay factor
        
        # 3. Importance (pre-rated + strength)
        importance = fact.strength  # already includes time decay
        
        fact.score = α * relevance + β * recency + γ * importance
    
    return sorted(candidates, key=lambda f: f.score, reverse=True)[:top_k]
```

**Suggested weights:** α=1.0, β=0.5, γ=0.5 (tune empirically)

---

### Phase 3: Reflection Engine (Complexity: Medium, Impact: Very High)

**The single highest-impact addition.** Run periodically (daily or on heartbeat):

```python
def reflect(agent_id, domain):
    recent_facts = get_facts_since(agent_id, domain, days=7)
    
    if sum(f.importance for f in recent_facts) < REFLECTION_THRESHOLD:
        return  # Not enough important new info to reflect on
    
    prompt = f"""
    Review these recent observations and generate 2-3 higher-level insights:
    
    {format_facts(recent_facts)}
    
    For each insight:
    1. State the pattern or insight
    2. List the evidence (which observations support it)
    3. Rate your confidence (0.0-1.0)
    
    Focus on: recurring patterns, user preferences, behavioral trends,
    things that worked/failed, and emerging themes.
    """
    
    reflections = llm.generate(prompt)
    
    for reflection in reflections:
        store_fact(
            content=reflection.insight,
            type='reflection',
            confidence=reflection.confidence,
            importance=0.8,  # Reflections are inherently important
            source='reflection_engine',
            evidence=reflection.supporting_facts
        )
```

---

### Phase 4: Relation Index / Light Graph (Complexity: Medium, Impact: High)

**Don't build a full graph database. Add a relation index alongside facts:**

```typescript
interface Relation {
  source_entity: string;
  relation_type: string;
  target_entity: string;
  fact_ids: string[];        // Facts that evidence this relation
  confidence: number;
  valid_from: Date;
  valid_until?: Date;
}
```

**Build relations during fact extraction:**
```
Fact: "Victor works at Syroco as PM"
→ Relation: Victor → works_at → Syroco
→ Relation: Victor → role → PM
```

**Use relations for multi-hop retrieval:**
```
Query: "What does Victor's company do?"
→ Victor → works_at → Syroco → builds → speed_sailing_boats
```

**Storage:** A simple JSON index file per domain. No graph DB needed initially.

---

### Phase 5: Consolidation Pipeline (Complexity: Medium, Impact: High)

**Run as a cron job or heartbeat task:**

```python
def consolidate(agent_id):
    """Sleep-like memory consolidation"""
    
    # 1. Decay all fact strengths
    for fact in get_all_facts(agent_id):
        fact.strength = compute_strength(fact)
    
    # 2. Prune dead facts
    prune_facts(agent_id, threshold=0.1)
    
    # 3. Merge duplicates
    dedup_facts(agent_id)  # Semantic similarity > 0.95 → merge
    
    # 4. Resolve contradictions
    for conflict in find_contradictions(agent_id):
        # Keep the more recent + higher confidence one
        resolve_contradiction(conflict)
    
    # 5. Generate reflections
    reflect(agent_id)
    
    # 6. Update community clusters
    update_communities(agent_id)
    
    # 7. Promote mature hypotheses
    for fact in get_facts_by_type(agent_id, 'hypothesis'):
        if fact.access_count > 3 and fact.confidence > 0.7:
            fact.type = 'signal'  # Promote
```

---

### Phase 6: Skill Library (Complexity: Medium, Impact: High)

**Separate from facts — these are learned behaviors:**

```typescript
interface Skill {
  id: string;
  name: string;
  description: string;
  condition: string;           // When to apply
  procedure: string;           // What to do
  success_count: number;
  failure_count: number;
  verified: boolean;
  embedding: number[];
  examples: string[];          // Successful applications
}
```

**Extract skills from Reflexion-style self-reflections:**
```
Failure: "I sent a message in English to the French WhatsApp group"
Reflection: "Always compose in French for the ORGA group"
Skill: { condition: "composing for ORGA group", procedure: "write in French", verified: true }
```

---

### Implementation Roadmap

| Phase | What | Effort | Impact | Dependencies |
|-------|------|--------|--------|-------------|
| **1** | Enhanced Fact Model | 2-3 days | High | None |
| **2** | Three-Factor Retrieval | 1-2 days | High | Phase 1 |
| **3** | Reflection Engine | 3-5 days | Very High | Phase 1, 2 |
| **4** | Relation Index | 3-5 days | High | Phase 1 |
| **5** | Consolidation Pipeline | 3-5 days | High | Phase 1, 3 |
| **6** | Skill Library | 3-5 days | High | Phase 3 |
| **7** | Community Detection | 5-7 days | Medium-High | Phase 4 |

**Total estimated effort:** 3-4 weeks for a single developer

**Recommended order:** 1 → 2 → 3 → 5 → 4 → 6 → 7

Phases 1+2 give immediate quality improvements with minimal effort.
Phase 3 (reflections) is the highest-impact single feature.
Phase 5 (consolidation) prevents unbounded growth.
Phases 4, 6, 7 add sophistication for later.

---

### Key Design Principles

1. **LLM-in-the-loop memory:** Let the LLM decide what's important, not just extract mechanically
2. **Temporal awareness:** Every fact has a time dimension — when it was true, when it was last relevant
3. **Epistemic humility:** Not all facts are equal. Confidence scores + types enable graduated trust
4. **Active forgetting:** Memory that grows without pruning becomes noise. Forgetting is a feature
5. **Reflection creates knowledge:** Raw observations → reflections → frameworks. The hierarchy of abstraction is where real intelligence emerges
6. **Skills ≠ facts:** Learning *what to do* is different from learning *what is true*. Both matter
7. **Graph-ready, not graph-first:** Start with enriched facts + lightweight relations. Don't build a graph DB until the data justifies it
8. **Human-readable always:** Whatever the storage format, a human should be able to read, edit, and understand the memory

---

*This research document synthesizes findings from 15+ papers and production systems spanning 2023-2025. The proposed architecture prioritizes practical implementability while incorporating the most impactful techniques from the academic literature.*
