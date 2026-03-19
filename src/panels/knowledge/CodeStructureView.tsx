import { useState } from 'react';
import { type TreeIndex, type TreeNode } from '../../services/treeIndexer';
import { useTheme } from '../../theme';
import { ChevronRight, ChevronDown } from 'lucide-react';

function ItemRow({ node }: { node: TreeNode }) {
  const t = useTheme();
  return (
    <div
      className="pl-4 py-0.5 text-[11px] truncate"
      style={{ color: t.textFaint, fontFamily: "'Geist Mono', monospace" }}
      title={node.meta?.firstSentence ?? node.title}
    >
      {node.title}
    </div>
  );
}

function SectionRow({ node }: { node: TreeNode }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 w-full py-0.5 hover:opacity-80 transition-opacity"
        style={{ color: t.textDim, fontFamily: "'Geist Mono', monospace", fontSize: '11px' }}
      >
        {open ? <ChevronDown size={9} /> : <ChevronRight size={9} />}
        <span className="flex-1 text-left">{node.title}</span>
        <span style={{ color: t.textFaint }}>({node.children.length})</span>
      </button>
      {open && node.children.map(c => <ItemRow key={c.nodeId} node={c} />)}
    </div>
  );
}

export function CodeStructureView({ index }: { index: TreeIndex }) {
  const t = useTheme();
  const sections = index.root.children.filter(n => n.children.length > 0);
  if (sections.length === 0) return null;
  return (
    <div
      className="mt-2 pt-2 space-y-0.5"
      style={{ borderTop: `1px solid ${t.borderSubtle}` }}
    >
      {sections.map(section => <SectionRow key={section.nodeId} node={section} />)}
    </div>
  );
}
