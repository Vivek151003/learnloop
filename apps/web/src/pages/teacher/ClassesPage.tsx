import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ClassDto } from '@learnloop/shared';
import {
  Alert,
  Button,
  Code,
  EmptyState,
  ErrorState,
  Input,
  LoadingBlock,
  Modal,
  PageHeader,
  Panel,
  Status,
  TableWrap,
  Td,
  Th,
} from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { useUser } from '../../lib/auth';
import { shortDate } from '../../lib/format';

export default function ClassesPage() {
  const user = useUser();
  const [open, setOpen] = useState(false);
  const q = useQuery({ queryKey: ['classes'], queryFn: () => api.get<ClassDto[]>('/classes') });
  const active = q.data?.filter((c) => !c.archived).length ?? 0;

  return (
    <>
      <PageHeader
        eyebrow="Teaching"
        title="Classes"
        subtitle={q.data ? `${active} active · students join with the class code` : undefined}
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
          description="Create a class to get a code your students can join with."
          action={<Button onClick={() => setOpen(true)}>Create a class</Button>}
        />
      ) : (
        <Panel>
          <TableWrap>
            <thead>
              <tr>
                <Th>Class</Th>
                {user.role === 'admin' && <Th>Teacher</Th>}
                <Th className="text-right">Students</Th>
                <Th>Code</Th>
                <Th>Created</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {q.data.map((c) => (
                <tr key={c.id} className="group hover:bg-paper">
                  <Td>
                    <Link
                      to={`/teacher/classes/${c.id}`}
                      className="font-medium underline-offset-[3px] group-hover:underline"
                    >
                      {c.name}
                    </Link>
                  </Td>
                  {user.role === 'admin' && <Td className="text-ink-2">{c.teacherName}</Td>}
                  <Td className="text-right font-mono tabular-nums">{c.studentCount}</Td>
                  <Td>{c.joinCode ? <Code>{c.joinCode}</Code> : '—'}</Td>
                  <Td className="font-mono text-xs text-ink-3">{shortDate(c.createdAt)}</Td>
                  <Td>
                    {c.archived ? (
                      <Status tone="neutral">Archived</Status>
                    ) : (
                      <Status tone="right">Active</Status>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        </Panel>
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
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Grade 7 Maths, period 3"
          hint="A join code is generated for you."
          maxLength={80}
        />
        {create.isError && <Alert tone="wrong">{errorMessage(create.error)}</Alert>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="quiet" onClick={onClose}>
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
