import { useEffect, useState, type FormEvent } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createQuestionSchema,
  type Paginated,
  type QuestionDto,
  type QuestionStatus,
  type TopicDto,
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
  Pager,
  Panel,
  Select,
  Status,
  TableWrap,
  Tag,
  Td,
  TextArea,
  Th,
} from '../../components/ui';
import { ApiRequestError, api, errorMessage, qs } from '../../lib/api';
import { useUser } from '../../lib/auth';
import { DIFFICULTY_LABELS } from '../../lib/format';

const STATUS_TONE = { approved: 'right', draft: 'pencil', retired: 'neutral' } as const;

/** FR-30..FR-32: browse, search, filter, add and approve questions. */
export default function QuestionBank() {
  const user = useUser();
  const qc = useQueryClient();
  const [filters, setFilters] = useState({ topicId: '', difficulty: '', status: '', q: '' });
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);

  // Debounce the search box so each keystroke doesn't hit the API.
  useEffect(() => {
    const t = setTimeout(() => {
      setFilters((f) => ({ ...f, q: search }));
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const topics = useQuery({ queryKey: ['topics'], queryFn: () => api.get<TopicDto[]>('/topics') });
  const list = useQuery({
    queryKey: ['questions', filters, page],
    queryFn: () =>
      api.get<Paginated<QuestionDto>>(`/questions${qs({ ...filters, page, pageSize: 20 })}`),
    placeholderData: keepPreviousData,
  });
  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: QuestionStatus }) =>
      api.patch<QuestionDto>(`/questions/${id}/status`, { status }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['questions'] }),
  });

  const setFilter = (k: keyof typeof filters) => (e: { target: { value: string } }) => {
    setFilters((f) => ({ ...f, [k]: e.target.value }));
    setPage(1);
  };
  const filtered = Boolean(filters.topicId || filters.difficulty || filters.status || filters.q);

  return (
    <>
      <PageHeader
        eyebrow="Teaching"
        title="Question bank"
        subtitle="Only approved questions are served to students. AI-written questions arrive as drafts."
        actions={
          user.role === 'teacher' && <Button onClick={() => setAdding(true)}>Add question</Button>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
        <Input
          label="Search"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Words in the question"
        />
        <Select label="Topic" value={filters.topicId} onChange={setFilter('topicId')}>
          <option value="">All topics</option>
          {topics.data?.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
        <Select label="Level" value={filters.difficulty} onChange={setFilter('difficulty')}>
          <option value="">Any</option>
          {[1, 2, 3, 4, 5].map((d) => (
            <option key={d} value={d}>
              {d} · {DIFFICULTY_LABELS[d]}
            </option>
          ))}
        </Select>
        <Select label="Status" value={filters.status} onChange={setFilter('status')}>
          <option value="">Any</option>
          <option value="draft">Draft</option>
          <option value="approved">Approved</option>
          <option value="retired">Retired</option>
        </Select>
      </div>

      {setStatus.isError && (
        <div className="mb-4">
          <Alert tone="wrong">{errorMessage(setStatus.error)}</Alert>
        </div>
      )}

      {list.isError ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} />
      ) : list.isPending ? (
        <LoadingBlock />
      ) : list.data.items.length === 0 ? (
        <EmptyState
          title={filtered ? 'No questions match' : 'The bank is empty'}
          description={
            filtered ? 'Try another search or clear a filter.' : 'Add a question to get started.'
          }
        />
      ) : (
        <Panel>
          <TableWrap minWidth={760}>
            <thead>
              <tr>
                <Th>Question</Th>
                <Th>Topic</Th>
                <Th className="text-right">Lvl</Th>
                <Th>Key</Th>
                <Th>Status</Th>
                <Th>
                  <span className="sr-only">Actions</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {list.data.items.map((q) => (
                <tr key={q.id}>
                  <Td className="max-w-md">
                    {q.body}
                    {q.source === 'ai' && (
                      <span className="ml-2">
                        <Tag tone="pencil">AI draft</Tag>
                      </span>
                    )}
                  </Td>
                  <Td className="whitespace-nowrap text-ink-2">{q.topicName}</Td>
                  <Td className="text-right font-mono">{q.difficulty}</Td>
                  <Td className="font-mono">{q.correctAnswer}</Td>
                  <Td>
                    <Status tone={STATUS_TONE[q.status]}>{q.status}</Status>
                  </Td>
                  <Td className="whitespace-nowrap text-right">
                    {q.status !== 'approved' && (
                      <Button
                        size="sm"
                        variant="quiet"
                        onClick={() => setStatus.mutate({ id: q.id, status: 'approved' })}
                      >
                        Approve
                      </Button>
                    )}
                    {q.status !== 'retired' && (
                      <Button
                        size="sm"
                        variant="quiet"
                        onClick={() => setStatus.mutate({ id: q.id, status: 'retired' })}
                      >
                        Retire
                      </Button>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
          <Pager
            page={list.data.page}
            pageSize={list.data.pageSize}
            total={list.data.total}
            onPage={setPage}
          />
        </Panel>
      )}
      <AddQuestionModal open={adding} onClose={() => setAdding(false)} topics={topics.data ?? []} />
    </>
  );
}

const EMPTY = {
  topicId: '',
  difficulty: '2',
  type: 'numeric' as 'numeric' | 'multiple_choice',
  body: '',
  options: '',
  correctAnswer: '',
  explanation: '',
};

function AddQuestionModal({
  open,
  onClose,
  topics,
}: {
  open: boolean;
  onClose: () => void;
  topics: TopicDto[];
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const create = useMutation({
    mutationFn: (body: unknown) => api.post<QuestionDto>('/questions', body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['questions'] });
      setForm(EMPTY);
      onClose();
    },
    onError: (err) => err instanceof ApiRequestError && setErrors(err.fieldErrors()),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const payload = {
      topicId: form.topicId,
      difficulty: Number(form.difficulty),
      type: form.type,
      body: form.body,
      correctAnswer: form.correctAnswer,
      explanation: form.explanation,
      ...(form.type === 'multiple_choice'
        ? {
            options: form.options
              .split('\n')
              .map((o) => o.trim())
              .filter(Boolean),
          }
        : {}),
    };
    const parsed = createQuestionSchema.safeParse(payload);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setErrors({});
    create.mutate(parsed.data);
  };
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Modal title="Add a question" open={open} onClose={onClose}>
      <form className="space-y-4" onSubmit={onSubmit} noValidate>
        <div className="grid gap-3 sm:grid-cols-3">
          <Select
            label="Topic"
            value={form.topicId}
            onChange={set('topicId')}
            error={errors.topicId}
          >
            <option value="">Choose…</option>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
          <Select label="Level" value={form.difficulty} onChange={set('difficulty')}>
            {[1, 2, 3, 4, 5].map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </Select>
          <Select label="Type" value={form.type} onChange={set('type')}>
            <option value="numeric">Numeric</option>
            <option value="multiple_choice">Multiple choice</option>
          </Select>
        </div>
        <TextArea label="Question" value={form.body} onChange={set('body')} error={errors.body} />
        {form.type === 'multiple_choice' && (
          <TextArea
            label="Options"
            hint="One per line."
            value={form.options}
            onChange={set('options')}
            error={errors.options}
            rows={4}
          />
        )}
        <Input
          label="Answer key"
          value={form.correctAnswer}
          onChange={set('correctAnswer')}
          error={errors.correctAnswer}
          className="[&_input]:font-mono"
          hint={
            form.type === 'multiple_choice'
              ? 'Must match one option exactly.'
              : 'A number or fraction, e.g. 3/4.'
          }
        />
        <TextArea
          label="Worked explanation"
          hint="Shown to students after they answer."
          value={form.explanation}
          onChange={set('explanation')}
          error={errors.explanation}
        />
        {create.isError && <Alert tone="wrong">{errorMessage(create.error)}</Alert>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={create.isPending}>
            Add question
          </Button>
        </div>
      </form>
    </Modal>
  );
}
