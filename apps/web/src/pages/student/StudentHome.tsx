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
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  LoadingBlock,
  PageHeader,
} from '../../components/ui';
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
  const navigate = useNavigate();
  const start = useStartSession();
  const topics = useQuery({ queryKey: ['topics'], queryFn: () => api.get<TopicDto[]>('/topics') });
  const progress = useQuery({
    queryKey: ['progress', user.id],
    queryFn: () => api.get<ProgressDto>(`/students/${user.id}/progress`),
  });
  const sessions = useQuery({
    queryKey: ['sessions'],
    queryFn: () => api.get<PracticeSessionDto[]>('/practice/sessions'),
  });

  // Recommend the topic with the lowest mastery; new students start with the first topic.
  const mastery = new Map(progress.data?.mastery.map((m) => [m.topicId, m.score]));
  const recommended = topics.data
    ?.slice()
    .sort((a, b) => (mastery.get(a.id) ?? -1) - (mastery.get(b.id) ?? -1))[0];
  const unfinished = sessions.data?.find((s) => !s.completed && !s.assignmentId);

  return (
    <>
      <PageHeader
        title={`Hi, ${user.displayName.split(' ')[0]}`}
        subtitle={
          progress.data
            ? `${progress.data.streakDays}-day streak · ${pct(progress.data.accuracy)} accuracy overall`
            : 'Ready for some practice?'
        }
      />

      {start.isError && (
        <div className="mb-4">
          <Alert tone="danger">{errorMessage(start.error)}</Alert>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="bg-gradient-to-br from-brand-600 to-brand-800 text-white">
            {topics.isPending ? (
              <LoadingBlock rows={1} label="Loading practice" />
            ) : unfinished ? (
              <>
                <p className="text-sm text-brand-100">Pick up where you left off</p>
                <p className="mt-1 text-xl font-semibold">{unfinished.topicName}</p>
                <p className="mt-1 text-sm text-brand-100">
                  {unfinished.answeredCount} of {unfinished.totalQuestions} answered
                </p>
                <Button
                  variant="secondary"
                  size="lg"
                  className="mt-4"
                  onClick={() => navigate(`/student/practice/${unfinished.id}`)}
                >
                  Resume practice
                </Button>
              </>
            ) : recommended ? (
              <>
                <p className="text-sm text-brand-100">Recommended for you</p>
                <p className="mt-1 text-xl font-semibold">{recommended.name}</p>
                <p className="mt-1 text-sm text-brand-100">
                  10 questions that adapt to how you’re doing.
                </p>
                <Button
                  variant="secondary"
                  size="lg"
                  className="mt-4"
                  loading={start.isPending}
                  onClick={() => start.mutate({ topicId: recommended.id })}
                >
                  Start practice
                </Button>
              </>
            ) : (
              <p>No topics available yet.</p>
            )}
          </Card>

          <AssignmentsCard />

          <section aria-labelledby="topics-heading">
            <h2 id="topics-heading" className="mb-3 text-lg font-semibold text-ink">
              Practise a topic
            </h2>
            {topics.isError ? (
              <ErrorState error={topics.error} onRetry={() => void topics.refetch()} />
            ) : topics.isPending ? (
              <LoadingBlock />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {topics.data.map((t) => {
                  const score = mastery.get(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      disabled={start.isPending}
                      onClick={() => start.mutate({ topicId: t.id })}
                      className="rounded-card border border-line bg-white p-4 text-left shadow-card transition hover:border-brand-200 hover:shadow-md disabled:opacity-60"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-ink">{t.name}</span>
                        <Badge tone="neutral">Grade {t.gradeLevel}</Badge>
                      </div>
                      <p className="mt-2 text-sm text-ink-muted">
                        {score === undefined ? 'Not started' : `Mastery ${pct(score)}`}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <JoinClassCard />
          <MyClassesCard />
        </aside>
      </div>
    </>
  );
}

function AssignmentsCard() {
  const start = useStartSession();
  const q = useQuery({
    queryKey: ['assignments'],
    queryFn: () => api.get<AssignmentDto[]>('/assignments'),
  });
  const todo = q.data?.filter((a) => !a.completed) ?? [];
  const done = q.data?.filter((a) => a.completed) ?? [];

  return (
    <section aria-labelledby="assigned-heading">
      <h2 id="assigned-heading" className="mb-3 text-lg font-semibold text-ink">
        Assigned work
      </h2>
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : q.isPending ? (
        <LoadingBlock rows={2} />
      ) : q.data.length === 0 ? (
        <EmptyState
          title="Nothing assigned right now"
          description="When your teacher assigns a quiz, it shows up here."
        />
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-line">
            {[...todo, ...done].map((a) => (
              <li
                key={a.id}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-medium text-ink">{a.quizTitle}</p>
                  <p className="text-sm text-ink-muted">
                    {a.className} · {a.questionCount} questions
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {a.completed ? (
                    <Badge tone="success">Done</Badge>
                  ) : (
                    <>
                      <Badge tone={a.overdue ? 'danger' : 'warn'}>{dueLabel(a.dueAt)}</Badge>
                      <Button
                        size="sm"
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
        </Card>
      )}
    </section>
  );
}

function JoinClassCard() {
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
    <Card>
      <h2 className="font-semibold text-ink">Join a class</h2>
      <form className="mt-3 space-y-3" onSubmit={onSubmit}>
        <Input
          label="Join code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="e.g. GRADE7AA"
          autoCapitalize="characters"
          maxLength={10}
          hint="Ask your teacher for the code."
        />
        {join.isError && <Alert tone="danger">{errorMessage(join.error)}</Alert>}
        {join.isSuccess && <Alert tone="success">You joined {join.data.name}.</Alert>}
        <Button type="submit" variant="secondary" className="w-full" loading={join.isPending}>
          Join class
        </Button>
      </form>
    </Card>
  );
}

function MyClassesCard() {
  const q = useQuery({ queryKey: ['classes'], queryFn: () => api.get<ClassDto[]>('/classes') });
  return (
    <Card>
      <h2 className="font-semibold text-ink">My classes</h2>
      <div className="mt-3">
        {q.isError ? (
          <ErrorState error={q.error} onRetry={() => void q.refetch()} />
        ) : q.isPending ? (
          <LoadingBlock rows={2} />
        ) : q.data.length === 0 ? (
          <p className="text-sm text-ink-muted">You haven’t joined a class yet.</p>
        ) : (
          <ul className="space-y-2">
            {q.data.map((c) => (
              <li key={c.id} className="text-sm">
                <span className="font-medium text-ink">{c.name}</span>
                <span className="text-ink-muted"> · {c.teacherName}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
