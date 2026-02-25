import { type NodeProps, useNodeId } from '@xyflow/react';
import { MODULE_DEF_MAP } from '../store/moduleDefinitions';
import { usePatchStore } from '../store/patchStore';
import { BaseModule } from './BaseModule';
import { Jack } from '../controls/Jack';
import { Knob } from '../controls/Knob';
import { Toggle } from '../controls/Toggle';
import { Scope } from '../controls/Scope';
import { ModuleSelect } from '../controls/ModuleSelect';

export function ModuleContent({ data }: NodeProps) {
  const nodeId = useNodeId() ?? '';
  const moduleType = (data as Record<string, unknown>).moduleType as string;
  const def = MODULE_DEF_MAP[moduleType];
  const config = usePatchStore((s) => s.moduleConfigs[nodeId]);
  const updateKnob = usePatchStore((s) => s.updateKnob);
  const updateToggle = usePatchStore((s) => s.updateToggle);
  const updateSelect = usePatchStore((s) => s.updateSelect);
  const updateTextarea = usePatchStore((s) => s.updateTextarea);
  const ledState = usePatchStore((s) => s.execution.ledStates[nodeId]);

  if (!def || !config) return null;

  return (
    <BaseModule
      id={nodeId}
      label={def.label}
      category={def.category}
      minWidth={def.minWidth}
    >
      {/* Selects */}
      {def.selects.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {def.selects.map((s) => (
            <ModuleSelect
              key={s.id}
              value={config.selects[s.id] ?? s.defaultValue}
              options={s.options}
              label={s.label}
              onChange={(v) => updateSelect(nodeId, s.id, v)}
            />
          ))}
        </div>
      )}

      {/* Scope */}
      {def.hasScope && (
        <Scope active={ledState === 'processing'} />
      )}

      {/* Textarea / Code editor */}
      {(def.hasTextarea || def.hasCodeEditor) && (
        <textarea
          className="module-textarea nodrag nowheel"
          rows={def.hasCodeEditor ? 4 : 2}
          placeholder={def.textareaPlaceholder}
          value={config.textareaValue}
          onChange={(e) => updateTextarea(nodeId, e.target.value)}
          onClick={(e) => e.stopPropagation()}
          spellCheck={false}
        />
      )}

      {/* Knobs */}
      {def.knobs.length > 0 && (
        <div className="knob-row nodrag">
          {def.knobs.map((k) => (
            <Knob
              key={k.id}
              value={config.knobs[k.id] ?? k.defaultValue}
              min={k.min}
              max={k.max}
              step={k.step}
              label={k.label}
              onChange={(v) => updateKnob(nodeId, k.id, v)}
            />
          ))}
        </div>
      )}

      {/* Toggles */}
      {def.toggles.length > 0 && (
        <div className="flex flex-wrap gap-3 px-1">
          {def.toggles.map((t) => (
            <Toggle
              key={t.id}
              value={config.toggles[t.id] ?? t.defaultValue}
              label={t.label}
              onChange={(v) => updateToggle(nodeId, t.id, v)}
            />
          ))}
        </div>
      )}

      {/* IO Jacks */}
      <div className="io-container">
        {/* Inputs */}
        <div className="jack-section">
          {def.inputs.map((inp) => (
            <Jack key={inp.id} id={inp.id} label={inp.label} type="target" nodeId={nodeId} />
          ))}
        </div>

        {/* Outputs */}
        <div className="jack-section items-end">
          {def.outputs.map((out) => (
            <Jack key={out.id} id={out.id} label={out.label} type="source" nodeId={nodeId} />
          ))}
        </div>
      </div>

      {/* Webhook URL display */}
      {moduleType === 'webhookIn' && (
        <div className="text-[8px] px-1 py-0.5 rounded truncate" style={{ background: '#0a0a0a', color: '#FE5000', fontFamily: "'Space Mono', monospace" }}>
          https://hook.modular.ai/{nodeId}
        </div>
      )}
    </BaseModule>
  );
}
