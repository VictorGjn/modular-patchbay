import { useState, useEffect, useRef, useCallback } from 'react';
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

const CHARACTER_LIMIT = 10000;
const MIN_CHARACTERS = 20;

interface DescribeTabProps {
  onValidationChange?: (isValid: boolean) => void;
}

export function DescribeTab({ onValidationChange }: DescribeTabProps) {
  const t = useTheme();
  const prompt = useConsoleStore(s => s.prompt);
  const setPrompt = useConsoleStore(s => s.setPrompt);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showValidation, setShowValidation] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout>(undefined);
  const radioGroupRef = useRef<HTMLDivElement>(null);

  const headerStyles = {
    color: t.textPrimary,
    fontFamily: "'Geist Sans', sans-serif",
  };

  const descriptionStyles = {
    color: t.textSecondary,
    lineHeight: 1.5,
  };

  const templateButtonStyles = (isSelected: boolean) => ({
    background: isSelected ? '#FE500010' : t.surface,
    borderColor: isSelected ? '#FE5000' : t.border,
    color: t.textPrimary,
  });

  const templateLabelStyles = {
    fontFamily: "'Geist Sans', sans-serif",
    fontSize: '14px',
  };

  const templateDescStyles = {
    color: t.textSecondary,
    lineHeight: 1.4,
  };

  const textAreaStyles = {
    minHeight: '200px',
    fontFamily: "'Geist Sans', sans-serif",
    fontSize: '14px',
    lineHeight: 1.6,
  };

  const tipsContainerStyles = {
    background: t.surface,
    border: `1px solid ${t.border}`,
  };

  const iconStyles = {
    color: '#FE5000',
    marginTop: 2,
    flexShrink: 0,
  };

  // Validation logic
  const isValid = prompt.length >= MIN_CHARACTERS;
  
  useEffect(() => {
    const error = !isValid && showValidation ? `Please enter at least ${MIN_CHARACTERS} characters` : null;
    setValidationError(error);
    onValidationChange?.(isValid);
  }, [isValid, showValidation, onValidationChange]);

  // Auto-save with debouncing
  const debouncedSave = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      // Save to store (already happens via setPrompt)
    }, 500);
  }, []);

  const handlePromptChange = (value: string) => {
    setPrompt(value);
    debouncedSave();
  };

  const handleTemplateSelect = (template: typeof QUICK_TEMPLATES[0]) => {
    setPrompt(template.prompt);
    setSelectedTemplate(template.label);
    setShowValidation(false);
  };

  // Keyboard navigation for radio group
  const handleKeyDown = (event: React.KeyboardEvent, index: number) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      event.preventDefault();
      const nextIndex = (index + 1) % QUICK_TEMPLATES.length;
      const nextButton = radioGroupRef.current?.children[nextIndex] as HTMLButtonElement;
      nextButton?.focus();
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      event.preventDefault();
      const prevIndex = (index - 1 + QUICK_TEMPLATES.length) % QUICK_TEMPLATES.length;
      const prevButton = radioGroupRef.current?.children[prevIndex] as HTMLButtonElement;
      prevButton?.focus();
    }
  };

  const handleValidationTrigger = () => {
    setShowValidation(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold mb-2 m-0" style={headerStyles}>
          Describe Your Agent
        </h2>
        <p className="text-sm" style={descriptionStyles}>
          Start by describing what you want your agent to do. Be specific about its role, capabilities, and the types of tasks it should handle.
        </p>
      </div>

      {/* Quick Templates */}
      <div>
        <h3 className="text-lg font-medium mt-3 mb-4 m-0" style={headerStyles}>
          Quick Start Templates
        </h3>
        <div 
          ref={radioGroupRef}
          className="grid grid-cols-2 gap-3"
          role="radiogroup"
          aria-label="Agent templates"
        >
          {QUICK_TEMPLATES.map((template, index) => (
            <button
              key={template.label}
              type="button"
              role="radio"
              aria-checked={selectedTemplate === template.label}
              onClick={() => handleTemplateSelect(template)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              aria-describedby={`template-desc-${template.label.replace(/\s+/g, '-').toLowerCase()}`}
              className="text-left p-5 rounded-lg border cursor-pointer transition-colors min-h-[44px]"
              style={templateButtonStyles(selectedTemplate === template.label)}
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
              <div className="font-semibold mb-1" style={templateLabelStyles}>
                {template.label}
                {selectedTemplate === template.label && (
                  <span className="sr-only"> (selected)</span>
                )}
              </div>
              <div 
                id={`template-desc-${template.label.replace(/\s+/g, '-').toLowerCase()}`}
                className="text-xs" 
                style={templateDescStyles}
              >
                {template.description}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Description TextArea */}
      <div>
        <label htmlFor="agent-description" className="block text-sm font-medium mb-3" style={{ color: t.textPrimary }}>
          Agent Description
        </label>
        <TextArea
          id="agent-description"
          value={prompt}
          onChange={(e) => handlePromptChange(e.target.value)}
          onBlur={handleValidationTrigger}
          placeholder="Describe your agent in detail... For example: 'A customer support agent that helps users with technical issues. It should have access to documentation, be able to create support tickets, and escalate complex issues to human agents. The agent should be friendly but professional, and always verify user identity before sharing sensitive information.'"
          rows={8}
          style={textAreaStyles}
          maxLength={CHARACTER_LIMIT}
        />
        
        {/* Character Count */}
        <div className="flex justify-between items-center mt-2">
          <div>
            {validationError && (
              <div className="text-sm text-red-500">
                {validationError}
              </div>
            )}
          </div>
          <div 
            className="text-sm text-right"
            style={{ color: t.textSecondary }}
            aria-live="polite"
          >
            {prompt.length} / {CHARACTER_LIMIT}
          </div>
        </div>
      </div>

      {/* Tips */}
      <div className="rounded-lg p-5 bg-surface border border-border" style={tipsContainerStyles}>
        <div className="flex items-start gap-3">
          <Lightbulb size={16} style={iconStyles} />
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