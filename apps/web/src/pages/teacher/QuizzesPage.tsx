import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ClassDto,
  ClassSummaryDto,
  Paginated,
  QuestionDto,
  QuizDto,
  TopicDto,
} from '@learnloop/shared';
import {
  Alert,
  Button,
  EmptyState,
  ErrorState,
  Input,
  LoadingBlock,
  Modal,
  PageHeader,
  Panel,
  Select,
  Status,
  TableWrap,
  Td,
  Th,
  cx,
} from '../../components/ui';
import { api, errorMessage, qs } from '../../lib/api';
import { useUser } from '../../lib/auth';
import { shortDate } from '../../lib/format';

/** FR-21 (manual path) and FR-22: build quizzes from the bank and assign them. */
export default function QuizzesPage() {
  const user = useUser();
  const [building, setBuilding] = useState(false);
  const [assigning, setAssigning] = useState<QuizDto | null>(null);
  const q = useQuery({ queryKey: ['quizzes'], queryFn: () => api.get<QuizDto[]>('/quizzes') });

  return (
    <>
      <PageHeader
        eyebrow="Teaching"
        title="Quizzes"
        subtitle="A fixed set of approved questions, served in your order. Assign one to a class or to chosen students."
        actions={
          user.role === 'teacher' && <Button onClick={() => setBuilding(true)}>New quiz</Button>
        }
      />
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : q.isPending ? (
        <LoadingBlock />
      ) : q.data.length === 0 ? (
        <EmptyState
          title="No quizzes yet"
          description="Pick questions from the bank to build your first one."
          action={<Button onClick={() => setBuilding(true)}>Build a quiz</Button>}
        />
      ) : (
        <Panel>
          <TableWrap>
            <thead>
              <tr>
                <Th>Title</Th>
                <Th>Topic</Th>
                <Th className="text-right">Questions</Th>
                <Th>Created</Th>
                <Th>Status</Th>
                <Th>
                  <span className="sr-only">Actions</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {q.data.map((quiz) => (
                <tr key={quiz.id}>
                  <Td className="font-medium">{quiz.title}</Td>
                  <Td className="text-ink-2">{quiz.topicName}</Td>
                  <Td className="text-right font-mono">{quiz.questionCount}</Td>
                  <Td className="font-mono text-xs text-ink-3">{shortDate(quiz.createdAt)}</Td>
                  <Td>
                    <Status tone={quiz.status === 'published' ? 'right' : 'pencil'}>
                      {quiz.status}
                    </Status>
                  </Td>
                  <Td className="text-right">
                    {user.role === 'teacher' && (
                      <Button variant="secondary" size="sm" onClick={() => setAssigning(quiz)}>
                        Assign…
                      </Button>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        </Panel>
      )}
      <QuizBuilder open={building} onClose={() => setBuilding(false)} />
      {assigning && <AssignModal quiz={assigning} onClose={() => setAssigning(null)} />}
    </>
  );
}

function QuizBuilder({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [topicId, setTopicId] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const topics = useQuery({
    queryKey: ['topics'],
    queryFn: () => api.get<TopicDto[]>('/topics'),
    enabled: open,
  });
  const questions = useQuery({
    queryKey: ['questions', { topicId, status: 'approved' }, 'builder'],
    queryFn: () =>
      api.get<Paginated<QuestionDto>>(
        `/questions${qs({ topicId, status: 'approved', pageSize: 100 })}`,
      ),
    enabled: open && Boolean(topicId),
  });
  const create = useMutation({
    mutationFn: () => api.post<QuizDto>('/quizzes', { title, topicId, questionIds: picked }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['quizzes'] });
      setTitle('');
      setPicked([]);
      onClose();
    },
  });
  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (title.trim() && topicId && picked.length) create.mutate();
  };

  return (
    <Modal title="New quiz" open={open} onClose={onClose}>
      <form className="space-y-4" onSubmit={onSubmit}>
        <Input
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          placeholder="Fractions check-in"
        />
        <Select
          label="Topic"
          value={topicId}
          onChange={(e) => {
            setTopicId(e.target.value);
            setPicked([]);
          }}
        >
          <option value="">Choose a topic…</option>
          {topics.data?.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
        {topicId && (
          <fieldset>
            <legend className="mb-1.5 flex w-full justify-between text-sm font-medium">
              Questions
              <span className="font-mono text-xs font-normal text-ink-3">
                {picked.length} picked · order = click order
              </span>
            </legend>
            {questions.isPending ? (
              <LoadingBlock rows={2} />
            ) : questions.isError ? (
              <ErrorState error={questions.error} onRetry={() => void questions.refetch()} />
            ) : questions.data.items.length === 0 ? (
              <p className="text-sm text-ink-3">No approved questions in this topic yet.</p>
            ) : (
              <ul className="max-h-72 divide-y divide-rule overflow-y-auto rounded border border-rule-strong">
                {questions.data.items.map((q) => {
                  const pos = picked.indexOf(q.id);
                  return (
                    <li key={q.id}>
                      <label
                        className={cx(
                          'flex cursor-pointer items-start gap-3 px-3 py-2.5 text-sm',
                          pos >= 0 ? 'bg-pencil-soft' : 'hover:bg-paper',
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={pos >= 0}
                          onChange={() => toggle(q.id)}
                          className="mt-1 h-4 w-4 accent-ink"
                        />
                        <span className="flex-1">{q.body}</span>
                        <span className="w-10 shrink-0 text-right font-mono text-xs text-ink-3">
                          {pos >= 0 ? `#${pos + 1}` : `L${q.difficulty}`}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </fieldset>
        )}
        {create.isError && <Alert tone="wrong">{errorMessage(create.error)}</Alert>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            loading={create.isPending}
            disabled={!title.trim() || !topicId || picked.length === 0}
          >
            Create quiz
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function defaultDue(): string {
  const d = new Date(Date.now() + 7 * 86_400_000);
  d.setHours(17, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function AssignModal({ quiz, onClose }: { quiz: QuizDto; onClose: () => void }) {
  const qc = useQueryClient();
  const [classId, setClassId] = useState('');
  const [dueAt, setDueAt] = useState(defaultDue);
  const [everyone, setEveryone] = useState(true);
  const [students, setStudents] = useState<string[]>([]);
  const classes = useQuery({
    queryKey: ['classes'],
    queryFn: () => api.get<ClassDto[]>('/classes'),
  });
  const roster = useQuery({
    queryKey: ['class-summary', classId],
    queryFn: () => api.get<ClassSummaryDto>(`/classes/${classId}/summary`),
    enabled: Boolean(classId) && !everyone,
  });
  const assign = useMutation({
    mutationFn: () =>
      api.post<{ assignmentId: string; studentCount: number }>(`/quizzes/${quiz.id}/assign`, {
        classId,
        dueAt: new Date(dueAt).toISOString(),
        ...(everyone ? {} : { studentIds: students }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['class-summary'] });
      void qc.invalidateQueries({ queryKey: ['assignments'] });
    },
  });
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    assign.mutate();
  };
  const radio = 'flex items-start gap-2.5 text-sm';

  return (
    <Modal title={`Assign “${quiz.title}”`} open onClose={onClose}>
      {assign.isSuccess ? (
        <>
          <Alert tone="right">
            Assigned to {assign.data.studentCount} student
            {assign.data.studentCount === 1 ? '' : 's'}.
          </Alert>
          <div className="mt-4 flex justify-end">
            <Button onClick={onClose}>Done</Button>
          </div>
        </>
      ) : (
        <form className="space-y-5" onSubmit={onSubmit}>
          <Select label="Class" value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">Choose a class…</option>
            {classes.data
              ?.filter((c) => !c.archived)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.studentCount})
                </option>
              ))}
          </Select>
          <Input
            label="Due"
            type="datetime-local"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
          />
          <fieldset className="space-y-2">
            <legend className="mb-1.5 text-sm font-medium">Who gets it</legend>
            <label className={radio}>
              <input
                type="radio"
                checked={everyone}
                onChange={() => setEveryone(true)}
                className="mt-1 accent-ink"
              />
              <span>
                Whole class
                <span className="block text-ink-3">Students who join later get it too.</span>
              </span>
            </label>
            <label className={radio}>
              <input
                type="radio"
                checked={!everyone}
                onChange={() => setEveryone(false)}
                className="mt-1 accent-ink"
              />
              <span>Selected students</span>
            </label>
          </fieldset>
          {!everyone &&
            classId &&
            (roster.isPending ? (
              <LoadingBlock rows={1} />
            ) : roster.isError ? (
              <ErrorState error={roster.error} />
            ) : (
              <ul className="max-h-48 divide-y divide-rule overflow-y-auto rounded border border-rule-strong">
                {roster.data.students.map((s) => (
                  <li key={s.studentId}>
                    <label className="flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-paper">
                      <input
                        type="checkbox"
                        className="accent-ink"
                        checked={students.includes(s.studentId)}
                        onChange={() =>
                          setStudents((x) =>
                            x.includes(s.studentId)
                              ? x.filter((i) => i !== s.studentId)
                              : [...x, s.studentId],
                          )
                        }
                      />
                      {s.displayName}
                    </label>
                  </li>
                ))}
              </ul>
            ))}
          {assign.isError && <Alert tone="wrong">{errorMessage(assign.error)}</Alert>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="quiet" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              loading={assign.isPending}
              disabled={!classId || !dueAt || (!everyone && students.length === 0)}
            >
              Assign
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
