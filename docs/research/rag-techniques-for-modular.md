# Advanced RAG Techniques → Modular Adaptation Analysis

> Source: [genieincodebottle/generative-ai](https://github.com/genieincodebottle/generative-ai)
> Date: 2026-03-09
> Purpose: Extract what's useful for Modular's tree-indexed context engineering pipeline

## Context: What Modular Does (vs Traditional RAG)

| Modular (Tree-Based) | Traditional RAG (Vector-Based) |
|---|---|
| Markdown → heading tree → depth-filtered rendering | Documents → chunks → vector DB → similarity search |
| Knowledge Type classification (ground-truth/signal/evidence/framework/hypothesis) | Flat chunk retrieval, no semantic classification |
| 5-level depth filtering (Full/Detail/Summary/Headlines/Mention) | k-nearest neighbors, no depth concept |
| Agent-driven branch navigation (LLM picks relevant tree nodes) | Query → embed → retrieve → generate |
| Framework extraction (parse guidelines → constraints + workflow) | No structural understanding |

**The key question**: Which RAG innovations translate from "search a vector DB" to "navigate a knowledge tree"?

---

## 1. Adaptive RAG — Query-Driven Strategy Selection

### How It Works (from `adaptive_rag.py`)
Despite the name "Adaptive RAG," the actual implementation is a **basic RAG pipeline**: load PDFs → chunk with `RecursiveCharacterTextSplitter` → embed with Gemini → store in ChromaDB → retrieve top-4 → generate answer. The "adaptive" aspect is limited to configurable chunk size/overlap via Streamlit sliders.

The **real Adaptive RAG concept** (from the academic paper) is richer: classify query complexity, then route to different retrieval strategies:
- Simple queries → direct LLM answer (no retrieval needed)
- Medium queries → standard single-step retrieval
- Complex queries → multi-step retrieval with decomposition

### What's Novel
Query-aware strategy routing. Don't use the same retrieval pipeline for every query.

### Adaptation for Modular — **Priority: P0**

**This is the single most impactful technique for Modular.** We already have 5 depth levels — the missing piece is *automatically choosing the right depth based on query complexity*.

```
Adaptive Depth Selection Algorithm:

function selectDepth(query, knowledgeTree):
  complexity = classifyQuery(query)  // LLM classifier
  
  switch complexity:
    case "lookup":
      // "What is X?" → Just need the heading + first paragraph
      return { depth: "Headlines", maxBranches: 1 }
    
    case "understand":  
      // "How does X work?" → Need detail but not everything
      return { depth: "Summary", maxBranches: 3 }
    
    case "analyze":
      // "Compare X and Y" → Need multiple branches at detail level
      return { depth: "Detail", maxBranches: 5 }
    
    case "synthesize":
      // "Design a system that..." → Need full context from relevant branches
      return { depth: "Full", maxBranches: 2 }

  // Also consider knowledge type matching:
  if query.needsFactualAnswer:
    prioritize(knowledgeType: "ground-truth")
  if query.needsReasoning:
    prioritize(knowledgeType: "framework", "evidence")
```

**Concrete implementation idea**: Add a `QueryClassifier` step before tree navigation. Use a cheap/fast LLM call to classify the query into complexity tiers, then set depth + branch limits accordingly. This prevents over-fetching context for simple queries and under-fetching for complex ones.

---

## 2. Corrective RAG — Self-Critique and Re-retrieval

### How It Works (from `corrective_rag.py`)
Three-pass pipeline:
1. **Initial retrieval** → top-3 similarity search → generate initial response
2. **Critique** → LLM critiques its own response, identifying errors/gaps: `"Please critique the following response. Identify any potential errors or missing information"`
3. **Re-retrieve** → Use the critique text as a new query to find additional docs → generate improved final response combining initial response + critique + additional context

The critique text drives the second retrieval — the model identifies what's *missing*, and that drives finding the missing information.

### What's Novel
The self-correction loop: generate → critique → retrieve more → regenerate. The critique serves as a query reformulation focused on gaps.

### Adaptation for Modular — **Priority: P0**

**"Verify and Deepen" pattern for tree navigation.** After initial tree traversal and rendering:

```
Corrective Tree Navigation:

function correctiveNavigate(query, tree):
  // Pass 1: Initial navigation
  branches = agent.selectBranches(query, tree)
  context = renderAtDepth(branches, "Summary")
  initialAnswer = generate(query, context)
  
  // Pass 2: Self-critique
  critique = LLM("What information is missing or potentially wrong 
                   in this answer? What aspects weren't covered?
                   Query: {query}, Answer: {initialAnswer}")
  
  // Pass 3: Gap-driven re-navigation
  gapBranches = agent.selectBranches(critique, tree)  // critique AS query
  newBranches = gapBranches.filter(b => b not in branches)  // only new ones
  
  if newBranches.length > 0:
    additionalContext = renderAtDepth(newBranches, "Detail")  // deeper this time
    finalAnswer = generate(query, context + additionalContext, 
                           initialAnswer, critique)
  
  return finalAnswer
```

**Why this matters for Modular**: Tree navigation might miss relevant branches because the agent picks based on headings alone. The critique step discovers what's missing, enabling a second pass to find branches the first pass missed. This is especially valuable when knowledge is spread across non-obvious sections.

---

## 3. Re-Ranking RAG — Post-Retrieval Quality Filtering

### How It Works (from `re_ranking_rag.py`)
Retrieve broadly (k=8), then re-rank to keep the best (top_n=5):
- **FlashRank**: Fast cross-encoder reranker
- **Cross-Encoder (BGE)**: BAAI/bge-reranker-base model scores query-document relevance
- **Cohere Rerank**: API-based reranking
- **LLM Listwise Rerank**: Use LLM itself to rank documents by relevance
- **LLM Chain Extractor**: Extract only the relevant parts from each document
- **Embeddings Filter**: Threshold-based filtering on embedding similarity

Uses LangChain's `ContextualCompressionRetriever` to wrap base retriever + compressor.

### What's Novel
Over-retrieve then refine. The initial retrieval casts a wide net; the reranker narrows to the most relevant.

### Adaptation for Modular — **Priority: P1**

**Branch Re-Ranking after Navigation.** When the agent selects multiple branches, re-rank them before rendering at depth:

```
Branch Re-Ranking:

function reRankBranches(query, selectedBranches, tree):
  // Render all branches at "Headlines" level (cheap)
  previews = selectedBranches.map(b => {
    return { branch: b, preview: renderAtDepth(b, "Headlines") }
  })
  
  // LLM-based re-ranking
  ranked = LLM("Given this query, rank these knowledge sections by relevance.
                 Score each 0-10.
                 Query: {query}
                 Sections: {previews}")
  
  // Keep top N, render those at deeper level
  topBranches = ranked.filter(r => r.score > 5).sortByScore()
  return topBranches.slice(0, contextBudget)
```

**Also useful**: The **LLM Chain Extractor** concept — instead of rendering full branches, have the LLM extract only the relevant sentences from each rendered section. This is essentially a more aggressive form of our existing compression.

---

## 4. Hybrid Search RAG — BM25 + Vector Ensemble

### How It Works (from `hybrid_search_rag.py`)
Combines two retrieval methods:
- **BM25Retriever**: Traditional keyword/term-frequency matching
- **Vector Retriever**: Semantic similarity via embeddings
- **EnsembleRetriever**: Weighted combination (configurable BM25_weight + vector_weight)

Each retriever returns k=5 docs; the ensemble merges and deduplicates using Reciprocal Rank Fusion.

### What's Novel
Keyword matching catches exact terms that semantic search misses; semantic search catches conceptual matches that keywords miss.

### Adaptation for Modular — **Priority: P2**

Our tree navigation is already semantic (LLM reads headings and decides). But we could add **keyword matching as a parallel signal**:

```
Hybrid Tree Search:

function hybridSearch(query, tree):
  // Semantic: Agent picks branches based on understanding
  semanticBranches = agent.selectBranches(query, tree)
  
  // Keyword: Simple string matching on heading text + first paragraphs
  keywords = extractKeyTerms(query)  // NLP or LLM extraction
  keywordBranches = tree.findBranchesContaining(keywords)
  
  // Merge with preference to semantic, but include keyword-only matches
  allBranches = union(semanticBranches, keywordBranches)
  
  // Flag branches found by both methods as higher confidence
  for branch in allBranches:
    branch.confidence = (branch in semanticBranches ? 0.6 : 0) +
                        (branch in keywordBranches ? 0.4 : 0)
  
  return allBranches.sortByConfidence()
```

**When this helps**: When a query mentions a very specific term (e.g., "NMEA protocol") that appears deep in a tree branch heading, but the LLM agent might not recognize its relevance from the heading alone. Keyword matching would catch it.

---

## 5. HyDE — Hypothetical Document Embeddings

### How It Works (from `hypothetical-document-embedding-rag.ipynb`)
Three-step process:
1. **Generate hypothetical answer**: Ask LLM to write a passage that *would* answer the query (without any retrieval)
2. **Use hypothetical answer as search query**: Instead of searching with the original query, search with the generated passage
3. **Generate final answer**: Use actually retrieved docs to generate the real answer

The key insight: a hypothetical answer is closer in embedding space to real answer documents than the question itself is.

```python
def hyde_rag(query, vectorstore, llm):
    # Generate hypothetical document
    hyde_prompt = "Given the following question, generate a hypothetical 
                   passage that would answer this question"
    hypothetical_doc = llm.invoke(hyde_prompt + query)
    
    # Retrieve using hypothetical doc (NOT the original query)
    retrieved_docs = vectorstore.similarity_search(hypothetical_doc.content, k=3)
    
    # Generate final answer from real docs
    final_response = llm.invoke(context=retrieved_docs, query=query)
```

### What's Novel
Bridges the query-document gap. Questions and answers live in different embedding neighborhoods; HyDE generates an answer-shaped query to search with.

### Adaptation for Modular — **Priority: P1**

**"Hypothetical Branch Content" for better tree navigation:**

```
HyDE Tree Navigation:

function hydeNavigate(query, tree):
  // Step 1: Generate what the ideal answer section would look like
  idealContent = LLM("If a knowledge base had the perfect section to 
                       answer this query, what would that section's 
                       heading and summary look like?
                       Query: {query}")
  
  // Step 2: Use ideal content to match against actual tree headings
  // This helps when the query is phrased differently than the headings
  branches = agent.selectBranches(idealContent, tree)  // search with ideal, not query
  
  // Step 3: Render and generate from real content
  context = renderAtDepth(branches, selectedDepth)
  return generate(query, context)
```

**Why this matters for Modular**: Our tree navigation relies on heading text matching query intent. But if a user asks "How do I make the system faster?" and the relevant heading is "Performance Optimization Pipeline," the LLM might miss the connection. HyDE generates text like "Performance optimization involves..." which better matches the heading.

---

## 6. Query Expansion — Multi-Query Retrieval

### How It Works (from `query-expansion-rag.ipynb`)
1. **Generate 3 alternative queries** from the original using LLM
2. **Retrieve k=2 docs for each** (original + 3 variants = 4 queries, 8 docs)
3. **Deduplicate** by page_content
4. **Generate** from combined unique context

```python
def query_transformation_rag(original_query, vectorstore, llm):
    transform_prompt = "Generate 3 alternative versions that might improve 
                        retrieval effectiveness. Each version should capture 
                        a different aspect or use different terminology."
    transformed_queries = llm.invoke(transform_prompt + original_query)
    
    all_docs = []
    for query in [original_query] + transformed_queries:
        docs = vectorstore.similarity_search(query, k=2)
        all_docs.extend(docs)
    
    unique_docs = deduplicate(all_docs)
    return generate(original_query, unique_docs)
```

### What's Novel
Different phrasings of the same query retrieve different relevant documents. Casts a wider net by exploring the query space.

### Adaptation for Modular — **Priority: P1**

**Multi-Perspective Tree Navigation:**

```
Query Expansion for Tree Navigation:

function expandedNavigate(query, tree):
  // Generate query variants
  variants = LLM("Rephrase this query 3 different ways, each emphasizing 
                   a different aspect: {query}")
  
  // Navigate tree with each variant
  allBranches = new Set()
  for q in [query, ...variants]:
    branches = agent.selectBranches(q, tree)
    allBranches.addAll(branches)
  
  // Deduplicate and rank
  rankedBranches = reRankBranches(query, [...allBranches], tree)
  return rankedBranches
```

**Especially useful for**: Queries that could match multiple sections. "How do I handle errors?" might match "Error Handling," "Debugging," "Logging," and "Monitoring" sections. Different phrasings surface different matches.

---

## 7. Multi-Index RAG — Multiple Knowledge Sources

### How It Works (from `multi-index-rag.ipynb`)
- Create separate vector stores for different data sources
- For each query, retrieve from ALL stores
- Combine contexts, labeling by source ("Source 1:", "Source 2:")
- Generate answer from combined context
- Generate source attribution explanation

### What's Novel
Parallelized retrieval across separate indexes, with source tracking.

### Adaptation for Modular — **Priority: P1**

**Multi-Tree Navigation with Source Attribution.** Modular already deals with multiple knowledge sources (different documents = different trees). The key addition: **track which tree contributed what to the answer**.

```
Multi-Tree RAG:

function multiTreeNavigate(query, trees):
  contributions = []
  for tree in trees:
    branches = agent.selectBranches(query, tree)
    if branches.length > 0:
      context = renderAtDepth(branches, "Summary")
      contributions.push({
        source: tree.metadata.name,
        knowledgeType: tree.metadata.type,  // ground-truth vs signal vs evidence
        content: context,
        branches: branches
      })
  
  // Generate with source awareness
  answer = LLM("Answer using these sources. Cite which source you used.
                 ${contributions.map(c => `[${c.source}]: ${c.content}`)}")
  
  return { answer, contributions }
```

**Key insight**: The Knowledge Type classification becomes powerful here. When combining from multiple trees, prioritize `ground-truth` over `signal` over `hypothesis`. This is something traditional RAG can't do.

---

## 8. Graph RAG — Relationship-Aware Retrieval

### How It Works (from Graph RAG README)
Full graph-based retrieval system:
- **Graph Construction**: Auto-detect relationships between document chunks based on shared metadata (habitat, origin, category, topic, author, etc.)
- **Edge Detection**: Content-based pattern matching (person, organization, location, technology, concept)
- **Traversal Retriever**: Explore connected documents through graph edges with configurable depth (`max_depth=2`)
- **Smart Router**: LangGraph workflow that analyzes query → decides between traversal (relational queries) vs standard retrieval (factual queries)
- **Confidence Scoring**: Provides transparency in routing decisions

Architecture: `Documents → Text Splitting → Embeddings → Edge Detection → Query → LangGraph Router → Strategy Selection → Retriever → Context → LLM → Answer`

### What's Novel
Exploits relationships *between* chunks, not just chunk-query similarity. A query about "animals sharing habitats" traverses the habitat edges, pulling in related documents even if they don't directly match the query text.

### Adaptation for Modular — **Priority: P0**

**This is HUGE for tree-based knowledge.** Trees already have implicit relationships:
- **Parent-child**: Heading hierarchy
- **Sibling**: Same-level headings share a parent concept
- **Cross-reference**: Sections that reference each other

```
Graph-Enhanced Tree Navigation:

// Build relationship graph between tree nodes
function buildTreeGraph(trees):
  graph = new Graph()
  
  for tree in trees:
    for node in tree.allNodes():
      graph.addNode(node)
      
      // Structural edges (implicit in tree)
      graph.addEdge(node, node.parent, "parent-of")
      for sibling in node.siblings:
        graph.addEdge(node, sibling, "sibling-of")
      
      // Semantic edges (compute once, cache)
      for otherNode in allOtherNodes:
        if sharesConcepts(node.headingText, otherNode.headingText):
          graph.addEdge(node, otherNode, "related-concept")
      
      // Cross-document edges
      for ref in node.extractReferences():  // links, mentions of other sections
        target = resolve(ref)
        if target:
          graph.addEdge(node, target, "references")

// Navigate using graph relationships
function graphNavigate(query, tree, graph):
  // Initial branch selection
  seedBranches = agent.selectBranches(query, tree)
  
  // Traverse graph to find related branches
  relatedBranches = new Set()
  for branch in seedBranches:
    neighbors = graph.traverse(branch, maxDepth=2)
    relatedBranches.addAll(neighbors)
  
  // Filter by relevance
  allBranches = union(seedBranches, relatedBranches)
  return reRank(query, allBranches)
```

**Most valuable for**: Cross-document knowledge synthesis. When answer requires connecting information from "Performance Requirements" in doc A with "Architecture Decisions" in doc B, graph edges between related concepts make this discoverable.

---

## 9. Agentic RAG — Multi-Agent Orchestration

### How It Works (from Agentic RAG README)
Five specialized agents in a LangGraph workflow:
1. **Planner Agent**: Analyzes query complexity (simple/moderate/complex/research), creates execution plan, decomposes into sub-questions
2. **Retriever Agent**: Semantic retrieval from vector DB
3. **Research Agent**: Web search via Tavily for current information
4. **Synthesizer Agent**: Combines information from document + web sources
5. **Validator Agent**: Validates answer quality, provides confidence scoring

Key features: adaptive query planning, confidence scoring, source tracking, multi-iteration refinement (configurable 5-15 max iterations).

### What's Novel
Decomposition + specialization. Complex queries get broken down; each sub-question is handled by the appropriate agent with the appropriate tool.

### Adaptation for Modular — **Priority: P1**

Modular already has agent-driven navigation. The addition: **explicit planning and validation agents**:

```
Agentic Tree Navigation:

function agenticNavigate(query):
  // PLANNER: Analyze and decompose
  plan = PlannerAgent.analyze(query)
  // Returns: { complexity, subQuestions, strategy, depthHint }
  
  // NAVIGATOR: For each sub-question, navigate the tree
  subResults = []
  for sq in plan.subQuestions:
    branches = NavigatorAgent.selectBranches(sq, trees)
    context = renderAtDepth(branches, plan.depthHint)
    subResults.push({ question: sq, context, branches })
  
  // SYNTHESIZER: Combine sub-results
  answer = SynthesizerAgent.combine(query, subResults)
  
  // VALIDATOR: Check answer quality
  validation = ValidatorAgent.validate(query, answer, subResults)
  if validation.confidence < 0.7:
    // Trigger corrective loop
    return agenticNavigate(validation.refinedQuery)
  
  return { answer, confidence: validation.confidence, sources: subResults }
```

**Key adaptation**: The Planner Agent should understand our knowledge types and depth levels. It should know that "ground-truth" sources don't need validation but "hypothesis" sources do.

---

## 10. Self-Adaptive RAG — Dynamic Strategy Switching

### How It Works (from `self-adaptive-rag.ipynb`)
Combines multiple RAG techniques and dynamically selects which to use:
- Assesses query type and complexity
- Chooses between: direct retrieval, multi-step retrieval, HyDE, query expansion
- Self-evaluates retrieved context quality
- Falls back to alternative strategy if first attempt fails

### What's Novel
Meta-level optimization: the system learns which strategy works for which query type.

### Adaptation for Modular — **Priority: P1**

**Strategy Registry for Tree Navigation:**

```
Self-Adaptive Tree Navigation:

strategies = {
  "direct": { fn: directNavigate, bestFor: "simple factual queries" },
  "expanded": { fn: expandedNavigate, bestFor: "broad/ambiguous queries" },
  "corrective": { fn: correctiveNavigate, bestFor: "complex multi-faceted queries" },
  "graph": { fn: graphNavigate, bestFor: "relational/comparative queries" },
  "hyde": { fn: hydeNavigate, bestFor: "differently-phrased queries" }
}

function adaptiveNavigate(query, trees):
  // Classify and select strategy
  strategyName = LLM("Given this query, which retrieval strategy is best?
                       Options: ${Object.keys(strategies)}
                       Descriptions: ${strategies.map(s => s.bestFor)}
                       Query: {query}")
  
  strategy = strategies[strategyName]
  result = strategy.fn(query, trees)
  
  // Self-evaluate
  quality = LLM("Is this context sufficient to answer the query well? 
                  Score 1-10. Query: {query}, Context: {result.context}")
  
  if quality < 6:
    // Try next best strategy
    fallbackStrategy = selectFallback(strategyName, query)
    result = fallbackStrategy.fn(query, trees)
  
  return result
```

---

## 11. Cache-Augmented Generation (CAG) — Preloaded Context

### How It Works
Eliminates retrieval entirely by preloading ALL relevant knowledge into the LLM's context window. Leverages extended context windows (100K+ tokens) and KV-cache optimization.

Based on paper: [arxiv.org/abs/2412.15605](https://arxiv.org/abs/2412.15605)

**Advantages**: No retrieval latency, no retrieval errors, simplified architecture
**Limitations**: Context window limits, performance degrades with very long contexts

### What's Novel
"Just put everything in the context" — viable now with large context windows.

### Adaptation for Modular — **Priority: P2**

This is actually **validation for what Modular already does partially** with depth filtering. CAG says "dump everything"; Modular says "dump the right things at the right depth." 

**Hybrid approach**: For small-to-medium knowledge bases, CAG might be viable as a **fallback mode**:

```
CAG Fallback:

function selectApproach(query, totalKnowledgeSize):
  if totalKnowledgeSize < 50_000_tokens:
    // Small enough: just render everything at Summary depth
    return renderAllTrees("Summary")  // CAG-style
  else:
    // Too large: use tree navigation
    return adaptiveNavigate(query, trees)  // RAG-style
```

---

## 12. AI Reasoning Patterns (from `ai-patterns/`)

The repository contains 22 reasoning pattern notebooks. Most relevant for Modular:

### Chain-of-Verification
- Generate answer → generate verification questions → answer each verification → produce refined answer
- **Modular use**: Post-generation verification of answers derived from tree context

### Decomposed Prompting  
- Break complex problems into sub-problems, solve each with specialized prompts
- **Modular use**: Already implicit in agentic navigation; formalize it

### Graph-of-Thoughts
- Explore multiple reasoning paths simultaneously, merge the best ones
- **Modular use**: Navigate multiple tree branches in parallel, merge results

### Skeleton-of-Thought
- Generate answer skeleton first, then fill in details in parallel
- **Modular use**: Generate at "Headlines" depth first, then selectively deepen

### Tree-of-Thought
- Explore multiple reasoning branches, evaluate each, prune bad ones
- **Modular use**: Natural fit — our knowledge IS a tree; ToT navigation is native

### Reflexion
- Generate → evaluate → reflect → regenerate with reflection
- **Modular use**: Similar to corrective RAG but with explicit reflection memory

### Self-Refine
- Iterative improvement: generate → critique → refine → critique → refine...
- **Modular use**: Iterative deepening of tree context based on self-critique

**Priority**: P2 individually, but the patterns inform the design of the overall pipeline.

---

## Summary: Priority Matrix

### P0 — Must Have (Transformative for Modular)

| Technique | Adaptation | Impact |
|---|---|---|
| **Adaptive RAG** | Adaptive Depth Selection — automatically choose depth level based on query complexity | Eliminates over-fetching and under-fetching. Every query gets the right amount of context. |
| **Corrective RAG** | Verify-and-Deepen loop — critique tree output, re-navigate to fill gaps | Catches missed branches. Self-healing context selection. |
| **Graph RAG** | Build relationship graph between tree nodes (structural + semantic + cross-reference edges) | Enables cross-document synthesis. Discovers non-obvious connections. |

### P1 — Should Have (Significant improvement)

| Technique | Adaptation | Impact |
|---|---|---|
| **HyDE** | Generate "ideal section" text to match against tree headings | Better heading matching when query phrasing differs from heading text. |
| **Re-Ranking** | LLM-based branch re-ranking after initial selection | Ensures best branches get deepest rendering within context budget. |
| **Query Expansion** | Multi-perspective tree navigation with query variants | Wider branch coverage, catches sections missed by single query. |
| **Multi-Index** | Multi-tree navigation with source attribution and knowledge type priority | Ground-truth sources get priority. Answer cites which tree contributed. |
| **Agentic RAG** | Planner + Navigator + Validator agent decomposition | Structured approach to complex queries. Built-in quality control. |
| **Self-Adaptive** | Strategy registry with fallback chain | Meta-optimization: system learns which navigation approach works best. |

### P2 — Nice to Have (Incremental value)

| Technique | Adaptation | Impact |
|---|---|---|
| **Hybrid Search** | Keyword matching as parallel signal to semantic navigation | Catches exact-term matches that LLM might miss. |
| **CAG** | Fallback mode for small knowledge bases — render everything | Simpler path for small contexts where navigation is overkill. |
| **AI Patterns** | Skeleton-of-Thought, Tree-of-Thought, Reflexion patterns for generation | Better answer quality through structured reasoning. |

---

## Recommended Implementation Order

1. **Adaptive Depth Selection** (P0) — Highest ROI, straightforward to implement. Add query classifier before tree navigation.

2. **Corrective Loop** (P0) — Add self-critique step after initial context assembly. Re-navigate on gaps. Pairs naturally with adaptive depth.

3. **Branch Re-Ranking** (P1) — Render branches at "Headlines" first, LLM-rank them, then deepen the best ones. Works within existing pipeline.

4. **Graph Relationships** (P0) — Build cross-node relationship graph. Highest engineering cost but enables cross-document synthesis that's currently impossible.

5. **HyDE Navigation** (P1) — Generate "ideal section" before tree navigation. Low cost, moderate impact.

6. **Query Expansion** (P1) — Navigate with 3 query variants. Low cost, broadens coverage.

7. **Multi-Tree Source Attribution** (P1) — Track which tree contributed what. Leverage knowledge type priority.

8. **Self-Adaptive Strategy Selection** (P1) — Meta-layer that picks the best navigation strategy per query. Requires techniques 1-6 to exist first.

---

## Key Takeaway

**The repository's implementations are fairly basic** — straightforward LangChain/ChromaDB RAG pipelines with Streamlit UIs. But the **concepts they encode** are valuable when translated from "vector search over flat chunks" to "structured navigation of knowledge trees."

The most transformative insight: **Modular's tree structure is actually a superpower** that traditional RAG doesn't have. Techniques like Adaptive RAG, Graph RAG, and Corrective RAG become MORE powerful in a tree context because:
- **Adaptive**: We have 5 depth levels to choose from (RAG only has k)
- **Graph**: Trees already encode structural relationships (parent/child/sibling)
- **Corrective**: We can selectively deepen specific branches instead of re-querying the whole DB

The tree structure gives us fine-grained control that vector DBs don't offer. The job is to wire these RAG patterns to exploit that control.
