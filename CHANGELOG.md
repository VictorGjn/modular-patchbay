# Changelog

All notable changes to Modular Studio will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.6] - 2026-03-19

### Added
- **Auto-Lessons from User Corrections** (#31) — Detects user corrections during conversations and extracts reusable rules/constraints that improve agent behavior over time
- **Semantic Response Caching** (#32) — Hybrid matching (cosine + hash + query diff) with configurable TTL for faster repeated queries
- **Hindsight Memory Integration** (#67) — Biomimetic memory backend inspired by biological memory systems (encoding → consolidation → retrieval)
- **Cache-Aware Context Assembly** (#30) — Provider-aware prompt reordering that maximizes cache hits across Anthropic, OpenAI, and Google
- **Three-Tier Tool Integration UI** (#61) — Native SDK, MCP, and CLI/Shell tools in a unified ToolsTab interface
- **Qualification with Real LLM** (#66) — Wired actual LLM calls into qualification pipeline (generate-suite + LLM-as-judge scoring)
- **Notion Connector** (#60) — Search Notion pages by keywords directly from the Knowledge tab
- **File Explorer Dialog** (#58) — Browse and select local files for knowledge sources
- **Server-Side Version Persistence** (#37) — Auto-save agent versions with restore capability
- **MCP Health Check Buttons** (#65) — One-click connection testing in ToolsTab
- **Full E2E Playwright Suite** (#41) — End-to-end tests for the V2 wizard flow
- **Component Test Suite** (#39) — Unit tests for V2 wizard components

### Fixed
- **Provider Detection** (#72) — Provider configured via backend now correctly detected (was checking empty `apiKey` instead of `status`)
- **Auto-Fetch Models on Load** — Models list auto-populated for configured providers (no more empty model selector)
- **Skills Install on Windows** — `npx` now works via `shell: true` (was failing with ENOENT on Windows)
- **Skills Install Downloads Full Directory** — Fallback installer now fetches entire skill directory via GitHub API, not just SKILL.md
- **MCP Fetch Registry** — Updated `@modelcontextprotocol/server-fetch` → `@anthropic-ai/mcp-fetch` (old package removed from npm)
- **Smart Tree Indexer Wiring** (#59) — Code structure view properly connected to repo indexing flow
- **MCP Quick Connect** (#64) — Adding servers from quick-connect now updates the server list
- **Skill Install URL Resolution** (#63) — Marketplace skill URLs now resolve correctly
- **Provider Setup Prompt** (#56) — Shows provider setup prompt before Generate Agent is available
- **Duplicate Marketplace Button** (#62) — Removed redundant button from ToolsTab
- **Redundant Templates** (#57) — Cleaned up duplicate templates in DescribeTab
- **Hindsight Client Optional** — Graceful fallback when hindsight-client is not installed

### Technical Improvements
- 870 tests (826 passing, 29 skipped)
- 150 commits since 1.0.5
- Build output: code-split with lazy-loaded tabs (vendor 192KB, services 261KB gzipped)
- TypeScript strict — all 30 build errors from v2 migration resolved

## [1.0.4] - 2025-03-12

### Fixed
- **Chat History Preservation** — Assistant role now correctly preserved in conversation history (#10)
- **Settings MCP Tab** — Removed infinite render loop that caused crashes (#12)  
- **Embedding Service Reliability** — Added readiness gate and retry logic for model loading (#11)
- **API Route Handling** — Added 404 catch-all handler to prevent silent failures (#16)

### Added
- **Markdown Rendering** — Assistant messages now properly render markdown formatting (#13)
- **Inline Pipeline Traces** — Pipeline statistics now appear inline with chat messages (#14)
- **Engineering Guidelines** — Added comprehensive development standards and practices
- **Smoke Test Checklist** — Manual testing checklist for release validation

### Technical Improvements
- Eliminated unsafe `as` type casts in conversation history handling
- Stabilized React useEffect dependencies to prevent infinite loops  
- Enhanced error handling for embedding service initialization
- Improved API route organization and error reporting

## [0.2.0] - 2024-03-11

### Added

#### Core Architecture
- **Context Engineering Pipeline** — Tree indexing, budget allocation, contrastive retrieval, and provenance tracking
- **3-Panel Layout** — Sources panel, Agent Builder, and Test Panel for streamlined workflow
- **Agent Directory Format** — Export/import agents as structured ZIP archives with human-readable files

#### Agent Management
- **Team Runner** — Parallel agent execution with coordinated workflows
- **Agent SDK Integration** — Streaming support for real-time agent communication
- **MCP OAuth Flow** — Secure authentication for Model Context Protocol servers

#### Knowledge System
- **Knowledge Types** — 6 epistemic types (ground-truth, signal, evidence, framework, hypothesis, guideline) with depth control
- **Memory System** — Agent recall and write capabilities with Ebbinghaus decay simulation
- **Contrastive Retrieval** — Intelligent content filtering and conflict detection

#### Security & Reliability
- **Security Hardening** — Command allowlist and OAuth token permission management
- **Comprehensive Testing** — 646 unit and end-to-end tests for reliability
- **Error Handling** — Robust error recovery and graceful degradation

#### Developer Experience
- **Visual Agent Builder** — Drag-and-drop interface for agent configuration
- **Real-time Preview** — Instant feedback on agent behavior and responses
- **Export/Import** — Seamless agent sharing and version control

### Technical Improvements
- TypeScript strict mode compliance
- ES modules throughout the codebase
- Optimized bundle splitting and chunking
- Cross-platform compatibility (Windows, macOS, Linux)

### Dependencies
- React 19.2.0 for modern UI patterns
- Claude Agent SDK 0.2.62 for AI integration
- Express 5.1.0 for server framework
- Model Context Protocol SDK 1.27.0

---

## [0.1.0] - 2024-02-15

### Added
- Initial release of Modular Studio
- Basic agent configuration interface
- MCP server integration
- File-based knowledge sources

[0.2.0]: https://github.com/VictorGjn/modular-patchbay/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/VictorGjn/modular-patchbay/releases/tag/v0.1.0