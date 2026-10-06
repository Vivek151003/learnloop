import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import type { AuditLogDto, Paginated } from '@learnloop/shared';
import {
  Alert,
  Button,
  EmptyState,
  ErrorState,
  LoadingBlock,
  PageHeader,
  Pager,
  Panel,
  Select,
  TableWrap,
  Td,
  Th,
  cx,
} from '../../components/ui';
import { api, errorMessage, qs } from '../../lib/api';
import { dateTime } from '../../lib/format';

const ACTION_GROUPS = [
  { value: '', label: 'Everything' },
  { value: 'auth.', label: 'Sign-ins and sessions' },
  { value: 'user.', label: 'User changes' },
  { value: 'class.', label: 'Classes' },
  { value: 'question.', label: 'Questions' },
  { value: 'quiz.', label: 'Quizzes' },
  { value: 'assignment.', label: 'Assignments' },
];

const isAlarming = (action: string) => /failed|reuse|disabled|deleted/.test(action);

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
        eyebrow="Administration"
        title="Audit log"
        subtitle="Append-only. Each entry stores a hash of the one before it, so an edit anywhere breaks the chain."
        actions={
          <Button variant="secondary" loading={verify.isPending} onClick={() => verify.mutate()}>
            Verify chain
          </Button>
        }
      />
      {verify.isError && (
        <div className="mb-4">
          <Alert tone="wrong">{errorMessage(verify.error)}</Alert>
        </div>
      )}
      {verify.data && (
        <div className="mb-4">
          {verify.data.valid ? (
            <Alert tone="right">Chain intact: {verify.data.checked} entries checked.</Alert>
          ) : (
            <Alert tone="wrong">
              Chain broken at entry #{verify.data.brokenAtSeq}. Rows have been altered outside the
              app.
            </Alert>
          )}
        </div>
      )}
      <div className="mb-4 max-w-xs">
        <Select
          label="Show"
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
        </Select>
      </div>
      {list.isError ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} />
      ) : list.isPending ? (
        <LoadingBlock />
      ) : list.data.items.length === 0 ? (
        <EmptyState
          title="No entries"
          description="Nothing has been recorded for this filter yet."
        />
      ) : (
        <Panel>
          <TableWrap minWidth={760}>
            <thead>
              <tr>
                <Th>When</Th>
                <Th>Actor</Th>
                <Th>Action</Th>
                <Th>Target</Th>
                <Th>Details</Th>
              </tr>
            </thead>
            <tbody className="font-mono text-xs">
              {list.data.items.map((e) => (
                <tr key={e.id}>
                  <Td className="whitespace-nowrap text-ink-3">{dateTime(e.createdAt)}</Td>
                  <Td className="text-ink-2">
                    {e.actorEmail ?? (e.actorId ? 'deleted user' : 'anonymous')}
                  </Td>
                  <Td
                    className={cx(
                      'whitespace-nowrap font-medium',
                      isAlarming(e.action) ? 'text-incorrect' : 'text-ink',
                    )}
                  >
                    {e.action}
                  </Td>
                  <Td className="text-ink-3">{e.target ?? '—'}</Td>
                  <Td className="max-w-xs break-all text-ink-3">
                    {Object.keys(e.metadata).length ? JSON.stringify(e.metadata) : '—'}
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
    </>
  );
}
