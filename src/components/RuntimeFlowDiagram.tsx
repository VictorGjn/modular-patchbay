import { type ReactNode } from 'react';
import { GitBranch, Layers, Cpu, Database, Zap, Brain, BarChart3 } from 'lucide-react';
import { useTheme } from '../theme';
import { Card, Badge } from './ds';

export interface RuntimeFlowDiagramProps {
  /** Optional: highlight a specific stage */
  activeStage?: string;
  /** Optional: show live stats from a running pipeline */
  stats?: {
    systemTokens?: number;
    knowledgeTokens?: number;
    totalTokens?: number;
    toolTurns?: number;
    pipelineDurationMs?: number;
  };
  /** Compact mode for embedding in panels */
  compact?: boolean;
}

interface StageNode {
  id: string;
  name: string;
  description: string;
  icon: ReactNode;
  color: string;
  inputs?: string[];
  outputs?: string[];
  type: 'input' | 'processing' | 'output' | 'llm';
}

interface Connection {
  from: string;
  to: string;
  label: string;
  path?: 'top' | 'bottom'; // For Source Router split
}

export function RuntimeFlowDiagram({ activeStage, stats, compact = false }: RuntimeFlowDiagramProps) {
  const t = useTheme();

  const stages: StageNode[] = [
    {
      id: 'systemFrame',
      name: 'System Frame',
      description: 'Agent config assembly',
      icon: <Database size={compact ? 14 : 16} />,
      color: '#3498db', // Blue for input/config
      type: 'input',
      inputs: ['Agent Config'],
      outputs: ['<identity>', '<instructions>', '<constraints>', '<workflow>', '<tool_guide>']
    },
    {
      id: 'sourceRouter',
      name: 'Source Router',
      description: 'Channel routing',
      icon: <GitBranch size={compact ? 14 : 16} />,
      color: '#FE5000', // Orange for processing
      type: 'processing',
      inputs: ['ChannelConfig[]'],
      outputs: ['Framework Channels', 'Regular Channels']
    },
    {
      id: 'knowledgePipeline',
      name: 'Knowledge Pipeline',
      description: 'Content processing',
      icon: <Cpu size={compact ? 14 : 16} />,
      color: '#FE5000', // Orange for processing
      type: 'processing',
      inputs: ['Regular Channels', 'Tree Indexes'],
      outputs: ['<knowledge>']
    },
    {
      id: 'contextAssembler',
      name: 'Context Assembler',
      description: 'Prompt assembly',
      icon: <Layers size={compact ? 14 : 16} />,
      color: '#FE5000', // Orange for processing
      type: 'processing',
      inputs: ['Frame', 'Orientation', 'Knowledge', 'Framework', 'Memory'],
      outputs: ['System Prompt']
    },
    {
      id: 'executionRouter',
      name: 'Execution Router',
      description: 'Response generation',
      icon: <Brain size={compact ? 14 : 16} />,
      color: '#9b59b6', // Purple for LLM/AI
      type: 'llm',
      inputs: ['System Prompt', 'History', 'User Message'],
      outputs: ['Response Text', 'Tool Results']
    },
    {
      id: 'postProcessor',
      name: 'Post Processor',
      description: 'Memory & analytics',
      icon: <BarChart3 size={compact ? 14 : 16} />,
      color: '#2ecc71', // Green for output
      type: 'output',
      inputs: ['Full Response', 'Channels'],
      outputs: ['Heatmap', 'Memory Stats']
    },
    {
      id: 'memoryPipeline',
      name: 'Memory Pipeline',
      description: 'Fact extraction',
      icon: <Zap size={compact ? 14 : 16} />,
      color: '#9b59b6', // Purple for LLM/AI
      type: 'llm',
      inputs: ['Response Context'],
      outputs: ['Memory Facts']
    }
  ];

  const connections: Connection[] = [
    { from: 'systemFrame', to: 'sourceRouter', label: 'Frame Data' },
    { from: 'sourceRouter', to: 'knowledgePipeline', label: 'Regular Channels', path: 'bottom' },
    { from: 'knowledgePipeline', to: 'contextAssembler', label: '<knowledge>' },
    { from: 'contextAssembler', to: 'executionRouter', label: 'System Prompt' },
    { from: 'executionRouter', to: 'postProcessor', label: 'Full Response' },
    { from: 'postProcessor', to: 'memoryPipeline', label: 'Response Context' },
    // Memory pipeline also has a pre-recall connection
    { from: 'memoryPipeline', to: 'contextAssembler', label: 'Memory Facts', path: 'top' }
  ];

  const nodeWidth = compact ? 120 : 140;
  const nodeHeight = compact ? 60 : 80;
  const stageSpacing = compact ? 160 : 200;
  const totalWidth = stages.length * stageSpacing;
  const totalHeight = compact ? 200 : 300;

  const renderNode = (stage: StageNode, index: number) => {
    const x = index * stageSpacing + 20;
    const y = totalHeight / 2 - nodeHeight / 2;
    const isActive = activeStage === stage.id;
    const isHighlighted = isActive;

    return (
      <g key={stage.id}>
        {/* Node background */}
        <rect
          x={x}
          y={y}
          width={nodeWidth}
          height={nodeHeight}
          rx={8}
          fill={isHighlighted ? stage.color + '20' : t.surfaceOpaque}
          stroke={isHighlighted ? stage.color : t.border}
          strokeWidth={isHighlighted ? 2 : 1}
          style={{
            filter: isHighlighted ? `drop-shadow(0 0 8px ${stage.color}40)` : undefined
          }}
        />
        
        {/* Icon */}
        <foreignObject x={x + 8} y={y + 8} width={24} height={24}>
          <div style={{ color: stage.color }}>
            {stage.icon}
          </div>
        </foreignObject>
        
        {/* Stage name */}
        <text
          x={x + nodeWidth / 2}
          y={y + (compact ? 25 : 30)}
          textAnchor="middle"
          style={{
            fill: t.textPrimary,
            fontSize: compact ? 10 : 11,
            fontWeight: '600',
            fontFamily: "'Geist Mono', monospace"
          }}
        >
          {stage.name}
        </text>
        
        {/* Description */}
        <text
          x={x + nodeWidth / 2}
          y={y + (compact ? 38 : 45)}
          textAnchor="middle"
          style={{
            fill: t.textSecondary,
            fontSize: compact ? 8 : 9,
            fontFamily: "'Geist Mono', monospace"
          }}
        >
          {stage.description}
        </text>

        {/* Special handling for Source Router split visualization */}
        {stage.id === 'sourceRouter' && (
          <>
            {/* Split indicator */}
            <circle
              cx={x + nodeWidth + 5}
              cy={y + nodeHeight / 2}
              r={3}
              fill={stage.color}
            />
            {/* Framework path (top) */}
            <line
              x1={x + nodeWidth + 5}
              y1={y + nodeHeight / 2}
              x2={x + nodeWidth + 30}
              y2={y + 10}
              stroke={t.textMuted}
              strokeWidth={1}
              strokeDasharray="2,2"
            />
            {/* Regular path (bottom) */}
            <line
              x1={x + nodeWidth + 5}
              y1={y + nodeHeight / 2}
              x2={x + nodeWidth + 30}
              y2={y + nodeHeight - 10}
              stroke={t.textMuted}
              strokeWidth={1}
              strokeDasharray="2,2"
            />
            <text
              x={x + nodeWidth + 35}
              y={y + 15}
              style={{
                fill: t.textMuted,
                fontSize: 12,
                fontFamily: "'Geist Mono', monospace"
              }}
            >
              Framework
            </text>
            <text
              x={x + nodeWidth + 35}
              y={y + nodeHeight - 5}
              style={{
                fill: t.textMuted,
                fontSize: 12,
                fontFamily: "'Geist Mono', monospace"
              }}
            >
              Regular
            </text>
          </>
        )}

        {/* Context Assembler layer visualization */}
        {stage.id === 'contextAssembler' && (
          <>
            <rect
              x={x + 10}
              y={y + nodeHeight - 15}
              width={nodeWidth - 20}
              height={2}
              fill={stage.color + '40'}
              rx={1}
            />
            <rect
              x={x + 10}
              y={y + nodeHeight - 12}
              width={nodeWidth - 20}
              height={2}
              fill={stage.color + '60'}
              rx={1}
            />
            <rect
              x={x + 10}
              y={y + nodeHeight - 9}
              width={nodeWidth - 20}
              height={2}
              fill={stage.color + '80'}
              rx={1}
            />
          </>
        )}
      </g>
    );
  };

  const renderConnection = (conn: Connection, index: number) => {
    const fromIndex = stages.findIndex(s => s.id === conn.from);
    const toIndex = stages.findIndex(s => s.id === conn.to);
    
    if (fromIndex === -1 || toIndex === -1) return null;

    const fromX = fromIndex * stageSpacing + 20 + nodeWidth;
    const toX = toIndex * stageSpacing + 20;
    const centerY = totalHeight / 2;
    
    // Handle special paths for Source Router and Memory Pipeline
    let fromY = centerY;
    let toY = centerY;
    let pathOffset = 0;

    if (conn.path === 'top') {
      pathOffset = -30;
      fromY = centerY + pathOffset;
      toY = centerY + pathOffset;
    } else if (conn.path === 'bottom') {
      pathOffset = 30;
      fromY = centerY + pathOffset;
      toY = centerY + pathOffset;
    }

    // Special handling for memory pipeline return path
    if (conn.from === 'memoryPipeline' && conn.to === 'contextAssembler') {
      fromY = centerY;
      toY = centerY - 40;
    }

    const midX = (fromX + toX) / 2;
    const controlOffset = 30;

    return (
      <g key={`${conn.from}-${conn.to}-${index}`}>
        {/* Connection path */}
        <path
          d={`M ${fromX} ${fromY} C ${fromX + controlOffset} ${fromY}, ${toX - controlOffset} ${toY}, ${toX} ${toY}`}
          fill="none"
          stroke={t.textMuted}
          strokeWidth={1.5}
          strokeDasharray="4,2"
          style={{
            animation: 'flowAnimation 2s linear infinite'
          }}
        />
        
        {/* Arrow */}
        <polygon
          points={`${toX},${toY} ${toX - 6},${toY - 3} ${toX - 6},${toY + 3}`}
          fill={t.textMuted}
        />
        
        {/* Label */}
        <text
          x={midX}
          y={fromY + (toY - fromY) / 2 - 5}
          textAnchor="middle"
          style={{
            fill: t.textMuted,
            fontSize: compact ? 7 : 8,
            fontFamily: "'Geist Mono', monospace"
          }}
        >
          {conn.label}
        </text>
      </g>
    );
  };

  const renderStats = () => {
    if (!stats) return null;
    
    return (
      <div 
        className="absolute top-2 right-2 flex gap-2"
        style={{ fontSize: compact ? 10 : 11 }}
      >
        {stats.systemTokens && (
          <Badge variant="info" size="sm">
            Sys: {stats.systemTokens.toLocaleString()}
          </Badge>
        )}
        {stats.knowledgeTokens && (
          <Badge variant="neutral" size="sm">
            Know: {stats.knowledgeTokens.toLocaleString()}
          </Badge>
        )}
        {stats.totalTokens && (
          <Badge variant="success" size="sm">
            Total: {stats.totalTokens.toLocaleString()}
          </Badge>
        )}
        {stats.toolTurns !== undefined && (
          <Badge variant="warning" size="sm">
            Tools: {stats.toolTurns}
          </Badge>
        )}
        {stats.pipelineDurationMs && (
          <Badge variant="neutral" size="sm">
            {stats.pipelineDurationMs}ms
          </Badge>
        )}
      </div>
    );
  };

  return (
    <Card className="relative">
      <div className="relative" style={{ height: compact ? 220 : 320 }}>
        <style>{`
          @keyframes flowAnimation {
            0% { stroke-dashoffset: 0; }
            100% { stroke-dashoffset: 12; }
          }
        `}</style>
        
        <svg
          width={totalWidth + 40}
          height={totalHeight}
          viewBox={`0 0 ${totalWidth + 40} ${totalHeight}`}
          className="w-full h-full"
        >
          {/* Render connections first (behind nodes) */}
          {connections.map(renderConnection)}
          
          {/* Render nodes */}
          {stages.map(renderNode)}
        </svg>

        {renderStats()}

        {/* Pipeline title */}
        <div
          className="absolute bottom-2 left-2"
          style={{
            color: t.textSecondary,
            fontSize: compact ? 9 : 10,
            fontFamily: "'Geist Mono', monospace",
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}
        >
          Knowledge Pipeline Flow
        </div>
      </div>
    </Card>
  );
}