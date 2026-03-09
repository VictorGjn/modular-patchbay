import { describe, it, expect } from 'vitest';
import { assemblePipelineContext } from '../../src/services/contextAssembler';

describe('Attention-Aware Ordering', () => {
  const baseParts = {
    frame: 'System frame content',
    orientationBlock: '',
    hasRepos: false,
    knowledgeFormatGuide: '',
    frameworkBlock: '',
    memoryBlock: '',
    knowledgeBlock: '',
  };

  it('sorts sources by epistemic priority within knowledge block', () => {
    const knowledgeBlock = `<knowledge>
[EVIDENCE] Evidence instruction
- Evidence source

<source name="test-results" type="Evidence" tokens="1000">
Test results show performance metrics...
</source>

[HYPOTHESIS] Hypothesis instruction
- Hypothesis source

<source name="feature-proposal" type="Hypothesis" tokens="800">
Proposed feature could improve usability...
</source>

[GROUND TRUTH] Ground truth instruction
- Ground truth source

<source name="api-spec" type="Ground Truth" tokens="2000">
API specification defines endpoints...
</source>

[FRAMEWORK] Framework instruction
- Framework source

<source name="architecture-doc" type="Framework" tokens="1500">
Architecture follows microservices pattern...
</source>
</knowledge>`;

    const result = assemblePipelineContext({
      ...baseParts,
      knowledgeBlock,
    });

    // Should order: Ground Truth (0) → Framework (2) → Hypothesis (3) → Evidence (5)
    const knowledgeSection = result.split('<knowledge>')[1].split('</knowledge>')[0];

    // Check that ground truth appears before framework
    const groundTruthIndex = knowledgeSection.indexOf('type="Ground Truth"');
    const frameworkIndex = knowledgeSection.indexOf('type="Framework"');
    const hypothesisIndex = knowledgeSection.indexOf('type="Hypothesis"');
    const evidenceIndex = knowledgeSection.indexOf('type="Evidence"');

    expect(groundTruthIndex).toBeGreaterThan(-1);
    expect(frameworkIndex).toBeGreaterThan(-1);
    expect(hypothesisIndex).toBeGreaterThan(-1);
    expect(evidenceIndex).toBeGreaterThan(-1);

    // Verify ordering
    expect(groundTruthIndex).toBeLessThan(frameworkIndex);
    expect(frameworkIndex).toBeLessThan(hypothesisIndex);
    expect(hypothesisIndex).toBeLessThan(evidenceIndex);
  });

  it('handles all knowledge types in correct order', () => {
    const knowledgeBlock = `<knowledge>
<source name="evidence-1" type="evidence" tokens="1000">Evidence content</source>
<source name="signal-1" type="signal" tokens="800">Signal content</source>
<source name="hypothesis-1" type="hypothesis" tokens="600">Hypothesis content</source>
<source name="framework-1" type="framework" tokens="1200">Framework content</source>
<source name="guideline-1" type="guideline" tokens="900">Guideline content</source>
<source name="ground-truth-1" type="ground-truth" tokens="1500">Ground truth content</source>
</knowledge>`;

    const result = assemblePipelineContext({
      ...baseParts,
      knowledgeBlock,
    });

    const knowledgeSection = result.split('<knowledge>')[1].split('</knowledge>')[0];

    // Extract source order by finding their positions
    const sources = ['ground-truth', 'guideline', 'framework', 'hypothesis', 'signal', 'evidence'];
    const positions = sources.map(type => knowledgeSection.indexOf(`type="${type}"`));

    // Verify all sources are present and in correct order
    for (let i = 0; i < positions.length; i++) {
      expect(positions[i]).toBeGreaterThan(-1);
      if (i > 0) {
        expect(positions[i]).toBeGreaterThan(positions[i - 1]);
      }
    }
  });

  it('handles missing type attribute with default position', () => {
    const knowledgeBlock = `<knowledge>
<source name="evidence-1" type="evidence" tokens="1000">Evidence content</source>
<source name="unknown-1" tokens="800">Unknown type content</source>
<source name="ground-truth-1" type="ground-truth" tokens="1500">Ground truth content</source>
</knowledge>`;

    const result = assemblePipelineContext({
      ...baseParts,
      knowledgeBlock,
    });

    // Should still order correctly with unknown type in default position (3)
    expect(result).toContain('ground-truth');
    expect(result).toContain('evidence');
    expect(result).toContain('Unknown type content');

    const knowledgeSection = result.split('<knowledge>')[1].split('</knowledge>')[0];
    const groundTruthIndex = knowledgeSection.indexOf('type="ground-truth"');
    const evidenceIndex = knowledgeSection.indexOf('type="evidence"');

    // Ground truth should come before evidence
    expect(groundTruthIndex).toBeLessThan(evidenceIndex);
  });

  it('preserves non-source content in knowledge block', () => {
    const knowledgeBlock = `<knowledge>
[GROUND TRUTH] Do not contradict this.
- Important ground truth info

<source name="api-spec" type="ground-truth" tokens="2000">
API specification defines endpoints...
</source>

[EVIDENCE] Cite and weigh against other evidence.
- Evidence details

<source name="test-results" type="evidence" tokens="1000">
Test results show performance metrics...
</source>
</knowledge>`;

    const result = assemblePipelineContext({
      ...baseParts,
      knowledgeBlock,
    });

    // Should preserve instruction blocks
    expect(result).toContain('[GROUND TRUTH] Do not contradict this.');
    expect(result).toContain('[EVIDENCE] Cite and weigh against other evidence.');
    expect(result).toContain('Important ground truth info');
    expect(result).toContain('Evidence details');

    // Should still order sources correctly
    const knowledgeSection = result.split('<knowledge>')[1].split('</knowledge>')[0];
    const groundTruthIndex = knowledgeSection.indexOf('type="ground-truth"');
    const evidenceIndex = knowledgeSection.indexOf('type="evidence"');
    expect(groundTruthIndex).toBeLessThan(evidenceIndex);
  });

  it('handles knowledge block without sources', () => {
    const knowledgeBlock = `<knowledge>
[GROUND TRUTH] Do not contradict this.
- Some metadata-only reference

[EVIDENCE] Cite and weigh against other evidence.
- Another metadata reference
</knowledge>`;

    const result = assemblePipelineContext({
      ...baseParts,
      knowledgeBlock,
    });

    // Should preserve content unchanged when no sources present
    expect(result).toContain('[GROUND TRUTH] Do not contradict this.');
    expect(result).toContain('[EVIDENCE] Cite and weigh against other evidence.');
    expect(result).toContain('Some metadata-only reference');
    expect(result).toContain('Another metadata reference');
  });

  it('handles empty knowledge block', () => {
    const knowledgeBlock = '<knowledge>\n</knowledge>';

    const result = assemblePipelineContext({
      ...baseParts,
      knowledgeBlock,
    });

    expect(result).toContain('<knowledge>');
    expect(result).toContain('</knowledge>');
  });

  it('handles no knowledge block', () => {
    const result = assemblePipelineContext({
      ...baseParts,
      knowledgeBlock: '',
    });

    expect(result).toBe('System frame content');
  });

  it('preserves knowledge block structure and attributes', () => {
    const knowledgeBlock = `<knowledge sources="test-api.md, user-feedback.md">
<source name="api-spec" type="ground-truth" tokens="2000">
API content...
</source>
</knowledge>`;

    const result = assemblePipelineContext({
      ...baseParts,
      knowledgeBlock,
    });

    // Should preserve the knowledge tag attributes
    expect(result).toContain('sources="test-api.md, user-feedback.md"');
    expect(result).toContain('<knowledge sources=');
  });

  it('handles case-insensitive type matching', () => {
    const knowledgeBlock = `<knowledge>
<source name="test-1" type="Ground Truth" tokens="2000">Content 1</source>
<source name="test-2" type="evidence" tokens="1000">Content 2</source>
<source name="test-3" type="Framework" tokens="1500">Content 3</source>
</knowledge>`;

    const result = assemblePipelineContext({
      ...baseParts,
      knowledgeBlock,
    });

    const knowledgeSection = result.split('<knowledge>')[1].split('</knowledge>')[0];

    // Should order correctly regardless of case
    const groundTruthIndex = knowledgeSection.indexOf('type="Ground Truth"');
    const frameworkIndex = knowledgeSection.indexOf('type="Framework"');
    const evidenceIndex = knowledgeSection.indexOf('type="evidence"');

    expect(groundTruthIndex).toBeLessThan(frameworkIndex);
    expect(frameworkIndex).toBeLessThan(evidenceIndex);
  });
});