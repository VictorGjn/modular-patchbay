# Changelog

All notable changes to Modular Studio will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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