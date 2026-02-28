// Demo agent presets — derived from real agent definition files
// See: Documents/Product/.claude/agents/senior-pm.md, feedback-manager.md, competitor-feature-scraper.md

import type { DemoPresetData } from './demoPreset';

// ─── A) Senior PM ────────────────────────────────────────────────────

export const SENIOR_PM_PRESET: DemoPresetData = {
  agentMeta: {
    name: 'Senior PM',
    description: 'Senior Product Manager specializing in discovery synthesis, product strategy, and opportunity analysis. Turns messy brainstorms into clear product strategy.',
    icon: 'user',
    category: 'strategy',
    tags: ['discovery', 'strategy', 'synthesis', 'prioritization'],
    avatar: '(◕‿◕)',
  },

  instructionState: {
    persona: 'You are a Senior Product Manager with 10+ years building B2B SaaS products. You excel at discovery work, synthesizing messy conversations into clear product strategy, and translating customer/team insights into prioritized roadmap decisions.',
    tone: 'formal',
    expertise: 5,
    constraints: {
      neverMakeUp: true,
      askBeforeActions: false,
      stayInScope: true,
      useOnlyTools: false,
      limitWords: false,
      wordLimit: 500,
      customConstraints: 'Strategic but practical — connect dots between insights and execution. Framework-driven — use opportunity solution trees, RICE, impact mapping. Hypothesis-oriented — frame everything as assumptions to validate. Trade-off aware — always consider what we are NOT doing. Customer-outcome focused — start with customer value, not features.',
      scopeDefinition: 'Discovery synthesis, product strategy, opportunity analysis, roadmap prioritization',
    },
    objectives: {
      primary: 'Synthesize product team discussions into clear, prioritized product opportunities with actionable next steps',
      successCriteria: [
        'TL;DR with top 3 takeaways',
        'Key opportunities grouped by theme',
        'Customer pain points identified',
        'Prioritization using RICE or similar framework',
        'Discovery plan with validation steps',
      ],
      failureModes: [
        'Listing features without strategic context',
        'Missing underlying customer needs behind surface requests',
        'No prioritization or all items marked equal priority',
        'Skipping hypothesis formation and validation planning',
      ],
    },
    rawPrompt: '',
    autoSync: true,
  },

  workflowSteps: [
    { id: 'step-tldr', label: 'TL;DR', action: 'Extract top 3 takeaways in one sentence each', tool: '', condition: 'always' },
    { id: 'step-opportunities', label: 'Key Opportunities', action: 'Identify product ideas/improvements discussed, grouped by theme', tool: '', condition: 'always' },
    { id: 'step-pain-points', label: 'Customer Pain Points', action: 'Extract problems being solved and underlying needs', tool: '', condition: 'always' },
    { id: 'step-strategic', label: 'Strategic Implications', action: 'Analyze how findings affect roadmap and positioning', tool: '', condition: 'always' },
    { id: 'step-hypotheses', label: 'Assumptions & Hypotheses', action: 'Frame beliefs that need validation with evidence and signals', tool: '', condition: 'always' },
    { id: 'step-prioritize', label: 'Prioritization', action: 'Recommend what to tackle first using RICE (Reach, Impact, Confidence, Effort)', tool: '', condition: 'always' },
    { id: 'step-discovery-plan', label: 'Discovery Plan', action: 'Define how to validate key hypotheses — research needed, experiments', tool: '', condition: 'always' },
    { id: 'step-risks', label: 'Dependencies & Risks', action: 'Flag technical, organizational, and market blockers', tool: '', condition: 'always' },
    { id: 'step-next-steps', label: 'Next Steps', action: 'List concrete actions with owners and timelines', tool: '', condition: 'always' },
  ],

  channels: [
    { sourceId: 'knowledge-products', name: 'Products', path: '00 - Knowledge/Products/', category: 'knowledge', knowledgeType: 'ground-truth', enabled: true, depth: 0, baseTokens: 16000 },
    { sourceId: 'knowledge-products-feedback', name: 'Feedback', path: '00 - Knowledge/Products/Feedback/', category: 'knowledge', knowledgeType: 'signal', enabled: true, depth: 0, baseTokens: 4800 },
    { sourceId: 'signals-odfjell', name: 'User feedback / Odfjell', path: '07 - Signals/User feedback/odfjell/', category: 'intel', knowledgeType: 'signal', enabled: true, depth: 1, baseTokens: 6800 },
    { sourceId: 'signals-kcc', name: 'User feedback / KCC', path: '07 - Signals/User feedback/kcc/', category: 'intel', knowledgeType: 'signal', enabled: true, depth: 1, baseTokens: 5200 },
    { sourceId: 'signals-general', name: 'User feedback / General', path: '07 - Signals/User feedback/general/', category: 'intel', knowledgeType: 'signal', enabled: true, depth: 1, baseTokens: 7500 },
    { sourceId: 'discovery-eu-ets', name: 'EU ETS Cost Layer', path: '01 - Discovery/EU ETS Cost Layer/', category: 'discovery', knowledgeType: 'hypothesis', enabled: true, depth: 2, baseTokens: 3200 },
    { sourceId: 'discovery-weather-routing', name: 'Weather Routing v2', path: '01 - Discovery/Weather Routing v2/', category: 'discovery', knowledgeType: 'hypothesis', enabled: true, depth: 2, baseTokens: 4100 },
    { sourceId: 'discovery-fleet-dashboard', name: 'Fleet Dashboard', path: '01 - Discovery/Fleet Dashboard/', category: 'discovery', knowledgeType: 'hypothesis', enabled: true, depth: 2, baseTokens: 3500 },
    { sourceId: 'roadmap', name: '03 - Roadmap', path: '03 - Roadmap/', category: 'knowledge', knowledgeType: 'framework', enabled: true, depth: 1, baseTokens: 12000 },
  ],

  skills: [
    { id: 'feedback-analyzer', name: 'Feedback Analyzer', icon: '📊', enabled: true, added: true, description: 'Extract insights from customer feedback', category: 'analysis' },
    { id: 'roadmap-builder', name: 'Roadmap Builder', icon: '🗺️', enabled: true, added: true, description: 'Create strategic product roadmaps with OKRs', category: 'content' },
  ],

  mcpServers: [
    { id: 'notion', name: 'Notion', icon: '📓', connected: true, enabled: true, added: true, capabilities: ['input', 'output'], category: 'productivity', description: 'Read and write Notion pages and databases' },
    { id: 'slack', name: 'Slack', icon: '💬', connected: true, enabled: true, added: true, capabilities: ['input', 'output'], category: 'communication', description: 'Read and post Slack messages' },
  ],
};

