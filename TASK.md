# UI Modernization Task

## Overview
Major UI overhaul of the Modular mixing console app. The current UI is too dark, looks dated, and has broken UX. Make it contemporary while keeping the analog mixing console identity.

## Tech Stack
- React 19 + TypeScript (strict) + Vite 7 + Zustand + Tailwind CSS v4
- Font: Inter (body) + Space Mono (labels/code)
- Accent: #FE5000

## What to Change

### 1. VISUAL REFRESH — Make it Contemporary
- The UI is very dark (#0f0f0f background everywhere). Lighten it up — think modern dark mode (like Linear, Vercel dashboard, Raycast) not cave mode.
- Use more contrast between surfaces. Currently everything blends into a brown-black soup.
- Suggested palette shift:
  - Background: `#111114` or `#131316` (blue-black instead of brown-black)
  - Surface: `#1c1c20` (cards/sections)
  - Surface elevated: `#25252a` (hover states, active items)
  - Borders: `#2a2a30` (subtle but visible)
  - Text primary: `#f0f0f0`
  - Text secondary: `#888`
  - Text muted: `#555`
  - Keep accent `#FE5000` — it's the brand
- Use Inter font for body text (already imported), Space Mono only for labels/monospace elements
- Rounder corners (8px for cards, 12px for modals)
- Subtle glassmorphism on surfaces (backdrop-blur, translucent backgrounds) — but tasteful, not excessive
- Remove the LED dot strip from Topbar — it's gimmicky
- Remove the SignalFlow SVG pipeline — replace with a simpler status indicator

### 2. JACK CABLES — Visual Connections
- Each section (Knowledge, MCP, Skills, Agents, Output) should have a visual "jack port" (small circular element at the bottom)
- The Prompt textarea should have jack ports too (one for text input, optionally one for voice)
- When a section has active items, draw an SVG cable (curved bezier) from the section's jack port to the prompt area's jack port
- Cable style: thin (2px), colored by section category, with a subtle glow when active
- Cables should have a gentle sag (gravity effect) — use quadratic bezier with midpoint pulled down
- This is the key visual metaphor — sections "plug into" the prompt

### 3. REPLACE EMOJIS WITH SVG ICONS
- Current code uses emojis (📚🔌⚡🤖📤📧💬🐙 etc.) everywhere — in Section headers, Tile badges, MCP servers, skills
- Replace ALL emojis with custom inline SVG icons or use Lucide React icons (install `lucide-react`)
- Install lucide-react: `npm install lucide-react`
- For Section headers: use Lucide icons (BookOpen for Knowledge, Plug for MCP, Zap for Skills, Bot for Agents, ArrowUpRight for Output)
- For MCP servers: use recognizable SVG icons — Gmail envelope, Slack hash, GitHub octocat, Notion page, HubSpot hexagon, etc. Create simple inline SVGs or use Lucide equivalents
- For Skills: use Lucide icons (Presentation, Mic, Cloud, Code, BarChart3, Anchor, GitBranch, Palette)
- For Agents: use Lucide icons or simple avatar circles with initials
- For Output formats: use Lucide icons (FileText, Presentation, Mail, Code, Table, Braces, GitFork, MessageSquare)
- For Knowledge types: replace emoji circles (🔴🟡🔵🟢🟣⚪) with small colored dot + text label

### 4. MCP PICKER — Browse & Add Pattern (like Knowledge FilePicker)
- Currently MCPs are all displayed directly in the section grid — change this
- MCP section should show ONLY the MCPs the user has added/enabled (like Knowledge shows added channels)
- Add a "+ ADD" button that opens a modal picker (similar to FilePicker for knowledge)
- The MCP picker modal should:
  - Show ALL available MCP servers in a scrollable list
  - Each row: icon + name + description + connection status (green dot = connected, red = offline) + "ADD" button
  - Search/filter at the top
  - Grouped by category (Communication, Development, Data, etc.)
- Once added, an MCP appears as a tile in the section
- Each MCP tile has a toggle to enable/disable (active = green dot, inactive = gray)
- Same pattern for Skills section — browse & add, then toggle

### 5. SKILL-AGENT LINKING
- When viewing Skills, show which agent(s) already use each skill
- In the Skill tile, show a small "Used by: Senior PM, Engineer" subtitle if agents reference it
- In the skill picker modal, show linked agents next to each skill
- Add the agent-skill mapping data to the store:
  ```typescript
  // In knowledgeBase.ts, add to MOCK_AGENTS:
  linkedSkills?: string[]; // skill IDs
  
  // Example:
  { id: 'agent-senior-pm', ..., linkedSkills: ['skill-feedback-analyzer', 'skill-maritime-expert'] }
  { id: 'agent-engineer', ..., linkedSkills: ['skill-coding-agent', 'skill-github'] }
  ```
- Optionally: when adding a skill, offer to auto-link it to the currently loaded agent

### 6. LAYOUT IMPROVEMENTS
- The 5-column grid is too cramped. Use a 2-row layout instead:
  - Top row: full-width Prompt area with jack ports
  - Middle: Horizontal scrollable sections (Knowledge | MCP | Skills | Agents | Output) each as a card
  - Cables connect from section jack ports up to the prompt jack ports
  - Bottom: Response area (collapsible)
- OR: Use a left sidebar (sections as vertical tabs) + main area (prompt + response) layout
- Pick whichever feels more natural for a "mixing console" — but make sections individually scrollable
- Keep the token budget bar at the bottom

### 7. FIX BROKEN UX
- Test all interactions: adding knowledge sources, toggling tiles, running, output format selection
- Depth popup (double-click on knowledge tile) should work reliably
- FilePicker search should be responsive
- Keyboard shortcuts (Ctrl+K, Ctrl+Enter, Escape) must work
- Agent loading (clicking an agent tile) should update the UI state correctly

## Files to Modify
- `src/styles/globals.css` — update color theme, add glass/blur utilities
- `src/styles/modules.css` — update animations, remove old knob/channel-strip styles, add cable styles
- `src/App.tsx` — restructure layout, add cable SVG layer, replace emojis
- `src/components/Section.tsx` — add jack port, update styling
- `src/components/Tile.tsx` — update styling, replace emoji badges with icons
- `src/components/Topbar.tsx` — simplify, remove LED strip, update styling
- `src/components/PromptArea.tsx` — add jack ports, update styling
- `src/components/SignalFlow.tsx` — remove or replace with simpler component
- `src/components/ResponseArea.tsx` — update styling
- `src/components/TokenBudget.tsx` — update styling
- `src/components/FilePicker.tsx` — update styling, serve as pattern for MCP/Skill picker
- NEW `src/components/McpPicker.tsx` — modal for browsing/adding MCP servers
- NEW `src/components/SkillPicker.tsx` — modal for browsing/adding skills  
- NEW `src/components/CableLayer.tsx` — SVG overlay for jack cable connections
- NEW `src/components/icons/` — directory for custom SVG icon components
- `src/store/knowledgeBase.ts` — add linkedSkills to AgentDef, add categories to MCPs/Skills
- `src/store/consoleStore.ts` — add MCP picker state, skill picker state

## Design References
Think: Linear app + Vercel dashboard + Ableton Live's session view. Modern, clean, spacious — but with the analog mixing console soul (cables, jack ports, warm accent color).

## Constraints
- Keep ALL existing functionality working
- Keep Zustand store structure compatible  
- Keep agent import/export working
- Build must pass (`npm run build` with zero errors)
- Use conventional commits

## When Done
Run `npm run build` to verify zero errors. Commit all changes with a descriptive conventional commit message. Then run:
```
openclaw system event --text "Done: UI modernization complete - contemporary dark theme, jack cables, SVG icons, MCP/Skill pickers, agent-skill linking" --mode now
```
