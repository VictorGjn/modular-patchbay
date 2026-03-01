# Changelog

## v0.1.0 (2026-03-02)

Initial release — Context engineering IDE for AI agents.

### Features

- **Dashboard layout** — Visual mixing-console interface with React Flow canvas for designing agent knowledge pipelines
- **Context engineering pipeline**
  - Tree indexer: recursive file/folder scanning with AST-aware chunking
  - Depth filter: configurable traversal depth to control context scope
  - Compressor: token-aware context compression with priority ranking
  - Navigator: interactive tree visualization with search and filtering
- **Source connectors**
  - File system connector with glob patterns
  - Pluggable connector architecture for external data sources
  - Repository indexer: Git-aware codebase analysis with language detection
- **MCP registry** — Searchable catalog of 100+ Model Context Protocol servers with one-click configuration
- **Execution traces** — Real-time pipeline execution visualization with step-by-step token flow tracking
- **Team knowledge graph** — Entity extraction and relationship mapping across agent contexts
- **Fact insights** — Automated fact extraction with confidence scoring and source attribution
- **Universal export** — Export agent configurations as YAML, JSON, Claude config, or MCP-compatible formats
- **CLI entry point** — `npx modular-studio` to launch the IDE locally with `--port` and `--open` options
