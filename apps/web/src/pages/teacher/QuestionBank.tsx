import { useEffect, useState, type FormEvent } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Check, Plus } from 'lucide-react';
import {
  createQuestionSchema,
  type Paginated,
  type QuestionDto,
  type QuestionStatus,
  type TopicDto,
} from '@learnloop/shared';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  FilterSelect,
  Input,
  LoadingBlock,
  Modal,
  PageHeader,
  Pager,
  SearchInput,
  Select,
  TableWrap,
  Td,
  TextArea,
  Th,
} from '../../components/ui';
import { useToast } from '../../components/toast';
import { ApiRequestError, api, errorMessage, qs } from '../../lib/api';
import { useUser } from '../../lib/auth';
import { DIFFICULTY_LABELS } from '../../lib/format';

const STATUS_TONE = { approved: 'success', draft: 'warning', retired: 'neutral' } as const;

/** FR-30..FR-32: browse, search, filter, add and approve questions. */
export default function QuestionBank() {
  const user = useUser();
  const qc = useQueryClient();
  const toast = useToast();
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
    onSuccess: (_q, v) => {
      void qc.invalidateQueries({ queryKey: ['questions'] });
      toast.success(v.status === 'approved' ? 'Question approved' : 'Question retired');
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const setFilter = (k: keyof typeof filters) => (e: { target: { value: string } }) => {
    setFilters((f) => ({ ...f, [k]: e.target.value }));
    setPage(1);
  };
  const filtered = Boolean(filters.topicId || filters.difficulty || filters.status || filters.q);

  return (
    <>
      <PageHeader
        title="Question bank"
        description="Only approved questions are shown to students. AI-written questions arrive as drafts."
        actions={
          user.role === 'teacher' && (
            <Button icon={Plus} onClick={() => setAdding(true)}>
              Add question
            </Button>
          )
        }
      />

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 px-5 py-3">
          <SearchInput
            label="Search questions"
            placeholder="Search questions"
            value={search}
            onChange={setSearch}
            className="w-full sm:w-72"
          />
          <FilterSelect
            label="Filter by topic"
            value={filters.topicId}
            onChange={setFilter('topicId')}
          >
            <option value="">All topics</option>
            {topics.data?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect
            label="Filter by level"
            value={filters.difficulty}
            onChange={setFilter('difficulty')}
          >
            <option value="">All levels</option>
            {[1, 2, 3, 4, 5].map((d) => (
              <option key={d} value={d}>
                Level {d} · {DIFFICULTY_LABELS[d]}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect
            label="Filter by status"
            value={filters.status}
            onChange={setFilter('status')}
          >
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="approved">Approved</option>
            <option value="retired">Retired</option>
          </FilterSelect>
          {list.data && (
            <span className="ml-auto text-sm text-gray-500">{list.data.total} questions</span>
          )}
        </div>

        {list.isError ? (
          <div className="p-5">
            <ErrorState error={list.error} onRetry={() => void list.refetch()} />
          </div>
        ) : list.isPending ? (
          <div className="p-5">
            <LoadingBlock />
          </div>
        ) : list.data.items.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title={filtered ? 'No questions match' : 'The question bank is empty'}
            description={
              filtered
                ? 'Try a different search or clear a filter.'
                : 'Add a question to get started.'
            }
          />
        ) : (
          <>
            <TableWrap minWidth={780}>
              <thead>
                <tr>
                  <Th>Question</Th>
                  <Th>Topic</Th>
                  <Th className="text-right">Level</Th>
                  <Th>Answer</Th>
                  <Th>Status</Th>
                  <Th>
                    <span className="sr-only">Actions</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {list.data.items.map((q) => (
                  <tr key={q.id} className="hover:bg-gray-50">
                    <Td className="max-w-md text-gray-900">
                      {q.body}
                      {q.source === 'ai' && (
                        <span className="ml-2">
                          <Badge tone="brand">AI-generated</Badge>
                        </span>
                      )}
                    </Td>
                    <Td className="whitespace-nowrap text-gray-600">{q.topicName}</Td>
                    <Td className="text-right tabular">{q.difficulty}</Td>
                    <Td className="tabular">{q.correctAnswer}</Td>
                    <Td>
                      <Badge tone={STATUS_TONE[q.status]}>
                        {q.status[0]!.toUpperCase() + q.status.slice(1)}
                      </Badge>
                    </Td>
                    <Td className="whitespace-nowrap text-right">
                      {q.status !== 'approved' && (
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={Check}
                          onClick={() => setStatus.mutate({ id: q.id, status: 'approved' })}
                        >
                          Approve
                        </Button>
                      )}
                      {q.status === 'approved' && (
                        <Button
                          size="sm"
                          variant="ghost"
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
          </>
        )}
      </Card>
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
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const create = useMutation({
    mutationFn: (body: unknown) => api.post<QuestionDto>('/questions', body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['questions'] });
      toast.success('Question added');
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
    <Modal
      title="Add a question"
      description="Questions you add are approved straight away."
      open={open}
      onClose={onClose}
      size="lg"
    >
      <form className="space-y-4" onSubmit={onSubmit} noValidate>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Select
            label="Topic"
            value={form.topicId}
            onChange={set('topicId')}
            error={errors.topicId}
          >
            <option value="">Select a topic</option>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
          <Select label="Level" value={form.difficulty} onChange={set('difficulty')}>
            {[1, 2, 3, 4, 5].map((d) => (
              <option key={d} value={d}>
                {d} · {DIFFICULTY_LABELS[d]}
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
            hint="One option per line."
            value={form.options}
            onChange={set('options')}
            error={errors.options}
            rows={4}
          />
        )}
        <Input
          label="Correct answer"
          value={form.correctAnswer}
          onChange={set('correctAnswer')}
          error={errors.correctAnswer}
          hint={
            form.type === 'multiple_choice'
              ? 'Must match one of the options exactly.'
              : 'A number or fraction, for example 3/4.'
          }
        />
        <TextArea
          label="Worked explanation"
          hint="Shown to students after they answer."
          value={form.explanation}
          onChange={set('explanation')}
          error={errors.explanation}
        />
        {create.isError && !Object.keys(errors).length && (
          <Alert tone="danger">{errorMessage(create.error)}</Alert>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
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
