
import { useMemo } from 'react';
import { Settings } from 'lucide-react';
import { useTheme } from '../../theme';
import { Select } from '../../components/ds/Select';
import { Section } from '../../components/ds/Section';
import { useProviderStore } from '../../store/providerStore';
import { useConsoleStore } from '../../store/consoleStore';
import { OUTPUT_FORMATS } from '../../store/knowledgeBase';

interface OutputConfigSectionProps {
  outputFormat: string;
  setOutputFormat: (format: string) => void;
  selectedModel: string;
  tokenBudget: number | null;
  collapsed: boolean;
  onToggle: () => void;
}

export function OutputConfigSection({ 
  outputFormat, 
  setOutputFormat,
  selectedModel,
  tokenBudget,
  collapsed, 
  onToggle 
}: OutputConfigSectionProps) {
  const t = useTheme();
  const getAllModels = useProviderStore(s => s.getAllModels);
  const providers = useProviderStore(s => s.providers);
  const modelOptions = useMemo(() => 
    getAllModels().map(m => ({
      value: `${m.providerId}::${m.id}`,
      label: `${m.providerName} / ${m.label}`
    })),
    [getAllModels, providers]
  );

  return (
    <Section
      icon={Settings} label="Output Configuration" color="#b28a00"
      collapsed={collapsed} onToggle={onToggle}
    >
      <div className="space-y-4">
        <Select
          label="Output Format"
          options={OUTPUT_FORMATS.map(f => ({ value: f.id, label: f.label }))}
          value={outputFormat}
          onChange={(value: string) => setOutputFormat(value)}
        />
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Select
              label="Model"
              options={modelOptions}
              value={selectedModel}
              onChange={(value: string) => useConsoleStore.getState().setModel(value)}
            />
          </div>
          <div>
            <span className="block text-sm font-medium mb-2" style={{ color: t.textPrimary }}>Token Budget</span>
            <div className="p-2 rounded" style={{ background: t.surfaceElevated, color: t.textSecondary }}>
              {tokenBudget?.toLocaleString() || 'Default'}
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}