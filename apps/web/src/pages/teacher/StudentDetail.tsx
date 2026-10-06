import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { AttemptDto, Paginated, ProgressDto } from '@learnloop/shared';
import {
  ErrorState,
  LoadingBlock,
  PageHeader,
  Pager,
  Panel,
  PanelHeader,
  Status,
  TableWrap,
  Td,
  Th,
} from '../../components/ui';
import { ProgressView } from '../../components/ProgressView';
import { api, qs } from '../../lib/api';
import { dateTime } from '../../lib/format';

/** FR-24: a student's progress plus attempt history with per-question results. */
export default function StudentDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const progress = useQuery({
    queryKey: ['progress', id],
    queryFn: () => api.get<ProgressDto>(`/students/${id}/progress`),
  });
  const attempts = useQuery({
    queryKey: ['attempts', id, page],
    queryFn: () =>
      api.get<Paginated<AttemptDto>>(`/students/${id}/attempts${qs({ page, pageSize: 15 })}`),
    placeholderData: keepPreviousData,
  });

  if (progress.isError)
    return <ErrorState error={progress.error} onRetry={() => void progress.refetch()} />;
  if (progress.isPending) return <LoadingBlock rows={4} />;

  return (
    <>
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="mb-3 text-sm text-ink-3 hover:text-ink"
      >
        <span aria-hidden="true">←</span> Back
      </button>
      <PageHeader eyebrow="Student" title={progress.data.displayName} />
      <ProgressView progress={progress.data} />

      <Panel as="section" className="mt-8">
        <PanelHeader
          title="Every answer"
          meta={attempts.data ? `${attempts.data.total} in total` : undefined}
        />
        {attempts.isError ? (
          <div className="p-5">
            <ErrorState error={attempts.error} onRetry={() => void attempts.refetch()} />
          </div>
        ) : attempts.isPending ? (
          <div className="p-5">
            <LoadingBlock rows={3} />
          </div>
        ) : attempts.data.items.length === 0 ? (
          <p className="px-5 py-6 text-sm text-ink-3">No answers yet.</p>
        ) : (
          <>
            <TableWrap minWidth={720}>
              <thead>
                <tr>
                  <Th>When</Th>
                  <Th>Question</Th>
                  <Th>Answer</Th>
                  <Th>Mark</Th>
                  <Th className="text-right">Lvl</Th>
                  <Th className="text-right">Time</Th>
                </tr>
              </thead>
              <tbody>
                {attempts.data.items.map((a) => (
                  <tr key={a.id}>
                    <Td className="whitespace-nowrap font-mono text-xs text-ink-3">
                      {dateTime(a.createdAt)}
                    </Td>
                    <Td className="max-w-sm">
                      <span className="line-clamp-2">{a.questionBody}</span>
                      <span className="text-xs text-ink-3">{a.topicName}</span>
                    </Td>
                    <Td className="font-mono">
                      {a.answer}
                      {!a.correct && (
                        <span className="block text-xs text-ink-3">key: {a.correctAnswer}</span>
                      )}
                    </Td>
                    <Td>
                      {a.correct ? (
                        <Status tone="right">Right</Status>
                      ) : (
                        <Status tone="wrong">Wrong</Status>
                      )}
                    </Td>
                    <Td className="text-right font-mono">{a.difficulty}</Td>
                    <Td className="text-right font-mono text-xs text-ink-3">
                      {Math.round(a.timeMs / 1000)}s
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
            <Pager
              page={attempts.data.page}
              pageSize={attempts.data.pageSize}
              total={attempts.data.total}
              onPage={setPage}
            />
          </>
        )}
      </Panel>
    </>
  );
}
