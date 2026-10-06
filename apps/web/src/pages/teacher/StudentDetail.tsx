import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { AttemptDto, Paginated, ProgressDto } from '@learnloop/shared';
import {
  Badge,
  Card,
  ErrorState,
  LoadingBlock,
  PageHeader,
  Pager,
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
  if (progress.isPending) return <LoadingBlock />;

  return (
    <>
      <div className="mb-2 text-sm">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-brand-700 hover:underline"
        >
          ← Back
        </button>
      </div>
      <PageHeader
        title={progress.data.displayName}
        subtitle="Student progress and attempt history"
      />
      <ProgressView progress={progress.data} />
      <Card className="mt-6">
        <h2 className="mb-3 font-semibold text-ink">Attempt history</h2>
        {attempts.isError ? (
          <ErrorState error={attempts.error} onRetry={() => void attempts.refetch()} />
        ) : attempts.isPending ? (
          <LoadingBlock rows={3} />
        ) : attempts.data.items.length === 0 ? (
          <p className="text-sm text-ink-muted">No attempts yet.</p>
        ) : (
          <>
            <TableWrap>
              <thead>
                <tr>
                  <Th>When</Th>
                  <Th>Question</Th>
                  <Th>Answer</Th>
                  <Th>Result</Th>
                  <Th>Level</Th>
                </tr>
              </thead>
              <tbody>
                {attempts.data.items.map((a) => (
                  <tr key={a.id}>
                    <Td className="whitespace-nowrap text-ink-muted">{dateTime(a.createdAt)}</Td>
                    <Td>
                      <span className="line-clamp-2">{a.questionBody}</span>
                      <span className="text-xs text-ink-faint">{a.topicName}</span>
                    </Td>
                    <Td className="tabular-nums">
                      {a.answer}
                      {!a.correct && (
                        <span className="block text-xs text-ink-faint">
                          Correct: {a.correctAnswer}
                        </span>
                      )}
                    </Td>
                    <Td>
                      {a.correct ? (
                        <Badge tone="success">Correct</Badge>
                      ) : (
                        <Badge tone="danger">Wrong</Badge>
                      )}
                    </Td>
                    <Td className="tabular-nums">{a.difficulty}</Td>
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
      </Card>
    </>
  );
}
