import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import type { AuditLogDto, Paginated } from '@learnloop/shared';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingBlock,
  PageHeader,
  Pager,
  Select,
  TableWrap,
  Td,
  Th,
} from '../../components/ui';
import { api, errorMessage, qs } from '../../lib/api';
import { dateTime } from '../../lib/format';

const ACTION_GROUPS = [
  { value: '', label: 'All actions' },
  { value: 'auth.', label: 'Sign-ins and sessions' },
  { value: 'user.', label: 'User changes' },
  { value: 'class.', label: 'Classes' },
  { value: 'question.', label: 'Questions' },
  { value: 'quiz.', label: 'Quizzes' },
  { value: 'assignment.', label: 'Assignments' },
];

const tone = (action: string) =>
  action.includes('failed') ||
  action.includes('reuse') ||
  action.includes('disabled') ||
  action.includes('deleted')
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
        subtitle="Append-only. Each entry is hash-chained to the one before it."
        actions={
          <Button variant="secondary" loading={verify.isPending} onClick={() => verify.mutate()}>
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
            <Alert tone="success">Chain intact: all {verify.data.checked} entries verified.</Alert>
          ) : (
            <Alert tone="danger">
              Chain broken at entry #{verify.data.brokenAtSeq}. The log may have been tampered with.
            </Alert>
          )}
        </div>
      )}
      <Card>
        <div className="max-w-xs">
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
        <div className="mt-6">
          {list.isError ? (
            <ErrorState error={list.error} onRetry={() => void list.refetch()} />
          ) : list.isPending ? (
            <LoadingBlock />
          ) : list.data.items.length === 0 ? (
            <EmptyState title="No entries yet" />
          ) : (
            <>
              <TableWrap>
                <thead>
                  <tr>
                    <Th>When</Th>
                    <Th>Actor</Th>
                    <Th>Action</Th>
                    <Th>Target</Th>
                    <Th>Details</Th>
                  </tr>
                </thead>
                <tbody>
                  {list.data.items.map((e) => (
                    <tr key={e.id}>
                      <Td className="whitespace-nowrap text-ink-muted">{dateTime(e.createdAt)}</Td>
                      <Td className="text-ink-muted">
                        {e.actorEmail ?? (e.actorId ? 'Deleted user' : 'Anonymous')}
                      </Td>
                      <Td>
                        <Badge tone={tone(e.action)}>{e.action}</Badge>
                      </Td>
                      <Td className="font-mono text-xs text-ink-muted">{e.target ?? '—'}</Td>
                      <Td className="font-mono text-xs text-ink-muted">
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
            </>
          )}
        </div>
      </Card>
    </>
  );
}
