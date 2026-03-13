import { useState } from 'react';
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

  const ActiveComponent = TABS.find(tab => tab.id === activeTab)?.component || DescribeTab;
  const activeIndex = TABS.findIndex(tab => tab.id === activeTab);

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

  return (
    <div
      role="main"
      className="flex-1 flex flex-col overflow-hidden"
      style={{ background: t.bg }}
    >
      {/* Tab Bar */}
      <nav
        aria-label="Agent wizard tabs"
        className="flex border-b shrink-0"
        style={{ 
          background: t.surface,
          borderColor: t.border,
        }}
      >
        {TABS.map((tab, index) => {
          const Icon = tab.icon;
          const isActive = tab.id === activeTab;
          const isCompleted = index < activeIndex; // Previous tabs are considered completed

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              aria-selected={isActive}
              className="flex items-center gap-2 px-6 py-4 text-sm font-medium border-none cursor-pointer transition-colors min-h-[44px]"
              style={{
                background: 'transparent',
                color: isActive ? '#FE5000' : t.textSecondary,
                borderBottom: isActive ? '2px solid #FE5000' : '2px solid transparent',
              }}
              onMouseEnter={e => {
                if (!isActive) {
                  e.currentTarget.style.color = '#FE5000';
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
                  e.currentTarget.style.color = '#FE5000';
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
                  color: isCompleted ? '#2ecc71' : (isActive ? '#FE5000' : t.textDim)
                }} 
              />
              <span style={{ fontFamily: "'Geist Sans', sans-serif" }}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Tab Content */}
      <div 
        className="flex-1 overflow-y-auto"
        style={{ padding: '24px 32px' }}
      >
        <ActiveComponent />
        
        {/* Navigation Buttons */}
        <div className="flex justify-between mt-8 pt-6" style={{ borderTop: `1px solid ${t.border}` }}>
          <button
            type="button"
            onClick={handlePrev}
            disabled={activeIndex === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border-none cursor-pointer min-h-[44px]"
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
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border-none cursor-pointer min-h-[44px]"
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
  );
}