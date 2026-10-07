import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CheckCheck, Clock, Flame, Target } from 'lucide-react';
import type { ProgressDto } from '@learnloop/shared';
import { Card, CardHeader, EmptyState, ProgressBar, StatCard } from './ui';
import { duration, pct, shortDate } from '../lib/format';

const BRAND = '#2457E6';
const GRID = '#E4E7EC';
const MUTED = '#667085';

/** FR-15: mastery per topic, streak, accuracy trend and time spent. Shared by the student and teacher views. */
export function ProgressView({ progress }: { progress: ProgressDto }) {
  const trend = progress.trend.map((t) => ({
    ...t,
    label: shortDate(t.date),
    accuracyPct: t.attempts ? Math.round(t.accuracy * 100) : null,
  }));
  const mastery = [...progress.mastery].sort((a, b) => b.score - a.score);
  const activeDays = progress.trend.filter((t) => t.attempts > 0).length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Day streak" value={progress.streakDays} icon={Flame} tone="warning" />
        <StatCard label="Accuracy" value={pct(progress.accuracy)} icon={Target} tone="success" />
        <StatCard label="Questions answered" value={progress.totalAttempts} icon={CheckCheck} />
        <StatCard label="Time practising" value={duration(progress.timeSpentMs)} icon={Clock} />
      </div>

      {progress.totalAttempts === 0 ? (
        <Card>
          <EmptyState
            icon={Target}
            title="No practice yet"
            description="Answer a few questions and mastery by topic will show up here."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <Card>
            <CardHeader title="Mastery by topic" description="Recent answers count the most" />
            <ul className="divide-y divide-gray-100">
              {mastery.map((m) => (
                <li key={m.topicId} className="px-5 py-3.5">
                  <div className="mb-2 flex items-baseline justify-between gap-3">
                    <span className="font-medium text-gray-900">{m.topicName}</span>
                    <span className="tabular text-gray-500">
                      <span className="font-medium text-gray-900">{pct(m.score)}</span> ·{' '}
                      {m.attempts} answered
                    </span>
                  </div>
                  <ProgressBar
                    value={m.score}
                    label={`${m.topicName} mastery`}
                    tone={m.score >= 0.7 ? 'success' : m.score < 0.4 ? 'danger' : 'brand'}
                  />
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader
              title="Accuracy over time"
              description={`Last 14 days · ${activeDays} active day${activeDays === 1 ? '' : 's'}`}
            />
            <div
              className="h-64 px-2 pb-2 pt-5"
              role="img"
              aria-label="Line chart of daily accuracy over the last 14 days. The daily numbers are listed below."
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend} margin={{ left: -12, right: 16, top: 8, bottom: 0 }}>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis
                    dataKey="label"
                    stroke={MUTED}
                    tickLine={false}
                    axisLine={{ stroke: GRID }}
                    tick={{ fontSize: 12 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    domain={[0, 100]}
                    ticks={[0, 25, 50, 75, 100]}
                    tickFormatter={(v) => `${v}%`}
                    stroke={MUTED}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip
                    cursor={{ stroke: GRID }}
                    contentStyle={{
                      border: `1px solid ${GRID}`,
                      borderRadius: 8,
                      fontSize: 12,
                      boxShadow: '0 4px 12px rgba(16,24,40,0.1)',
                    }}
                    formatter={(v, _n, item) => [
                      `${v}% of ${(item.payload as { attempts: number }).attempts} answered`,
                      'Correct',
                    ]}
                  />
                  <Line
                    type="linear"
                    dataKey="accuracyPct"
                    stroke={BRAND}
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#fff', stroke: BRAND, strokeWidth: 2 }}
                    activeDot={{ r: 5 }}
                    connectNulls
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <details className="border-t border-gray-200 px-5 py-3 text-sm">
              <summary className="cursor-pointer font-medium text-gray-600">
                View daily numbers
              </summary>
              <table className="mt-3 w-full text-sm tabular">
                <tbody>
                  {trend
                    .filter((t) => t.attempts > 0)
                    .map((t) => (
                      <tr key={t.date} className="border-t border-gray-100">
                        <td className="py-1.5 text-gray-600">{t.label}</td>
                        <td className="py-1.5 text-right text-gray-500">{t.attempts} answered</td>
                        <td className="py-1.5 text-right font-medium text-gray-900">
                          {t.accuracyPct}%
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </details>
          </Card>
        </div>
      )}
    </div>
  );
}
