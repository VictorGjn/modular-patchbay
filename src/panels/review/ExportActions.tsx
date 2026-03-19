import { useState, useCallback } from 'react';
import { Download, Save, Eye, ChevronDown } from 'lucide-react';
import { useTheme } from '../../theme';
import { useVersionStore } from '../../store/versionStore';

interface ExportActionsProps {
  onExport: () => void;
  onExportFormat: (format: string) => void;
  onPromptPreview: () => void;
  saveStatus: 'saved' | 'saving' | 'error' | 'unsaved';
}

export function ExportActions({ 
  onExport, 
  onExportFormat,
  onPromptPreview,
  saveStatus 
}: ExportActionsProps) {
  const t = useTheme();
  const [showExportDropdown, setShowExportDropdown] = useState(false);

  const exportButtonStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 16px',
    background: '#FE5000',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500',
    fontFamily: "'Geist Sans', sans-serif",
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  };

  const saveButtonStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 16px',
    background: 'transparent',
    color: t.textSecondary,
    border: `1px solid ${t.border}`,
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500',
    fontFamily: "'Geist Sans', sans-serif",
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  };

  const exportDropdownStyle = {
    position: 'absolute' as const,
    top: '100%',
    left: 0,
    right: 0,
    background: t.surfaceElevated,
    border: `1px solid ${t.border}`,
    borderRadius: '6px',
    marginTop: '4px',
    zIndex: 1000,
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
  };

  const handleExportFormat = useCallback((format: string) => {
    onExportFormat(format);
    setShowExportDropdown(false);
  }, [onExportFormat]);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={onPromptPreview}
        className="flex items-center gap-2 px-4 py-2 text-sm rounded border"
        style={{
          background: 'transparent',
          color: t.textSecondary,
          borderColor: t.border,
          fontFamily: "'Geist Sans', sans-serif",
        }}
      >
        <Eye size={14} />
        Prompt Preview
      </button>

      <div className="relative">
        <button
          type="button"
          onClick={() => setShowExportDropdown(!showExportDropdown)}
          aria-expanded={showExportDropdown}
          aria-haspopup="menu"
          aria-label="Export agent configuration in different formats"
          style={exportButtonStyle}
        >
          <Download size={14} />
          Export
          <ChevronDown size={12} />
        </button>

        {showExportDropdown && (
          <div role="menu" style={exportDropdownStyle}>
            {['JSON', 'YAML', 'Markdown', 'Claude format', 'OpenAI format'].map((format) => (
              <button
                key={format}
                type="button"
                role="menuitem"
                onClick={() => handleExportFormat(format)}
                aria-label={`Export agent configuration as ${format}`}
                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: t.textPrimary,
                  cursor: 'pointer',
                }}
              >
                {format}
              </button>
            ))}
          </div>
        )}
      </div>

      <button type="button" onClick={onExport} style={exportButtonStyle}>
        <Download size={16} />
        Export Agent
      </button>

      <button
        type="button"
        disabled={saveStatus === 'saving'}
        onClick={() => {
          const versionStore = useVersionStore.getState();
          if (!versionStore.agentId) {
            // Create new agent if no ID exists
            const newId = `agent-${Date.now()}`;
            versionStore.setAgentId(newId);
          }
          versionStore.saveToServer('Manual save');
        }}
        style={{
          ...saveButtonStyle,
          opacity: saveStatus === 'saving' ? 0.6 : 1,
          cursor: saveStatus === 'saving' ? 'not-allowed' : 'pointer',
        }}
      >
        <Save size={16} />
        {saveStatus === 'saving' ? 'Saving...' : 'Save Draft'}
      </button>
      
      {/* Save Status Indicator */}
      <div className="flex items-center gap-2 text-sm">
        <div
          className="w-2 h-2 rounded-full"
          style={{
            background: saveStatus === 'saved' ? '#22c55e' :
                       saveStatus === 'saving' ? '#f59e0b' :
                       saveStatus === 'error' ? '#ef4444' : '#6b7280',
          }}
        />
        <span style={{ color: t.textSecondary, fontSize: '13px' }}>
          {saveStatus === 'saved' ? 'Saved' :
           saveStatus === 'saving' ? 'Saving...' :
           saveStatus === 'error' ? 'Save failed' : 'Unsaved changes'}
        </span>
      </div>
    </div>
  );
}