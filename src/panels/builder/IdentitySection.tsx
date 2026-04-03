import { useState } from 'react';
import { useTheme } from '../../theme';
import { useConsoleStore } from '../../store/consoleStore';
import { Input } from '../../components/ds/Input';
import { TextArea } from '../../components/ds/TextArea';
import { PRESET_AVATARS, AvatarIcon } from '../../components/ds/AvatarIcon';
import { X } from 'lucide-react';

export function IdentitySection() {
  const t = useTheme();
  const agentMeta = useConsoleStore(s => s.agentMeta);
  const setAgentMeta = useConsoleStore(s => s.setAgentMeta);
  const [tagInput, setTagInput] = useState('');
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [editingName, setEditingName] = useState(false);

  return (
    <div className="px-5 py-4 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="relative">
          <button type="button" aria-label="Choose avatar" onClick={() => setShowAvatarPicker(!showAvatarPicker)}
            className="w-11 h-11 rounded-lg cursor-pointer flex items-center justify-center"
            style={{ background: 'var(--m-surface-elevated)', border: '1.5px solid var(--m-border)', color: 'var(--m-accent)' }}>
            <AvatarIcon avatarId={agentMeta.avatar} size={20} />
          </button>
          {showAvatarPicker && (
            <div className="absolute top-13 left-0 z-50 grid grid-cols-5 gap-0.5 p-2 rounded-lg"
              style={{ background: 'var(--m-surface-opaque)', border: '1px solid var(--m-border)', boxShadow: '0 8px 24px oklch(0 0 0 / 0.2)', width: 185 }}>
              {PRESET_AVATARS.map(av => {
                const Icon = av.icon;
                return (
                  <button key={av.id} type="button" title={av.id}
                    onClick={() => { setAgentMeta({ avatar: av.id }); setShowAvatarPicker(false); }}
                    className="w-8 h-8 rounded cursor-pointer flex items-center justify-center border-none"
                    style={{ background: agentMeta.avatar === av.id ? 'var(--m-accent-bg)' : 'transparent', color: agentMeta.avatar === av.id ? 'var(--m-accent)' : 'var(--m-text-secondary)' }}>
                    <Icon size={15} />
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="flex-1">
          {editingName ? (
            <Input value={agentMeta.name} onChange={e => setAgentMeta({ name: e.target.value })}
              onBlur={() => setEditingName(false)} onKeyDown={e => e.key === 'Enter' && setEditingName(false)}
              autoFocus style={{ fontSize: 19, padding: '6px 10px' }} />
          ) : (
            <button type="button" onClick={() => setEditingName(true)}
              className="text-left font-semibold cursor-pointer border-none bg-transparent p-0 w-full"
              style={{ color: agentMeta.name ? 'var(--m-text-primary)' : 'var(--m-text-muted)', fontSize: 19, fontFamily: 'var(--m-font-sans)' }}>
              {agentMeta.name || 'Click to name your agent'}
            </button>
          )}
        </div>
      </div>
      <TextArea label="Description" value={agentMeta.description}
        onChange={e => setAgentMeta({ description: e.target.value })}
        placeholder="One-line summary of what this agent does..." style={{ minHeight: 40 }} />
      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] tracking-wider uppercase font-semibold" style={{ color: 'var(--m-text-muted)', fontFamily: 'var(--m-font-mono)' }}>Tags</span>
        <div className="flex flex-wrap gap-1.5 px-2 py-1.5 rounded-lg min-h-[36px]" style={{ background: 'var(--m-input-bg)', border: '1px solid var(--m-border)' }}>
          {agentMeta.tags.map((tag, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px]"
              style={{ fontFamily: 'var(--m-font-mono)', background: 'var(--m-accent-bg)', color: 'var(--m-accent)', border: '1px solid oklch(0.63 0.24 38 / 0.19)' }}>
              {tag}
              <button type="button" onClick={() => setAgentMeta({ tags: agentMeta.tags.filter((_, j) => j !== i) })}
                className="flex items-center justify-center border-none bg-transparent cursor-pointer p-0"
                style={{ color: 'var(--m-accent)', lineHeight: 1 }} aria-label={"Remove tag"}>
                <X size={10} />
              </button>
            </span>
          ))}
          <input type="text" value={tagInput} onChange={e => setTagInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                const newTag = tagInput.trim().replace(/,$/, '');
                if (newTag && !agentMeta.tags.includes(newTag)) setAgentMeta({ tags: [...agentMeta.tags, newTag] });
                setTagInput('');
              } else if (e.key === 'Backspace' && tagInput === '' && agentMeta.tags.length > 0) {
                setAgentMeta({ tags: agentMeta.tags.slice(0, -1) });
              }
            }}
            placeholder={agentMeta.tags.length === 0 ? 'pm, analysis, competitor' : ''}
            className="flex-1 min-w-[100px] text-[12px] outline-none border-none bg-transparent"
            style={{ fontFamily: 'var(--m-font-mono)', color: 'var(--m-text-primary)' }} />
        </div>
      </div>
    </div>
  );
}
