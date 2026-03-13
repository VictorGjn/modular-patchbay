import { useState } from 'react';
import { useTheme } from '../theme';
import { Section } from '../components/ds/Section';
import {
  Award, Plus, Play, CheckCircle, XCircle, 
  Clock, Target
} from 'lucide-react';



// Mock test suites data
const MOCK_TEST_SUITES = [
  {
    id: '1',
    name: 'Basic Functionality',
    description: 'Tests core agent functionality and response quality',
    tests: [
      { name: 'Simple Q&A', status: 'passed' as const, duration: 1200 },
      { name: 'Context Understanding', status: 'passed' as const, duration: 1800 },
      { name: 'Error Handling', status: 'failed' as const, duration: 900 },
    ],
    lastRun: new Date('2024-01-15T10:30:00Z'),
  },
  {
    id: '2',
    name: 'Knowledge Integration',
    description: 'Validates knowledge source utilization and retrieval',
    tests: [
      { name: 'Source Citation', status: 'passed' as const, duration: 2100 },
      { name: 'Knowledge Synthesis', status: 'pending' as const, duration: 0 },
      { name: 'Fact Verification', status: 'passed' as const, duration: 1500 },
    ],
    lastRun: new Date('2024-01-14T14:20:00Z'),
  },
  {
    id: '3',
    name: 'Tool Usage',
    description: 'Tests MCP server integrations and skill execution',
    tests: [
      { name: 'API Calls', status: 'pending' as const, duration: 0 },
      { name: 'Skill Execution', status: 'pending' as const, duration: 0 },
      { name: 'Error Recovery', status: 'pending' as const, duration: 0 },
    ],
    lastRun: null,
  },
];

