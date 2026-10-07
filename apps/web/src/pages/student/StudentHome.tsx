import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarClock,
  CheckCheck,
  CircleCheck,
  Flame,
  Inbox,
  Play,
  Target,
  UserPlus,
} from 'lucide-react';
import type {
  AssignmentDto,
  ClassDto,
  PracticeSessionDto,
  ProgressDto,
  StartSessionInput,
  TopicDto,
} from '@learnloop/shared';
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  Input,
  LoadingBlock,
  PageHeader,
  ProgressBar,
  StatCard,
} from '../../components/ui';
import { useToast } from '../../components/toast';
import { api, errorMessage } from '../../lib/api';
import { useUser } from '../../lib/auth';
import { dueLabel, pct } from '../../lib/format';

export function useStartSession() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: StartSessionInput) =>
      api.post<{ session: PracticeSessionDto; resumed: boolean }>('/practice/sessions', input),
    onSuccess: ({ session }) => {
      void qc.invalidateQueries({ queryKey: ['sessions'] });
      navigate(`/student/practice/${session.id}`);
    },
  });
}

export function StudentHome() {
  const user = useUser();
  const start = useStartSession();
  const topics = useQuery({ queryKey: ['topics'], queryFn: () => api.get<TopicDto[]>('/topics') });
  const progress = useQuery({
    queryKey: ['progress', user.id],
    queryFn: () => api.get<ProgressDto>(`/students/${user.id}/progress`),
  });
  const mastery = new Map(progress.data?.mastery.map((m) => [m.topicId, m]));
  const p = progress.data;

  return (
    <>
      <PageHeader
        title={`Hi, ${user.displayName.split(' ')[0]}`}
        description="Practise a topic or finish the work your teacher set."
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Day streak"
          value={p ? p.streakDays : '–'}
          icon={Flame}
          tone="warning"
          hint="Days in a row with practice"
        />
        <StatCard
          label="Accuracy"
          value={p ? pct(p.accuracy) : '–'}
          icon={Target}
          tone="success"
          hint="Correct answers overall"
        />
        <StatCard
          label="Answered"
          value={p ? p.totalAttempts : '–'}
          icon={CheckCheck}
          hint="Questions in total"
        />
      </div>

      {start.isError && (
        <div className="mb-6">
          <Alert tone="danger">{errorMessage(start.error)}</Alert>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <UpNext topics={topics.data} mastery={mastery} />
          <Assignments />

          <section aria-labelledby="topics-heading">
            <h2 id="topics-heading" className="mb-3 text-base font-semibold text-gray-900">
              Practice by topic
            </h2>
            {topics.isError ? (
              <ErrorState error={topics.error} onRetry={() => void topics.refetch()} />
            ) : topics.isPending ? (
              <LoadingBlock rows={3} />
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {topics.data.map((t) => {
                  const m = mastery.get(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      disabled={start.isPending}
                      onClick={() => start.mutate({ topicId: t.id })}
                      className="rounded-lg border border-gray-200 bg-white p-4 text-left shadow-xs transition hover:border-brand-200 hover:shadow-sm disabled:opacity-60"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-medium text-gray-900">{t.name}</span>
                        <Badge>Grade {t.gradeLevel}</Badge>
                      </div>
                      <div className="mt-4 flex items-center gap-3">
                        <ProgressBar
                          value={m?.score ?? 0}
                          label={`${t.name} mastery`}
                          tone={m && m.score >= 0.7 ? 'success' : 'brand'}
                          size="sm"
                        />
                        <span className="w-9 shrink-0 text-right text-xs tabular text-gray-500">
                          {m ? pct(m.score) : '–'}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-gray-500">
                        {m ? `${m.attempts} questions answered` : 'Not started'}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <JoinClass />
          <MyClasses />
        </aside>
      </div>
    </>
  );
}

/** The single next action: resume what's open, or the weakest topic. */
function UpNext({
  topics,
  mastery,
}: {
  topics: TopicDto[] | undefined;
  mastery: Map<string, { score: number }>;
}) {
  const navigate = useNavigate();
  const start = useStartSession();
  const sessions = useQuery({
    queryKey: ['sessions'],
    queryFn: () => api.get<PracticeSessionDto[]>('/practice/sessions'),
  });
  if (!topics || sessions.isPending) return <LoadingBlock rows={1} label="Loading next activity" />;

  const open = sessions.data?.find((s) => !s.completed && !s.assignmentId);
  const weakest = topics
    .slice()
    .sort((a, b) => (mastery.get(a.id)?.score ?? -1) - (mastery.get(b.id)?.score ?? -1))[0];
  if (!open && !weakest) return null;

  return (
    <Card className="p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <Badge tone="brand">{open ? 'In progress' : 'Suggested for you'}</Badge>
          <p className="mt-2 text-lg font-semibold text-gray-900">
            {open ? open.topicName : weakest!.name}
          </p>
          {open ? (
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
              <ProgressBar
                value={open.answeredCount / open.totalQuestions}
                label="Session progress"
                className="w-40 shrink-0"
              />
              <span className="whitespace-nowrap text-sm text-gray-500">
                {open.answeredCount} of {open.totalQuestions} answered
              </span>
            </div>
          ) : (
            <p className="mt-1 text-gray-500">
              {mastery.has(weakest!.id)
                ? `Your lowest topic at ${pct(mastery.get(weakest!.id)!.score)} mastery.`
                : 'You haven’t tried this one yet.'}{' '}
              10 questions, about 10 minutes.
            </p>
          )}
        </div>
        {open ? (
          <Button size="lg" icon={Play} onClick={() => navigate(`/student/practice/${open.id}`)}>
            Resume
          </Button>
        ) : (
          <Button
            size="lg"
            icon={Play}
            loading={start.isPending}
            onClick={() => start.mutate({ topicId: weakest!.id })}
          >
            Start practice
          </Button>
        )}
      </div>
    </Card>
  );
}

function Assignments() {
  const start = useStartSession();
  const q = useQuery({
    queryKey: ['assignments'],
    queryFn: () => api.get<AssignmentDto[]>('/assignments'),
  });
  const todo = q.data?.filter((a) => !a.completed) ?? [];
  const done = q.data?.filter((a) => a.completed) ?? [];

  return (
    <Card>
      <CardHeader title="Assigned work" description={q.data ? `${todo.length} to do` : undefined} />
      {q.isError ? (
        <div className="p-5">
          <ErrorState error={q.error} onRetry={() => void q.refetch()} />
        </div>
      ) : q.isPending ? (
        <div className="p-5">
          <LoadingBlock rows={2} />
        </div>
      ) : q.data.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Nothing assigned"
          description="When your teacher assigns a quiz it will show up here with its due date."
        />
      ) : (
        <ul className="divide-y divide-gray-100">
          {[...todo, ...done].map((a) => (
            <li
              key={a.id}
              className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-start gap-3">
                <span
                  className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${a.completed ? 'bg-success-50 text-success-600' : 'bg-gray-100 text-gray-500'}`}
                >
                  {a.completed ? (
                    <CircleCheck className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <CalendarClock className="h-4 w-4" aria-hidden="true" />
                  )}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-medium text-gray-900">{a.quizTitle}</p>
                  <p className="truncate text-gray-500">
                    {a.className} · {a.topicName} · {a.questionCount} questions
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3 pl-11 sm:pl-0">
                {a.completed ? (
                  <Badge tone="success">Completed</Badge>
                ) : (
                  <>
                    <Badge tone={a.overdue ? 'danger' : 'warning'}>{dueLabel(a.dueAt)}</Badge>
                    <Button
                      size="sm"
                      variant={a.overdue ? 'primary' : 'secondary'}
                      loading={start.isPending && start.variables?.assignmentId === a.id}
                      onClick={() => start.mutate({ assignmentId: a.id })}
                    >
                      Start
                    </Button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function JoinClass() {
  const qc = useQueryClient();
  const toast = useToast();
  const [code, setCode] = useState('');
  const join = useMutation({
    mutationFn: (joinCode: string) => api.post<ClassDto>('/classes/join', { joinCode }),
    onSuccess: (cls) => {
      setCode('');
      toast.success(`You joined ${cls.name}`);
      void qc.invalidateQueries({ queryKey: ['classes'] });
      void qc.invalidateQueries({ queryKey: ['assignments'] });
    },
  });
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (code.trim()) join.mutate(code.trim().toUpperCase());
  };
  return (
    <Card>
      <CardHeader title="Join a class" />
      <form className="space-y-3 p-5" onSubmit={onSubmit}>
        <Input
          label="Class code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="e.g. GRADE7AA"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={10}
          className="[&_input]:font-mono [&_input]:tracking-wider"
          hint="Ask your teacher for the code."
        />
        {join.isError && <Alert tone="danger">{errorMessage(join.error)}</Alert>}
        <Button
          type="submit"
          variant="secondary"
          icon={UserPlus}
          className="w-full"
          loading={join.isPending}
          disabled={!code.trim()}
        >
          Join class
        </Button>
      </form>
    </Card>
  );
}

function MyClasses() {
  const q = useQuery({ queryKey: ['classes'], queryFn: () => api.get<ClassDto[]>('/classes') });
  return (
    <Card>
      <CardHeader title="Your classes" />
      {q.isError ? (
        <div className="p-5">
          <ErrorState error={q.error} onRetry={() => void q.refetch()} />
        </div>
      ) : q.isPending ? (
        <div className="p-5">
          <LoadingBlock rows={1} />
        </div>
      ) : q.data.length === 0 ? (
        <p className="px-5 py-6 text-gray-500">You haven’t joined a class yet.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {q.data.map((c) => (
            <li key={c.id} className="flex items-center gap-3 px-5 py-3">
              <Avatar name={c.teacherName} />
              <div className="min-w-0">
                <p className="truncate font-medium text-gray-900">{c.name}</p>
                <p className="truncate text-gray-500">{c.teacherName}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
