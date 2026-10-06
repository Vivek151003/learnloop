import { useEffect, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ROLES, type Paginated, type Role, type UserDto } from '@learnloop/shared';
import {
  Alert,
  Button,
  EmptyState,
  ErrorState,
  Input,
  LoadingBlock,
  PageHeader,
  Pager,
  Panel,
  Select,
  Status,
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
        eyebrow="Administration"
        title="Users"
        subtitle="Role changes and disabled accounts take effect on the user’s next request and are written to the audit log."
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
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
        <div className="mb-4">
          <Alert tone="wrong">{errorMessage(update.error)}</Alert>
        </div>
      )}
      {list.isError ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} />
      ) : list.isPending ? (
        <LoadingBlock />
      ) : list.data.items.length === 0 ? (
        <EmptyState title="No users match" description="Try another name, email or role." />
      ) : (
        <Panel>
          <TableWrap minWidth={720}>
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
                  <tr key={u.id} className={u.disabled ? 'text-ink-3' : undefined}>
                    <Td className="font-medium">
                      {u.displayName}
                      {self && <span className="ml-1.5 text-xs font-normal text-ink-3">(you)</span>}
                    </Td>
                    <Td className="font-mono text-xs">{u.email}</Td>
                    <Td>
                      <label className="sr-only" htmlFor={`role-${u.id}`}>
                        Role for {u.displayName}
                      </label>
                      <select
                        id={`role-${u.id}`}
                        value={u.role}
                        disabled={self || update.isPending}
                        onChange={(e) => update.mutate({ id: u.id, role: e.target.value as Role })}
                        className="h-8 rounded border border-rule-strong bg-paper-raised px-2 text-sm disabled:border-transparent disabled:bg-transparent"
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
                        <Status tone="wrong">Disabled</Status>
                      ) : (
                        <Status tone="right">Active</Status>
                      )}
                    </Td>
                    <Td className="whitespace-nowrap font-mono text-xs text-ink-3">
                      {shortDate(u.createdAt)}
                    </Td>
                    <Td className="text-right">
                      {!self && (
                        <Button
                          size="sm"
                          variant="quiet"
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
        </Panel>
      )}
    </>
  );
}
