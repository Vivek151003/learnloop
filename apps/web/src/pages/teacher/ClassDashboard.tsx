import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  ArchiveRestore,
  CircleCheck,
  Copy,
  Download,
  RefreshCw,
  Target,
  TriangleAlert,
  Users,
} from 'lucide-react';
import type { ClassDto, ClassSummaryDto } from '@learnloop/shared';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  Code,
  EmptyState,
  ErrorState,
  LoadingBlock,
  PageHeader,
  ProgressBar,
  SearchInput,
  SortTh,
  StatCard,
  Tabs,
  TableWrap,
  Td,
  Th,
  sortRows,
} from '../../components/ui';
import { useToast } from '../../components/toast';
import { api, errorMessage } from '../../lib/api';
import { copyText } from '../../lib/clipboard';
import { dueLabel, pct } from '../../lib/format';
import { useSort } from '../../lib/useSort';

type Tab = 'overview' | 'students' | 'assignments';
type StudentSort = 'name' | 'attempts' | 'accuracy' | 'overdue';

/** FR-23: average score, completion, weakest topics and students at risk. */
export default function ClassDashboard() {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('overview');
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
    onSuccess: (c, vars) => {
      void qc.invalidateQueries({ queryKey: ['classes'] });
      toast.success(
        vars.rotateJoinCode
          ? `New class code: ${c.joinCode}`
          : c.archived
            ? 'Class archived'
            : 'Class restored',
      );
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const exportCsv = useMutation({
    mutationFn: () =>
      api.download(`/classes/${id}/results.csv`, `${cls?.name ?? 'class'}-results.csv`),
    onSuccess: () => toast.success('Results downloaded'),
    onError: (err) => toast.error(errorMessage(err)),
  });

  if (summary.isError)
    return <ErrorState error={summary.error} onRetry={() => void summary.refetch()} />;
  if (summary.isPending) return <LoadingBlock rows={4} />;
  const s = summary.data;

  const copyCode = async () => {
    if (cls?.joinCode && (await copyText(cls.joinCode)))
      toast.success(`Copied code ${cls.joinCode}`);
  };

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Classes', to: '/teacher' }, { label: s.className }]}
        title={s.className}
        description={
          cls?.joinCode ? (
            <span className="flex flex-wrap items-center gap-2">
              Class code <Code>{cls.joinCode}</Code>
              <button
                type="button"
                onClick={() => void copyCode()}
                className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline"
              >
                <Copy className="h-3.5 w-3.5" aria-hidden="true" /> Copy
              </button>
              {cls.archived && <Badge>Archived</Badge>}
            </span>
          ) : undefined
        }
        actions={
          <>
            <Button
              variant="secondary"
              icon={Download}
              loading={exportCsv.isPending}
              onClick={() => exportCsv.mutate()}
            >
              Export CSV
            </Button>
            <Button
              variant="secondary"
              icon={RefreshCw}
              loading={update.isPending && update.variables?.rotateJoinCode}
              onClick={() => update.mutate({ rotateJoinCode: true })}
            >
              New code
            </Button>
            <Button
              variant="ghost"
              icon={cls?.archived ? ArchiveRestore : Archive}
              onClick={() => update.mutate({ archived: !cls?.archived })}
            >
              {cls?.archived ? 'Restore' : 'Archive'}
            </Button>
          </>
        }
      />

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'overview', label: 'Overview' },
          { id: 'students', label: 'Students', count: s.studentCount },
          { id: 'assignments', label: 'Assignments', count: s.assignments.length },
        ]}
      />

      {tab === 'overview' && <Overview s={s} onOpenStudents={() => setTab('students')} />}
      {tab === 'students' && <StudentsTab s={s} />}
      {tab === 'assignments' && <AssignmentsTab s={s} />}
    </>
  );
}

