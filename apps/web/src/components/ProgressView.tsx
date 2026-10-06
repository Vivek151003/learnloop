import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ProgressDto } from '@learnloop/shared';
import { EmptyState, Meter, Panel, PanelHeader, StatStrip } from './ui';
import { duration, pct, shortDate } from '../lib/format';

const INK = '#1C1B17';
const RULE = '#E3DED2';
const MUTED = '#6B665D';
const MONO = '"IBM Plex Mono", ui-monospace, monospace';

/** FR-15: mastery per topic, streak, accuracy trend and time spent. Shared by student and teacher views. */
export function ProgressView({ progress }: { progress: ProgressDto }) {
  const trend = progress.trend.map((t) => ({
    ...t,
    label: shortDate(t.date),
    accuracyPct: t.attempts ? Math.round(t.accuracy * 100) : null,
  }));
  const mastery = [...progress.mastery].sort((a, b) => b.score - a.score);
  const activeDays = progress.trend.filter((t) => t.attempts > 0).length;

  return (
    <div className="space-y-8">
      <StatStrip
        items={[
          {
            label: 'Streak',
            value: `${progress.streakDays}d`,
            note: 'days in a row with practice',
          },
          { label: 'Correct', value: pct(progress.accuracy), note: 'of all answers' },
          { label: 'Answered', value: progress.totalAttempts, note: 'questions in total' },
          { label: 'Time', value: duration(progress.timeSpentMs), note: 'spent answering' },
        ]}
      />

      {progress.totalAttempts === 0 ? (
        <EmptyState
          title="No practice yet"
          description="Answer a few questions and mastery by topic will show up here."
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <Panel as="section">
            <PanelHeader title="Mastery by topic" meta="0–100%, recent answers count most" />
            <ul className="divide-y divide-rule">
              {mastery.map((m) => (
                <li
                  key={m.topicId}
                  className="grid grid-cols-[minmax(0,1fr)_3rem] items-center gap-x-4 gap-y-1.5 px-5 py-3"
                >
                  <span className="truncate text-sm">{m.topicName}</span>
                  <span className="text-right font-mono text-sm tabular-nums">{pct(m.score)}</span>
                  <Meter
                    value={m.score}
                    label={`${m.topicName} mastery`}
                    tone={m.score >= 0.7 ? 'right' : m.score < 0.4 ? 'wrong' : 'ink'}
                  />
                  <span className="text-right font-mono text-2xs text-ink-3">{m.attempts} ans</span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel as="section">
            <PanelHeader
              title="Accuracy, last 14 days"
              meta={`${activeDays} active day${activeDays === 1 ? '' : 's'}`}
            />
            <div
              className="h-64 px-2 pb-2 pt-4"
              role="img"
              aria-label="Line chart of daily accuracy over the last 14 days. Daily values are in the table below."
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend} margin={{ left: -12, right: 16, top: 8, bottom: 0 }}>
                  <CartesianGrid stroke={RULE} vertical={false} />
                  <XAxis
                    dataKey="label"
                    stroke={MUTED}
                    tickLine={false}
                    axisLine={{ stroke: RULE }}
                    tick={{ fontSize: 11, fontFamily: MONO }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    domain={[0, 100]}
                    ticks={[0, 50, 100]}
                    tickFormatter={(v) => `${v}%`}
                    stroke={MUTED}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fontFamily: MONO }}
                  />
                  <Tooltip
                    cursor={{ stroke: RULE }}
                    contentStyle={{
                      border: `1px solid ${RULE}`,
                      borderRadius: 6,
                      fontFamily: MONO,
                      fontSize: 12,
                      boxShadow: 'none',
                    }}
                    formatter={(v, _n, item) => [
                      `${v}% of ${(item.payload as { attempts: number }).attempts}`,
                      'Correct',
                    ]}
                  />
                  <Line
                    type="linear"
                    dataKey="accuracyPct"
                    stroke={INK}
                    strokeWidth={1.75}
                    dot={{ r: 3, fill: '#F2C230', stroke: INK, strokeWidth: 1.5 }}
                    activeDot={{ r: 4 }}
                    connectNulls
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <details className="border-t border-rule px-5 py-3 text-sm">
              <summary className="cursor-pointer text-ink-2">Daily numbers</summary>
              <table className="mt-2 w-full font-mono text-xs">
                <tbody>
                  {trend
                    .filter((t) => t.attempts > 0)
                    .map((t) => (
                      <tr key={t.date} className="border-t border-rule">
                        <td className="py-1.5">{t.label}</td>
                        <td className="py-1.5 text-right">{t.attempts} answered</td>
                        <td className="py-1.5 text-right">{t.accuracyPct}%</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </details>
          </Panel>
        </div>
      )}
    </div>
  );
}