export function QualificationTab() {
  const t = useTheme();
  const [testSuitesCollapsed, setTestSuitesCollapsed] = useState(false);
  const [metricsCollapsed, setMetricsCollapsed] = useState(false);
  const [benchmarksCollapsed, setBenchmarksCollapsed] = useState(false);

  const getStatusIcon = (status: 'passed' | 'failed' | 'pending') => {
    switch (status) {
      case 'passed':
        return <CheckCircle size={14} style={{ color: '#2ecc71' }} />;
      case 'failed':
        return <XCircle size={14} style={{ color: '#e74c3c' }} />;
      case 'pending':
        return <Clock size={14} style={{ color: '#f1c40f' }} />;
    }
  };

  const getStatusColor = (status: 'passed' | 'failed' | 'pending') => {
    switch (status) {
      case 'passed': return '#2ecc71';
      case 'failed': return '#e74c3c';
      case 'pending': return '#f1c40f';
    }
  };

  const formatDuration = (ms: number) => {
    if (ms === 0) return 'N/A';
    return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
  };

  const formatDate = (date: Date | null) => {
    if (!date) return 'Never';
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Calculate overall stats
  const allTests = (MOCK_TEST_SUITES as any).flatMap((suite: any) => suite.tests);
  const passedTests = allTests.filter((test: any) => test.status === 'passed').length;
  const totalTests = allTests.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold mb-2 m-0" style={{ color: t.textPrimary, fontFamily: "'Geist Sans', sans-serif" }}>
          Qualification & Testing
        </h2>
        <p className="text-sm" style={{ color: t.textSecondary, lineHeight: 1.5 }}>
          Run comprehensive test suites to validate your agent's performance, reliability, and adherence to requirements before production deployment.
        </p>
      </div>

      {/* Test Suites */}
      <Section
        icon={Award} label="Test Suites" color="#FE5000"
        badge={`${passedTests}/${totalTests} passed`}
        collapsed={testSuitesCollapsed} onToggle={() => setTestSuitesCollapsed(!testSuitesCollapsed)}
      >
        <div className="space-y-4">
          {MOCK_TEST_SUITES.map((suite) => {
            const suitePassed = suite.tests.filter(test => test.status === 'passed').length;
            const suiteFailed = suite.tests.filter(test => test.status === 'failed').length;
            const suitePending = suite.tests.filter(test => test.status === 'pending').length;

            
            return (
              <div key={suite.id} className="p-4 rounded-lg border" style={{ border: `1px solid ${t.border}`, background: t.surfaceElevated }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold mb-1" style={{ color: t.textPrimary, fontFamily: "'Geist Sans', sans-serif" }}>
                      {suite.name}
                    </h3>
                    <p className="text-sm" style={{ color: t.textSecondary }}>
                      {suite.description}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="text-sm" style={{ color: t.textDim, fontFamily: "'Geist Mono', monospace" }}>
                      Last run: {formatDate(suite.lastRun)}
                    </div>
                    <button
                      type="button"
                      className="flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium border-none cursor-pointer"
                      style={{
                        background: '#FE5000',
                        color: '#fff',
                        fontFamily: "'Geist Sans', sans-serif",
                      }}
                    >
                      <Play size={14} />
                      Run
                    </button>
                  </div>
                </div>
                
                {/* Test results summary */}
                <div className="flex items-center gap-4 mb-3">
                  <span className="flex items-center gap-1 text-sm" style={{ color: '#2ecc71' }}>
                    <CheckCircle size={14} />
                    {suitePassed} passed
                  </span>
                  <span className="flex items-center gap-1 text-sm" style={{ color: '#e74c3c' }}>
                    <XCircle size={14} />
                    {suiteFailed} failed
                  </span>
                  <span className="flex items-center gap-1 text-sm" style={{ color: '#f1c40f' }}>
                    <Clock size={14} />
                    {suitePending} pending
                  </span>
                </div>
                
                {/* Individual tests */}
                <div className="space-y-2">
                  {suite.tests.map((test, index) => (
                    <div key={index} className="flex items-center justify-between p-2 rounded" style={{ background: t.surface }}>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(test.status)}
                        <span className="text-sm" style={{ color: t.textPrimary }}>
                          {test.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs" style={{ color: t.textDim, fontFamily: "'Geist Mono', monospace" }}>
                          {formatDuration(test.duration)}
                        </span>
                        <span 
                          className="text-xs px-2 py-1 rounded-full"
                          style={{ 
                            background: `${getStatusColor(test.status)}15`, 
                            color: getStatusColor(test.status),
                            fontFamily: "'Geist Mono', monospace",
                            textTransform: 'uppercase',
                          }}
                        >
                          {test.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Add new test suite */}
        <button
          type="button"
          className="flex items-center gap-2 w-full mt-4 px-4 py-3 rounded-lg border-2 border-dashed cursor-pointer"
          style={{
            borderColor: t.border,
            background: 'transparent',
            color: t.textDim,
          }}
        >
          <Plus size={16} />
          Add Test Suite
        </button>
      </Section>

      {/* Quality Metrics */}
      <Section
        icon={Target} label="Quality Metrics" color="#2ecc71"
        badge="Latest results"
        collapsed={metricsCollapsed} onToggle={() => setMetricsCollapsed(!metricsCollapsed)}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-lg text-center" style={{ background: t.surfaceElevated }}>
            <div className="text-2xl font-bold mb-1" style={{ color: '#2ecc71' }}>
              87%
            </div>
            <div className="text-sm" style={{ color: t.textSecondary }}>
              Accuracy Score
            </div>
          </div>
          
          <div className="p-4 rounded-lg text-center" style={{ background: t.surfaceElevated }}>
            <div className="text-2xl font-bold mb-1" style={{ color: '#3498db' }}>
              1.2s
            </div>
            <div className="text-sm" style={{ color: t.textSecondary }}>
              Avg Response Time
            </div>
          </div>
          
          <div className="p-4 rounded-lg text-center" style={{ background: t.surfaceElevated }}>
            <div className="text-2xl font-bold mb-1" style={{ color: '#f1c40f' }}>
              94%
            </div>
            <div className="text-sm" style={{ color: t.textSecondary }}>
              Reliability Score
            </div>
          </div>
        </div>
        
        <div className="mt-6">
          <h4 className="font-semibold mb-3" style={{ color: t.textPrimary }}>
            Performance Trends
          </h4>
          <div className="h-32 rounded-lg flex items-center justify-center" style={{ background: t.surfaceElevated }}>
            <span style={{ color: t.textDim }}>
              Performance charts would be displayed here
            </span>
          </div>
        </div>
      </Section>

      {/* Benchmarks */}
      <Section
        icon={Award} label="Industry Benchmarks" color="#9b59b6"
        badge="Comparison"
        collapsed={benchmarksCollapsed} onToggle={() => setBenchmarksCollapsed(!benchmarksCollapsed)}
      >
        <div className="space-y-4">
          <div className="p-4 rounded-lg" style={{ background: t.surfaceElevated }}>
            <div className="flex items-center justify-between mb-2">
              <span style={{ color: t.textPrimary }}>HELM Benchmark</span>
              <span className="text-sm px-2 py-1 rounded" style={{ background: '#2ecc7120', color: '#2ecc71' }}>
                Above Average
              </span>
            </div>
            <div className="w-full h-2 rounded" style={{ background: t.borderSubtle }}>
              <div className="h-2 rounded" style={{ width: '78%', background: '#2ecc71' }} />
            </div>
            <div className="flex justify-between text-xs mt-1" style={{ color: t.textDim }}>
              <span>Your Score: 78/100</span>
              <span>Industry Avg: 65/100</span>
            </div>
          </div>
          
          <div className="p-4 rounded-lg" style={{ background: t.surfaceElevated }}>
            <div className="flex items-center justify-between mb-2">
              <span style={{ color: t.textPrimary }}>MT-Bench</span>
              <span className="text-sm px-2 py-1 rounded" style={{ background: '#f1c40f20', color: '#f1c40f' }}>
                Average
              </span>
            </div>
            <div className="w-full h-2 rounded" style={{ background: t.borderSubtle }}>
              <div className="h-2 rounded" style={{ width: '62%', background: '#f1c40f' }} />
            </div>
            <div className="flex justify-between text-xs mt-1" style={{ color: t.textDim }}>
              <span>Your Score: 6.2/10</span>
              <span>Industry Avg: 6.8/10</span>
            </div>
          </div>
        </div>
      </Section>

      {/* Action Buttons */}
      <div className="flex gap-4 mt-8">
        <button
          type="button"
          className="flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-medium border-none cursor-pointer"
          style={{
            background: '#FE5000',
            color: '#fff',
            fontFamily: "'Geist Sans', sans-serif",
          }}
        >
          <Play size={16} />
          Run All Tests
        </button>
        
        <button
          type="button"
          className="flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-medium border cursor-pointer"
          style={{
            background: 'transparent',
            color: t.textPrimary,
            borderColor: t.border,
            fontFamily: "'Geist Sans', sans-serif",
          }}
        >
          <Plus size={16} />
          Create Test Suite
        </button>
      </div>
    </div>
  );
}