import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ProgressDto } from '@learnloop/shared';
import { Card, EmptyState, Meter, Stat } from './ui';
import { duration, pct, shortDate } from '../lib/format';

const BRAND = '#4f46e5';
const GRID = '#e2e8f0';
const AXIS = '#64748b';

/** FR-15: mastery per topic, streak, accuracy trend and time spent. Shared by the student and teacher views. */
export function ProgressView({ progress }: { progress: ProgressDto }) {
  const trend = progress.trend.map((t) => ({
    ...t,
    label: shortDate(t.date),
    accuracyPct: t.attempts ? Math.round(t.accuracy * 100) : null,
  }));
  const mastery = progress.mastery.map((m) => ({ ...m, scorePct: Math.round(m.score * 100) }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Streak"
          value={`${progress.streakDays} day${progress.streakDays === 1 ? '' : 's'}`}
        />
        <Stat label="Accuracy" value={pct(progress.accuracy)} />
        <Stat label="Questions answered" value={progress.totalAttempts} />
        <Stat label="Time practising" value={duration(progress.timeSpentMs)} />
      </div>

      {progress.totalAttempts === 0 ? (
        <EmptyState
          title="No practice yet"
          description="Answer a few questions and your mastery and trends will appear here."
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <h2 className="font-semibold text-ink">Mastery by topic</h2>
            <div className="mt-4 h-64" aria-hidden="true">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mastery} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid horizontal={false} stroke={GRID} />
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                    stroke={AXIS}
                    fontSize={12}
                  />
                  <YAxis
                    type="category"
                    dataKey="topicName"
                    width={110}
                    stroke={AXIS}
                    fontSize={12}
                  />
                  <Tooltip formatter={(v) => [`${v}%`, 'Mastery']} />
                  <Bar dataKey="scorePct" fill={BRAND} radius={[0, 4, 4, 0]} barSize={14} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {/* Text equivalent of the chart for screen readers and small screens. */}
            <ul className="mt-4 space-y-3">
              {progress.mastery.map((m) => (
                <li key={m.topicId}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="text-ink">{m.topicName}</span>
                    <span className="tabular-nums text-ink-muted">
                      {pct(m.score)} · {m.attempts} answered
                    </span>
                  </div>
                  <Meter
                    value={m.score}
                    label={`${m.topicName} mastery`}
                    tone={m.score >= 0.7 ? 'success' : m.score >= 0.4 ? 'brand' : 'warn'}
                  />
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <h2 className="font-semibold text-ink">Accuracy, last 14 days</h2>
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend} margin={{ left: -16, right: 8, top: 8 }}>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis dataKey="label" stroke={AXIS} fontSize={12} interval="preserveStartEnd" />
                  <YAxis
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                    stroke={AXIS}
                    fontSize={12}
                  />
                  <Tooltip
                    formatter={(v, _n, item) => [
                      `${v}% (${(item.payload as { attempts: number }).attempts} answered)`,
                      'Accuracy',
                    ]}
                  />
                  <Line
                    type="monotone"
                    dataKey="accuracyPct"
                    stroke={BRAND}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 text-xs text-ink-faint">Days without practice are skipped.</p>
          </Card>
        </div>
      )}
    </div>
  );
}
