import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ClassDto } from '@learnloop/shared';
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Input,
  LoadingBlock,
  Modal,
  PageHeader,
} from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { useUser } from '../../lib/auth';

export default function ClassesPage() {
  const user = useUser();
  const [open, setOpen] = useState(false);
  const q = useQuery({ queryKey: ['classes'], queryFn: () => api.get<ClassDto[]>('/classes') });

  return (
    <>
      <PageHeader
        title="Classes"
        subtitle="Share a join code with students, then assign practice."
        actions={
          user.role === 'teacher' && <Button onClick={() => setOpen(true)}>New class</Button>
        }
      />
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : q.isPending ? (
        <LoadingBlock />
      ) : q.data.length === 0 ? (
        <EmptyState
          title="No classes yet"
          description="Create your first class to get a join code for your students."
          action={<Button onClick={() => setOpen(true)}>Create a class</Button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {q.data.map((c) => (
            <Link
              key={c.id}
              to={`/teacher/classes/${c.id}`}
              className="block rounded-card border border-line bg-white p-5 shadow-card transition hover:border-brand-200 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-semibold text-ink">{c.name}</h2>
                {c.archived && <Badge>Archived</Badge>}
              </div>
              <p className="mt-1 text-sm text-ink-muted">
                {c.studentCount} student{c.studentCount === 1 ? '' : 's'}
                {user.role === 'admin' ? ` · ${c.teacherName}` : ''}
              </p>
              {c.joinCode && (
                <p className="mt-4 text-sm text-ink-muted">
                  Join code{' '}
                  <span className="ml-1 rounded bg-slate-100 px-2 py-0.5 font-mono font-semibold tracking-wider text-ink">
                    {c.joinCode}
                  </span>
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
      <CreateClassModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function CreateClassModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const create = useMutation({
    mutationFn: () => api.post<ClassDto>('/classes', { name }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['classes'] });
      setName('');
      onClose();
    },
  });
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim()) create.mutate();
  };
  return (
    <Modal title="New class" open={open} onClose={onClose}>
      <form className="space-y-4" onSubmit={onSubmit}>
        <Input
          label="Class name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Grade 7 Maths, Period 3"
          maxLength={80}
          autoFocus
        />
        {create.isError && <Alert tone="danger">{errorMessage(create.error)}</Alert>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={create.isPending} disabled={!name.trim()}>
            Create class
          </Button>
        </div>
      </form>
    </Modal>
  );
}
