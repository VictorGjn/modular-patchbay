import { useState, useRef, useEffect, Suspense, lazy } from 'react';
import { ErrorBoundary } from '../components/ds/ErrorBoundary';
import { ProviderOnboarding } from '../components/ds/ProviderOnboarding';
import { useTheme } from '../theme';
import { useConsoleStore } from '../store/consoleStore';
import { useMemoryStore } from '../store/memoryStore';
import { DescribeTab } from '../tabs/DescribeTab';
import { Spinner } from '../components/ds/Spinner';
import { FloatingRunButton } from '../components/ds/FloatingRunButton';
import {
  FileText, Database, Wrench, Brain, 
  CheckSquare, Play, Award, Check, ChevronLeft, ChevronRight
} from 'lucide-react';

// Code splitting for heavy components
const TestTab = lazy(() => import('../tabs/TestTab').then(module => ({ default: module.TestTab })));
const QualificationTab = lazy(() => import('../tabs/QualificationTab').then(module => ({ default: module.QualificationTab })));
const KnowledgeTab = lazy(() => import('../tabs/KnowledgeTab').then(module => ({ default: module.KnowledgeTab })));
const ToolsTab = lazy(() => import('../tabs/ToolsTab').then(module => ({ default: module.ToolsTab })));
const MemoryTab = lazy(() => import('../tabs/MemoryTab').then(module => ({ default: module.MemoryTab })));
const ReviewTab = lazy(() => import('../tabs/ReviewTab').then(module => ({ default: module.ReviewTab })));

const TABS = [
  { id: 'describe', label: 'Describe', icon: FileText, component: DescribeTab },
  { id: 'knowledge', label: 'Knowledge', icon: Database, component: KnowledgeTab },
  { id: 'tools', label: 'Tools', icon: Wrench, component: ToolsTab },
  { id: 'memory', label: 'Memory', icon: Brain, component: MemoryTab },
  { id: 'review', label: 'Review', icon: CheckSquare, component: ReviewTab },
  { id: 'test', label: 'Test', icon: Play, component: TestTab },
  { id: 'qualification', label: 'Qualification', icon: Award, component: QualificationTab },
] as const;

const MIN_DESKTOP_WIDTH = 1024;

// Loading fallback component
function LoadingFallback() {
  const t = useTheme();
  
  return (
    <div className="flex items-center justify-center h-32">
      <div className="flex items-center gap-3">
        <Spinner size="md" />
        <span style={{ color: t.textSecondary }}>Loading...</span>
      </div>
    </div>
  );
}

