import { describe, it, expect } from 'vitest';
import {
  getCapabilityMatrix, isCapabilityUsable, getUnsupportedCapabilities, getDegradedCapabilities,
  validateAgentCapabilities, CAPABILITY_KEYS, PROVIDER_CAPABILITIES,
} from '../../src/capabilities';

describe('capabilities', () => {
  describe('PROVIDER_CAPABILITIES', () => {
    it('defines matrices for all well-known providers', () => {
      for (const id of ['anthropic', 'claude-agent-sdk', 'openai', 'google', 'openrouter', 'custom']) {
        expect(PROVIDER_CAPABILITIES[id]).toBeDefined();
      }
    });
    it('has all 6 capability keys per provider', () => {
      for (const [pid, matrix] of Object.entries(PROVIDER_CAPABILITIES)) {
        for (const key of CAPABILITY_KEYS) {
          expect(matrix[key], `${pid}.${key}`).toBeDefined();
          expect(['supported', 'degraded', 'unsupported']).toContain(matrix[key].status);
        }
      }
    });
  });

  describe('getCapabilityMatrix', () => {
    it('returns correct matrix for known providers', () => {
      expect(getCapabilityMatrix('anthropic')).toBe(PROVIDER_CAPABILITIES.anthropic);
      expect(getCapabilityMatrix('openai')).toBe(PROVIDER_CAPABILITIES.openai);
      expect(getCapabilityMatrix('google')).toBe(PROVIDER_CAPABILITIES.google);
    });
    it('returns custom for unknown ids', () => {
      expect(getCapabilityMatrix('some-unknown')).toBe(PROVIDER_CAPABILITIES.custom);
    });
    it('returns custom for custom-prefixed ids', () => {
      expect(getCapabilityMatrix('custom-12345')).toBe(PROVIDER_CAPABILITIES.custom);
    });
  });

  describe('isCapabilityUsable', () => {
    it('true for supported', () => expect(isCapabilityUsable(getCapabilityMatrix('anthropic'), 'toolCalling')).toBe(true));
    it('true for degraded', () => expect(isCapabilityUsable(getCapabilityMatrix('openai'), 'memoryHooks')).toBe(true));
    it('false for unsupported', () => expect(isCapabilityUsable(getCapabilityMatrix('google'), 'memoryHooks')).toBe(false));
  });

  describe('getUnsupportedCapabilities', () => {
    it('empty for fully-supported provider', () => expect(getUnsupportedCapabilities(getCapabilityMatrix('anthropic'))).toEqual([]));
    it('lists unsupported for Google', () => {
      const u = getUnsupportedCapabilities(getCapabilityMatrix('google'));
      expect(u).toContain('memoryHooks');
      expect(u).toContain('mcpBridge');
      expect(u).not.toContain('streaming');
    });
  });

  describe('getDegradedCapabilities', () => {
    it('empty for fully-supported provider', () => expect(getDegradedCapabilities(getCapabilityMatrix('anthropic'))).toEqual([]));
    it('lists degraded for OpenRouter', () => {
      const d = getDegradedCapabilities(getCapabilityMatrix('openrouter'));
      expect(d).toContain('toolCalling');
      expect(d).toContain('structuredOutput');
    });
  });

  describe('validateAgentCapabilities', () => {
    it('all ok for Anthropic', () => {
      const r = validateAgentCapabilities(getCapabilityMatrix('anthropic'), CAPABILITY_KEYS);
      expect(r.every((x) => x.level === 'ok')).toBe(true);
    });
    it('errors for unsupported', () => {
      const r = validateAgentCapabilities(getCapabilityMatrix('google'), ['memoryHooks', 'mcpBridge']);
      expect(r).toHaveLength(2);
      expect(r[0].level).toBe('error');
      expect(r[0].message).toContain('Memory Hooks');
    });
    it('warnings for degraded', () => {
      const r = validateAgentCapabilities(getCapabilityMatrix('openrouter'), ['toolCalling']);
      expect(r[0].level).toBe('warning');
      expect(r[0].message).toContain('limited support');
    });
    it('mixed results', () => {
      const r = validateAgentCapabilities(getCapabilityMatrix('google'), ['streaming', 'structuredOutput', 'memoryHooks']);
      expect(r.map(x => x.level)).toContain('ok');
      expect(r.map(x => x.level)).toContain('warning');
      expect(r.map(x => x.level)).toContain('error');
    });
    it('empty for no requirements', () => expect(validateAgentCapabilities(getCapabilityMatrix('anthropic'), [])).toEqual([]));
    it('includes notes', () => {
      const r = validateAgentCapabilities(getCapabilityMatrix('google'), ['structuredOutput']);
      expect(r[0].message).toContain('JSON mode only');
    });
  });

  it('anthropic has all supported', () => {
    const m = getCapabilityMatrix('anthropic');
    for (const k of CAPABILITY_KEYS) expect(m[k].status).toBe('supported');
  });
  it('claude-agent-sdk matches anthropic', () => {
    const a = getCapabilityMatrix('anthropic');
    const s = getCapabilityMatrix('claude-agent-sdk');
    for (const k of CAPABILITY_KEYS) expect(s[k].status).toBe(a[k].status);
  });
});
