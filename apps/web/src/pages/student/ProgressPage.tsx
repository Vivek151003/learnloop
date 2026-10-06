import { useQuery } from '@tanstack/react-query';
import type { ProgressDto } from '@learnloop/shared';
import { ErrorState, LoadingBlock, PageHeader } from '../../components/ui';
import { ProgressView } from '../../components/ProgressView';
import { api } from '../../lib/api';
import { useUser } from '../../lib/auth';

export default function ProgressPage() {
  const user = useUser();
  const q = useQuery({
    queryKey: ['progress', user.id],
    queryFn: () => api.get<ProgressDto>(`/students/${user.id}/progress`),
  });
  return (
    <>
      <PageHeader
        eyebrow="Progress"
        title="How you’re doing"
        subtitle="Mastery rises with correct answers and dips with misses; recent work counts most."
      />
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : q.isPending ? (
        <LoadingBlock />
      ) : (
        <ProgressView progress={q.data} />
      )}
    </>
  );
}
