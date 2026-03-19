import { useState } from 'react';
import { useVersionStore, type AgentVersion, type ChangeEntry } from '../store/versionStore';
import { useTheme } from '../theme';
import { Badge, Button, IconButton, Modal } from './ds';
import { GitBranch, RotateCcw, Trash2, Save, ChevronRight, Circle } from 'lucide-react';

function ChangeIcon({ type }: { type: ChangeEntry['type'] }) {
  const colors = { major: '#FE5000', minor: '#3498db', patch: '#888' };
  return <Circle size={6} fill={colors[type]} stroke="none" />;
}

function VersionRow({ v, isCurrent, onRestore, onDelete }: {
  v: AgentVersion; isCurrent: boolean;
  onRestore: () => void; onDelete: () => void;
}) {
  const t = useTheme();
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{
        border: `1px solid ${isCurrent ? '#FE500040' : t.borderSubtle}`,
        background: isCurrent ? '#FE500008' : 'transparent',
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full min-h-[36px] flex items-center gap-2 px-3 py-2 cursor-pointer border-none bg-transparent text-left"
      >
        <ChevronRight
          size={10}
          style={{ color: t.textDim, transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}
        />
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className="text-[14px] font-bold shrink-0" style={{ fontFamily: "'Geist Mono', monospace", color: isCurrent ? '#FE5000' : t.textPrimary }}>
            v{v.version}
          </span>
          <span className="text-[12px] truncate" style={{ color: t.textMuted }}>
            {v.label || 'Checkpoint'}
          </span>
        </div>
        {isCurrent && <Badge variant="success" size="sm" dot>CURRENT</Badge>}
        <span className="text-[13px] shrink-0" style={{ color: t.textFaint }}>
          {new Date(v.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </button>

      {expanded && (
        <div className="px-3 pb-2 flex flex-col gap-1.5">
          {v.changes.length === 0 && (
            <div className="text-[12px]" style={{ color: t.textMuted }}>
              No changelog entries recorded for this version.
            </div>
          )}
          {v.changes.map((c, i) => (
            <div key={i} className="flex items-center gap-2 text-[12px]" style={{ color: t.textSecondary }}>
              <ChangeIcon type={c.type} />
              <span className="uppercase text-[12px] font-semibold w-14 shrink-0" style={{ color: t.textDim }}>{c.category}</span>
              <span>{c.description}</span>
            </div>
          ))}
          <div className="flex items-center gap-1 mt-1">
            {!isCurrent && (
              <Button variant="secondary" size="sm" icon={<RotateCcw size={10} />} onClick={onRestore}>
                Restore
              </Button>
            )}
            <IconButton icon={<Trash2 size={11} />} variant="danger" size="sm" tooltip="Delete version" onClick={onDelete} />
          </div>
        </div>
      )}
    </div>
  );
}

export function VersionIndicator() {
  const t = useTheme();
  const versions = useVersionStore(s => s.versions);
  const currentVersion = useVersionStore(s => s.currentVersion);
  const dirty = useVersionStore(s => s.dirty);
  const checkpoint = useVersionStore(s => s.checkpoint);
  const [showHistory, setShowHistory] = useState(false);

  return (
    <>
      {/* Compact indicator in topbar */}
      <button
        type="button"
        onClick={() => setShowHistory(true)}
        className="flex items-center gap-1.5 px-2 h-8 rounded-lg cursor-pointer border-none"
        style={{
          background: dirty ? '#FE500015' : 'transparent',
          color: dirty ? '#FE5000' : t.textDim,
          fontFamily: "'Geist Mono', monospace",
          fontSize: 12,
          fontWeight: 600,
          transition: 'background 0.15s',
        }}
        title="Version history"
      >
        <GitBranch size={12} />
        v{currentVersion}
        {dirty && <span className="w-1.5 h-1.5 rounded-full bg-[#FE5000] animate-pulse" />}
      </button>

      {/* Version history modal */}
      <Modal
        open={showHistory}
        onClose={() => setShowHistory(false)}
        title="Version History"
        width={480}
        footer={
          <Button variant="primary" size="sm" icon={<Save size={10} />} onClick={() => { checkpoint(); }}>
            Save Checkpoint
          </Button>
        }
      >
        <div className="flex flex-col gap-1.5 p-3 max-h-[60vh] overflow-y-auto overscroll-contain pr-1">
          {versions.length === 0 && (
            <div className="py-8 text-center">
              <GitBranch size={20} style={{ margin: '0 auto 8px', color: t.textFaint, opacity: 0.3 }} />
              <div className="text-[12px]" style={{ color: t.textFaint }}>No versions yet</div>
              <div className="text-[12px] mt-1" style={{ color: t.textMuted }}>
                Make changes to your agent — versions are created automatically
              </div>
            </div>
          )}
          {[...versions].reverse().map((v) => (
            <VersionRow
              key={v.id}
              v={v}
              isCurrent={v.version === currentVersion}
              onRestore={() => {
                useVersionStore.getState().restoreVersion(v.version);
                setShowHistory(false);
              }}
              onDelete={() => useVersionStore.getState().deleteVersion(v.id)}
            />
          ))}
        </div>
      </Modal>
    </>
  );
}
