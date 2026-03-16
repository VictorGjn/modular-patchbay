import { useTheme } from '../theme';
import { QualificationPanel } from '../panels/QualificationPanel';

export function QualificationTab() {
  const t = useTheme();

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

      {/* QualificationPanel Content */}
      <QualificationPanel />
    </div>
  );
}