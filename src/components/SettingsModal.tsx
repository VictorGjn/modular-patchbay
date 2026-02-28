import { useState, useEffect } from 'react';
import { Settings, X, Eye, EyeOff } from 'lucide-react';
import { useTheme } from '../theme';

const STORAGE_KEY_API = 'modular-api-key';
const STORAGE_KEY_URL = 'modular-base-url';
const STORAGE_KEY_MODEL = 'modular-model-override';
const DEFAULT_BASE_URL = 'https://api.openai.com/v1';

export function getStoredApiKey(): string {
  return localStorage.getItem(STORAGE_KEY_API) ?? '';
}

export function getStoredBaseUrl(): string {
  return localStorage.getItem(STORAGE_KEY_URL) || DEFAULT_BASE_URL;
}

export function getStoredModelOverride(): string {
  return localStorage.getItem(STORAGE_KEY_MODEL) ?? '';
}

export function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTheme();
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState(DEFAULT_BASE_URL);
  const [modelOverride, setModelOverride] = useState('');
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    if (open) {
      setApiKey(getStoredApiKey());
      setBaseUrl(getStoredBaseUrl());
      setModelOverride(getStoredModelOverride());
      setShowKey(false);
    }
  }, [open]);

  if (!open) return null;

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY_API, apiKey);
    if (baseUrl && baseUrl !== DEFAULT_BASE_URL) {
      localStorage.setItem(STORAGE_KEY_URL, baseUrl);
    } else {
      localStorage.removeItem(STORAGE_KEY_URL);
    }
    if (modelOverride) {
      localStorage.setItem(STORAGE_KEY_MODEL, modelOverride);
    } else {
      localStorage.removeItem(STORAGE_KEY_MODEL);
    }
    onClose();
  };

  const inputStyle = {
    background: t.inputBg,
    border: `1px solid ${t.border}`,
    color: t.textPrimary,
    fontFamily: "'Inter', sans-serif",
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: t.isDark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.3)', backdropFilter: 'blur(8px)' }} />
      <div
        className="relative w-[420px] rounded-xl overflow-hidden"
        style={{ background: t.surfaceOpaque, border: `1px solid ${t.border}`, boxShadow: '0 24px 48px rgba(0,0,0,0.3)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: t.borderSubtle }}>
          <Settings size={14} style={{ color: t.textDim }} />
          <span className="text-xs tracking-wider uppercase flex-1 font-semibold" style={{ color: t.textSecondary }}>
            LLM Settings
          </span>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer border-none bg-transparent p-1 rounded-md"
            style={{ color: t.textDim }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="px-4 py-4 flex flex-col gap-4">
          {/* API Key */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] tracking-wider uppercase" style={{ color: t.textMuted }}>
              API Key
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                className="w-full text-xs px-3 py-2 pr-9 rounded-lg outline-none"
                style={inputStyle}
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer border-none bg-transparent p-0.5"
                style={{ color: t.textDim }}
              >
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <span className="text-[10px]" style={{ color: t.textFaint }}>
              Stored in localStorage. Works with OpenAI, OpenRouter, or any compatible API.
            </span>
          </div>

          {/* Base URL */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] tracking-wider uppercase" style={{ color: t.textMuted }}>
              Base URL
            </label>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder={DEFAULT_BASE_URL}
              className="w-full text-xs px-3 py-2 rounded-lg outline-none"
              style={inputStyle}
            />
          </div>

          {/* Model Override */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] tracking-wider uppercase" style={{ color: t.textMuted }}>
              Model Override
            </label>
            <input
              type="text"
              value={modelOverride}
              onChange={(e) => setModelOverride(e.target.value)}
              placeholder="Leave empty to use selector model"
              className="w-full text-xs px-3 py-2 rounded-lg outline-none"
              style={inputStyle}
            />
            <span className="text-[10px]" style={{ color: t.textFaint }}>
              Overrides the model selector. E.g. gpt-4o, openrouter/auto, etc.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t" style={{ borderColor: t.borderSubtle }}>
          <button
            type="button"
            onClick={onClose}
            className="text-xs px-4 py-1.5 rounded-lg cursor-pointer"
            style={{ background: 'transparent', border: `1px solid ${t.border}`, color: t.textSecondary }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="text-xs px-4 py-1.5 rounded-lg cursor-pointer font-semibold border-none"
            style={{ background: '#FE5000', color: '#fff' }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
