import { useState, useRef, useEffect } from 'react';
import { useTheme } from '../theme';
import { DescribeTab } from '../tabs/DescribeTab';
import { KnowledgeTab } from '../tabs/KnowledgeTab';
import { ToolsTab } from '../tabs/ToolsTab';
import { MemoryTab } from '../tabs/MemoryTab';
import { ReviewTab } from '../tabs/ReviewTab';
import { TestTab } from '../tabs/TestTab';
import { QualificationTab } from '../tabs/QualificationTab';
import {
  FileText, Database, Wrench, Brain, 
  CheckSquare, Play, Award
} from 'lucide-react';

const TABS = [
  { id: 'describe', label: 'Describe', icon: FileText, component: DescribeTab },
  { id: 'knowledge', label: 'Knowledge', icon: Database, component: KnowledgeTab },
  { id: 'tools', label: 'Tools', icon: Wrench, component: ToolsTab },
  { id: 'memory', label: 'Memory', icon: Brain, component: MemoryTab },
  { id: 'review', label: 'Review', icon: CheckSquare, component: ReviewTab },
  { id: 'test', label: 'Test', icon: Play, component: TestTab },
  { id: 'qualification', label: 'Qualification', icon: Award, component: QualificationTab },
] as const;

export function WizardLayout() {
  const t = useTheme();
  const [activeTab, setActiveTab] = useState('describe');
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const contentRef = useRef<HTMLDivElement>(null);

  const ActiveComponent = TABS.find(tab => tab.id === activeTab)?.component || DescribeTab;
  const activeIndex = TABS.findIndex(tab => tab.id === activeTab);

  // Focus management when tab changes
  useEffect(() => {
    if (contentRef.current) {
      // Focus should move to the content when switching tabs
      const skipLink = contentRef.current.querySelector('[data-skip-target]') as HTMLElement;
      const firstHeading = contentRef.current.querySelector('h2, h3, h4') as HTMLElement;
      const focusTarget = skipLink || firstHeading || contentRef.current;
      
      if (focusTarget) {
        focusTarget.focus();
      }
    }
  }, [activeTab]);

  const handleNext = () => {
    if (activeIndex < TABS.length - 1) {
      setActiveTab(TABS[activeIndex + 1].id);
    }
  };

  const handlePrev = () => {
    if (activeIndex > 0) {
      setActiveTab(TABS[activeIndex - 1].id);
    }
  };

  const handleTabKeyDown = (e: React.KeyboardEvent, index: number) => {
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        const prevIndex = index === 0 ? TABS.length - 1 : index - 1;
        tabRefs.current[prevIndex]?.focus();
        setActiveTab(TABS[prevIndex].id);
        break;
      case 'ArrowRight':
        e.preventDefault();
        const nextIndex = index === TABS.length - 1 ? 0 : index + 1;
        tabRefs.current[nextIndex]?.focus();
        setActiveTab(TABS[nextIndex].id);
        break;
      case 'Home':
        e.preventDefault();
        tabRefs.current[0]?.focus();
        setActiveTab(TABS[0].id);
        break;
      case 'End':
        e.preventDefault();
        const lastIndex = TABS.length - 1;
        tabRefs.current[lastIndex]?.focus();
        setActiveTab(TABS[lastIndex].id);
        break;
    }
  };

  // Generate better contrast color for dark backgrounds
  const getContrastColor = (baseColor: string, isDarkBg: boolean) => {
    if (isDarkBg && baseColor === '#FE5000') {
      return '#FF6B1A'; // Lighter variant that passes 4.5:1 contrast on dark surfaces
    }
    return baseColor;
  };

  return (
    <div
      role="main"
      className="min-h-screen flex flex-col overflow-hidden"
      style={{ background: t.bg }}
    >
      {/* Skip Link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-3 focus:py-2 focus:rounded"
        style={{ 
          background: t.surface, 
          color: t.textPrimary,
          textDecoration: 'none',
          outline: `2px solid ${getContrastColor('#FE5000', t.isDark)}`
        }}
      >
        Skip to main content
      </a>

      {/* Tab Bar */}
      <nav
        aria-label="Agent wizard steps"
        className="flex border-b shrink-0"
        style={{ 
          background: t.surface,
          borderColor: t.border,
        }}
      >
        <div role="tablist" className="flex w-full max-w-4xl mx-auto">
          {TABS.map((tab, index) => {
            const Icon = tab.icon;
            const isActive = tab.id === activeTab;
            const isCompleted = index < activeIndex;
            const accentColor = getContrastColor('#FE5000', t.isDark);

            return (
              <button
                key={tab.id}
                ref={el => { tabRefs.current[index] = el; }}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`tabpanel-${tab.id}`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => setActiveTab(tab.id)}
                onKeyDown={(e) => handleTabKeyDown(e, index)}
                className="flex items-center gap-2 px-6 py-4 text-sm font-medium border-none cursor-pointer transition-colors min-h-[44px]"
                style={{
                  background: 'transparent',
                  color: isActive ? accentColor : t.textSecondary,
                  borderBottom: isActive ? `2px solid ${accentColor}` : '2px solid transparent',
                }}
                onMouseEnter={e => {
                  if (!isActive) {
                    e.currentTarget.style.color = accentColor;
                    e.currentTarget.style.background = t.isDark ? '#FE500010' : '#FE500005';
                  }
                }}
                onMouseLeave={e => {
                  if (!isActive) {
                    e.currentTarget.style.color = t.textSecondary;
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
                onFocus={e => {
                  if (!isActive) {
                    e.currentTarget.style.color = accentColor;
                    e.currentTarget.style.background = t.isDark ? '#FE500010' : '#FE500005';
                  }
                }}
                onBlur={e => {
                  if (!isActive) {
                    e.currentTarget.style.color = t.textSecondary;
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                <Icon 
                  size={16} 
                  style={{ 
                    color: isCompleted ? '#2ecc71' : (isActive ? accentColor : t.textDim)
                  }}
                  aria-hidden="true"
                />
                <span style={{ fontFamily: "'Geist Sans', sans-serif" }}>
                  {tab.label}
                </span>
                <span className="sr-only">
                  {isActive && ', selected'}
                  {isCompleted && ', completed'}
                  . Use arrow keys to navigate tabs.
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Tab Content */}
      <div 
        ref={contentRef}
        id="main-content"
        role="tabpanel"
        aria-labelledby={`tab-${activeTab}`}
        tabIndex={0}
        className="flex-1 overflow-y-auto focus:outline-none"
        data-skip-target
      >
        <div className="max-w-4xl mx-auto px-8 py-6">
          <ActiveComponent />
          
          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8 pt-6" style={{ borderTop: `1px solid ${t.border}` }}>
            <button
              type="button"
              onClick={handlePrev}
              disabled={activeIndex === 0}
              aria-label={`Go to previous step: ${activeIndex > 0 ? TABS[activeIndex - 1].label : 'none'}`}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border-none cursor-pointer min-h-[44px] transition-opacity"
              style={{
                background: activeIndex === 0 ? 'transparent' : t.surfaceElevated,
                color: activeIndex === 0 ? t.textFaint : t.textPrimary,
                border: `1px solid ${activeIndex === 0 ? 'transparent' : t.border}`,
                opacity: activeIndex === 0 ? 0.5 : 1,
                cursor: activeIndex === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              Previous
            </button>
            
            <button
              type="button"
              onClick={handleNext}
              disabled={activeIndex === TABS.length - 1}
              aria-label={`Go to next step: ${activeIndex < TABS.length - 1 ? TABS[activeIndex + 1].label : 'none'}`}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border-none cursor-pointer min-h-[44px] transition-opacity"
              style={{
                background: activeIndex === TABS.length - 1 ? 'transparent' : '#FE5000',
                color: activeIndex === TABS.length - 1 ? t.textFaint : '#fff',
                opacity: activeIndex === TABS.length - 1 ? 0.5 : 1,
                cursor: activeIndex === TABS.length - 1 ? 'not-allowed' : 'pointer',
              }}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}