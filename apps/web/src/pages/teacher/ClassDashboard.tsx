import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ClassDto, ClassSummaryDto } from '@learnloop/shared';
import {
  Alert,
  Button,
  Code,
  EmptyState,
  ErrorState,
  LoadingBlock,
  Meter,
  PageHeader,
  Panel,
  PanelHeader,
  StatStrip,
  Status,
  TableWrap,
  Tag,
  Td,
  Th,
} from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { dueLabel, pct } from '../../lib/format';

/** FR-23: average score, completion, weakest topics and students at risk. */
export default function ClassDashboard() {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const summary = useQuery({
    queryKey: ['class-summary', id],
    queryFn: () => api.get<ClassSummaryDto>(`/classes/${id}/summary`),
  });
  const classes = useQuery({
    queryKey: ['classes'],
    queryFn: () => api.get<ClassDto[]>('/classes'),
  });
  const cls = classes.data?.find((c) => c.id === id);

  const update = useMutation({
    mutationFn: (body: { archived?: boolean; rotateJoinCode?: true }) =>
      api.patch<ClassDto>(`/classes/${id}`, body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['classes'] }),
  });
  const exportCsv = useMutation({
    mutationFn: () =>
      api.download(`/classes/${id}/results.csv`, `${cls?.name ?? 'class'}-results.csv`),
  });

  if (summary.isError)
    return <ErrorState error={summary.error} onRetry={() => void summary.refetch()} />;
  if (summary.isPending) return <LoadingBlock rows={4} />;
  const s = summary.data;
  const atRisk = new Set(s.studentsAtRisk.map((r) => r.studentId));

  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-3 text-sm text-ink-3">
        <Link to="/teacher" className="hover:text-ink">
          Classes
        </Link>{' '}
        / <span className="text-ink-2">{s.className}</span>
      </nav>
      <PageHeader
        title={s.className}
        subtitle={
          cls?.joinCode ? (
            <span className="flex flex-wrap items-center gap-2">
              Students join with <Code>{cls.joinCode}</Code>
              {cls.archived && <Tag>Archived</Tag>}
            </span>
          ) : undefined
        }
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              loading={exportCsv.isPending}
              onClick={() => exportCsv.mutate()}
            >
              Export CSV
            </Button>
            <Button
              variant="secondary"
              size="sm"
              loading={update.isPending && update.variables?.rotateJoinCode}
              onClick={() => update.mutate({ rotateJoinCode: true })}
            >
              New code
            </Button>
            <Button
              variant="quiet"
              size="sm"
              onClick={() => update.mutate({ archived: !cls?.archived })}
            >
              {cls?.archived ? 'Unarchive' : 'Archive'}
            </Button>
          </>
        }
      />
      {(update.isError || exportCsv.isError) && (
        <div className="mb-6">
          <Alert tone="wrong">{errorMessage(update.error ?? exportCsv.error)}</Alert>
        </div>
      )}

      <StatStrip
        items={[
          { label: 'Students', value: s.studentCount },
          { label: 'Avg. correct', value: pct(s.averageScore), note: 'across all practice' },
          { label: 'Work handed in', value: pct(s.completionRate), note: 'of everything assigned' },
          {
            label: 'Need attention',
            value: s.studentsAtRisk.length,
            note: 'low accuracy or overdue',
          },
        ]}
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Panel as="section">
          <PanelHeader
            title="Needs attention"
            meta={`${s.studentsAtRisk.length} student${s.studentsAtRisk.length === 1 ? '' : 's'}`}
          />
          {s.studentsAtRisk.length === 0 ? (
            <p className="px-5 py-6 text-sm text-ink-3">No one is flagged right now.</p>
          ) : (
            <ul className="divide-y divide-rule">
              {s.studentsAtRisk.map((r) => (
                <li
                  key={r.studentId}
                  className="flex flex-wrap items-center justify-between gap-2 px-5 py-3"
                >
                  <Link to={`/teacher/students/${r.studentId}`} className="link font-medium">
                    {r.displayName}
                  </Link>
                  <span className="flex flex-wrap gap-1.5">
                    {r.reasons.map((x) => (
                      <Tag key={x} tone="wrong">
                        {x}
                      </Tag>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel as="section">
          <PanelHeader title="Weakest topics" meta="average mastery" />
          {s.weakestTopics.length === 0 ? (
            <p className="px-5 py-6 text-sm text-ink-3">No practice yet.</p>
          ) : (
            <ol className="divide-y divide-rule">
              {s.weakestTopics.map((t, i) => (
                <li
                  key={t.topicId}
                  className="grid grid-cols-[1.5rem_minmax(0,1fr)_3rem] items-center gap-x-3 gap-y-1.5 px-5 py-3"
                >
                  <span className="font-mono text-xs text-ink-3">{i + 1}</span>
                  <span className="text-sm">{t.topicName}</span>
                  <span className="text-right font-mono text-sm tabular-nums">
                    {pct(t.averageMastery)}
                  </span>
                  <span />
                  <Meter
                    value={t.averageMastery}
                    label={`${t.topicName} average mastery`}
                    tone={t.averageMastery < 0.4 ? 'wrong' : 'ink'}
                  />
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>

      <Panel as="section" className="mt-6">
        <PanelHeader title="Assigned work" />
        {s.assignments.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="Nothing assigned yet"
              description="Build a quiz on the Quizzes page and assign it to this class."
            />
          </div>
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Quiz</Th>
                <Th>Due</Th>
                <Th className="w-1/3">Handed in</Th>
              </tr>
            </thead>
            <tbody>
              {s.assignments.map((a) => {
                const overdue = new Date(a.dueAt) < new Date() && a.completed < a.total;
                return (
                  <tr key={a.id}>
                    <Td className="font-medium">{a.quizTitle}</Td>
                    <Td>
                      <Status tone={overdue ? 'wrong' : 'neutral'}>{dueLabel(a.dueAt)}</Status>
                    </Td>
                    <Td>
                      <div className="flex items-center gap-3">
                        <Meter
                          value={a.total ? a.completed / a.total : 0}
                          label={`${a.quizTitle} handed in`}
                        />
                        <span className="w-14 shrink-0 text-right font-mono text-xs tabular-nums text-ink-2">
                          {a.completed}/{a.total}
                        </span>
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </TableWrap>
        )}
      </Panel>

      <Panel as="section" className="mt-6">
        <PanelHeader title="Students" meta="sorted by name" />
        {s.students.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="No students yet"
              description={
                cls?.joinCode ? `Share the code ${cls.joinCode} with your class.` : undefined
              }
            />
          </div>
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th className="text-right">Answered</Th>
                <Th className="w-1/3">Correct</Th>
                <Th className="text-right">Overdue</Th>
              </tr>
            </thead>
            <tbody>
              {s.students.map((st) => (
                <tr key={st.studentId} className="hover:bg-paper">
                  <Td>
                    <Link to={`/teacher/students/${st.studentId}`} className="link font-medium">
                      {st.displayName}
                    </Link>
                    {atRisk.has(st.studentId) && (
                      <>
                        <span
                          className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-incorrect align-middle"
                          aria-hidden="true"
                        />
                        <span className="sr-only"> (needs attention)</span>
                      </>
                    )}
                  </Td>
                  <Td className="text-right font-mono tabular-nums">{st.attempts}</Td>
                  <Td>
                    {st.attempts ? (
                      <div className="flex items-center gap-3">
                        <Meter
                          value={st.accuracy}
                          label={`${st.displayName} accuracy`}
                          tone={st.accuracy < 0.5 ? 'wrong' : 'ink'}
                        />
                        <span className="w-10 shrink-0 text-right font-mono text-xs tabular-nums">
                          {pct(st.accuracy)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-ink-3">—</span>
                    )}
                  </Td>
                  <Td
                    className={
                      st.overdueCount
                        ? 'text-right font-mono text-incorrect'
                        : 'text-right font-mono text-ink-3'
                    }
                  >
                    {st.overdueCount}
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Panel>
    </>
  );
}
