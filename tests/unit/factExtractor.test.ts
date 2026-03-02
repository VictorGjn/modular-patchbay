import { describe, it, expect } from 'vitest';
import { extractFacts } from '../../server/services/factExtractor.js';

describe('factExtractor', () => {
  it('extracts decision from "I decided to use REST"', () => {
    const facts = extractFacts('I decided to use REST for the API.', 'agent-1');
    const decision = facts.find((f) => f.epistemicType === 'decision');
    expect(decision).toBeDefined();
    expect(decision!.value).toContain('REST');
    expect(decision!.source).toBe('agent-1');
  });

  it('extracts decision from "Let\'s use Express"', () => {
    const facts = extractFacts("Let's use Express for routing.", 'agent-2');
    const decision = facts.find((f) => f.epistemicType === 'decision');
    expect(decision).toBeDefined();
    expect(decision!.value).toContain('Express');
  });

  it('extracts contract from interface definition', () => {
    const code = `
interface HurricaneData {
  lat: number;
  lng: number;
  category: number;
}`;
    const facts = extractFacts(code, 'agent-1');
    const contract = facts.find((f) => f.epistemicType === 'contract');
    expect(contract).toBeDefined();
    expect(contract!.value).toContain('HurricaneData');
    expect(contract!.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('extracts contract from type alias', () => {
    const code = '\nexport type Status = "active" | "inactive";';
    const facts = extractFacts(code, 'agent-1');
    const contract = facts.find((f) => f.epistemicType === 'contract');
    expect(contract).toBeDefined();
    expect(contract!.value).toContain('Status');
  });

  it('extracts observation from file description', () => {
    const text = 'The file src/api/index.ts exports 3 routes for the application.';
    const facts = extractFacts(text, 'agent-1');
    const obs = facts.find((f) => f.epistemicType === 'observation');
    expect(obs).toBeDefined();
    expect(obs!.value).toContain('3 routes');
  });

  it('extracts observation from "I created file"', () => {
    const text = 'I created file src/utils/helpers.ts with utility functions.';
    const facts = extractFacts(text, 'agent-1');
    const obs = facts.find((f) => f.epistemicType === 'observation');
    expect(obs).toBeDefined();
    expect(obs!.value).toContain('src/utils/helpers');
  });

  it('extracts inference from "Therefore"', () => {
    const text = 'Therefore the database needs a migration.';
    const facts = extractFacts(text, 'agent-1');
    const inf = facts.find((f) => f.epistemicType === 'inference');
    expect(inf).toBeDefined();
    expect(inf!.value).toContain('database');
  });

  it('extracts hypothesis from "I think"', () => {
    const text = 'I think the bottleneck is in the query layer.';
    const facts = extractFacts(text, 'agent-1');
    const hyp = facts.find((f) => f.epistemicType === 'hypothesis');
    expect(hyp).toBeDefined();
    expect(hyp!.confidence).toBeLessThan(0.6);
  });

  it('assigns correct confidence levels', () => {
    const text = 'I decided to use PostgreSQL. I think Redis might help.';
    const facts = extractFacts(text, 'agent-1');
    const decision = facts.find((f) => f.epistemicType === 'decision');
    const hypothesis = facts.find((f) => f.epistemicType === 'hypothesis');
    expect(decision!.confidence).toBeGreaterThan(hypothesis!.confidence);
  });

  it('deduplicates identical facts', () => {
    const text = 'I decided to use REST. I decided to use REST.';
    const facts = extractFacts(text, 'agent-1');
    const decisions = facts.filter((f) => f.epistemicType === 'decision');
    expect(decisions.length).toBe(1);
  });

  it('returns empty array for empty input', () => {
    const facts = extractFacts('', 'agent-1');
    expect(facts).toEqual([]);
  });

  it('handles multiple fact types in one text', () => {
    const text = `I decided to use Express.
The file server.ts exports the main app.
I think caching would help.`;
    const facts = extractFacts(text, 'agent-1');
    const types = new Set(facts.map((f) => f.epistemicType));
    expect(types.size).toBeGreaterThanOrEqual(2);
  });

  it('sets source correctly', () => {
    const facts = extractFacts('I decided to use TypeScript.', 'backend-agent');
    expect(facts.every((f) => f.source === 'backend-agent')).toBe(true);
  });
});
