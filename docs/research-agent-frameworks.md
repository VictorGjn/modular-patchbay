# AI Agent Framework Configuration Research Report

*Research conducted: March 10, 2026*

## Executive Summary

This report analyzes the current state of AI agent building frameworks and their configuration patterns, focusing on five key areas:
1. **Agent Configuration Formats** - How frameworks define agents
2. **MCP Server Integration** - Tool configuration patterns
3. **Memory/Knowledge Architecture** - Persistence and sharing approaches  
4. **Multi-Agent Composition** - Team orchestration models
5. **Context Engineering** - Token management and source prioritization

## 1. Agent Configuration Formats

### CrewAI: YAML-Based Agent Definitions

**Repository**: https://github.com/crewAIInc/crewAI  
**Status**: Active, 100k+ certified developers

CrewAI uses a structured YAML-based approach with separate files for agents and tasks:

**agents.yaml**:
```yaml
researcher:
  role: >
    {topic} Senior Data Researcher
  goal: >
    Uncover cutting-edge developments in {topic}
  backstory: >
    You're a seasoned researcher with a knack for uncovering the latest
    developments in {topic}. Known for your ability to find the most relevant
    information and present it in a clear and concise manner.

reporting_analyst:
  role: >
    {topic} Reporting Analyst
  goal: >
    Create detailed reports based on {topic} data analysis and research findings
  backstory: >
    You're a meticulous analyst with a keen eye for detail.
```

**tasks.yaml**:
```yaml
research_task:
  description: >
    Conduct a thorough research about {topic}
  expected_output: >
    A list with 10 bullet points of the most relevant information about {topic}
  agent: researcher

reporting_task:
  description: >
    Review the context and expand each topic into a full section for a report.
  expected_output: >
    A fully fledged report with main topics, each with a full section of information.
  agent: reporting_analyst
  output_file: report.md
```

**Key Features**:
- Separation of concerns (agents vs tasks)
- Template variable support (`{topic}`)
- Built-in output file management
- Decorator-based Python integration (@agent, @task, @crew)

### Microsoft AutoGen: Code-First Agent Definitions

**Repository**: https://github.com/microsoft/autogen  
**Status**: Active, moving to Microsoft Agent Framework

AutoGen uses programmatic agent definition with direct Python instantiation:

```python
import asyncio
from autogen_agentchat.agents import AssistantAgent
from autogen_ext.models.openai import OpenAIChatCompletionClient

async def main():
    model_client = OpenAIChatCompletionClient(model="gpt-4.1")
    
    math_agent = AssistantAgent(
        "math_expert",
        model_client=model_client,
        system_message="You are a math expert.",
        description="A math expert assistant.",
        model_client_stream=True,
    )
    
    chemistry_agent = AssistantAgent(
        "chemistry_expert", 
        model_client=model_client,
        system_message="You are a chemistry expert.",
        description="A chemistry expert assistant.",
        model_client_stream=True,
    )
```

**Key Features**:
- Fully programmatic configuration
- Native MCP workbench integration
- Layered architecture (Core/AgentChat/Extensions APIs)
- Built-in streaming support

### LangGraph: State Graph Definitions

**Repository**: https://github.com/langchain-ai/langgraph  
**Status**: Active, production-ready

LangGraph uses a state-based graph approach for agent workflows:

```python
from langgraph.graph import START, StateGraph
from typing_extensions import TypedDict

class State(TypedDict):
    text: str

def node_a(state: State) -> dict:
    return {"text": state["text"] + "a"}

def node_b(state: State) -> dict:
    return {"text": state["text"] + "b"}

graph = StateGraph(State)
graph.add_node("node_a", node_a)
graph.add_node("node_b", node_b)
graph.add_edge(START, "node_a")
graph.add_edge("node_a", "node_b")
```

**Key Features**:
- State-driven architecture
- Durable execution with automatic recovery
- Human-in-the-loop interrupts
- Visual debugging with LangSmith

### OpenAI Swarm: Lightweight Agent Handoffs

**Repository**: https://github.com/openai/swarm  
**Status**: **DEPRECATED** → Replaced by OpenAI Agents SDK

Swarm introduced the elegant handoff pattern that influenced many frameworks:

