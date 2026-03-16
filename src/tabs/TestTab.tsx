import { useState, useCallback, useEffect } from 'react';
import { useTheme } from '../theme';
import { useConversationStore } from '../store/conversationStore';
import { TracePanel } from '../components/test/TracePanel';
import { ConversationPanel } from '../components/test/ConversationPanel';
import { ContextInspector } from '../components/test/ContextInspector';
import { PanelDivider } from '../components/ds/PanelDivider';
import { MessageCircle, Search, Activity } from 'lucide-react';

const STORAGE_KEY = 'testTab-panelWidths';
const DEFAULT_LEFT_WIDTH = 25;
const DEFAULT_RIGHT_WIDTH = 25;

interface PanelWidths {
  left: number;
  right: number;
}

export function TestTab() {
  const t = useTheme();
  const conversationId = useConversationStore(s => s.conversationId);
  
  const [panelWidths, setPanelWidths] = useState<PanelWidths>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return { left: DEFAULT_LEFT_WIDTH, right: DEFAULT_RIGHT_WIDTH };
      }
    }
    return { left: DEFAULT_LEFT_WIDTH, right: DEFAULT_RIGHT_WIDTH };
  });

  const [mobileTabIndex, setMobileTabIndex] = useState(0);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1200);
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(panelWidths));
  }, [panelWidths]);

  const handleLeftResize = useCallback((leftWidthPct: number) => {
    setPanelWidths(prev => ({ ...prev, left: leftWidthPct }));
  }, []);

  const handleRightResize = useCallback((rightWidthPct: number) => {
    setPanelWidths(prev => ({ ...prev, right: 100 - rightWidthPct }));
  }, []);

  const handleLeftCollapse = useCallback(() => {
    setIsCollapsed(!isCollapsed);
    if (!isCollapsed) {
      setPanelWidths(prev => ({ ...prev, left: 0 }));
    } else {
      setPanelWidths(prev => ({ ...prev, left: DEFAULT_LEFT_WIDTH }));
    }
  }, [isCollapsed]);

  const centerWidth = 100 - panelWidths.left - panelWidths.right;

  if (isMobile) {
    const tabs = [
      { id: 'conversation', label: 'Conversation', icon: MessageCircle, component: ConversationPanel },
      { id: 'trace', label: 'Trace', icon: Activity, component: TracePanel },
      { id: 'context', label: 'Inspector', icon: Search, component: ContextInspector },
    ];

    const ActiveComponent = tabs[mobileTabIndex]?.component || ConversationPanel;

    return (
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="px-4 py-3">
          <h2 
            className="text-2xl font-semibold mb-2"
            style={{ color: t.textPrimary, fontFamily: "'Geist Sans', sans-serif" }}
          >
            Test Your Agent
          </h2>
          <p className="text-sm" style={{ color: t.textSecondary, lineHeight: 1.5 }}>
            Test your agent with sample conversations, view execution traces, and analyze performance.
          </p>
        </div>

        {/* Tab Bar */}
        <div 
          className="flex border-b"
          style={{ borderColor: t.border, background: t.surfaceElevated }}
        >
          {tabs.map((tab, index) => {
            const Icon = tab.icon;
            const isActive = index === mobileTabIndex;
            
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setMobileTabIndex(index)}
                className="flex items-center gap-2 px-4 py-3 text-sm font-medium border-none bg-transparent"
                style={{
                  color: isActive ? '#FE5000' : t.textSecondary,
                  borderBottom: isActive ? '2px solid #FE5000' : 'none',
                  fontFamily: "'Geist Sans', sans-serif"
                }}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          <ActiveComponent conversationId={conversationId || undefined} />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 flex-shrink-0">
        <h2 
          className="text-2xl font-semibold mb-2"
          style={{ color: t.textPrimary, fontFamily: "'Geist Sans', sans-serif" }}
        >
          Test Your Agent
        </h2>
        <p className="text-sm" style={{ color: t.textSecondary, lineHeight: 1.5 }}>
          Test your agent with sample conversations, view execution traces, and analyze performance.
        </p>
      </div>

      {/* 3-Panel Layout */}
      <div 
        className="flex-1 flex overflow-hidden"
        style={{ 
          display: 'grid',
          gridTemplateColumns: `${panelWidths.left}% 4px ${centerWidth}% 4px ${panelWidths.right}%`,
          gap: 0
        }}
      >
        {/* Left Panel - Trace */}
        <div 
          className="overflow-hidden border-r"
          style={{ 
            borderColor: t.border, 
            background: t.surface,
            display: panelWidths.left === 0 ? 'none' : 'block'
          }}
        >
          <TracePanel conversationId={conversationId || undefined} />
        </div>

        {/* Left Divider */}
        <PanelDivider
          onResize={handleLeftResize}
          leftWidthPct={panelWidths.left}
          onDoubleClick={handleLeftCollapse}
        />

        {/* Center Panel - Conversation */}
        <div 
          className="overflow-hidden"
          style={{ background: t.surface }}
        >
          <ConversationPanel conversationId={conversationId || undefined} />
        </div>

        {/* Right Divider */}
        <PanelDivider
          onResize={handleRightResize}
          leftWidthPct={100 - panelWidths.right}
        />

        {/* Right Panel - Context Inspector */}
        <div 
          className="overflow-hidden border-l"
          style={{ 
            borderColor: t.border, 
            background: t.surface,
            display: panelWidths.right === 0 ? 'none' : 'block'
          }}
        >
          <ContextInspector conversationId={conversationId || undefined} />
        </div>
      </div>
    </div>
  );
}