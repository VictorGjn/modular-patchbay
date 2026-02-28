import { memo, useState, useCallback } from 'react';
import { Position } from '@xyflow/react';
import { ResizeHandle } from '../components/ResizeHandle';
import { JackPort } from '../components/JackPort';
import { useConsoleStore } from '../store/consoleStore';
import { useTheme } from '../theme';
import { User, ChevronDown, ChevronRight } from 'lucide-react';

const PRESET_EMOJIS = ['🤖', '👨‍💻', '👩‍💻', '🧠', '⚡', '🔥', '💡', '🎯', '🚀', '🛡️', '🔬', '📊', '🎨', '📝', '🎭', '🌟', '💎', '🦉', '🦋', '🐱'];

export const IdentityNode = memo(function IdentityNode() {
  const t = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [editingName, setEditingName] = useState(false);

  const agentMeta = useConsoleStore((s) => s.agentMeta);
  const setAgentMeta = useConsoleStore((s) => s.setAgentMeta);

  const handleTagsChange = useCallback((value: string) => {
    const tags = value.split(',').map(tag => tag.trim()).filter(Boolean);
    setAgentMeta({ tags });
  }, [setAgentMeta]);

  const inputStyle = {
    background: t.inputBg,
    border: `1px solid ${t.border}`,
    color: t.textPrimary,
    fontFamily: "'Space Mono', monospace",
    fontSize: 11,
  };

  return (
    <div
      className="flex flex-col rounded-lg overflow-hidden"
      style={{
        background: t.surfaceOpaque,
        border: `1px solid ${t.border}`,
        minWidth: 300,
        minHeight: collapsed ? 44 : 200,
        width: 300,
        boxShadow: `0 2px 12px ${t.isDark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.08)'}`,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 shrink-0 cursor-pointer select-none"
        style={{
          height: 36,
          background: t.surfaceElevated,
          borderBottom: `1px solid ${t.border}`,
        }}
        onClick={() => setCollapsed(!collapsed)}
      >
        <button type="button" className="p-0 border-none bg-transparent cursor-pointer" style={{ color: t.textDim }} aria-label={collapsed ? 'Expand' : 'Collapse'}>
          {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        </button>
        <User size={12} style={{ color: '#FE5000' }} />
        <span className="text-[10px] font-bold tracking-widest uppercase" style={{ fontFamily: "'Space Mono', monospace", color: t.textPrimary }}>
          Identity
        </span>
        {agentMeta.name && (
          <span className="text-[9px] ml-auto px-1.5 py-0.5 rounded" style={{ background: '#FE500015', color: '#FE5000', fontFamily: "'Space Mono', monospace" }}>
            {agentMeta.name.slice(0, 20)}{agentMeta.name.length > 20 ? '…' : ''}
          </span>
        )}

        <JackPort id="identity-out" type="source" position={Position.Right} color="#FE5000" label="OUT" side="right" />
      </div>

      {!collapsed && (
        <div className="flex-1 p-3 flex flex-col gap-3 overflow-y-auto nowheel nodrag">
          {/* Avatar and Name row */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="w-12 h-12 text-xl border rounded-lg cursor-pointer nodrag flex items-center justify-center"
                style={{
                  background: t.surfaceElevated,
                  border: `1px solid ${t.border}`,
                  color: t.textPrimary,
                }}
                title="Click to change avatar"
              >
                {agentMeta.avatar}
              </button>

              {/* Emoji picker popup */}
              {showEmojiPicker && (
                <div
                  className="absolute top-14 left-0 z-50 grid grid-cols-5 gap-1 p-2 rounded-lg border"
                  style={{
                    background: t.surfaceOpaque,
                    border: `1px solid ${t.border}`,
                    boxShadow: `0 4px 12px ${t.isDark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.15)'}`,
                  }}
                >
                  {PRESET_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => {
                        setAgentMeta({ avatar: emoji });
                        setShowEmojiPicker(false);
                      }}
                      className="w-8 h-8 text-sm border-none rounded cursor-pointer nodrag flex items-center justify-center hover:bg-opacity-20"
                      style={{
                        background: agentMeta.avatar === emoji ? '#FE500020' : 'transparent',
                      }}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex-1">
              {editingName ? (
                <input
                  type="text"
                  value={agentMeta.name}
                  onChange={(e) => setAgentMeta({ name: e.target.value })}
                  onBlur={() => setEditingName(false)}
                  onKeyDown={(e) => { if (e.key === 'Enter') setEditingName(false); }}
                  placeholder="Agent name"
                  className="w-full text-sm px-2 py-1 rounded outline-none nodrag"
                  style={inputStyle}
                  autoFocus
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setEditingName(true)}
                  className="text-left text-sm font-semibold cursor-pointer border-none bg-transparent p-0 nodrag"
                  style={{ color: agentMeta.name ? t.textPrimary : t.textMuted }}
                >
                  {agentMeta.name || 'Click to set name'}
                </button>
              )}
            </div>
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1">
            <label className="text-[9px] tracking-wider uppercase font-semibold" style={{ color: t.textMuted, fontFamily: "'Space Mono', monospace" }}>
              Description
            </label>
            <textarea
              value={agentMeta.description}
              onChange={(e) => setAgentMeta({ description: e.target.value })}
              placeholder="Describe what this agent does..."
              className="w-full text-xs px-2 py-1.5 rounded outline-none resize-y nowheel nodrag"
              style={{ ...inputStyle, minHeight: 60 }}
            />
          </div>

          {/* Tags */}
          <div className="flex flex-col gap-1">
            <label className="text-[9px] tracking-wider uppercase font-semibold" style={{ color: t.textMuted, fontFamily: "'Space Mono', monospace" }}>
              Tags
            </label>
            <input
              type="text"
              value={agentMeta.tags.join(', ')}
              onChange={(e) => handleTagsChange(e.target.value)}
              placeholder="ai, assistant, helpful"
              className="w-full text-xs px-2 py-1 rounded outline-none nodrag"
              style={inputStyle}
            />
            {agentMeta.tags.length > 0 && (
              <div className="flex gap-1 flex-wrap mt-1">
                {agentMeta.tags.map((tag, i) => (
                  <span
                    key={i}
                    className="text-[9px] px-1.5 py-0.5 rounded"
                    style={{
                      background: '#FE500015',
                      color: '#FE5000',
                      fontFamily: "'Space Mono', monospace",
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <ResizeHandle />
    </div>
  );
});