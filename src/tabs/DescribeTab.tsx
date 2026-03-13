import { useState } from 'react';
import { useTheme } from '../theme';
import { useConsoleStore } from '../store/consoleStore';
import { TextArea } from '../components/ds/TextArea';
import { Lightbulb } from 'lucide-react';

const QUICK_TEMPLATES = [
  {
    label: 'Code Review Agent',
    description: 'Reviews code for best practices, security, and maintainability',
    prompt: 'A code review agent that analyzes pull requests and provides detailed feedback on code quality, security vulnerabilities, performance issues, and adherence to coding standards. Should use framework sources for style guides and ground-truth for API documentation.',
  },
  {
    label: 'Research Assistant',
    description: 'Gathers and synthesizes information from multiple sources',
    prompt: 'A research assistant that collects information from various sources, synthesizes findings, and produces comprehensive reports. Uses evidence and signal sources to gather data, with broad exploration capabilities for discovering relevant information.',
  },
  {
    label: 'Content Writer',
    description: 'Creates engaging content following brand guidelines',
    prompt: 'A content writing agent that produces high-quality articles, blog posts, and marketing copy. Uses framework sources for brand voice and style guidelines, ground-truth for factual information, and hypothesis sources for creative content development.',
  },
  {
    label: 'Product Manager',
    description: 'Analyzes market data and creates product roadmaps',
    prompt: 'A product management agent that tracks competitor analysis, user feedback, and market trends. Creates weekly reports, manages roadmaps, and provides strategic recommendations. Integrates with tools like GitHub for technical insights and Notion for documentation.',
  },
];

export function DescribeTab() {
  const t = useTheme();
  const prompt = useConsoleStore(s => s.prompt);
  const setPrompt = useConsoleStore(s => s.setPrompt);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  const handleTemplateSelect = (template: typeof QUICK_TEMPLATES[0]) => {
    setPrompt(template.prompt);
    setSelectedTemplate(template.label);
  };

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-2 m-0" style={{ color: t.textPrimary, fontFamily: "'Geist Sans', sans-serif" }}>
          Describe Your Agent
        </h2>
        <p className="text-sm" style={{ color: t.textSecondary, lineHeight: 1.5 }}>
          Start by describing what you want your agent to do. Be specific about its role, capabilities, and the types of tasks it should handle.
        </p>
      </div>

      {/* Quick Templates */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-4 m-0" style={{ color: t.textPrimary, fontFamily: "'Geist Sans', sans-serif" }}>
          Quick Start Templates
        </h3>
        <div 
          className="grid grid-cols-1 md:grid-cols-2 gap-3"
          role="group"
          aria-label="Agent template selection"
        >
          {QUICK_TEMPLATES.map((template) => (
            <button
              key={template.label}
              type="button"
              onClick={() => handleTemplateSelect(template)}
              aria-pressed={selectedTemplate === template.label}
              aria-describedby={`template-desc-${template.label.replace(/\s+/g, '-').toLowerCase()}`}
              className="text-left p-4 rounded-lg border cursor-pointer transition-colors min-h-[44px]"
              style={{
                background: selectedTemplate === template.label ? '#FE500010' : t.surfaceElevated,
                borderColor: selectedTemplate === template.label ? '#FE5000' : t.border,
                color: t.textPrimary,
              }}
              onMouseEnter={e => {
                if (selectedTemplate !== template.label) {
                  e.currentTarget.style.background = '#FE500008';
                  e.currentTarget.style.borderColor = '#FE500050';
                }
              }}
              onMouseLeave={e => {
                if (selectedTemplate !== template.label) {
                  e.currentTarget.style.background = t.surfaceElevated;
                  e.currentTarget.style.borderColor = t.border;
                }
              }}
            >
              <div className="font-semibold mb-1" style={{ fontFamily: "'Geist Sans', sans-serif", fontSize: '14px' }}>
                {template.label}
                {selectedTemplate === template.label && (
                  <span className="sr-only"> (selected)</span>
                )}
              </div>
              <div 
                id={`template-desc-${template.label.replace(/\s+/g, '-').toLowerCase()}`}
                className="text-xs" 
                style={{ color: t.textSecondary, lineHeight: 1.4 }}
              >
                {template.description}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Description TextArea */}
      <div className="mb-6">
        <label htmlFor="agent-description" className="block text-sm font-medium mb-3" style={{ color: t.textPrimary }}>
          Agent Description
        </label>
        <TextArea
          id="agent-description"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe your agent in detail... For example: 'A customer support agent that helps users with technical issues. It should have access to documentation, be able to create support tickets, and escalate complex issues to human agents. The agent should be friendly but professional, and always verify user identity before sharing sensitive information.'"
          rows={8}
          style={{
            minHeight: '200px',
            fontFamily: "'Geist Sans', sans-serif",
            fontSize: '14px',
            lineHeight: 1.6,
          }}
        />
      </div>

      {/* Tips */}
      <div className="rounded-lg p-4" style={{ background: t.isDark ? '#0a1929' : '#f8fafc', border: `1px solid ${t.border}` }}>
        <div className="flex items-start gap-3">
          <Lightbulb size={16} style={{ color: '#FE5000', marginTop: 2, flexShrink: 0 }} />
          <div>
            <h4 className="font-semibold text-sm mb-2 m-0" style={{ color: t.textPrimary }}>
              Writing Tips
            </h4>
            <ul className="text-sm space-y-1" style={{ color: t.textSecondary }}>
              <li>• Be specific about the agent's role and responsibilities</li>
              <li>• Mention the types of inputs and outputs you expect</li>
              <li>• Include any domain expertise or specialized knowledge required</li>
              <li>• Describe the tone and communication style you want</li>
              <li>• Note any constraints or limitations the agent should respect</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}