export function WizardLayout() {
  const t = useTheme();
  // Only subscribe to fields needed for tab completion checks
  const promptLength = useConsoleStore(s => s.prompt.length);
  const channelsLength = useConsoleStore(s => s.channels.length);
  const mcpServersLength = useConsoleStore(s => s.mcpServers.length);
  const skillsLength = useConsoleStore(s => s.skills.length);
  const agentName = useConsoleStore(s => s.agentMeta.name);
  const memoryStrategy = useMemoryStore(s => s.session.strategy);
  const factsLength = useMemoryStore(s => s.facts.length);
  const longTermEnabled = useMemoryStore(s => s.longTerm.enabled);
  const workingContent = useMemoryStore(s => s.working.content);
  const [activeTab, setActiveTab] = useState('describe');
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(false);
  
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const contentRef = useRef<HTMLDivElement>(null);
  const tabScrollRef = useRef<HTMLDivElement>(null);

  const ActiveComponent = TABS.find(tab => tab.id === activeTab)?.component || DescribeTab;
  const activeIndex = TABS.findIndex(tab => tab.id === activeTab);

  // Check scroll position for fade indicators
  const handleTabScroll = () => {
    const scrollContainer = tabScrollRef.current;
    if (!scrollContainer) return;
    
    const { scrollLeft, scrollWidth, clientWidth } = scrollContainer;
    setShowLeftFade(scrollLeft > 0);
    setShowRightFade(scrollLeft < scrollWidth - clientWidth - 1);
  };

  // Initialize scroll indicators on mount and window resize
  useEffect(() => {
    const checkScrollIndicators = () => {
      if (window.innerWidth >= MIN_DESKTOP_WIDTH) {
        setShowLeftFade(false);
        setShowRightFade(false);
        return;
      }
      handleTabScroll();
    };

    checkScrollIndicators();
    window.addEventListener('resize', checkScrollIndicators);
    
    return () => window.removeEventListener('resize', checkScrollIndicators);
  }, []);

  // Focus management when tab changes
  useEffect(() => {
    if (contentRef.current) {
      const skipLink = contentRef.current.querySelector('[data-skip-target]') as HTMLElement;
      const firstHeading = contentRef.current.querySelector('h2, h3, h4') as HTMLElement;
      const focusTarget = skipLink || firstHeading || contentRef.current;
      
      if (focusTarget) {
        focusTarget.focus();
      }
    }
  }, [activeTab]);

  // OAuth tab restoration
  useEffect(() => {
    const oauthCompleted = localStorage.getItem('mcp-oauth-completed');
    const returnTab = localStorage.getItem('mcp-oauth-return-tab');
    
    if (oauthCompleted === 'true' && returnTab && TABS.some(tab => tab.id === returnTab)) {
      // Restore the tab and clear the completion flag
      setActiveTab(returnTab);
      localStorage.removeItem('mcp-oauth-completed');
      localStorage.removeItem('mcp-oauth-return-tab');
    }
  }, []); // Run once on mount

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

  const handleFloatingRunClick = () => {
    setActiveTab('test');
    // Focus chat input after tab switch - try multiple selectors
    setTimeout(() => {
      const selectors = [
        '[data-test-chat-input]',
        'textarea[placeholder*="message"]',
        'input[placeholder*="message"]',
        'textarea[placeholder*="chat"]',
        'input[placeholder*="chat"]',
        'textarea',
        'input[type="text"]'
      ];
      
      for (const selector of selectors) {
        const input = document.querySelector(selector) as HTMLElement;
        if (input) {
          input.focus();
          break;
        }
      }
    }, 100);
  };

  const handleTabKeyDown = (e: React.KeyboardEvent, index: number) => {
    switch (e.key) {
      case 'ArrowLeft': {
        e.preventDefault();
        const prevIndex = index === 0 ? TABS.length - 1 : index - 1;
        tabRefs.current[prevIndex]?.focus();
        setActiveTab(TABS[prevIndex].id);
        break;
      }
      case 'ArrowRight': {
        e.preventDefault();
        const nextIndex = index === TABS.length - 1 ? 0 : index + 1;
        tabRefs.current[nextIndex]?.focus();
        setActiveTab(TABS[nextIndex].id);
        break;
      }
      case 'Home':
        e.preventDefault();
        tabRefs.current[0]?.focus();
        setActiveTab(TABS[0].id);
        break;
      case 'End': {
        e.preventDefault();
        const lastIndex = TABS.length - 1;
        tabRefs.current[lastIndex]?.focus();
        setActiveTab(TABS[lastIndex].id);
        break;
      }
      case 'Tab':
        // Allow natural tab navigation to content
        break;
    }
  };

  const getContrastColor = (baseColor: string, isDarkBg: boolean) => {
    if (isDarkBg && baseColor === '#FE5000') {
      return '#FF6B1A';
    }
    return baseColor;
  };

  // Check tab completion status
  const isTabComplete = (tabId: string): boolean => {
    switch (tabId) {
      case 'describe':
        return promptLength > 20;
      case 'knowledge':
        return channelsLength > 0;
      case 'tools':
        return mcpServersLength > 0 || skillsLength > 0;
      case 'memory':
        // Require explicit user action: changed strategy, added facts, enabled long-term, or added working context
        return memoryStrategy !== 'summarize_and_recent' ||
               factsLength > 0 ||
               longTermEnabled ||
               workingContent.length > 0;
      case 'review':
        return agentName !== '' && agentName.length > 0;
      default:
        return false;
    }
  };

  const fadeGradientStyles = {
    left: {
      background: `linear-gradient(to right, ${t.surface} 0%, transparent 100%)`,
    },
    right: {
      background: `linear-gradient(to left, ${t.surface} 0%, transparent 100%)`,
    },
  };

  return (
    <div
      role="main"
      className="flex-1 flex flex-col overflow-hidden min-h-0"
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
        className="relative flex border-b shrink-0"
        style={{ 
          background: t.surface,
          borderColor: t.border,
        }}
      >
        {/* Left fade indicator */}
        {showLeftFade && (
          <div 
            className="absolute left-0 top-0 bottom-0 w-8 pointer-events-none z-10"
            style={fadeGradientStyles.left}
            aria-hidden="true"
          />
        )}
        
        {/* Right fade indicator */}
        {showRightFade && (
          <div 
            className="absolute right-0 top-0 bottom-0 w-8 pointer-events-none z-10"
            style={fadeGradientStyles.right}
            aria-hidden="true"
          />
        )}

        <div 
          ref={tabScrollRef}
          role="tablist" 
          className="flex w-full overflow-x-auto lg:overflow-x-visible tab-scrollbar-hidden"
          onScroll={handleTabScroll}
        >
          {TABS.map((tab, index) => {
            const Icon = tab.icon;
            const isActive = tab.id === activeTab;
            const isCompleted = index < activeIndex;
            const isTabCompleted = isTabComplete(tab.id);
            const accentColor = getContrastColor('#FE5000', t.isDark);

            const getTabTooltip = (tabId: string) => {
              switch (tabId) {
                case 'describe': return 'Define your agent';
                case 'knowledge': return 'Add data sources';
                case 'tools': return 'Select capabilities';
                case 'memory': return 'Configure memory';
                case 'review': return 'Review and edit';
                case 'test': return 'Test and debug';
                case 'qualification': return 'Export and deploy';
                default: return tab.label;
              }
            };

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
                title={getTabTooltip(tab.id)}
                className="flex items-center gap-2 px-6 py-4 text-sm font-medium border-none cursor-pointer transition-colors min-h-[44px] whitespace-nowrap"
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
                {isTabCompleted && (
                  <Check 
                    size={12} 
                    style={{ color: '#2ecc71' }}
                    aria-hidden="true"
                  />
                )}
                <span className="sr-only">
                  {isActive && ', selected'}
                  {isCompleted && ', completed'}
                  {isTabCompleted && ', task completed'}
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
        className={`flex-1 min-h-0 focus:outline-none ${activeTab === 'test' ? 'overflow-hidden' : 'overflow-y-auto'}`}
        data-skip-target
      >
        <div className={activeTab === 'test' ? 'h-full' : 'w-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 py-6 pb-16'}>
          <ProviderOnboarding />
          <ErrorBoundary label={activeTab} key={activeTab}>
            <Suspense fallback={<LoadingFallback />}>
              {activeTab === 'describe' ? (
                <DescribeTab
                  onNavigateToNext={handleNext}
                  onNavigateToKnowledge={() => setActiveTab('knowledge')}
                />
              ) : (
                <ActiveComponent />
              )}
            </Suspense>
          </ErrorBoundary>
        </div>
      </div>

      {/* Edge Navigation Arrows */}
      {activeIndex > 0 && (
        <button
          type="button"
          onClick={handlePrev}
          aria-label={`Go to previous step: ${TABS[activeIndex - 1].label}`}
          className="fixed flex items-center justify-center w-10 h-10 rounded-full border-none cursor-pointer transition-all duration-200"
          style={{
            position: 'fixed',
            left: '16px',
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 30,
            background: t.isDark ? `${t.surface}CC` : `${t.surface}CC`, // 80% opacity
            color: t.textPrimary,
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = t.isDark ? `${t.surface}E6` : `${t.surface}E6`; // 90% opacity
            e.currentTarget.style.transform = 'translateY(-50%) scale(1.05)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = t.isDark ? `${t.surface}CC` : `${t.surface}CC`; // 80% opacity
            e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
          }}
          onFocus={e => {
            e.currentTarget.style.background = t.isDark ? `${t.surface}E6` : `${t.surface}E6`; // 90% opacity
            e.currentTarget.style.transform = 'translateY(-50%) scale(1.05)';
          }}
          onBlur={e => {
            e.currentTarget.style.background = t.isDark ? `${t.surface}CC` : `${t.surface}CC`; // 80% opacity
            e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
          }}
          title={`Previous: ${TABS[activeIndex - 1].label}`}
        >
          <ChevronLeft size={20} />
        </button>
      )}

      {activeIndex < TABS.length - 1 && (
        <button
          type="button"
          onClick={handleNext}
          aria-label={`Go to next step: ${TABS[activeIndex + 1].label}`}
          className="fixed flex items-center justify-center w-10 h-10 rounded-full border-none cursor-pointer transition-all duration-200"
          style={{
            position: 'fixed',
            right: '16px',
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 30,
            background: t.isDark ? `${t.surface}CC` : `${t.surface}CC`, // 80% opacity
            color: t.textPrimary,
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = t.isDark ? `${t.surface}E6` : `${t.surface}E6`; // 90% opacity
            e.currentTarget.style.transform = 'translateY(-50%) scale(1.05)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = t.isDark ? `${t.surface}CC` : `${t.surface}CC`; // 80% opacity
            e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
          }}
          onFocus={e => {
            e.currentTarget.style.background = t.isDark ? `${t.surface}E6` : `${t.surface}E6`; // 90% opacity
            e.currentTarget.style.transform = 'translateY(-50%) scale(1.05)';
          }}
          onBlur={e => {
            e.currentTarget.style.background = t.isDark ? `${t.surface}CC` : `${t.surface}CC`; // 80% opacity
            e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
          }}
          title={`Next: ${TABS[activeIndex + 1].label}`}
        >
          <ChevronRight size={20} />
        </button>
      )}

      {/* Floating Action Button */}
      <FloatingRunButton 
        onClick={handleFloatingRunClick}
        isVisible={activeTab !== 'test'}
      />
    </div>
  );
}