```python
from swarm import Swarm, Agent

def transfer_to_agent_b():
    return agent_b

agent_a = Agent(
    name="Agent A",
    instructions="You are a helpful agent.",
    functions=[transfer_to_agent_b],
)

agent_b = Agent(
    name="Agent B", 
    instructions="Only speak in Haikus.",
)

client = Swarm()
response = client.run(
    agent=agent_a,
    messages=[{"role": "user", "content": "I want to talk to agent B."}],
)
```

**Key Innovation**: Simple function-based agent handoffs became a widely adopted pattern.

### Cursor: `.cursorrules` Files

**Repository**: https://github.com/PatrickJS/awesome-cursorrules  
**Status**: Active, IDE-integrated

Cursor uses simple text files for AI behavior customization:

```
# .cursorrules
You are an expert in TypeScript, Node.js, Next.js, React, and Tailwind CSS.

## Code Style and Structure
- Write concise, technical TypeScript code with accurate examples
- Use functional and declarative programming patterns
- Prefer iteration and modularization over code duplication
- Use descriptive variable names with auxiliary verbs (e.g., isLoading, hasError)

## Naming Conventions
- Use lowercase with dashes for directories (e.g., components/auth-wizard)
- Favor named exports for components and utilities

## TypeScript Usage
- Use TypeScript for all code; prefer interfaces over types
- Avoid enums; use const assertions or maps instead
- Use functional components with TypeScript interfaces
```

**Key Features**:
- Natural language configuration
- Project-specific AI behavior
- IDE integration (no separate runtime)
- Simple file-based approach

### OpenClaw: Multi-File Agent Identity

**Status**: Active (based on current runtime context)

OpenClaw uses multiple specialized files for agent definition:

- `SOUL.md` - Agent personality and behavior guidelines  
- `AGENTS.md` - Operational instructions and memory management
- `TOOLS.md` - Local configuration and preferences
- `MEMORY.md` - Long-term curated memories (main session only)
- `memory/YYYY-MM-DD.md` - Daily interaction logs
- `openclaw.json` - Project configuration

**Key Features**:
- Clear separation between identity, instructions, and memory
- Security-conscious memory loading (MEMORY.md only in main sessions)
- File-based persistence with daily granularity
- Natural language configuration approach

## 2. MCP Server Integration Patterns

### Model Context Protocol Overview

**Repository**: https://github.com/modelcontextprotocol/modelcontextprotocol  
**Status**: Active specification

MCP provides a standardized protocol for tool integration across AI applications.

### AutoGen: Native MCP Workbench

AutoGen has first-class MCP support through the `McpWorkbench`:

```python
from autogen_ext.tools.mcp import McpWorkbench, StdioServerParams

server_params = StdioServerParams(
    command="npx",
    args=["@playwright/mcp@latest", "--headless"],
)

async with McpWorkbench(server_params) as mcp:
    agent = AssistantAgent(
        "web_browsing_assistant",
        model_client=model_client,
        workbench=mcp,  # For multiple servers: [mcp1, mcp2, ...]
        max_tool_iterations=10,
    )
```

**Pattern**: Per-agent MCP server assignment with list support for multiple servers.

### Claude Desktop: Global MCP Configuration  

Claude uses `mcp.json` for global MCP server configuration:

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest"]
    },
    "filesystem": {
      "command": "uvx",
      "args": ["mcp-server-filesystem", "/path/to/allowed/files"]
    }
  },
  "toolConfiguration": {
    "playwright": "enabled",
    "filesystem": "deferred"
  }
}
```

**Pattern**: Global server registry with per-tool enabling controls.

### API Key Management Patterns

1. **Environment Variables** (Most common)
   - `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, etc.
   - Project-level `.env` files

2. **Global Configuration** 
   - `~/.config/openclaw/config.json`
   - Platform keychain integration

3. **Per-Project Secrets**
   - Project `.env` (gitignored)
   - CI/CD pipeline secrets

## 3. Knowledge/Memory Architecture

### OpenClaw: File-Based Hierarchical Memory

```
workspace/
├── MEMORY.md              # Curated long-term memory (main session only)
├── memory/
│   ├── 2026-03-10.md     # Daily interaction logs
│   ├── 2026-03-09.md
│   └── heartbeat-state.json
└── AGENTS.md              # Instructions for memory management
```

**Pattern**: 
- Raw logs in daily files
- Curated insights in MEMORY.md
- Security-conscious loading (private data only in main sessions)

### Letta (formerly MemGPT): Tiered Memory System

