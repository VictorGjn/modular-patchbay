import { memo } from 'react';
import { Position } from '@xyflow/react';
import { useConsoleStore } from '../store/consoleStore';
import { OUTPUT_FORMATS, type OutputFormat } from '../store/knowledgeBase';
import { Tile } from '../components/Tile';
import { JackPort } from '../components/JackPort';
import { OutputIcon } from '../components/icons/SectionIcons';
import { ArrowUpRight } from 'lucide-react';

export const OutputNode = memo(function OutputNode() {
  const outputFormat = useConsoleStore((s) => s.outputFormat);
  const setOutputFormat = useConsoleStore((s) => s.setOutputFormat);

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: 'rgba(28, 28, 32, 0.9)',
        backdropFilter: 'blur(8px)',
        border: '1px solid #2a2a30',
        width: 260,
        minHeight: 100,
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: '1px solid #222226' }}>
        <JackPort type="target" position={Position.Left} label="INPUT" color="#FE5000" id="output-in" />
        <ArrowUpRight size={14} style={{ color: '#888' }} />
        <span className="text-xs font-medium tracking-wide uppercase flex-1" style={{ color: '#888' }}>
          Output
        </span>
      </div>

      {/* Format tiles */}
      <div className="p-2 overflow-y-auto nowheel" style={{ maxHeight: 280 }}>
        <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))' }}>
          {OUTPUT_FORMATS.map((fmt) => (
            <Tile
              key={fmt.id}
              name={fmt.label}
              active={outputFormat === fmt.id}
              icon={<OutputIcon formatId={fmt.id} size={14} />}
              radioMode
              onClick={() => setOutputFormat(fmt.id as OutputFormat)}
            />
          ))}
        </div>
      </div>
    </div>
  );
});
