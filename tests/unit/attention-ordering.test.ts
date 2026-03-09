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

  it('handles source blocks with special characters and HTML entities', () => {
    const knowledgeBlock = `<knowledge>
<source name="special-chars" type="evidence" tokens="1000">
Content with <em>HTML</em> & special chars: "quotes", 'apostrophes', & ampersands
Code snippet: if (x < 5 && y > 10) { return "test"; }
</source>
<source name="ground-truth-1" type="ground-truth" tokens="1500">
API endpoints: GET /api/users?id=123&format=json
POST /api/data with payload: {"key": "value", "nested": {"array": [1,2,3]}}
</source>
</knowledge>`;

    const result = assemblePipelineContext({
      ...baseParts,
      knowledgeBlock,
    });

    const knowledgeSection = result.split('<knowledge>')[1].split('</knowledge>')[0];

    // Should preserve special characters and order correctly
    expect(result).toContain('<em>HTML</em>');
    expect(result).toContain('"quotes"');
    expect(result).toContain('{"key": "value"');
    expect(result).toContain('id=123&format=json');

    // Ground truth should come before evidence
    const groundTruthIndex = knowledgeSection.indexOf('type="ground-truth"');
    const evidenceIndex = knowledgeSection.indexOf('type="evidence"');
    expect(groundTruthIndex).toBeLessThan(evidenceIndex);
  });

  it('preserves original order for sources of same type (ordering stability)', () => {
    const knowledgeBlock = `<knowledge>
<source name="evidence-3" type="evidence" tokens="1000">Third evidence source</source>
<source name="evidence-1" type="evidence" tokens="800">First evidence source</source>
<source name="ground-truth-2" type="ground-truth" tokens="2000">Second ground truth</source>
<source name="evidence-2" type="evidence" tokens="1200">Second evidence source</source>
<source name="ground-truth-1" type="ground-truth" tokens="1500">First ground truth</source>
</knowledge>`;

    const result = assemblePipelineContext({
      ...baseParts,
      knowledgeBlock,
    });

    const knowledgeSection = result.split('<knowledge>')[1].split('</knowledge>')[0];

    // Extract all source name positions to check ordering
    const groundTruth1Pos = knowledgeSection.indexOf('name="ground-truth-1"');
    const groundTruth2Pos = knowledgeSection.indexOf('name="ground-truth-2"');
    const evidence1Pos = knowledgeSection.indexOf('name="evidence-1"');
    const evidence2Pos = knowledgeSection.indexOf('name="evidence-2"');
    const evidence3Pos = knowledgeSection.indexOf('name="evidence-3"');

    // Ground truth sources should maintain their original relative order
    expect(groundTruth2Pos).toBeLessThan(groundTruth1Pos);

    // Evidence sources should maintain their original relative order
    expect(evidence3Pos).toBeLessThan(evidence1Pos);
    expect(evidence1Pos).toBeLessThan(evidence2Pos);

    // All ground truth should come before all evidence
    expect(groundTruth1Pos).toBeLessThan(evidence3Pos);
    expect(groundTruth2Pos).toBeLessThan(evidence3Pos);
  });

  it('handles malformed or nested source tags gracefully', () => {
    const knowledgeBlock = `<knowledge>
<source name="normal" type="evidence" tokens="1000">Normal content</source>
<div>Some other content with <source name="inner" type="ground-truth">nested source</source> here</div>
<source name="after" type="hypothesis" tokens="800">Content after</source>
</knowledge>`;

    const result = assemblePipelineContext({
      ...baseParts,
      knowledgeBlock,
    });

    // Should handle gracefully and still order valid sources
    expect(result).toContain('Normal content');
    expect(result).toContain('Content after');
    expect(result).toContain('nested source');

    const knowledgeSection = result.split('<knowledge>')[1].split('</knowledge>')[0];

    // Valid sources should still be ordered correctly (ground-truth before hypothesis before evidence)
    const normalPos = knowledgeSection.indexOf('name="normal"');
    const afterPos = knowledgeSection.indexOf('name="after"');

    // Hypothesis should come before evidence
    expect(afterPos).toBeLessThan(normalPos);
  });

  it('handles knowledge blocks with attributes and whitespace variations', () => {
    const knowledgeBlock = `<knowledge sources="test1.md, test2.md" version="1.0">

[GROUND TRUTH] Critical information
- Important notes

<source name="api-spec"    type="ground-truth"   tokens="2000"  >
API specification with whitespace in attributes
</source>

[EVIDENCE] Supporting data

<source name="metrics"
        type="evidence"
        tokens="1000"
        >
Performance metrics data
</source>

</knowledge>`;

    const result = assemblePipelineContext({
      ...baseParts,
      knowledgeBlock,
    });

    // Should preserve knowledge tag attributes
    expect(result).toContain('sources="test1.md, test2.md"');
    expect(result).toContain('version="1.0"');

    // Should preserve instruction blocks
    expect(result).toContain('[GROUND TRUTH] Critical information');
    expect(result).toContain('[EVIDENCE] Supporting data');

    const knowledgeSection = result.split('<knowledge')[1].split('</knowledge>')[0];

    // Sources should be ordered correctly despite whitespace variations
    const groundTruthIndex = knowledgeSection.indexOf('name="api-spec"');
    const evidenceIndex = knowledgeSection.indexOf('name="metrics"');
    expect(groundTruthIndex).toBeLessThan(evidenceIndex);
  });
});