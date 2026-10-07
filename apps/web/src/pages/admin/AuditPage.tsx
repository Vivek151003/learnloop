import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { ScrollText, ShieldCheck } from 'lucide-react';
import type { AuditLogDto, Paginated } from '@learnloop/shared';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  FilterSelect,
  LoadingBlock,
  PageHeader,
  Pager,
  TableWrap,
  Td,
  Th,
} from '../../components/ui';
import { api, errorMessage, qs } from '../../lib/api';
import { dateTime } from '../../lib/format';

const ACTION_GROUPS = [
  { value: '', label: 'All activity' },
  { value: 'auth.', label: 'Sign-ins and sessions' },
  { value: 'user.', label: 'User changes' },
  { value: 'class.', label: 'Classes' },
  { value: 'question.', label: 'Questions' },
  { value: 'quiz.', label: 'Quizzes' },
  { value: 'assignment.', label: 'Assignments' },
];

const tone = (action: string) =>
  /failed|reuse|disabled|deleted/.test(action)
    ? 'danger'
    : action.startsWith('auth.')
      ? 'neutral'
      : 'brand';

/** FR-41: the tamper-evident audit log, with a chain integrity check. */
export default function AuditPage() {
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const list = useQuery({
    queryKey: ['audit', action, page],
    queryFn: () =>
      api.get<Paginated<AuditLogDto>>(`/admin/audit${qs({ action, page, pageSize: 25 })}`),
    placeholderData: keepPreviousData,
  });
  const verify = useMutation({
    mutationFn: () =>
      api.get<{ valid: boolean; checked: number; brokenAtSeq?: number }>('/admin/audit/verify'),
  });

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Append-only. Each entry includes a hash of the one before it, so any edit breaks the chain."
        actions={
          <Button
            variant="secondary"
            icon={ShieldCheck}
            loading={verify.isPending}
            onClick={() => verify.mutate()}
          >
            Verify integrity
          </Button>
        }
      />
      {verify.isError && (
        <div className="mb-4">
          <Alert tone="danger">{errorMessage(verify.error)}</Alert>
        </div>
      )}
      {verify.data && (
        <div className="mb-4">
          {verify.data.valid ? (
            <Alert tone="success">
              Chain intact. All {verify.data.checked} entries were verified.
            </Alert>
          ) : (
            <Alert tone="danger">
              Chain broken at entry #{verify.data.brokenAtSeq}. Rows were changed outside the app.
            </Alert>
          )}
        </div>
      )}
      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 px-5 py-3">
          <FilterSelect
            label="Filter by activity"
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setPage(1);
            }}
          >
            {ACTION_GROUPS.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </FilterSelect>
          {list.data && (
            <span className="ml-auto text-sm text-gray-500">{list.data.total} entries</span>
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
            icon={ScrollText}
            title="No entries"
            description="Nothing has been recorded for this filter yet."
          />
        ) : (
          <>
            <TableWrap minWidth={780}>
              <thead>
                <tr>
                  <Th>Time</Th>
                  <Th>Actor</Th>
                  <Th>Action</Th>
                  <Th>Target</Th>
                  <Th>Details</Th>
                </tr>
              </thead>
              <tbody>
                {list.data.items.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <Td className="whitespace-nowrap text-gray-500">{dateTime(e.createdAt)}</Td>
                    <Td className="text-gray-700">
                      {e.actorEmail ?? (e.actorId ? 'Deleted user' : 'Anonymous')}
                    </Td>
                    <Td>
                      <Badge tone={tone(e.action)}>{e.action}</Badge>
                    </Td>
                    <Td className="font-mono text-xs text-gray-500">{e.target ?? '–'}</Td>
                    <Td className="max-w-xs break-all font-mono text-xs text-gray-500">
                      {Object.keys(e.metadata).length ? JSON.stringify(e.metadata) : '–'}
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
    </>
  );
}
