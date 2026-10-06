import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ClassDto, ClassSummaryDto } from '@learnloop/shared';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingBlock,
  Meter,
  PageHeader,
  Stat,
  TableWrap,
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
  if (summary.isPending) return <LoadingBlock />;
  const s = summary.data;

  return (
    <>
      <div className="mb-2 text-sm">
        <Link to="/teacher" className="text-brand-700 hover:underline">
          ← Classes
        </Link>
      </div>
      <PageHeader
        title={s.className}
        subtitle={
          cls?.joinCode ? (
            <>
              Join code{' '}
              <span className="rounded bg-slate-100 px-2 py-0.5 font-mono font-semibold tracking-wider text-ink">
                {cls.joinCode}
              </span>
              {cls.archived && (
                <span className="ml-2">
                  <Badge>Archived</Badge>
                </span>
              )}
            </>
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
              New join code
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => update.mutate({ archived: !cls?.archived })}
            >
              {cls?.archived ? 'Unarchive' : 'Archive'}
            </Button>
          </>
        }
      />
      {(update.isError || exportCsv.isError) && (
        <div className="mb-4">
          <Alert tone="danger">{errorMessage(update.error ?? exportCsv.error)}</Alert>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Students" value={s.studentCount} />
        <Stat
          label="Average score"
          value={pct(s.averageScore)}
          hint="Accuracy across all practice"
        />
        <Stat label="Completion rate" value={pct(s.completionRate)} hint="Assigned work finished" />
        <Stat label="Students at risk" value={s.studentsAtRisk.length} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card>
          <h2 className="font-semibold text-ink">Weakest topics</h2>
          {s.weakestTopics.length === 0 ? (
            <p className="mt-3 text-sm text-ink-muted">No practice data yet.</p>
          ) : (
            <ul className="mt-4 space-y-4">
              {s.weakestTopics.map((t) => (
                <li key={t.topicId}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="text-ink">{t.topicName}</span>
                    <span className="tabular-nums text-ink-muted">{pct(t.averageMastery)}</span>
                  </div>
                  <Meter
                    value={t.averageMastery}
                    label={`${t.topicName} average mastery`}
                    tone="warn"
                  />
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="lg:col-span-2">
          <h2 className="font-semibold text-ink">Students at risk</h2>
          {s.studentsAtRisk.length === 0 ? (
            <p className="mt-3 text-sm text-ink-muted">No one is flagged right now.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {s.studentsAtRisk.map((r) => (
                <li
                  key={r.studentId}
                  className="flex flex-wrap items-center justify-between gap-2 py-2"
                >
                  <Link
                    to={`/teacher/students/${r.studentId}`}
                    className="font-medium text-brand-700 hover:underline"
                  >
                    {r.displayName}
                  </Link>
                  <span className="flex flex-wrap gap-1">
                    {r.reasons.map((x) => (
                      <Badge key={x} tone="danger">
                        {x}
                      </Badge>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-6">
        <h2 className="font-semibold text-ink">Assignments</h2>
        {s.assignments.length === 0 ? (
          <div className="mt-3">
            <EmptyState
              title="Nothing assigned yet"
              description="Create a quiz, then assign it to this class from the Quizzes page."
            />
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {s.assignments.map((a) => (
              <li key={a.id} className="grid gap-2 py-3 sm:grid-cols-3 sm:items-center">
                <span className="font-medium text-ink">{a.quizTitle}</span>
                <span className="text-sm text-ink-muted">{dueLabel(a.dueAt)}</span>
                <div>
                  <div className="mb-1 text-sm tabular-nums text-ink-muted">
                    {a.completed} of {a.total} done
                  </div>
                  <Meter
                    value={a.total ? a.completed / a.total : 0}
                    label={`${a.quizTitle} completion`}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="mt-6">
        <h2 className="mb-3 font-semibold text-ink">Students</h2>
        {s.students.length === 0 ? (
          <EmptyState
            title="No students yet"
            description={
              cls?.joinCode ? `Share the join code ${cls.joinCode} with your class.` : undefined
            }
          />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Answered</Th>
                <Th>Accuracy</Th>
                <Th>Overdue</Th>
              </tr>
            </thead>
            <tbody>
              {s.students.map((st) => (
                <tr key={st.studentId}>
                  <Td>
                    <Link
                      to={`/teacher/students/${st.studentId}`}
                      className="font-medium text-brand-700 hover:underline"
                    >
                      {st.displayName}
                    </Link>
                  </Td>
                  <Td className="tabular-nums">{st.attempts}</Td>
                  <Td className="tabular-nums">{st.attempts ? pct(st.accuracy) : '—'}</Td>
                  <Td>
                    {st.overdueCount ? (
                      <Badge tone="danger">{st.overdueCount}</Badge>
                    ) : (
                      <span className="text-ink-faint">0</span>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>
    </>
  );
}
