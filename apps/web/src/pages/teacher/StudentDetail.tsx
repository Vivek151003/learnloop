import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { CircleCheck, CircleX, ListChecks } from 'lucide-react';
import type { AttemptDto, Paginated, ProgressDto } from '@learnloop/shared';
import {
  Avatar,
  Badge,
  Card,
  CardHeader,
  EmptyState,
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
      <PageHeader
        breadcrumbs={[{ label: 'Classes', to: '/teacher' }, { label: progress.data.displayName }]}
        title={
          <span className="flex items-center gap-3">
            <Avatar name={progress.data.displayName} size="lg" />
            {progress.data.displayName}
          </span>
        }
        description="Progress and every answer this student has given."
      />
      <ProgressView progress={progress.data} />

      <Card className="mt-6">
        <CardHeader
          title="Answer history"
          description={attempts.data ? `${attempts.data.total} answers, newest first` : undefined}
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
          <EmptyState
            icon={ListChecks}
            title="No answers yet"
            description="Answers appear here as soon as this student practises."
          />
        ) : (
          <>
            <TableWrap minWidth={760}>
              <thead>
                <tr>
                  <Th>When</Th>
                  <Th>Question</Th>
                  <Th>Answer</Th>
                  <Th>Result</Th>
                  <Th className="text-right">Level</Th>
                  <Th className="text-right">Time</Th>
                </tr>
              </thead>
              <tbody>
                {attempts.data.items.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <Td className="whitespace-nowrap text-gray-500">{dateTime(a.createdAt)}</Td>
                    <Td className="max-w-sm">
                      <span className="line-clamp-2 text-gray-900">{a.questionBody}</span>
                      <span className="text-xs text-gray-500">{a.topicName}</span>
                    </Td>
                    <Td className="tabular">
                      {a.answer}
                      {!a.correct && (
                        <span className="block text-xs text-gray-500">
                          Correct: {a.correctAnswer}
                        </span>
                      )}
                    </Td>
                    <Td>
                      {a.correct ? (
                        <Badge tone="success" icon={CircleCheck}>
                          Correct
                        </Badge>
                      ) : (
                        <Badge tone="danger" icon={CircleX}>
                          Incorrect
                        </Badge>
                      )}
                    </Td>
                    <Td className="text-right tabular">{a.difficulty}</Td>
                    <Td className="text-right tabular text-gray-500">
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
      </Card>
    </>
  );
}
