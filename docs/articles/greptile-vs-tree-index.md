# Why Greptile Can't Maximize Your Context Window (And What We Built Instead)

*A real-world comparison using a 220-file TypeScript codebase.*

---

## The Problem

You have a 220-file TypeScript codebase — React frontend, Express backend, 22 Zustand stores, 76 components. You need an agent to add a date range filter to the order list. The agent has an 8K context window for knowledge.

How do you fill that window with exactly the right context?

## How Greptile Would Handle It

[Greptile](https://greptile.com) is a codebase understanding API. You'd ask: "How does the order list work?" and get back a natural-language answer with code snippets.

Here's the problem:

**1. Runtime Q&A, not pre-computed knowledge.** Every question costs an API call. You can't pre-index your repo and have the understanding travel with your agent. When your agent runs at 2 AM and Greptile's rate limit kicks in, it's blind.

**2. You get an answer, not a map.** Greptile tells you what it found. It doesn't give you a tree structure the agent can navigate. The agent can't say "I need the data flow section at full depth but only headlines for the architecture." It gets whatever Greptile decides is relevant.

**3. No depth control.** You get one level of detail — whatever the model decides to include. Maybe it gives you too much about authentication when you needed order store internals. Maybe it summarizes the exact function you needed to read in full.

**4. Token waste.** The response includes Greptile's reasoning, formatting, and citations. That's tokens in your context window that aren't your codebase.

**5. Black box.** You can't see what the model chose to include or exclude. No way to override. No way to learn from what worked.

## What We Built: Tree-Indexed, Agent-Navigated Context

We took a different approach. Instead of asking an API "tell me about this code," we built a pipeline that makes the codebase **navigable by the agent itself**.

### Step 1: Scan and Index

```
$ modular-studio index-repo .

Scan: 220 files, 4 features
  Wrote: 00-overview.md (2,642 chars)
  Wrote: 01-dist-server.md (2,069 chars)
  Wrote: 02-docs.md (927 chars)
  Wrote: 03-server.md (2,470 chars)
  Wrote: 04-src.md (17,759 chars)
```

The repo indexer scans the codebase and generates feature-level markdown documentation. Not per-file summaries (Autodoc already tried that) — per-feature documents that describe how things work together.

Each document has heading structure that maps to 5 depth levels:

```markdown
# Feature: Src                          ← Mention (depth 4): 2 tokens
## Components                           ← Headlines (depth 3): title only
### Key Files                           ← Summary (depth 2): first sentence
Detailed description of each file...    ← Detail (depth 1): first paragraph
Full implementation notes and code...   ← Full (depth 0): everything
```

### Step 2: Agent Navigates the Tree

Here's where it gets interesting. Instead of a human setting a depth slider, the **agent** reads the tree headlines and decides what it needs:

```
Source: overview (616 tokens, 13 nodes)

[n1-1] modular-studio [616 tokens] (5 subsections)
  [n2-2] Stack [42 tokens]
  [n2-3] Structure [21 tokens]
  [n2-4] File Distribution [50 tokens]
  [n2-5] Conventions [71 tokens] (2 subsections)
  [n2-8] Features [432 tokens] (4 subsections)
    [n3-9] Dist Server [126 tokens]
    [n3-10] Docs [38 tokens]
    [n3-11] Server [91 tokens]
    [n3-12] Src [177 tokens]
```

The agent sees this map (63 tokens — practically free) and selects:

```json
[
  { "nodeId": "n2-2", "depth": 2, "reason": "Need stack context", "priority": 2 },
  { "nodeId": "n3-12", "depth": 0, "reason": "Full src details for the feature", "priority": 0 },
  { "nodeId": "n2-5", "depth": 3, "reason": "Conventions awareness", "priority": 3 }
]
```

**The agent reads the table of contents and picks what to read.** Critical sections get full depth. Background context gets headlines. Irrelevant sections get skipped entirely.

### Step 3: Compressor Reduces Selected Content

Even within the selected branches, there's noise. The compressor (inspired by [rtk-ai/rtk](https://github.com/rtk-ai/rtk)) removes:

- **Duplicate information** across branches (same fact stated in overview and feature doc)
- **Filler sentences** ("As mentioned above...", "It is worth noting that...")
- **Code comments** that restate what the code does

On our own overview doc: 661 tokens in, 661 out — because the generated docs are already dense. On a human-written README with typical verbosity? 30-50% compression is common.

### Step 4: Context Assembly

The final context uses exactly what the agent selected, compressed, and packed within budget:

```
Task: "Add date range filter to order list"
Budget: 8,000 tokens
Used: 4,200 tokens (52% utilization)
Sections: 3 branches selected, 2 at full depth, 1 at headlines

Indexing: 3ms | Navigation: 0ms (cached) | Compress: 1ms | Total: 4ms
```

The agent gets the order store internals at full depth, stack context as a one-liner, and conventions as headlines. It knows where to add the filter, what patterns to follow, and what stores to touch. On one prompt.

## The Comparison

| | Greptile | Tree-Indexed Pipeline |
|---|---------|----------------------|
| **Architecture** | Runtime API (cloud) | Pre-computed (local) |
| **Granularity** | Whatever the model returns | Per-branch, 5 depth levels |
| **Who decides what's relevant?** | Greptile's model | Your agent, per task |
| **Offline capable?** | No | Yes — `.modular-knowledge/` travels with repo |
| **Token waste** | Response formatting + citations | Zero — only selected content |
| **Transparency** | Black box | Full tree visible, selections logged |
| **Cost per query** | API call ($) | Zero (pre-indexed) |
| **Composable** | No — Greptile only | Yes — same pipeline for Notion, HubSpot, Slack |

## The Pipeline Is Source-Agnostic

The tree indexer isn't just for code. The same pipeline handles:

- **Markdown docs** → heading-based tree (README, AGENTS.md, wikis)
- **Structured data** → field groups (HubSpot deals, Notion databases)
- **Chronological data** → time segments (Slack threads, meeting transcripts)
- **Flat text** → single node (pastes, emails)
- **Code repositories** → feature-level docs (scanned + generated)

One pipeline. Any source. The agent navigates them all the same way.

## Why This Matters for Context Engineering

The context window is the most expensive real estate in AI. Every token counts. The tools we have today — RAG, vector search, even Greptile — treat context as a retrieval problem: "find the relevant chunks."

But context isn't retrieval. It's **curation**. The right context for "add a date filter" is different from "fix the auth bug," even in the same codebase. A static retrieval system can't know that.

What you need is:
1. **A map** of all available knowledge (tree index)
2. **A navigator** that reads the map per task (agent-driven selection)
3. **A compressor** that maximizes signal density
4. **A budget** that's visible and controllable (context assembler)

That's what we built. Every piece is open source, composable, and runs locally.

---

*Built with [Modular Studio](https://github.com/VictorGjn/modular-patchbay) — the context engineering layer for AI agents. 241 tests. Ships as `npx modular-studio`.*