function Overview({ s, onOpenStudents }: { s: ClassSummaryDto; onOpenStudents: () => void }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Students" value={s.studentCount} icon={Users} />
        <StatCard
          label="Average score"
          value={pct(s.averageScore)}
          icon={Target}
          tone="success"
          hint="Correct answers across all practice"
        />
        <StatCard
          label="Work completed"
          value={pct(s.completionRate)}
          icon={CircleCheck}
          tone="success"
          hint="Of everything assigned"
        />
        <StatCard
          label="Need attention"
          value={s.studentsAtRisk.length}
          icon={TriangleAlert}
          tone={s.studentsAtRisk.length ? 'danger' : 'success'}
          hint="Low accuracy or overdue work"
        />
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader
            title="Students needing attention"
            description="Under 50% correct after 5+ answers, or overdue work"
            actions={
              <Button variant="ghost" size="sm" onClick={onOpenStudents}>
                View all
              </Button>
            }
          />
          {s.studentsAtRisk.length === 0 ? (
            <EmptyState
              icon={CircleCheck}
              title="No one is flagged"
              description="Every student is on track right now."
            />
          ) : (
            <ul className="divide-y divide-gray-100">
              {s.studentsAtRisk.map((r) => (
                <li
                  key={r.studentId}
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-3"
                >
                  <Avatar name={r.displayName} />
                  <Link
                    to={`/teacher/students/${r.studentId}`}
                    className="font-medium text-gray-900 hover:text-brand-700 hover:underline"
                  >
                    {r.displayName}
                  </Link>
                  <span className="ml-auto flex flex-wrap justify-end gap-1.5">
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

        <Card>
          <CardHeader title="Weakest topics" description="Lowest average mastery in this class" />
          {s.weakestTopics.length === 0 ? (
            <EmptyState
              title="No practice data yet"
              description="Topics appear once students start practising."
            />
          ) : (
            <ul className="divide-y divide-gray-100">
              {s.weakestTopics.map((t) => (
                <li key={t.topicId} className="px-5 py-3.5">
                  <div className="mb-2 flex items-baseline justify-between">
                    <span className="font-medium text-gray-900">{t.topicName}</span>
                    <span className="tabular text-gray-600">{pct(t.averageMastery)}</span>
                  </div>
                  <ProgressBar
                    value={t.averageMastery}
                    label={`${t.topicName} average mastery`}
                    tone={t.averageMastery < 0.4 ? 'danger' : 'warning'}
                  />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function StudentsTab({ s }: { s: ClassSummaryDto }) {
  const [search, setSearch] = useState('');
  const sort = useSort<StudentSort>('name');
  const atRisk = new Set(s.studentsAtRisk.map((r) => r.studentId));
  const rows = sortRows(
    s.students.filter((st) => st.displayName.toLowerCase().includes(search.trim().toLowerCase())),
    (st) =>
      sort.key === 'name'
        ? st.displayName
        : sort.key === 'attempts'
          ? st.attempts
          : sort.key === 'accuracy'
            ? st.accuracy
            : st.overdueCount,
    sort.dir,
  );

  if (s.students.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={Users}
          title="No students yet"
          description="Students appear here once they join with the class code."
        />
      </Card>
    );
  }
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-5 py-3">
        <SearchInput
          label="Search students"
          placeholder="Search students"
          value={search}
          onChange={setSearch}
          className="w-full sm:w-72"
        />
        <span className="text-sm text-gray-500">
          {rows.length} of {s.students.length}
        </span>
      </div>
      {rows.length === 0 ? (
        <EmptyState title="No students match your search" />
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <SortTh
                active={sort.key === 'name'}
                dir={sort.dir}
                onSort={() => sort.toggle('name')}
              >
                Student
              </SortTh>
              <SortTh
                active={sort.key === 'attempts'}
                dir={sort.dir}
                onSort={() => sort.toggle('attempts')}
                align="right"
              >
                Answered
              </SortTh>
              <SortTh
                active={sort.key === 'accuracy'}
                dir={sort.dir}
                onSort={() => sort.toggle('accuracy')}
                className="w-1/3"
              >
                Accuracy
              </SortTh>
              <SortTh
                active={sort.key === 'overdue'}
                dir={sort.dir}
                onSort={() => sort.toggle('overdue')}
                align="right"
              >
                Overdue
              </SortTh>
            </tr>
          </thead>
          <tbody>
            {rows.map((st) => (
              <tr key={st.studentId} className="hover:bg-gray-50">
                <Td>
                  <Link
                    to={`/teacher/students/${st.studentId}`}
                    className="flex items-center gap-3 font-medium text-gray-900 hover:text-brand-700"
                  >
                    <Avatar name={st.displayName} />
                    <span className="hover:underline">{st.displayName}</span>
                    {atRisk.has(st.studentId) && <Badge tone="danger">At risk</Badge>}
                  </Link>
                </Td>
                <Td className="text-right tabular">{st.attempts}</Td>
                <Td>
                  {st.attempts ? (
                    <div className="flex items-center gap-3">
                      <ProgressBar
                        value={st.accuracy}
                        label={`${st.displayName} accuracy`}
                        tone={
                          st.accuracy < 0.5 ? 'danger' : st.accuracy >= 0.8 ? 'success' : 'brand'
                        }
                        size="sm"
                      />
                      <span className="w-10 shrink-0 text-right tabular text-gray-700">
                        {pct(st.accuracy)}
                      </span>
                    </div>
                  ) : (
                    <span className="text-gray-400">No answers yet</span>
                  )}
                </Td>
                <Td className="text-right">
                  {st.overdueCount ? (
                    <Badge tone="danger">{st.overdueCount}</Badge>
                  ) : (
                    <span className="text-gray-400">0</span>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
    </Card>
  );
}

function AssignmentsTab({ s }: { s: ClassSummaryDto }) {
  if (s.assignments.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={CircleCheck}
          title="Nothing assigned yet"
          description="Build a quiz on the Quizzes page, then assign it to this class."
        />
      </Card>
    );
  }
  return (
    <Card>
      <TableWrap>
        <thead>
          <tr>
            <Th>Quiz</Th>
            <Th>Due</Th>
            <Th className="w-2/5">Completed</Th>
          </tr>
        </thead>
        <tbody>
          {s.assignments.map((a) => {
            const overdue = new Date(a.dueAt) < new Date() && a.completed < a.total;
            return (
              <tr key={a.id} className="hover:bg-gray-50">
                <Td className="font-medium text-gray-900">{a.quizTitle}</Td>
                <Td>
                  <Badge tone={overdue ? 'danger' : 'neutral'}>{dueLabel(a.dueAt)}</Badge>
                </Td>
                <Td>
                  <div className="flex items-center gap-3">
                    <ProgressBar
                      value={a.total ? a.completed / a.total : 0}
                      label={`${a.quizTitle} completed`}
                      size="sm"
                      tone={a.completed === a.total ? 'success' : 'brand'}
                    />
                    <span className="w-14 shrink-0 text-right tabular text-gray-700">
                      {a.completed}/{a.total}
                    </span>
                  </div>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </TableWrap>
    </Card>
  );
}