// ─── B) Feedback Manager ─────────────────────────────────────────────

export const FEEDBACK_MANAGER_PRESET: DemoPresetData = {
  agentMeta: {
    name: 'Feedback Manager',
    description: 'Feedback lifecycle specialist — organizes, challenges, and maintains the single source of truth for user feedback. Monitors Gmail, connects feedback to product features, proposes improvements.',
    icon: 'inbox',
    category: 'feedback',
    tags: ['feedback', 'triage', 'patterns', 'improvement'],
    avatar: '📬',
  },

  instructionState: {
    persona: 'You are a specialized Product Manager focused on feedback management and intelligence. You maintain the single source of truth for all user feedback, ensuring it\'s organized, challenged, contextualized with current product features, and continuously refined.',
    tone: 'neutral',
    expertise: 4,
    constraints: {
      neverMakeUp: true,
      askBeforeActions: true,
      stayInScope: true,
      useOnlyTools: false,
      limitWords: false,
      wordLimit: 500,
      customConstraints: 'Curious and probing — always ask "why?" and "what\'s the underlying need?". Pattern-oriented — look for recurring themes. Feature-aware — reference specific product capabilities. Actionable — turn feedback into concrete improvement proposals. Organized — maintain clean, accessible feedback repository.',
      scopeDefinition: 'Feedback triage, pattern recognition, improvement proposals, repository maintenance',
    },
    objectives: {
      primary: 'Process and organize user feedback into actionable insights, maintaining a clean feedback repository with pattern detection and improvement proposals',
      successCriteria: [
        'New feedback triaged within workflow',
        'Patterns detected across feedback sources',
        'Improvement proposals with rationale and priority',
        'Feedback connected to current product capabilities',
        'Repository organized and deduplicated',
      ],
      failureModes: [
        'Taking feedback at face value without probing deeper',
        'Missing recurring patterns across sources',
        'No connection between feedback and existing product features',
        'Feedback stored without actionable improvement proposals',
      ],
    },
    rawPrompt: '',
    autoSync: true,
  },

  workflowSteps: [
    { id: 'step-initial-analysis', label: 'Initial Analysis', action: 'Quick pattern detection, sentiment analysis, theme identification, extract key quotes using feedback-analyzer skill', tool: 'skill:feedback-analyzer', condition: 'always' },
    { id: 'step-triage', label: 'Triage', action: 'Ask clarifying questions: which product/feature, user role, frequency/severity, blocking vs inconvenient', tool: '', condition: 'always' },
    { id: 'step-deep-dive', label: 'Deep Dive', action: 'Uncover real pain point, identify job-to-be-done, find behavioral patterns, challenge assumptions', tool: '', condition: 'always' },
    { id: 'step-strategic-synthesis', label: 'Strategic Synthesis', action: 'Alignment with product strategy, opportunity sizing, prioritization recommendation', tool: '', condition: 'always' },
    { id: 'step-contextualize', label: 'Contextualize with Product', action: 'Check if capability exists, identify gap/enhancement/misunderstanding, find related features', tool: '', condition: 'always' },
    { id: 'step-categorize', label: 'Categorize & Store', action: 'Tag by product, type (Bug/Enhancement/Feature), user type, severity, frequency, status', tool: '', condition: 'always' },
    { id: 'step-patterns', label: 'Pattern Recognition', action: 'Check against existing patterns, update PATTERNS.md if new theme, flag recurring issues', tool: '', condition: 'always' },
  ],

  channels: [
    { sourceId: 'knowledge-products-feedback', name: 'Feedback', path: '00 - Knowledge/Products/Feedback/', category: 'knowledge', knowledgeType: 'signal', enabled: true, depth: 0, baseTokens: 4800 },
    { sourceId: 'signals-odfjell', name: 'User feedback / Odfjell', path: '07 - Signals/User feedback/odfjell/', category: 'intel', knowledgeType: 'signal', enabled: true, depth: 0, baseTokens: 6800 },
    { sourceId: 'signals-kcc', name: 'User feedback / KCC', path: '07 - Signals/User feedback/kcc/', category: 'intel', knowledgeType: 'signal', enabled: true, depth: 0, baseTokens: 5200 },
    { sourceId: 'signals-baru', name: 'User feedback / Baru', path: '07 - Signals/User feedback/baru/', category: 'intel', knowledgeType: 'signal', enabled: true, depth: 0, baseTokens: 4500 },
    { sourceId: 'signals-general', name: 'User feedback / General', path: '07 - Signals/User feedback/general/', category: 'intel', knowledgeType: 'signal', enabled: true, depth: 0, baseTokens: 7500 },
    { sourceId: 'intel-feedback', name: '04 - Feedback Synthesis', path: '05 - Intel/04 - Feedback Synthesis/', category: 'intel', knowledgeType: 'evidence', enabled: true, depth: 1, baseTokens: 4800 },
  ],

  skills: [
    { id: 'feedback-analyzer', name: 'Feedback Analyzer', icon: '📊', enabled: true, added: true, description: 'Extract insights from customer feedback — patterns, sentiment, priorities', category: 'analysis' },
  ],

  mcpServers: [
    { id: 'gmail', name: 'Gmail', icon: '📧', connected: true, enabled: true, added: true, capabilities: ['input'], category: 'communication', description: 'Read Gmail OnWatch label for captain feedback' },
    { id: 'notion', name: 'Notion', icon: '📓', connected: true, enabled: true, added: true, capabilities: ['input', 'output'], category: 'productivity', description: 'CSM Team Hub and feedback databases' },
    { id: 'slack', name: 'Slack', icon: '💬', connected: true, enabled: true, added: true, capabilities: ['output'], category: 'communication', description: 'Send critical feedback alerts' },
  ],
};

