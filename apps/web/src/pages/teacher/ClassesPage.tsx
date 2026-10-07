import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Plus, Users } from 'lucide-react';
import type { ClassDto } from '@learnloop/shared';
import {
  Alert,
  Badge,
  Button,
  Card,
  Code,
  EmptyState,
  ErrorState,
  IconButton,
  Input,
  LoadingBlock,
  Modal,
  PageHeader,
  SearchInput,
  SortTh,
  TableWrap,
  Td,
  Th,
  sortRows,
} from '../../components/ui';
import { useToast } from '../../components/toast';
import { api, errorMessage } from '../../lib/api';
import { useUser } from '../../lib/auth';
import { copyText } from '../../lib/clipboard';
import { shortDate } from '../../lib/format';
import { useSort } from '../../lib/useSort';

type SortKey = 'name' | 'students' | 'created';

export default function ClassesPage() {
  const user = useUser();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const sort = useSort<SortKey>('name');
  const q = useQuery({ queryKey: ['classes'], queryFn: () => api.get<ClassDto[]>('/classes') });

  const rows = sortRows(
    (q.data ?? []).filter((c) => c.name.toLowerCase().includes(search.trim().toLowerCase())),
    (c) => (sort.key === 'name' ? c.name : sort.key === 'students' ? c.studentCount : c.createdAt),
    sort.dir,
  );

  const copy = async (code: string) => {
    if (await copyText(code)) toast.success(`Copied code ${code}`);
    else toast.error('Couldn’t copy. Select the code and copy it manually.');
  };

  return (
    <>
      <PageHeader
        title="Classes"
        description="Share a class code with students, then assign practice."
        actions={
          user.role === 'teacher' && (
            <Button icon={Plus} onClick={() => setOpen(true)}>
              New class
            </Button>
          )
        }
      />
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : q.isPending ? (
        <LoadingBlock />
      ) : q.data.length === 0 ? (
        <Card>
          <EmptyState
            icon={Users}
            title="No classes yet"
            description="Create a class to get a code your students can join with."
            action={
              <Button icon={Plus} onClick={() => setOpen(true)}>
                Create a class
              </Button>
            }
          />
        </Card>
      ) : (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-5 py-3">
            <SearchInput
              label="Search classes"
              placeholder="Search classes"
              value={search}
              onChange={setSearch}
              className="w-full sm:w-72"
            />
            <span className="text-sm text-gray-500">
              {rows.length} {rows.length === 1 ? 'class' : 'classes'}
            </span>
          </div>
          {rows.length === 0 ? (
            <EmptyState title="No classes match your search" />
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <SortTh
                    active={sort.key === 'name'}
                    dir={sort.dir}
                    onSort={() => sort.toggle('name')}
                  >
                    Class
                  </SortTh>
                  {user.role === 'admin' && <Th>Teacher</Th>}
                  <SortTh
                    active={sort.key === 'students'}
                    dir={sort.dir}
                    onSort={() => sort.toggle('students')}
                    align="right"
                  >
                    Students
                  </SortTh>
                  <Th>Class code</Th>
                  <SortTh
                    active={sort.key === 'created'}
                    dir={sort.dir}
                    onSort={() => sort.toggle('created')}
                  >
                    Created
                  </SortTh>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <Td>
                      <Link
                        to={`/teacher/classes/${c.id}`}
                        className="font-medium text-gray-900 hover:text-brand-700 hover:underline"
                      >
                        {c.name}
                      </Link>
                    </Td>
                    {user.role === 'admin' && <Td className="text-gray-600">{c.teacherName}</Td>}
                    <Td className="text-right tabular">{c.studentCount}</Td>
                    <Td>
                      {c.joinCode ? (
                        <span className="flex items-center gap-1">
                          <Code>{c.joinCode}</Code>
                          <IconButton
                            icon={Copy}
                            label={`Copy code ${c.joinCode}`}
                            onClick={() => void copy(c.joinCode!)}
                          />
                        </span>
                      ) : (
                        '–'
                      )}
                    </Td>
                    <Td className="whitespace-nowrap text-gray-600">{shortDate(c.createdAt)}</Td>
                    <Td>
                      {c.archived ? <Badge>Archived</Badge> : <Badge tone="success">Active</Badge>}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </Card>
      )}
      <CreateClassModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function CreateClassModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [name, setName] = useState('');
  const create = useMutation({
    mutationFn: () => api.post<ClassDto>('/classes', { name }),
    onSuccess: (c) => {
      void qc.invalidateQueries({ queryKey: ['classes'] });
      toast.success(`Class created. Code: ${c.joinCode}`);
      setName('');
      onClose();
    },
  });
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim()) create.mutate();
  };
  return (
    <Modal
      title="New class"
      description="A class code is generated automatically."
      open={open}
      onClose={onClose}
    >
      <form className="space-y-4" onSubmit={onSubmit}>
        <Input
          label="Class name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Grade 7 Maths, period 3"
          maxLength={80}
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