**Repository**: https://github.com/letta-ai/letta

```python
from letta_client import Letta

agent_state = client.agents.create(
    model="openai/gpt-5.2",
    memory_blocks=[
        {
            "label": "human",
            "value": "Name: John. Status: user. Occupation: software engineer"
        },
        {
            "label": "persona", 
            "value": "I am a helpful assistant specialized in code review."
        }
    ],
    tools=["web_search", "fetch_webpage"]
)
```

**Memory Architecture**:
- **Core Memory**: Always-active working memory
- **Archival Memory**: Long-term searchable storage  
- **Recall Memory**: Conversation history management
- **Memory Blocks**: Structured labeled memory segments

### Claude Projects: File-Based Knowledge

Claude Projects use uploaded files as knowledge sources:
- Project files automatically included in context
- No explicit memory persistence between conversations
- Knowledge through document embedding and retrieval

### LangGraph: State-Based Memory

```python
class AgentState(BaseModel):
    messages: List[BaseMessage]
    context: Dict[str, Any]
    memory_snapshot: Optional[str]

# Memory persisted in state between turns
graph.add_node("memory_update", update_memory_state)
```

## 4. Multi-Agent Composition

### CrewAI: Agent + Task + Crew Model

```python
@CrewBase
class AnalysisCrew:
    @agent
    def researcher(self) -> Agent:
        return Agent(config=self.agents_config['researcher'])
    
    @agent  
    def analyst(self) -> Agent:
        return Agent(config=self.agents_config['analyst'])
    
    @crew
    def crew(self) -> Crew:
        return Crew(
            agents=self.agents,
            tasks=self.tasks,
            process=Process.sequential,  # or Process.hierarchical
        )
```

**Key Features**:
- Declarative team composition
- Process types: Sequential, Hierarchical (with auto-manager)
- Built-in task delegation and result aggregation

### CrewAI Flows: Event-Driven Composition

```python
class AdvancedAnalysisFlow(Flow[MarketState]):
    @start()
    def fetch_market_data(self):
        return {"sector": "tech", "timeframe": "1W"}
    
    @listen(fetch_market_data)
    def analyze_with_crew(self, market_data):
        crew = Crew(agents=[analyst, researcher], tasks=[analysis_task])
        return crew.kickoff(inputs=market_data)
    
    @router(analyze_with_crew) 
    def determine_next_steps(self):
        if self.state.confidence > 0.8:
            return "high_confidence"
        return "low_confidence"
```

**Innovation**: Combines autonomous crews with deterministic flow control.

### AutoGen: ConversableAgent Groups

```python
# Multi-agent orchestration via AgentTool
math_agent_tool = AgentTool(math_agent, return_value_as_last_message=True)
chemistry_agent_tool = AgentTool(chemistry_agent, return_value_as_last_message=True)

orchestrator = AssistantAgent(
    "assistant",
    tools=[math_agent_tool, chemistry_agent_tool],
    max_tool_iterations=10,
)
```

**Pattern**: Flat tool-based composition with recursive agent calling.

### LangGraph: State Graph Orchestration

```python
# Multi-agent as graph nodes
def route_to_specialist(state):
    if "math" in state["query"]:
        return "math_agent"
    elif "code" in state["query"]:
        return "code_agent"
    return "general_agent"

graph = StateGraph(State)
graph.add_node("router", route_to_specialist)
graph.add_node("math_agent", math_specialist)
graph.add_node("code_agent", code_specialist)
graph.add_conditional_edges("router", route_to_specialist)
```

**Pattern**: State machines with conditional routing between specialized agents.

### OpenAI Swarm: Function-Based Handoffs (Deprecated)

```python
def escalate_to_human():
    return human_agent

def transfer_to_sales():
    return sales_agent

support_agent = Agent(
    instructions="Handle customer support",
    functions=[escalate_to_human, transfer_to_sales]
)
```

**Legacy Innovation**: Inspired the handoff pattern adopted by other frameworks.

## 5. Context Engineering Patterns

### Static vs Dynamic Context Assembly

**Static Approaches**:
- **Cursor**: `.cursorrules` loaded once per session
- **Claude Projects**: Knowledge files pre-embedded
- **CrewAI**: YAML configs parsed at instantiation

**Dynamic Approaches**:
- **OpenClaw**: Selective memory loading based on session type
- **LangGraph**: State-driven context updates
- **Letta**: Adaptive memory retrieval based on relevance

