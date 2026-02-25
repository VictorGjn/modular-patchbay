import { useConsoleStore } from '../store/consoleStore';
import { CATEGORY_COLORS, KNOWLEDGE_TYPES, classifyKnowledgeType, type KnowledgeSource } from '../store/knowledgeBase';

export function GhostChannel({ source, reason }: { source: KnowledgeSource; reason: string }) {
  const addChannel = useConsoleStore((s) => s.addChannel);
  const catColor = CATEGORY_COLORS[source.category];
  const kt = KNOWLEDGE_TYPES[classifyKnowledgeType(source.path)];

  return (
    <button
      type="button"
      onClick={() =>
        addChannel({
          sourceId: source.id,
          name: source.name,
          path: source.path,
          category: source.category,
          knowledgeType: classifyKnowledgeType(source.path),
          depth: 2, // default to Summary for suggestions
          baseTokens: source.tokenEstimate,
        })
      }
      className="flex flex-col items-center shrink-0 relative select-none cursor-pointer transition-all group"
      style={{
        width: 140,
        background: 'transparent',
        border: '1px dashed #2d272066',
        borderRadius: 6,
        opacity: 0.45,
        padding: 0,
        animation: 'ghost-breathe 4s ease infinite',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.opacity = '0.85';
        e.currentTarget.style.borderColor = `${catColor}80`;
        e.currentTarget.style.background = `${catColor}08`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.opacity = '0.45';
        e.currentTarget.style.borderColor = '#2d272066';
        e.currentTarget.style.background = 'transparent';
      }}
      title={`Suggested: ${reason}\nClick to add`}
    >
      {/* Category stripe */}
      <div className="w-full h-[2px] rounded-t-[5px]" style={{ background: `${catColor}44` }} />

      <div className="flex flex-col items-center py-3 px-2 gap-1.5">
        {/* Name */}
        <span
          className="text-[8px] tracking-[1.5px] uppercase truncate text-center w-full"
          style={{ fontFamily: "'Space Mono', monospace", color: '#5a4e42' }}
        >
          {source.name}
        </span>

        {/* Knowledge type */}
        <span style={{ fontSize: 14, opacity: 0.5 }}>{kt.icon}</span>

        {/* Plus indicator */}
        <span
          className="text-[18px] font-light"
          style={{ color: '#3d3730', lineHeight: 1 }}
        >
          +
        </span>

        {/* Reason */}
        <span
          className="text-[7px] text-center leading-tight"
          style={{ fontFamily: "'Space Mono', monospace", color: '#3d3730' }}
        >
          {reason}
        </span>
      </div>
    </button>
  );
}
