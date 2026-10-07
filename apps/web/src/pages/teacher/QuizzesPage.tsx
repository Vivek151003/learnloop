import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, Plus, Send } from 'lucide-react';
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
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  LoadingBlock,
  Modal,
  PageHeader,
  Select,
  TableWrap,
  Td,
  Th,
  cx,
} from '../../components/ui';
import { useToast } from '../../components/toast';
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
        title="Quizzes"
        description="Build a quiz from approved questions, then assign it to a class or to selected students."
        actions={
          user.role === 'teacher' && (
            <Button icon={Plus} onClick={() => setBuilding(true)}>
              New quiz
            </Button>
          )
        }
      />
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : q.isPending ? (
        <LoadingBlock />
      ) : q.data.length === 0 ? (
        <Card>
          <EmptyState
            icon={ClipboardList}
            title="No quizzes yet"
            description="Pick questions from the bank to build your first quiz."
            action={
              <Button icon={Plus} onClick={() => setBuilding(true)}>
                Build a quiz
              </Button>
            }
          />
        </Card>
      ) : (
        <Card>
          <TableWrap>
            <thead>
              <tr>
                <Th>Quiz</Th>
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
                <tr key={quiz.id} className="hover:bg-gray-50">
                  <Td className="font-medium text-gray-900">{quiz.title}</Td>
                  <Td className="text-gray-600">{quiz.topicName}</Td>
                  <Td className="text-right tabular">{quiz.questionCount}</Td>
                  <Td className="whitespace-nowrap text-gray-600">{shortDate(quiz.createdAt)}</Td>
                  <Td>
                    <Badge tone={quiz.status === 'published' ? 'success' : 'warning'}>
                      {quiz.status === 'published' ? 'Published' : 'Draft'}
                    </Badge>
                  </Td>
                  <Td className="text-right">
                    {user.role === 'teacher' && (
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={Send}
                        onClick={() => setAssigning(quiz)}
                      >
                        Assign
                      </Button>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        </Card>
      )}
      <QuizBuilder open={building} onClose={() => setBuilding(false)} />
      {assigning && <AssignModal quiz={assigning} onClose={() => setAssigning(null)} />}
    </>
  );
}

function QuizBuilder({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
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
      toast.success('Quiz created');
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
    <Modal
      title="New quiz"
      description="Students answer the questions in the order you pick them."
      open={open}
      onClose={onClose}
      size="lg"
    >
      <form className="space-y-4" onSubmit={onSubmit}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            placeholder="e.g. Fractions check-in"
          />
          <Select
            label="Topic"
            value={topicId}
            onChange={(e) => {
              setTopicId(e.target.value);
              setPicked([]);
            }}
          >
            <option value="">Select a topic</option>
            {topics.data?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </div>
        {topicId && (
          <fieldset>
            <legend className="mb-1.5 flex w-full items-baseline justify-between text-sm font-medium text-gray-700">
              Questions
              <span className="font-normal text-gray-500">{picked.length} selected</span>
            </legend>
            {questions.isPending ? (
              <LoadingBlock rows={2} />
            ) : questions.isError ? (
              <ErrorState error={questions.error} onRetry={() => void questions.refetch()} />
            ) : questions.data.items.length === 0 ? (
              <p className="rounded-md border border-dashed border-gray-300 px-4 py-6 text-center text-gray-500">
                No approved questions in this topic yet.
              </p>
            ) : (
              <ul className="max-h-72 divide-y divide-gray-100 overflow-y-auto rounded-md border border-gray-200">
                {questions.data.items.map((q) => {
                  const pos = picked.indexOf(q.id);
                  return (
                    <li key={q.id}>
                      <label
                        className={cx(
                          'flex cursor-pointer items-start gap-3 px-3 py-2.5',
                          pos >= 0 ? 'bg-brand-50' : 'hover:bg-gray-50',
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={pos >= 0}
                          onChange={() => toggle(q.id)}
                          className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-brand-600"
                        />
                        <span className="flex-1 text-gray-900">{q.body}</span>
                        {pos >= 0 ? (
                          <Badge tone="brand">#{pos + 1}</Badge>
                        ) : (
                          <span className="shrink-0 text-xs text-gray-500">
                            Level {q.difficulty}
                          </span>
                        )}
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </fieldset>
        )}
        {create.isError && <Alert tone="danger">{errorMessage(create.error)}</Alert>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
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
  const toast = useToast();
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
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ['class-summary'] });
      void qc.invalidateQueries({ queryKey: ['assignments'] });
      toast.success(`Assigned to ${r.studentCount} student${r.studentCount === 1 ? '' : 's'}`);
      onClose();
    },
  });
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    assign.mutate();
  };
  const radio =
    'flex cursor-pointer items-start gap-3 rounded-md border border-gray-200 p-3 has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50';

  return (
    <Modal title="Assign quiz" description={quiz.title} open onClose={onClose}>
      <form className="space-y-4" onSubmit={onSubmit}>
        <Select label="Class" value={classId} onChange={(e) => setClassId(e.target.value)}>
          <option value="">Select a class</option>
          {classes.data
            ?.filter((c) => !c.archived)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.studentCount} students)
              </option>
            ))}
        </Select>
        <Input
          label="Due date"
          type="datetime-local"
          value={dueAt}
          onChange={(e) => setDueAt(e.target.value)}
        />
        <fieldset className="space-y-2">
          <legend className="mb-1.5 text-sm font-medium text-gray-700">Assign to</legend>
          <label className={radio}>
            <input
              type="radio"
              checked={everyone}
              onChange={() => setEveryone(true)}
              className="mt-0.5 accent-brand-600"
            />
            <span>
              <span className="block font-medium text-gray-900">Whole class</span>
              <span className="text-gray-500">Students who join later get it too.</span>
            </span>
          </label>
          <label className={radio}>
            <input
              type="radio"
              checked={!everyone}
              onChange={() => setEveryone(false)}
              className="mt-0.5 accent-brand-600"
            />
            <span className="font-medium text-gray-900">Selected students</span>
          </label>
        </fieldset>
        {!everyone &&
          classId &&
          (roster.isPending ? (
            <LoadingBlock rows={1} />
          ) : roster.isError ? (
            <ErrorState error={roster.error} />
          ) : (
            <ul className="max-h-48 divide-y divide-gray-100 overflow-y-auto rounded-md border border-gray-200">
              {roster.data.students.map((s) => (
                <li key={s.studentId}>
                  <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-gray-50">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 accent-brand-600"
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
        {assign.isError && <Alert tone="danger">{errorMessage(assign.error)}</Alert>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            icon={Send}
            loading={assign.isPending}
            disabled={!classId || !dueAt || (!everyone && students.length === 0)}
          >
            Assign quiz
          </Button>
        </div>
      </form>
    </Modal>
  );
}
