import { useState } from 'react';
import { Wrench, Check, X, Loader2 } from 'lucide-react';
import { useTheme } from '../../theme';
import type { ToolEvent } from '../../store/activityStore';

interface ToolCallCardProps {
  event: ToolEvent;
  resultEvent?: ToolEvent;
  defaultExpanded?: boolean;
}

function argsSummary(args: Record<string, unknown> | undefined): string {
  if (!args) return '';
  const entries = Object.entries(args)
    .map(([k, v]) => `${k}: ${typeof v === 'string' ? JSON.stringify(v) : JSON.stringify(v)}`)
    .join(', ');
  return entries.length > 80 ? entries.slice(0, 77) + '...' : entries;
}

export function ToolCallCard({ event, resultEvent, defaultExpanded = false }: ToolCallCardProps) {
  const t = useTheme();
  const [expanded, setExpanded] = useState(defaultExpanded);

  const isRunning = !resultEvent;
  const isError = resultEvent?.type === 'tool_error';
  const isSuccess = resultEvent?.type === 'tool_result';

  const statusColor = isRunning ? '#3498db' : isError ? '#e74c3c' : '#2ecc71';
  const borderColor = isRunning ? '#3498db30' : isError ? '#e74c3c30' : '#2ecc7130';

  return (
    <div
      style={{
        border: `1px solid ${borderColor}`,
        borderRadius: 6,
        overflow: 'hidden',
        background: t.isDark ? '#13131a' : '#f8f8fc',
        marginBottom: 4,
      }}
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="flex items-center gap-2 w-full text-left border-none cursor-pointer"
        style={{
          padding: '6px 10px',
          background: 'transparent',
          minHeight: 36,
        }}
      >
        {/* Tool icon */}
        <Wrench size={12} style={{ color: statusColor, flexShrink: 0 }} />

        {/* Tool name */}
        <span style={{
          fontFamily: "'Geist Mono', monospace",
          fontSize: 12,
          color: t.textPrimary,
          fontWeight: 500,
        }}>
          {event.toolName}
        </span>

        {/* Server badge */}
        {event.serverName && (
          <span style={{
            fontSize: 10,
            padding: '1px 5px',
            borderRadius: 3,
            background: t.isDark ? '#2a2a35' : '#e8e8f0',
            color: t.textDim,
            fontFamily: "'Geist Mono', monospace",
          }}>
            {event.serverName}
          </span>
        )}

        {/* Status indicator */}
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
          {isRunning && (
            <Loader2
              size={12}
              style={{ color: '#3498db', animation: 'spin 1s linear infinite' }}
            />
          )}
          {isSuccess && <Check size={12} style={{ color: '#2ecc71' }} />}
          {isError && <X size={12} style={{ color: '#e74c3c' }} />}

          {resultEvent?.durationMs != null && (
            <span style={{
              fontFamily: "'Geist Mono', monospace",
              fontSize: 10,
              color: t.textFaint,
            }}>
              {resultEvent.durationMs}ms
            </span>
          )}
        </span>

        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </button>

      {/* Collapsed one-liner */}
      {!expanded && event.args && (
        <div style={{
          padding: '0 10px 6px',
          fontFamily: "'Geist Mono', monospace",
          fontSize: 11,
          color: t.textFaint,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {argsSummary(event.args)}
        </div>
      )}

      {/* Expanded detail */}
      {expanded && (
        <div style={{
          borderTop: `1px solid ${t.border}`,
          padding: '8px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}>
          {event.args && (
            <div>
              <div style={{ fontSize: 10, color: t.textDim, fontFamily: "'Geist Sans', sans-serif", marginBottom: 3 }}>
                Arguments
              </div>
              <pre style={{
                margin: 0,
                fontFamily: "'Geist Mono', monospace",
                fontSize: 11,
                color: t.textSecondary,
                background: t.isDark ? '#0d0d12' : '#ebebf5',
                borderRadius: 4,
                padding: '6px 8px',
                overflowX: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}>
                {JSON.stringify(event.args, null, 2)}
              </pre>
            </div>
          )}

          {resultEvent && (resultEvent.result || resultEvent.error) && (
            <div>
              <div style={{ fontSize: 10, color: t.textDim, fontFamily: "'Geist Sans', sans-serif", marginBottom: 3 }}>
                {resultEvent.error ? 'Error' : 'Result'}
              </div>
              <pre style={{
                margin: 0,
                fontFamily: "'Geist Mono', monospace",
                fontSize: 11,
                color: isError ? '#e74c3c' : t.textSecondary,
                background: t.isDark ? '#0d0d12' : '#ebebf5',
                borderRadius: 4,
                padding: '6px 8px',
                overflowX: 'auto',
                overflowY: 'auto',
                maxHeight: 300,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}>
                {resultEvent.error ?? resultEvent.result}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
