import { useEffect, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ROLES, type Paginated, type Role, type UserDto } from '@learnloop/shared';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  LoadingBlock,
  PageHeader,
  Pager,
  Select,
  TableWrap,
  Td,
  Th,
} from '../../components/ui';
import { api, errorMessage, qs } from '../../lib/api';
import { useUser } from '../../lib/auth';
import { shortDate } from '../../lib/format';

/** FR-40: list users, change roles, disable accounts. */
export default function UsersPage() {
  const me = useUser();
  const qc = useQueryClient();
  const [role, setRole] = useState('');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => {
      setQ(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const list = useQuery({
    queryKey: ['admin-users', role, q, page],
    queryFn: () =>
      api.get<Paginated<UserDto>>(`/admin/users${qs({ role, q, page, pageSize: 20 })}`),
    placeholderData: keepPreviousData,
  });
  const update = useMutation({
    mutationFn: ({ id, ...body }: { id: string; role?: Role; disabled?: boolean }) =>
      api.patch<UserDto>(`/admin/users/${id}`, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-users'] });
      void qc.invalidateQueries({ queryKey: ['audit'] });
    },
  });

  return (
    <>
      <PageHeader
        title="Users"
        subtitle="Role changes and account status are recorded in the audit log."
      />
      <Card>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name or email"
          />
          <Select
            label="Role"
            value={role}
            onChange={(e) => {
              setRole(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All roles</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
        </div>
        {update.isError && (
          <div className="mt-4">
            <Alert tone="danger">{errorMessage(update.error)}</Alert>
          </div>
        )}
        <div className="mt-6">
          {list.isError ? (
            <ErrorState error={list.error} onRetry={() => void list.refetch()} />
          ) : list.isPending ? (
            <LoadingBlock />
          ) : list.data.items.length === 0 ? (
            <EmptyState title="No users match" />
          ) : (
            <>
              <TableWrap>
                <thead>
                  <tr>
                    <Th>Name</Th>
                    <Th>Email</Th>
                    <Th>Role</Th>
                    <Th>Status</Th>
                    <Th>Joined</Th>
                    <Th>
                      <span className="sr-only">Actions</span>
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {list.data.items.map((u) => {
                    const self = u.id === me.id;
                    return (
                      <tr key={u.id}>
                        <Td className="font-medium">
                          {u.displayName}
                          {self && <span className="ml-1 text-xs text-ink-faint">(you)</span>}
                        </Td>
                        <Td className="text-ink-muted">{u.email}</Td>
                        <Td>
                          <label className="sr-only" htmlFor={`role-${u.id}`}>
                            Role for {u.displayName}
                          </label>
                          <select
                            id={`role-${u.id}`}
                            value={u.role}
                            disabled={self || update.isPending}
                            onChange={(e) =>
                              update.mutate({ id: u.id, role: e.target.value as Role })
                            }
                            className="h-8 rounded-md border border-line bg-white px-2 text-sm"
                          >
                            {ROLES.map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </select>
                        </Td>
                        <Td>
                          {u.disabled ? (
                            <Badge tone="danger">Disabled</Badge>
                          ) : (
                            <Badge tone="success">Active</Badge>
                          )}
                        </Td>
                        <Td className="whitespace-nowrap text-ink-muted">
                          {shortDate(u.createdAt)}
                        </Td>
                        <Td>
                          {!self && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => update.mutate({ id: u.id, disabled: !u.disabled })}
                            >
                              {u.disabled ? 'Enable' : 'Disable'}
                            </Button>
                          )}
                        </Td>
                      </tr>
                    );
                  })}
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
