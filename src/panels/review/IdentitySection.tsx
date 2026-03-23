import React, { useState } from 'react';
import { User } from 'lucide-react';
import { useTheme } from '../../theme';
import { Input } from '../../components/ds/Input';
import { TextArea } from '../../components/ds/TextArea';
import { Section } from '../../components/ds/Section';
import { PRESET_AVATARS, AvatarIcon } from '../../components/ds/AvatarIcon';
import type { AgentMeta } from '../../types/console.types';

interface IdentitySectionProps {
  agentMeta: AgentMeta;
  setAgentMeta: (updates: Partial<AgentMeta>) => void;
  collapsed: boolean;
  onToggle: () => void;
}

export function IdentitySection({ agentMeta, setAgentMeta, collapsed, onToggle }: IdentitySectionProps) {
  const t = useTheme();
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [tagInput, setTagInput] = useState('');

  const avatarButtonBaseStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '80px',
    height: '80px',
    borderRadius: '8px',
    border: '2px dashed var(--border)',
    background: 'var(--surface-elevated)',
    cursor: 'pointer',
  };

  const avatarPickerStyle = {
    position: 'absolute' as const,
    top: '96px',
    left: 0,
    background: t.surfaceElevated,
    border: `1px solid ${t.border}`,
    borderRadius: '8px',
    padding: '12px',
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '8px',
    zIndex: 1000,
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
  };

  const tagStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 8px',
    background: t.badgeBg,
    color: t.textSecondary,
    borderRadius: '12px',
    fontSize: '12px',
    fontFamily: "'Geist Sans', sans-serif",
  };

  const addTag = (tag: string) => {
    if (tag && !agentMeta.tags.includes(tag)) {
      setAgentMeta({ tags: [...agentMeta.tags, tag] });
    }
  };

  const removeTag = (tag: string) => {
    setAgentMeta({ tags: agentMeta.tags.filter(t => t !== tag) });
  };

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      addTag(tagInput.trim());
      setTagInput('');
    }
  };

  return (
    <Section
      icon={User} label="Identity" color="#2393f1"
      collapsed={collapsed} onToggle={onToggle}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          <Input
            label="Agent Name"
            value={agentMeta.name}
            onChange={(e) => setAgentMeta({ name: e.target.value })}
            placeholder="Enter agent name..."
          />
          <TextArea
            label="Description"
            value={agentMeta.description}
            onChange={(e) => setAgentMeta({ description: e.target.value })}
            placeholder="Describe what this agent does..."
            rows={3}
          />
          <Input
            label="Category"
            value={agentMeta.category}
            onChange={(e) => setAgentMeta({ category: e.target.value })}
            placeholder="e.g., productivity, development, research..."
          />
        </div>
        
        {/* Avatar */}
        <div className="space-y-3">
          <label className="block text-sm font-medium" style={{ color: t.textPrimary }}>
            Avatar
          </label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowAvatarPicker(!showAvatarPicker)}
              aria-label={`Select agent avatar (currently ${agentMeta.avatar || 'default'})`}
              title="Choose avatar"
              aria-expanded={showAvatarPicker}
              aria-haspopup="menu"
              style={avatarButtonBaseStyle}
            >
              <AvatarIcon avatarId={agentMeta.avatar} size={48} />
            </button>
            
            {showAvatarPicker && (
              <div style={avatarPickerStyle}>
                {PRESET_AVATARS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setAgentMeta({ avatar: opt.id });
                      setShowAvatarPicker(false);
                    }}
                    aria-label={`Select avatar ${opt.id} as agent avatar`}
                    title={`Select ${opt.id} avatar`}
                    className="flex items-center justify-center w-12 h-12 rounded-lg cursor-pointer border-none"
                    style={{
                      background: agentMeta.avatar === opt.id ? '#FE500020' : 'transparent',
                      border: `1px solid ${agentMeta.avatar === opt.id ? '#FE5000' : 'transparent'}`,
                    }}
                  >
                    <AvatarIcon avatarId={opt.id} size={24} />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tags */}
      <div className="mt-4 space-y-3">
        <label className="block text-sm font-medium" style={{ color: t.textPrimary }}>
          Tags
        </label>
        <div className="flex flex-wrap gap-2">
          {agentMeta.tags.map((tag) => (
            <span key={tag} style={tagStyle}>
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                title={`Remove ${tag} tag`}
                className="border-none bg-transparent cursor-pointer p-0 ml-1"
                style={{ color: '#FE5000' }}
              >
                ×
              </button>
            </span>
          ))}
          <Input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleTagKeyDown}
            placeholder="Add tag..."
            className="w-24"
            style={{ minWidth: '100px' }}
          />
        </div>
      </div>
    </Section>
  );
}