### Token Budget Management

**CrewAI Context Variables**:
```python
def instructions(context_variables):
    user_name = context_variables["user_name"]
    return f"Help {user_name} with their tasks. Current context: {context_variables}"
```

**AutoGen Streaming**:
- Built-in token-efficient streaming
- Lazy evaluation of tool results

**OpenClaw Memory Rotation**:
```markdown
## Memory Maintenance (During Heartbeats)
1. Read recent daily files
2. Identify significant events worth keeping
3. Update MEMORY.md with distilled learnings  
4. Remove outdated info from MEMORY.md
```

### Source Prioritization Patterns

1. **Hierarchical Priority** (OpenClaw):
   - SOUL.md (identity) > AGENTS.md (instructions) > memory files

2. **Recency-Based** (Letta):
   - Recent interactions weighted higher in memory retrieval

3. **Relevance-Driven** (LangGraph):
   - Context assembly based on current state and task requirements

4. **Tool-Specific** (AutoGen):
   - MCP server outputs prioritized by tool execution order

## Key Findings & Trends

### 1. Configuration Philosophy Divide

**Declarative/Config-First**: CrewAI (YAML), Cursor (text), OpenClaw (markdown)
- ✅ Human-readable and version-controllable
- ✅ Non-technical team members can contribute  
- ❌ Less programmatic flexibility

**Programmatic/Code-First**: AutoGen, LangGraph
- ✅ Full programming language expressiveness
- ✅ Dynamic configuration and runtime adaptation
- ❌ Higher technical barrier to entry

### 2. Memory Architecture Evolution

**Trend**: Moving from stateless to stateful agents
- Early: Stateless conversation turns (ChatGPT model)
- Current: Persistent memory with retrieval (Letta, OpenClaw)
- Emerging: Hierarchical memory with automatic curation

### 3. MCP Integration Maturity

**Leaders**: AutoGen (native workbench), Claude Desktop (global config)
**Followers**: Other frameworks implementing MCP server support
**Trend**: Moving toward standardized tool integration

### 4. Multi-Agent Orchestration Patterns

**Sequential Handoffs**: Swarm → CrewAI → AutoGen tools
**State Graphs**: LangGraph's conditional routing
**Event-Driven**: CrewAI Flows
**Trend**: Hybrid approaches combining autonomy with control

### 5. Context Engineering Best Practices

**Emerging Consensus**:
1. **Layered Context**: Identity → Instructions → Recent Memory → Task Context
2. **Security-Conscious Loading**: Private data only in appropriate contexts
3. **Adaptive Compression**: Summarization and curation over time
4. **Source Attribution**: Clear provenance for retrieved context

## Recommendations for Framework Designers

1. **Adopt MCP Standard**: Native MCP support is becoming table stakes
2. **Hybrid Configuration**: Support both declarative and programmatic approaches
3. **Memory Hierarchy**: Implement tiered memory with automatic curation  
4. **Security by Design**: Context isolation and access controls
5. **Observable Orchestration**: Built-in debugging and flow visualization
6. **Token Economy**: Intelligent context compression and prioritization

## Framework Maturity Assessment

| Framework | Config | Memory | MCP | Multi-Agent | Production |
|-----------|--------|--------|-----|-------------|------------|
| CrewAI | 🟢 YAML | 🟡 Tasks | 🔴 Planned | 🟢 Crews+Flows | 🟢 Ready |
| AutoGen | 🟢 Code | 🟡 State | 🟢 Native | 🟡 Tools | 🟢 Ready |
| LangGraph | 🟢 Code | 🟢 Persistent | 🟡 Planned | 🟢 Graphs | 🟢 Ready |
| Letta | 🟡 API | 🟢 Tiered | 🟡 Basic | 🔴 Limited | 🟡 Beta |
| OpenClaw | 🟢 Files | 🟢 Hierarchical | ✅ Native | 🟡 Spawn | 🟢 Ready |
| Cursor | 🟢 Text | 🔴 None | 🔴 N/A | 🔴 N/A | 🟢 Ready |

**Legend**: 🟢 Excellent, 🟡 Good, 🔴 Limited, ✅ Built-in

---

*This research represents the state of AI agent frameworks as of March 2026. The field is rapidly evolving, and framework capabilities may have advanced since this analysis.*