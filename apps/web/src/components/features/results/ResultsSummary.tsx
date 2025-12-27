interface ResultsSummaryProps {
  summary: {
    totalIssues: number;
    critical: number;
    serious: number;
    moderate: number;
    minor: number;
  };
  passed?: number;
}

export function ResultsSummary({ summary, passed = 0 }: ResultsSummaryProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      <SummaryCard label="Critical" count={summary.critical} color="critical" />
      <SummaryCard label="Serious" count={summary.serious} color="serious" />
      <SummaryCard label="Moderate" count={summary.moderate} color="moderate" />
      <SummaryCard label="Minor" count={summary.minor} color="minor" />
      <SummaryCard label="Passed" count={passed} color="success" />
    </div>
  );
}

interface SummaryCardProps {
  label: string;
  count: number;
  color: 'critical' | 'serious' | 'moderate' | 'minor' | 'success';
}

function SummaryCard({ label, count, color }: SummaryCardProps) {
  const colorClasses = {
    critical: 'bg-red-100 text-red-800 border-red-200',
    serious: 'bg-orange-100 text-orange-800 border-orange-200',
    moderate: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    minor: 'bg-blue-100 text-blue-800 border-blue-200',
    success: 'bg-green-100 text-green-800 border-green-200',
  };

  return (
    <div className={`p-4 rounded-lg border ${colorClasses[color]}`}>
      <div className="text-2xl font-bold">{count}</div>
      <div className="text-sm">{label}</div>
    </div>
  );
}
