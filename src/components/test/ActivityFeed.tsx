import { useRef, useEffect } from 'react';
import { Brain, MessageSquare, Play } from 'lucide-react';
import { useTheme } from '../../theme';
import { ToolCallCard } from './ToolCallCard';
import { TurnProgress } from './TurnProgress';
import type { ToolEvent } from '../../store/activityStore';

interface ActivityFeedProps {
  events: ToolEvent[];
  currentTurn: number;
  maxTurns: number;
  running: boolean;
  thinking?: string;
}

interface TurnGroup {
  turnNumber: number;
  events: ToolEvent[];
}

function groupByTurn(events: ToolEvent[]): TurnGroup[] {
  const groups: TurnGroup[] = [];
  let current: TurnGroup | null = null;

  for (const evt of events) {
    if (evt.type === 'turn_start') {
      current = { turnNumber: evt.turnNumber ?? groups.length + 1, events: [] };
      groups.push(current);
    } else if (current) {
      current.events.push(evt);
    } else {
      // Events before any turn_start — put in turn 1
      current = { turnNumber: 1, events: [evt] };
      groups.push(current);
    }
  }

  return groups;
}

export function ActivityFeed({ events, currentTurn, maxTurns, running, thinking }: ActivityFeedProps) {
  const t = useTheme();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events.length]);

  const groups = groupByTurn(events);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Turn progress */}
      {(running || events.length > 0) && (
        <TurnProgress current={currentTurn} max={maxTurns} running={running} />
      )}

      {groups.map((group) => {
        // Pair tool_start events with their tool_result/tool_error by order (i-th start → i-th result)
        const toolStarts = group.events.filter(e => e.type === 'tool_start');
        const toolResults = group.events.filter(e => e.type === 'tool_result' || e.type === 'tool_error');
        const resultByIndex = new Map<number, ToolEvent>();
        toolResults.forEach((evt, i) => resultByIndex.set(i, evt));

        const thinkingEvents = group.events.filter(e => e.type === 'thinking');
        const doneEvents = group.events.filter(e => e.type === 'done' || e.type === 'turn_end');

        return (
          <div key={group.turnNumber}>
            {/* Turn header */}
            <div className="flex items-center gap-2" style={{ marginBottom: 6 }}>
              <Play size={10} style={{ color: '#FE5000', flexShrink: 0 }} />
              <span style={{
                fontFamily: "'Geist Mono', monospace",
                fontSize: 10,
                color: t.textFaint,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
                Turn {group.turnNumber}
              </span>
              <div style={{ flex: 1, height: 1, background: t.border }} />
            </div>

            {/* Thinking text */}
            {thinkingEvents.map(evt => (
              <div key={evt.id} className="flex items-start gap-2" style={{ marginBottom: 4 }}>
                <Brain size={12} style={{ color: '#9b59b6', flexShrink: 0, marginTop: 2 }} />
                <span style={{
                  fontFamily: "'Geist Sans', sans-serif",
                  fontSize: 12,
                  color: t.textDim,
                  fontStyle: 'italic',
                }}>
                  {evt.result}
                </span>
              </div>
            ))}

            {/* Tool call cards */}
            {toolStarts.map((evt, i) => (
              <ToolCallCard
                key={evt.id}
                event={evt}
                resultEvent={resultByIndex.get(i)}
              />
            ))}

            {/* Done / final text */}
            {doneEvents.map(evt => evt.result ? (
              <div key={evt.id} className="flex items-start gap-2" style={{ marginTop: 4 }}>
                <MessageSquare size={12} style={{ color: t.textDim, flexShrink: 0, marginTop: 2 }} />
                <span style={{
                  fontFamily: "'Geist Sans', sans-serif",
                  fontSize: 12,
                  color: t.textSecondary,
                }}>
                  {evt.result}
                </span>
              </div>
            ) : null)}
          </div>
        );
      })}

      {/* Live thinking / streaming text */}
      {thinking && running && (
        <div className="flex items-start gap-2">
          <Brain size={12} style={{ color: '#9b59b6', flexShrink: 0, marginTop: 2 }} />
          <span style={{
            fontFamily: "'Geist Sans', sans-serif",
            fontSize: 12,
            color: t.textDim,
            fontStyle: 'italic',
          }}>
            {thinking}
          </span>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
