import { type ChannelConfig, type KnowledgeSource } from '../store/knowledgeBase';

export interface GhostSuggestion {
  source: KnowledgeSource;
  reason: string;
}

const KEYWORD_MAP: Record<string, string[]> = {
  'knowledge-clients-odfjell': ['odfjell', 'bow optima', 'bow olympus', 'bow orion', 'michelle', 'chemical tanker'],
  'knowledge-clients-kcc': ['kcc', 'klaveness', 'baru', 'balzani', 'baleen', 'combination carrier'],
  'knowledge-competitors-stormgeo': ['stormgeo', 'storm geo', 'competitor'],
  'knowledge-competitors-dtn': ['dtn', 'competitor'],
  'knowledge-competitors-sofar': ['sofar', 'competitor'],
  'knowledge-competitors-wni': ['wni', 'weathernews', 'competitor'],
  'knowledge-competitors-napa': ['napa', 'competitor'],
  'knowledge-products': ['product', 'feature', 'navigation report', 'live', 'fleet'],
  'knowledge-products-nr': ['navigation report', 'nr', 'post-voyage', 'voyage report'],
  'knowledge-products-feedback': ['feedback', 'user feedback', 'nps'],
  'discovery-eu-ets': ['eu ets', 'carbon', 'emission', 'ets', 'co2', 'regulation', 'fueleu'],
  'discovery-weather-routing': ['weather routing', 'route optimization', 'weather'],
  'discovery-fleet-dashboard': ['fleet', 'dashboard', 'fleet view'],
  'discovery-cii-monitor': ['cii', 'carbon intensity', 'rating'],
  'intel-competitive': ['competitive', 'competitor', 'benchmark', 'versus', 'vs'],
  'intel-maritime': ['maritime', 'shipping', 'vessel', 'marine'],
  'odfjell-savings': ['savings', 'fuel savings', 'optimization', 'odfjell'],
  'voyage-prep': ['voyage prep', 'voyage preparation', 'tce', 'charter'],
  'signals-odfjell': ['odfjell feedback', 'odfjell signal', 'michelle said'],
  'roadmap': ['roadmap', 'prioritize', 'quarter', 'q1', 'q2', 'q3', 'q4', 'planning'],
  'sales-prep-events': ['event', 'conference', 'meeting prep', 'pitch'],
  'cmo-company-profiles': ['company profile', 'company intel', 'research company'],
};

export function getGhostSuggestions(prompt: string, activeChannels: ChannelConfig[], maxSuggestions = 3): GhostSuggestion[] {
  if (!prompt || prompt.length < 5) return [];

  const p = prompt.toLowerCase();
  const activeIds = new Set(activeChannels.map((ch) => ch.sourceId));
  // Ghost suggestions are disabled until real knowledge tree is available
  const allSources: KnowledgeSource[] = [];
  const suggestions: GhostSuggestion[] = [];

  // 1. Keyword-based suggestions from prompt
  for (const [sourceId, keywords] of Object.entries(KEYWORD_MAP)) {
    if (activeIds.has(sourceId)) continue;
    for (const kw of keywords) {
      if (p.includes(kw)) {
        const source = allSources.find((s) => s.id === sourceId);
        if (source) {
          suggestions.push({ source, reason: `Prompt mentions "${kw}"` });
          break;
        }
      }
    }
  }

  // 2. Knowledge type gap detection
  if (activeChannels.length > 0) {
    const hasGroundTruth = activeChannels.some((ch) => ch.knowledgeType === 'ground-truth' && ch.enabled);
    const hasSignal = activeChannels.some((ch) => ch.knowledgeType === 'signal' && ch.enabled);
    const hasEvidence = activeChannels.some((ch) => ch.knowledgeType === 'evidence' && ch.enabled);

    if (!hasGroundTruth && !activeIds.has('knowledge-products')) {
      const src = allSources.find((s) => s.id === 'knowledge-products');
      if (src) suggestions.push({ source: src, reason: 'No Ground Truth — add Products?' });
    }

    if (hasSignal && !hasEvidence && !activeIds.has('intel-competitive')) {
      const src = allSources.find((s) => s.id === 'intel-competitive');
      if (src) suggestions.push({ source: src, reason: 'Signals without Evidence' });
    }
  }

  // Deduplicate and limit
  const seen = new Set<string>();
  return suggestions.filter((s) => {
    if (seen.has(s.source.id)) return false;
    seen.add(s.source.id);
    return true;
  }).slice(0, maxSuggestions);
}
