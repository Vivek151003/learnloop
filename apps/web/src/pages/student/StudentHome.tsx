import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
  Button,
  EmptyState,
  ErrorState,
  Input,
  LoadingBlock,
  Meter,
  PageHeader,
  Panel,
  PanelHeader,
  SectionTitle,
  Status,
} from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { useUser } from '../../lib/auth';
import { DIFFICULTY_LABELS, dueLabel, pct } from '../../lib/format';

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

const today = () =>
  new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

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
        eyebrow={today()}
        title={`${user.displayName.split(' ')[0]}’s practice`}
        subtitle={
          p && p.totalAttempts > 0
            ? `${p.streakDays}-day streak · ${pct(p.accuracy)} correct across ${p.totalAttempts} questions`
            : 'Ten questions at a time. They get harder as you get them right.'
        }
      />

      {start.isError && (
        <div className="mb-6">
          <Alert tone="wrong">{errorMessage(start.error)}</Alert>
        </div>
      )}

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-10">
          <UpNext topics={topics.data} mastery={mastery} />
          <Assignments />
          <section aria-labelledby="topics-heading">
            <SectionTitle id="topics-heading" aside="Grades 6–8">
              Topics
            </SectionTitle>
            {topics.isError ? (
              <ErrorState error={topics.error} onRetry={() => void topics.refetch()} />
            ) : topics.isPending ? (
              <LoadingBlock rows={4} />
            ) : (
              <Panel>
                <ul className="divide-y divide-rule">
                  {topics.data.map((t) => {
                    const m = mastery.get(t.id);
                    return (
                      <li key={t.id}>
                        <button
                          type="button"
                          disabled={start.isPending}
                          onClick={() => start.mutate({ topicId: t.id })}
                          className="group grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-2 px-5 py-3.5 text-left transition-colors hover:bg-paper sm:grid-cols-[minmax(0,1fr)_180px_auto] disabled:opacity-60"
                        >
                          <span className="min-w-0">
                            <span className="block font-medium">{t.name}</span>
                            <span className="font-mono text-xs text-ink-3">
                              Grade {t.gradeLevel}
                            </span>
                          </span>
                          <span className="col-span-2 row-start-2 flex items-center gap-3 sm:col-span-1 sm:row-start-auto">
                            <Meter
                              value={m?.score ?? 0}
                              label={`${t.name} mastery`}
                              tone={m && m.score >= 0.7 ? 'right' : 'ink'}
                            />
                            <span className="w-10 shrink-0 text-right font-mono text-xs tabular-nums text-ink-2">
                              {m ? pct(m.score) : '—'}
                            </span>
                          </span>
                          <span className="text-sm text-ink-3 transition-colors group-hover:text-ink">
                            Practise <span aria-hidden="true">→</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </Panel>
            )}
          </section>
        </div>

        <aside className="space-y-8">
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

  return (
    <section
      aria-label="Up next"
      className="rounded border border-rule border-l-[3px] border-l-pencil bg-paper-raised"
    >
      <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between">
        {open ? (
          <div>
            <p className="eyebrow">Unfinished</p>
            <p className="mt-1 font-serif text-2xl font-semibold">{open.topicName}</p>
            <p className="mt-1 text-sm text-ink-2">
              {open.answeredCount} of {open.totalQuestions} answered · level{' '}
              {open.currentDifficulty} ({DIFFICULTY_LABELS[open.currentDifficulty]?.toLowerCase()})
            </p>
          </div>
        ) : weakest ? (
          <div>
            <p className="eyebrow">Suggested</p>
            <p className="mt-1 font-serif text-2xl font-semibold">{weakest.name}</p>
            <p className="mt-1 text-sm text-ink-2">
              {mastery.has(weakest.id)
                ? `Your lowest topic at ${pct(mastery.get(weakest.id)!.score)} mastery.`
                : 'You haven’t tried this one yet.'}{' '}
              10 questions, about 10 minutes.
            </p>
          </div>
        ) : (
          <p className="text-ink-2">No topics yet.</p>
        )}
        {open ? (
          <Button size="lg" onClick={() => navigate(`/student/practice/${open.id}`)}>
            Resume
          </Button>
        ) : weakest ? (
          <Button
            size="lg"
            loading={start.isPending}
            onClick={() => start.mutate({ topicId: weakest.id })}
          >
            Start practice
          </Button>
        ) : null}
      </div>
    </section>
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
    <section aria-labelledby="assigned-heading">
      <SectionTitle id="assigned-heading" aside={q.data && `${todo.length} to do`}>
        Set by your teacher
      </SectionTitle>
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : q.isPending ? (
        <LoadingBlock rows={2} />
      ) : q.data.length === 0 ? (
        <EmptyState
          title="Nothing set right now"
          description="Work your teacher assigns will appear here with its due date."
        />
      ) : (
        <Panel>
          <ul className="divide-y divide-rule">
            {[...todo, ...done].map((a) => (
              <li
                key={a.id}
                className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p
                    className={
                      a.completed ? 'text-ink-3 line-through decoration-ink-4' : 'font-medium'
                    }
                  >
                    {a.quizTitle}
                  </p>
                  <p className="text-sm text-ink-3">
                    {a.className} · {a.topicName} · {a.questionCount} questions
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-4">
                  {a.completed ? (
                    <Status tone="right">Handed in</Status>
                  ) : (
                    <>
                      <Status tone={a.overdue ? 'wrong' : 'pencil'}>{dueLabel(a.dueAt)}</Status>
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
        </Panel>
      )}
    </section>
  );
}

function JoinClass() {
  const qc = useQueryClient();
  const [code, setCode] = useState('');
  const join = useMutation({
    mutationFn: (joinCode: string) => api.post<ClassDto>('/classes/join', { joinCode }),
    onSuccess: () => {
      setCode('');
      void qc.invalidateQueries({ queryKey: ['classes'] });
      void qc.invalidateQueries({ queryKey: ['assignments'] });
    },
  });
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (code.trim()) join.mutate(code.trim().toUpperCase());
  };
  return (
    <Panel as="section">
      <PanelHeader title="Join a class" />
      <form className="space-y-3 p-5" onSubmit={onSubmit}>
        <Input
          label="Class code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="GRADE7AA"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={10}
          className="[&_input]:font-mono [&_input]:tracking-widest"
          hint="Your teacher has it."
        />
        {join.isError && <Alert tone="wrong">{errorMessage(join.error)}</Alert>}
        {join.isSuccess && <Alert tone="right">Joined {join.data.name}.</Alert>}
        <Button
          type="submit"
          variant="secondary"
          className="w-full"
          loading={join.isPending}
          disabled={!code.trim()}
        >
          Join
        </Button>
      </form>
    </Panel>
  );
}

function MyClasses() {
  const q = useQuery({ queryKey: ['classes'], queryFn: () => api.get<ClassDto[]>('/classes') });
  return (
    <Panel as="section">
      <PanelHeader title="Your classes" />
      <div className="px-5 py-4">
        {q.isError ? (
          <ErrorState error={q.error} onRetry={() => void q.refetch()} />
        ) : q.isPending ? (
          <LoadingBlock rows={1} />
        ) : q.data.length === 0 ? (
          <p className="text-sm text-ink-3">Not in a class yet.</p>
        ) : (
          <ul className="space-y-3">
            {q.data.map((c) => (
              <li key={c.id}>
                <p className="text-sm font-medium">{c.name}</p>
                <p className="text-sm text-ink-3">{c.teacherName}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}
