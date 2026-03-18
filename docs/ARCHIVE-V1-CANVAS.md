# V1 Canvas Architecture Archive

This document records the removal of v1 canvas-related code that was replaced by the v2 wizard UI.

## Overview

The original Modular Studio used a React Flow-based canvas interface where users could drag and drop nodes to build agent workflows visually. This has been replaced by a step-by-step wizard interface that provides better UX and faster agent creation.

## What Was Removed

### Layouts
- `src/layouts/DashboardLayout.tsx` - Main canvas container, replaced by `WizardLayout`
- `src/layouts/RuntimeWorkspaceLayout.tsx` - Runtime execution workspace (unused)

### React Flow Nodes (11 components)
All visual node components for the canvas interface:
- `src/nodes/AgentNode.tsx` - Main agent configuration node
- `src/nodes/AgentPreviewNode.tsx` - Agent preview display
- `src/nodes/GeneratorNode.tsx` - Agent generation control
- `src/nodes/KnowledgeNode.tsx` - Knowledge source selection
- `src/nodes/McpNode.tsx` - MCP server configuration
- `src/nodes/MemoryNode.tsx` - Memory strategy settings
- `src/nodes/OutputNode.tsx` - Output format control
- `src/nodes/PromptNode.tsx` - Prompt engineering node
- `src/nodes/ResponseNode.tsx` - Response display
- `src/nodes/SkillsNode.tsx` - Skills selection
- `src/nodes/WorkflowNode.tsx` - Workflow step editing

### Edges (2 components)
Visual connectors between nodes:
- `src/edges/FeedbackEdge.tsx` - Feedback loop connections
- `src/edges/PatchCable.tsx` - Data flow connections

### Controls (5 components)
Skeuomorphic UI controls used in nodes:
- `src/controls/Knob.tsx` - Rotary dial control
- `src/controls/LEDIndicator.tsx` - Status indicator lights
- `src/controls/Scope.tsx` - Oscilloscope-style display
- `src/controls/Screw.tsx` - Decorative hardware elements
- `src/controls/Toggle.tsx` - Switch controls

### Legacy Components (5 components)
Older visualization and card components:
- `src/components/AgentCard.tsx` - Old agent card layout (replaced by AgentLibrary)
- `src/components/AgentViz.tsx` - Agent visualization container
- `src/components/AgentVizCircuit.tsx` - Circuit board visualization
- `src/components/AgentVizLayers.tsx` - Layered agent display
- `src/components/JackPort.tsx` - Audio jack-style connector

## Why Removed

1. **User Experience**: The v2 wizard provides faster, more intuitive agent creation
2. **Maintenance**: Canvas nodes had complex state management and React Flow dependencies
3. **Bundle Size**: Significant reduction in JavaScript bundle size
4. **Design Evolution**: Moving away from skeuomorphic design toward cleaner interfaces

## Migration Notes

- Agent state management moved from node-based to wizard step-based stores
- Visual feedback replaced by inline hints and validation messages
- Drag-and-drop workflow replaced by guided step-through process
- Canvas-style connections replaced by automatic data flow in wizard

## Preserved Functionality

All core functionality was preserved in the v2 wizard:
- Agent configuration → Describe + Review tabs
- Knowledge sources → Knowledge tab with panels
- Tools/MCP → Tools tab
- Memory → Memory tab
- Testing → Test tab with chat interface
- Qualification → Qualification tab

## Git History

All removed code remains accessible in git history before commit: `[commit hash will be added]`

## Date Removed

**March 18, 2026** - Removed as part of v2 wizard UI completion

---

*This archive serves as documentation for future reference and ensures institutional knowledge of the v1 canvas architecture is preserved.*