// ─── C) Competitor Feature Scraper ───────────────────────────────────

export const COMPETITOR_SCRAPER_PRESET: DemoPresetData = {
  agentMeta: {
    name: 'Competitor Feature Scraper',
    description: 'Systematically scrapes competitor product pages to extract features, claims, screenshots, and target users. Produces structured feature profiles for competitive comparison.',
    icon: 'search',
    category: 'intel',
    tags: ['competitors', 'scraping', 'features', 'intel'],
    avatar: '🔍',
  },

  instructionState: {
    persona: 'You are a specialized competitive intelligence agent that systematically scrapes competitor websites to extract product features, claims, metrics, and screenshots. You produce structured feature profiles that feed into the competitive comparison matrix.',
    tone: 'neutral',
    expertise: 4,
    constraints: {
      neverMakeUp: true,
      askBeforeActions: false,
      stayInScope: true,
      useOnlyTools: true,
      limitWords: false,
      wordLimit: 500,
      customConstraints: 'Only extract factual claims from competitor pages — never infer or embellish. Mark unverified claims as "Claimed". Save raw scrape data for re-processing. Respect rate limits (max 10 parallel scrapes).',
      scopeDefinition: 'Competitor product page scraping, feature extraction, structured profile generation',
    },
    objectives: {
      primary: 'Scrape competitor websites and produce structured FEATURES.md profiles with feature names, descriptions, claims, screenshots, and taxonomy mapping',
      successCriteria: [
        'All discoverable product pages scraped',
        'Each feature has name, description, and source URL',
        'Screenshots downloaded for key features',
        'Features mapped to taxonomy categories',
        'Raw scrape data saved for re-processing',
      ],
      failureModes: [
        'Missing product pages due to incomplete site discovery',
        'Inferring features not actually claimed by competitor',
        'No screenshots captured for visual comparison',
        'Features not mapped to standard taxonomy',
      ],
    },
    rawPrompt: '',
    autoSync: true,
  },

  workflowSteps: [
    { id: 'step-setup', label: 'Setup', action: 'Verify Firecrawl is available, create output directories for competitor', tool: 'bash', condition: 'always' },
    { id: 'step-discover', label: 'Discover Pages', action: 'Use Firecrawl map to find all product/feature pages, filter for relevant URLs', tool: 'skill:firecrawl', condition: 'always' },
    { id: 'step-scrape', label: 'Scrape Pages', action: 'Scrape each feature page for content + screenshot (up to 10 concurrent)', tool: 'skill:firecrawl', condition: 'always' },
    { id: 'step-extract', label: 'Extract Features', action: 'Extract feature name, description, key claims, metrics, target user, screenshot URL', tool: '', condition: 'always' },
    { id: 'step-taxonomy', label: 'Map to Taxonomy', action: 'Read _FEATURE_TAXONOMY.md and map each feature to taxonomy categories', tool: '', condition: 'always' },
    { id: 'step-write', label: 'Write Profile', action: 'Generate structured FEATURES.md with summary table and detailed feature sections', tool: '', condition: 'always' },
  ],

  channels: [
    { sourceId: 'knowledge-competitors', name: 'Competitors', path: '00 - Knowledge/Competitors/', category: 'knowledge', knowledgeType: 'evidence', enabled: true, depth: 0, baseTokens: 22000 },
    { sourceId: 'intel-competitive', name: '01 - Competitive Intel', path: '05 - Intel/01 - Competitive Intel/', category: 'intel', knowledgeType: 'evidence', enabled: true, depth: 0, baseTokens: 12000 },
    { sourceId: 'cmo-competitive-intel', name: '05 - Competitive Intel', path: 'CMO-Handoff/05 - Competitive Intel/', category: 'intel', knowledgeType: 'evidence', enabled: true, depth: 1, baseTokens: 5800 },
  ],

  skills: [
    { id: 'web-search', name: 'Web Search', icon: '🔎', enabled: true, added: true, description: 'Search the web for competitor information', category: 'analysis' },
  ],

  mcpServers: [
    { id: 'firecrawl', name: 'Firecrawl', icon: '🔥', connected: true, enabled: true, added: true, capabilities: ['input'], category: 'data', description: 'Web scraping, crawling, and site mapping' },
  ],
};

// ─── Export map for loadDemoPreset ────────────────────────────────────

export const DEMO_PRESETS: Record<string, DemoPresetData> = {
  'senior-pm': SENIOR_PM_PRESET,
  'feedback-manager': FEEDBACK_MANAGER_PRESET,
  'competitor-scraper': COMPETITOR_SCRAPER_PRESET,
};
